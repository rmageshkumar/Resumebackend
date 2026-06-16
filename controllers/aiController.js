const { GoogleGenerativeAI } = require("@google/generative-ai");
const dotenv = require("dotenv");
const path = require("path");

dotenv.config({ path: path.join(__dirname, "..", ".env") });

const stripJsonFence = (value) =>
  value
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "");

const parseModelJson = (value) => {
  const cleaned = stripJsonFence(value);

  try {
    return JSON.parse(cleaned);
  } catch {
    const jsonStart = cleaned.indexOf("{");
    const jsonEnd = cleaned.lastIndexOf("}");

    if (jsonStart === -1 || jsonEnd === -1 || jsonEnd <= jsonStart) {
      throw new Error("AI response did not contain valid JSON.");
    }

    return JSON.parse(cleaned.slice(jsonStart, jsonEnd + 1));
  }
};

const createResumePrompt = (resumeText) => `
Extract structured resume data from the resume text below.

Return only valid JSON with this exact shape:
{
  "personalDetails": {
    "firstName": "",
    "lastName": "",
    "jobTitle": "",
    "address": "",
    "phone": "",
    "email": "",
    "summery": ""
  },
  "experience": [
    {
      "title": "",
      "companyName": "",
      "city": "",
      "state": "",
      "startDate": "",
      "endDate": "",
      "currentlyWorking": false,
      "workSummery": ""
    }
  ],
  "education": [
    {
      "universityName": "",
      "degree": "",
      "major": "",
      "startDate": "",
      "endDate": "",
      "description": ""
    }
  ],
  "skills": [
    {
      "name": "",
      "rating": 0
    }
  ]
}

Rules:
- Use empty strings for missing text fields.
- Use an empty array when a section is missing.
- Skill rating must be a number from 1 to 5.
- Do not include markdown, comments, or extra properties.

Resume text:
${resumeText}
`;

const SECTION_ALIASES = {
  summary: ["summary", "professional summary", "profile", "objective"],
  experience: [
    "experience",
    "work experience",
    "professional experience",
    "employment history",
    "work history",
  ],
  education: ["education", "academic background", "academics"],
  skills: ["skills", "technical skills", "core skills", "key skills"],
};

const KNOWN_SKILLS = [
  "javascript",
  "typescript",
  "react",
  "node.js",
  "node",
  "express",
  "mongodb",
  "mysql",
  "postgresql",
  "python",
  "java",
  "c++",
  "c#",
  ".net",
  "html",
  "css",
  "tailwind",
  "aws",
  "azure",
  "docker",
  "kubernetes",
  "git",
  "rest api",
  "graphql",
  "redux",
  "next.js",
  "vue",
  "angular",
  "sql",
  "excel",
  "figma",
  "salesforce",
  "project management",
  "agile",
  "scrum",
];

const normalizeLines = (text) =>
  text
    .replace(/\r/g, "\n")
    .replace(/[•●▪◦]/g, "\n")
    .replace(
      /\s+(summary|professional summary|profile|objective|experience|work experience|professional experience|employment history|work history|education|academic background|academics|skills|technical skills|core skills|key skills)\s*:?/gi,
      "\n$1\n",
    )
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

const isSectionHeading = (line) => {
  const normalized = line.toLowerCase().replace(/[:\-]/g, "").trim();
  return Object.values(SECTION_ALIASES)
    .flat()
    .some((heading) => normalized === heading);
};

const getSection = (lines, sectionName) => {
  const headings = SECTION_ALIASES[sectionName];
  const start = lines.findIndex((line) => {
    const normalized = line.toLowerCase().replace(/[:\-]/g, "").trim();
    return headings.includes(normalized);
  });

  if (start === -1) return [];

  const sectionLines = [];
  for (let index = start + 1; index < lines.length; index += 1) {
    if (isSectionHeading(lines[index])) break;
    sectionLines.push(lines[index]);
  }

  return sectionLines;
};

