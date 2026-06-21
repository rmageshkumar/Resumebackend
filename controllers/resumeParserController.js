const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');
const fs = require('fs');
const path = require('path');

exports.parseResume = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    const filePath = req.file.path;
    const fileExtension = path.extname(req.file.originalname).toLowerCase();
    let extractedText = '';

    console.log('Parsing file:', req.file.originalname, 'Extension:', fileExtension);

    // Parse based on file type
    if (fileExtension === '.pdf') {
      const dataBuffer = fs.readFileSync(filePath);
      const data = await pdfParse(dataBuffer);
      extractedText = data.text;
    } else if (fileExtension === '.docx') {
      const result = await mammoth.extractRawText({ path: filePath });
      extractedText = result.value;
    } else if (fileExtension === '.doc') {
      // .doc files are harder to parse, return error for now
      fs.unlinkSync(filePath);
      return res.status(400).json({ message: '.doc files not supported. Please convert to .docx or .pdf' });
    } else {
      fs.unlinkSync(filePath);
      return res.status(400).json({ message: 'Unsupported file format. Please upload PDF or DOCX' });
    }

    // Clean up the uploaded file
    fs.unlinkSync(filePath);

    // Extract basic information from the text
    const parsedData = extractResumeInfo(extractedText);

    console.log('Resume parsed successfully');
    res.json({
      success: true,
      text: extractedText,
      parsedData: parsedData
    });

  } catch (error) {
    console.error('Resume parsing error:', error);
    
    // Clean up file if it exists
    if (req.file && req.file.path && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }

    res.status(500).json({ 
      message: 'Failed to parse resume', 
      error: error.message 
    });
  }
};

// Helper function to extract basic resume information
function extractResumeInfo(text) {
  const lines = text.split('\n').filter(line => line.trim());
  
  // Extract email
  const emailMatch = text.match(/[\w.-]+@[\w.-]+\.\w+/);
  const email = emailMatch ? emailMatch[0] : '';

  // Extract phone
  const phoneMatch = text.match(/[\+]?[(]?[0-9]{3}[)]?[-\s\.]?[0-9]{3}[-\s\.]?[0-9]{4,6}/);
  const phone = phoneMatch ? phoneMatch[0] : '';

  // Extract name (usually first line, but this is basic)
  const name = lines[0] || '';

  // Extract skills (common keywords)
  const skillKeywords = [
    'javascript', 'python', 'java', 'react', 'node', 'sql', 'aws', 'docker',
    'kubernetes', 'git', 'agile', 'scrum', 'html', 'css', 'typescript', 'mongodb',
    'postgresql', 'mysql', 'redis', 'graphql', 'rest', 'api', 'microservices',
    'machine learning', 'data analysis', 'project management', 'leadership'
  ];
  
  const foundSkills = skillKeywords.filter(skill => 
    text.toLowerCase().includes(skill.toLowerCase())
  );

  return {
    name: name.trim(),
    email: email,
    phone: phone,
    skills: foundSkills,
    rawText: text
  };
}
