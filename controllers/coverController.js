const pool = require("../config/db");
const { v4: uuidv4 } = require("uuid");

// Create a new cover letter
const createCoverLetter = async (req, res) => {
  try {
    const { title, jobDescription, experience, content, userId } = req.body;
    const coverId = uuidv4();

    const query = `
      INSERT INTO cover_letters (cover_id, title, job_description, experience, content, user_id, created_at)
      VALUES (?, ?, ?, ?, ?, ?, NOW())
    `;

    await pool.query(query, [
      coverId,
      title,
      jobDescription,
      experience,
      content,
      userId,
    ]);

    res.status(201).json({
      success: true,
      message: "Cover letter created successfully",
      data: { coverId },
    });
  } catch (error) {
    console.error("Error creating cover letter:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create cover letter",
      error: error.message,
    });
  }
};

// Get all cover letters for a user
const getUserCoverLetters = async (req, res) => {
  try {
    const userId = req.user.id;

    const query = `
      SELECT * FROM cover_letters 
      WHERE user_id = ? 
      ORDER BY created_at DESC
    `;

    const [coverLetters] = await pool.query(query, [userId]);

    console.log("Cover letters fetched successfully:", coverLetters);

    res.status(200).json({
      success: true,
      data: coverLetters,
    });
  } catch (error) {
    console.error("Error fetching cover letters:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch cover letters",
      error: error.message,
    });
  }
};

// Get a specific cover letter by ID
const getCoverLetterById = async (req, res) => {
  try {
    const { coverId } = req.params;

    const query = `
      SELECT * FROM cover_letters 
      WHERE cover_id = ?
    `;

    const [coverLetters] = await pool.query(query, [coverId]);

    if (coverLetters.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Cover letter not found",
      });
    }

    res.status(200).json({
      success: true,
      data: coverLetters[0],
    });
  } catch (error) {
    console.error("Error fetching cover letter:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch cover letter",
      error: error.message,
    });
  }
};

// Update a cover letter
const updateCoverLetter = async (req, res) => {
  try {
    const { coverId } = req.params;
    const { title, jobDescription, experience, content } = req.body;

    // First check if the cover letter exists
    const checkQuery = `SELECT * FROM cover_letters WHERE cover_id = ?`;
    const [existingCoverLetters] = await pool.query(checkQuery, [coverId]);

    if (existingCoverLetters.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Cover letter not found",
      });
    }

    const updateQuery = `
      UPDATE cover_letters 
      SET 
        title = ?,
        job_description = ?,
        experience = ?,
        content = ?,
        updated_at = NOW()
      WHERE cover_id = ?
    `;

    await pool.query(updateQuery, [
      title,
      jobDescription,
      experience,
      content,
      coverId,
    ]);

    res.status(200).json({
      success: true,
      message: "Cover letter updated successfully",
    });
  } catch (error) {
    console.error("Error updating cover letter:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update cover letter",
      error: error.message,
    });
  }
};

// Delete a cover letter
const deleteCoverLetter = async (req, res) => {
  try {
    const { coverId } = req.params;

    // First check if the cover letter exists
    const checkQuery = `SELECT * FROM cover_letters WHERE cover_id = ?`;
    const [existingCoverLetters] = await pool.query(checkQuery, [coverId]);

    if (existingCoverLetters.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Cover letter not found",
      });
    }

    const deleteQuery = `DELETE FROM cover_letters WHERE cover_id = ?`;
    await pool.query(deleteQuery, [coverId]);

    res.status(200).json({
      success: true,
      message: "Cover letter deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting cover letter:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete cover letter",
      error: error.message,
    });
  }
};