const splitName = (name = "") => {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return {
    firstName: parts[0] || "",
    lastName: parts.slice(1).join(" "),
  };
};

const getHeaderText = (text) => {
  const firstSectionIndex = text.search(
    /\b(summary|professional summary|profile|objective|experience|work experience|professional experience|employment history|work history|education|academic background|academics|skills|technical skills|core skills|key skills)\b/i,
  );

  return (firstSectionIndex === -1 ? text : text.slice(0, firstSectionIndex)).slice(
    0,
    300,
  );
};

const extractPersonalDetails = (text, lines) => {
  const email = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0] || "";
  const phone =
    text.match(/(?:\+?\d[\d\s().-]{8,}\d)/)?.[0]?.replace(/\s+/g, " ").trim() ||
    "";
  const headerText = getHeaderText(text)
    .replace(email, "")
    .replace(phone, "")
    .replace(/(?:\+?\d[\d\s().-]{8,}\d)/g, "")
    .trim();

  const firstContentLine =
    lines.slice(0, 8).find(
      (line) =>
        line.length <= 80 &&
        !line.includes(",") &&
        !line.includes("@") &&
        !/\d[\d\s().-]{8,}\d/.test(line) &&
        !isSectionHeading(line) &&
        !/[.!?]$/.test(line) &&
        line.split(/\s+/).length <= 5,
    ) || "";

  const headerName =
    headerText
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 5)
      .join(" ")
      .replace(/[|,;]+$/g, "")
      .trim();
  const nameSource = firstContentLine || headerName;
  const { firstName, lastName } = splitName(nameSource);
  const summaryLines = getSection(lines, "summary");
  const likelyJobTitle =
    lines
      .slice(0, 8)
      .find(
        (line) =>
          line !== firstContentLine &&
          line.length <= 80 &&
          !line.includes(",") &&
          !line.includes("@") &&
          !/\d[\d\s().-]{8,}\d/.test(line) &&
          !isSectionHeading(line) &&
          !/[.!?]$/.test(line) &&
          !/\b(worked|built|developed|created|managed|implemented|responsible|experience|javascript|wordpress|drupal|react|node|mysql|sql)\b/i.test(
            line,
          ),
      ) || "";

  return {
    firstName,
    lastName,
    jobTitle: likelyJobTitle,
    address: "",
    phone,
    email,
    summery: summaryLines.slice(0, 4).join(" "),
  };
};

const extractSkills = (text, lines) => {
  const skillsSection = getSection(lines, "skills").join(" ");
  const source = skillsSection || text;
  const lowerSource = source.toLowerCase();
  const explicitSkills = source
    .split(/[,|•;]+/)
    .map((skill) => skill.trim())
    .filter((skill) => skill.length > 1 && skill.length < 40);

  const knownSkills = KNOWN_SKILLS.filter((skill) => {
    if (skill === "node" && lowerSource.includes("node.js")) return false;
    if (skill === "sql" && /mysql|postgresql/i.test(lowerSource)) return false;
    return lowerSource.includes(skill);
  });
  const skills = [
    ...new Map(
      [...explicitSkills, ...knownSkills].map((skill) => [
        skill.toLowerCase(),
        skill,
      ]),
    ).values(),
  ].slice(0, 20);

  return skills.map((skill) => ({
    name: skill.replace(/\s+/g, " "),
    rating: 4,
  }));
};

const parseDateRange = (line) => {
  const datePattern =
    "(?:(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\\.?\\s+)?\\d{4}";
  const match = line.match(
    new RegExp(`(${datePattern})\\s*(?:-|–|to)\\s*(present|current|${datePattern})`, "i"),
  );

  if (!match) {
    return { startDate: "", endDate: "", currentlyWorking: false };
  }

  const startDate = match[1].trim();
  const endDate = match[2].trim();

  return {
    startDate,
    endDate,
    currentlyWorking: /present|current/i.test(endDate),
  };
};