// Generate dummy data for testing
const generateDummyData = async (req, res) => {
  try {
    const { userId } = req.params;

    // Sample dummy data
    const dummyData = [
      {
        title: "Software Developer Application",
        jobDescription:
          "We are looking for a skilled Software Developer with experience in React, Node.js, and database management. The ideal candidate will have 3+ years of experience building web applications.",
        experience:
          "I have 4 years of experience developing web applications using React, Node.js, and MongoDB. I've led multiple projects from conception to deployment.",
        content:
          "Dear Hiring Manager,\n\nI am writing to express my interest in the Software Developer position at your company. With 4 years of experience in web development using React, Node.js, and MongoDB, I believe I would be a valuable addition to your team.\n\nIn my current role, I have successfully led multiple projects from conception to deployment, improving system efficiency by 40%. I am particularly proud of developing a real-time analytics dashboard that helped the marketing team increase conversion rates by 25%.\n\nI am excited about the opportunity to bring my technical expertise and problem-solving skills to your organization. I would welcome the chance to discuss how my background and skills would be a good fit for this role.\n\nThank you for considering my application.\n\nSincerely,\nJohn Doe",
        userId: userId,
      },
      {
        title: "Data Scientist Position",
        jobDescription:
          "Seeking a Data Scientist with strong background in machine learning, statistical analysis, and data visualization. Experience with Python, R, and SQL required.",
        experience:
          "I have a Master's degree in Data Science and 2 years of professional experience working with machine learning models, statistical analysis, and data visualization tools.",
        content:
          "Dear Hiring Manager,\n\nI am excited to apply for the Data Scientist position at your company. With my Master's degree in Data Science and 2 years of professional experience, I am confident in my ability to contribute to your data science initiatives.\n\nMy experience includes developing predictive models that reduced customer churn by 15% and creating interactive data visualizations that improved stakeholder decision-making. I am proficient in Python, R, SQL, and various machine learning frameworks.\n\nI am particularly interested in your company's innovative approach to data-driven solutions and would welcome the opportunity to discuss how my skills align with your team's needs.\n\nThank you for your consideration.\n\nBest regards,\nJane Smith",
        userId: userId,
      },
      {
        title: "Marketing Manager Application",
        jobDescription:
          "Looking for a Marketing Manager to develop and implement marketing strategies. The ideal candidate will have experience in digital marketing, campaign management, and team leadership.",
        experience:
          "I have 5+ years of experience in marketing, with a focus on digital campaigns, content strategy, and team management. I've increased organic traffic by 200% in my current role.",
        content:
          "Dear Hiring Manager,\n\nI am writing to express my interest in the Marketing Manager position at your company. With over 5 years of experience in digital marketing and team leadership, I am excited about the opportunity to contribute to your marketing initiatives.\n\nIn my current role, I have successfully increased organic traffic by 200% through strategic SEO and content marketing efforts. I have also managed a team of 5 marketing professionals, fostering a collaborative environment that has resulted in award-winning campaigns.\n\nI am particularly drawn to your company's innovative approach to customer engagement and would welcome the opportunity to bring my creative and analytical skills to your team.\n\nThank you for considering my application.\n\nSincerely,\nMichael Johnson",
        userId: userId,
      },
    ];

    // Insert dummy data into database
    for (const data of dummyData) {
      const coverId = uuidv4();
      const query = `
        INSERT INTO cover_letters (cover_id, title, job_description, experience, content, user_id, created_at)
        VALUES (?, ?, ?, ?, ?, ?, NOW())
      `;

      await pool.query(query, [
        coverId,
        data.title,
        data.jobDescription,
        data.experience,
        data.content,
        data.userId,
      ]);
    }

    res.status(201).json({
      success: true,
      message: "Dummy cover letters created successfully",
      count: dummyData.length,
    });
  } catch (error) {
    console.error("Error generating dummy data:", error);
    res.status(500).json({
      success: false,
      message: "Failed to generate dummy data",
      error: error.message,
    });
  }
};

module.exports = {
  createCoverLetter,
  getUserCoverLetters,
  getCoverLetterById,
  updateCoverLetter,
  deleteCoverLetter,
  generateDummyData,
};