const extractExperience = (lines) => {
  const experienceLines = getSection(lines, "experience");
  const entries = [];
  let current = null;

  for (const line of experienceLines) {
    const hasDateRange = /\d{4}.*(?:-|–|to).*?(?:\d{4}|present|current)/i.test(line);
    const looksLikeTitle =
      !line.startsWith("-") &&
      !line.startsWith("•") &&
      line.length < 120 &&
      (hasDateRange || / at | - |,/.test(line));

    if (looksLikeTitle) {
      if (current) entries.push(current);
      const dates = parseDateRange(line);
      const cleaned = line
        .replace(/\(?\b(?:(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?\s+)?\d{4}\s*(?:-|–|to)\s*(?:present|current|(?:(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?\s+)?\d{4}).*$/i, "")
        .trim();
      const [title = "", companyName = ""] = cleaned.split(/\s+at\s+| - |,/i);

      current = {
        title: title.replace(/[-,]+$/g, "").trim(),
        companyName: companyName.replace(/[-,]+$/g, "").trim(),
        city: "",
        state: "",
        ...dates,
        workSummery: "",
      };
    } else if (current) {
      current.workSummery = [current.workSummery, line.replace(/^[•-]\s*/, "")]
        .filter(Boolean)
        .join("\n");
    }
  }

  if (current) entries.push(current);
  return entries.slice(0, 8);
};

const extractEducation = (lines) => {
  const educationLines = getSection(lines, "education");
  const degreeRegex =
    /\b(bachelor|master|mba|b\.?tech|m\.?tech|b\.?e\.?|m\.?e\.?|b\.?s\.?|m\.?s\.?|ph\.?d|diploma|degree)\b/i;

  return educationLines
    .filter((line) => degreeRegex.test(line) || /\b(university|college|institute)\b/i.test(line))
    .slice(0, 6)
    .map((line) => {
      const dates = parseDateRange(line);
      const [degree = "", universityName = ""] = line.split(/\s+at\s+| - |,/i);
      return {
        universityName: universityName.trim(),
        degree: degree.trim(),
        major: "",
        startDate: dates.startDate,
        endDate: dates.endDate,
        description: "",
      };
    });
};

const analyzeResumeLocally = (resumeText) => {
  const lines = normalizeLines(resumeText);
  return {
    personalDetails: extractPersonalDetails(resumeText, lines),
    experience: extractExperience(lines),
    education: extractEducation(lines),
    skills: extractSkills(resumeText, lines),
  };
};

const analyzeResumeWithAi = async (resumeText) => {
  const apiKey = process.env.GOOGLE_AI_API_KEY || process.env.VITE_GOOGLE_AI_API_KEY;
  if (!apiKey) {
    throw new Error(
      "Google AI API key is not configured. Set GOOGLE_AI_API_KEY in the backend .env file.",
    );
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: process.env.GOOGLE_AI_MODEL || "gemini-2.0-flash",
  });

  const result = await model.generateContent({
    contents: [
      {
        role: "user",
        parts: [{ text: createResumePrompt(resumeText) }],
      },
    ],
    generationConfig: {
      temperature: 0.2,
      topP: 0.95,
      topK: 40,
      maxOutputTokens: 8192,
      responseMimeType: "application/json",
    },
  });

  return parseModelJson(result.response.text());
};

exports.analyzeResume = async (req, res) => {
  try {
    const { resumeText } = req.body;

    if (!resumeText || typeof resumeText !== "string") {
      return res.status(400).json({ message: "resumeText is required" });
    }

    if (process.env.USE_AI_RESUME_ANALYZER === "true") {
      res.json(await analyzeResumeWithAi(resumeText));
      return;
    }

    res.json(analyzeResumeLocally(resumeText));
  } catch (error) {
    console.error("Resume analysis failed:", error);

    const message =
      error?.status === 429 || String(error?.message).includes("429")
        ? "The AI service is rate limited. Resume was not analyzed by AI."
        : error?.message || "Failed to analyze resume";

    res.status(error?.status || 500).json({ message });
  }
};
