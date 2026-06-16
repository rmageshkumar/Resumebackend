const pool = require("../config/db");
const { v4: uuidv4 } = require("uuid");

// Helper function to check resume ownership
const checkResumeOwnership = async (resumeId, userId) => {
  console.log("Checking resume ownership for resume ID:", resumeId);
  console.log("User ID:", userId);

  return new Promise((resolve, reject) => {
    console.log("checking promise");
    pool.query(
      "SELECT * FROM user_resumes WHERE resume_id = ? AND user_id = ?",
      [resumeId, userId],
      (err, results) => {
        console.log("Query Executed."); // Check if this logs

        if (err) {
          console.error("Database error:", err);
          reject(err);
        } else {
          const isOwner = results.length > 0;
          console.log("Resume ownership check result:", isOwner);
          resolve(isOwner);
        }
      },
    );
  });
};

// Create a new resume
exports.createResume = async (req, res) => {
  console.log("📥 Creating a new resume with data:", req.body);

  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized: User not found" });
    }

    const {
      title,
      firstName,
      lastName,
      jobTitle,
      address,
      phone,
      email,
      summery,
      themeColor,
      template = "modern",
    } = req.body;

    if (!title) {
      return res.status(400).json({ message: "Resume title is required" });
    }

    const resumeId = uuidv4();

    // Insert resume using `pool.execute`
    const [result] = await pool.execute(
      `INSERT INTO user_resumes 
      (title, user_email, user_name, resume_id, first_name, last_name, job_title, 
      address, phone, email, summery, theme_color, template, published, user_id) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        title,
        req.user.email,
        req.user.name,
        resumeId,
        firstName || null,
        lastName || null,
        jobTitle || null,
        address || null,
        phone || null,
        email || req.user.email,
        summery || null,
        themeColor || null,
        template,
        true,
        userId,
      ],
    );

    console.log("✅ Resume created successfully with ID:", result.insertId);

    res.status(201).json({
      message: "✅ Resume created successfully",
      resumeId: result.insertId,
      resumeUid: resumeId,
    });
  } catch (error) {
    console.error("❌ Error creating resume:", error);
    res
      .status(500)
      .json({ message: "Failed to create resume", error: error.message });
  }
};

// Get all resumes for the logged-in user
exports.getUserResumes = async (req, res) => {
  try {
    console.log("=== getUserResumes called ===");
    console.log("req.user:", req.user);
    const userId = req.user.id;
    console.log("Fetching resumes for user id:", userId);

    // Using MySQL2's promise-based pool.query() to avoid unnecessary Promise wrapping
    const [resumes] = await pool.query(
      "SELECT * FROM user_resumes WHERE user_id = ? ORDER BY updated_at DESC",
      [userId],
    );
    console.log("Found resumes:", resumes.length);
    console.log("Resumes data:", resumes);

    res.json({ resumes });
  } catch (error) {
    console.error("Error fetching resumes:", error);
    res.status(500).json({
      message: "Failed to fetch resumes",
      error: error.message,
    });
  }
};

// Get a specific resume by ID with all its components
exports.getResumeById = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // console.log("Fetching resume ID:", id, "for user:", userId);

    // Check if the resume exists and belongs to the user
    const [resumeResults] = await pool.query(
      "SELECT * FROM user_resumes WHERE resume_id = ? AND user_id = ?",
      [id, userId],
    );

    // console.log("Resume results:", resumeResults); // Add this line for debugging

    if (resumeResults.length === 0) {
      return res
        .status(404)
        .json({ message: "Resume not found or unauthorized" });
    }

    const resume = resumeResults[0];
    console.log("Resume: id *****", resume.id); // Add this line for debugging

    const resumeId = resume.id;

    // Fetch all related resume data in **parallel** using Promise.all()
    const [
      [education],
      [experience],
      [skills],
      [languages],
      [certifications],
      [customSections],
    ] = await Promise.all([
      pool.query(
        "SELECT * FROM resume_education WHERE resume_id = ? ORDER BY end_date DESC",
        [resumeId],
      ),
      pool.query(
        "SELECT * FROM resume_experience WHERE resume_id = ? ORDER BY end_date DESC",
        [resumeId],
      ),
      pool.query(
        "SELECT * FROM resume_skills WHERE resume_id = ? ORDER BY level DESC",
        [resumeId],
      ),
      pool.query("SELECT * FROM resume_language WHERE resume_id = ?", [
        resumeId,
      ]),
      pool.query(
        "SELECT * FROM resume_certifications WHERE resume_id = ? ORDER BY issue_date DESC",
        [resumeId],
      ),
      pool.query("SELECT * FROM resume_custom_sections WHERE resume_id = ?", [
        resumeId,
      ]),
    ]);

    // Combine all resume data
    const completeResume = {
      ...resume,
      education,
      experience,
      skills,
      languages,
      certifications,
      customSections,
    };

    res.json({ resume: completeResume });
  } catch (error) {
    console.error("Error fetching resume:", error);
    res.status(500).json({
      message: "Failed to fetch resume",
      error: error.message,
    });
  }
};

// Update resume details
exports.updateResumeDetail = async (req, res) => {
  console.log("Updating resume with ID:", req.params.id);
  console.log("User ID:", req.user.id);
  console.log("Request body:", req.body); // Log the request body for debugging

  try {
    const { id } = req.params;
    const userId = req.user.id;
    const limitText = (value, maxLength) => {
      if (value === undefined || value === null) return value;
      return String(value).slice(0, maxLength);
    };

    const {
      title,
      first_name,
      last_name,
      jobTitle,
      address,
      phone,
      email,
      summery, // Fixed spelling
      themeColor,
    } = req.body;

    // // Check if the resume exists and belongs to the user
    // const isOwner = await checkResumeOwnership(id, userId);
    // console.log("isOwner:", isOwner);
    // if (!isOwner) {
    //   return res.status(404).json({ message: "Resume not found" });
    // }

    console.log("Updating resume with ID 0001:", id);
    console.log("Fields to update:", req.body); // Log the request body for debugging

    // Dynamically build update query
    const fields = [];
    const values = [];

    if (title !== undefined)
      (fields.push("title = ?"), values.push(limitText(title, 255)));
    if (first_name !== undefined)
      (fields.push("first_name = ?"), values.push(limitText(first_name, 100)));
    if (last_name !== undefined)
      (fields.push("last_name = ?"), values.push(limitText(last_name, 100)));
    if (jobTitle !== undefined)
      (fields.push("job_title = ?"), values.push(limitText(jobTitle, 150)));
    if (address !== undefined)
      (fields.push("address = ?"), values.push(limitText(address, 255)));
    if (phone !== undefined)
      (fields.push("phone = ?"), values.push(limitText(phone, 50)));
    if (email !== undefined)
      (fields.push("email = ?"), values.push(limitText(email, 255)));
    if (summery !== undefined)
      (fields.push("summery = ?"), values.push(summery));
    if (themeColor !== undefined)
      (fields.push("theme_color = ?"), values.push(themeColor));

    // Ensure `updated_at` is updated
    fields.push("updated_at = ?");
    values.push(new Date());

    // If no fields to update, return early
    if (fields.length === 0) {
      return res.status(400).json({ message: "No fields to update" });
    }

    console.log("Fields to update: 0001", fields.join(","));

    // Add resume ID for the WHERE clause
    values.push(id);

    // Execute the update query
    await pool.query(
      `UPDATE user_resumes SET ${fields.join(", ")} WHERE resume_id = ?`,
      values,
    );

    res.json({ message: "Resume updated successfully" });
  } catch (error) {
    console.error("Error updating resume:", error);
    res
      .status(500)
      .json({ message: "Failed to update resume", error: error.message });
  }
};

// Delete a resume
exports.deleteResumeById = async (req, res) => {
  console.log("Delete resume endpoint called with params:", req.params);
  console.log("Request headers:", req.headers);

  if (!req.user || !req.user.id) {
    console.error("User not authenticated or missing from request");
    return res
      .status(401)
      .json({ message: "Unauthorized: User not authenticated" });
  }

  try {
    const { id } = req.params;
    const userId = req.user.id;

    console.log(
      "Processing delete request for resume ID:",
      id,
      "by user:",
      userId,
    );

    if (!id) {
      console.error("Missing resume ID in request params");
      return res.status(400).json({ message: "Resume ID is required" });
    }

    // First check if the resume exists with the resume_id
    console.log("Querying for resume with resume_id:", id);
    const [resumeResults] = await pool.query(
      "SELECT id FROM user_resumes WHERE resume_id = ? AND user_id = ?",
      [id, userId],
    );

    console.log("Resume query results:", resumeResults);

    if (!resumeResults || resumeResults.length === 0) {
      console.log("No resume found with resume_id:", id, "for user:", userId);
      return res
        .status(404)
        .json({ message: "Resume not found or not authorized" });
    }

    const resumeDbId = resumeResults[0].id;
    console.log("Found resume database ID:", resumeDbId);

    // Delete the resume using the database ID
    console.log("Executing delete query for resume ID:", resumeDbId);
    const [deleteResult] = await pool.query(
      "DELETE FROM user_resumes WHERE id = ?",
      [resumeDbId],
    );

    console.log("Delete operation result:", deleteResult);

    if (deleteResult.affectedRows === 0) {
      console.log("No rows affected by delete operation");
      return res.status(404).json({ message: "Resume could not be deleted" });
    }

    console.log("Resume successfully deleted");
    return res.json({
      message: "Resume deleted successfully",
      resumeId: id,
      affectedRows: deleteResult.affectedRows,
    });
  } catch (error) {
    console.error("Error in deleteResumeById:", error);
    console.error("Error stack:", error.stack);
    return res.status(500).json({
      message: "Failed to delete resume",
      error: error.message,
      stack: process.env.NODE_ENV === "development" ? error.stack : undefined,
    });
  }
};

// Update resume template
exports.updateResumeTemplate = async (req, res) => {
  console.log("updateResumeTemplate called with params:", req.params);
  console.log("updateResumeTemplate request body:", req.body);

  try {
    const { id } = req.params;
    const userId = req.user.id;
    const { template } = req.body;

    console.log("Updating template for resume ID:", id, "to:", template);

    if (!template) {
      return res.status(400).json({ message: "Template is required" });
    }

    // Check if the resume exists and belongs to the user
    const isOwner = await checkResumeOwnership(id, userId);
    if (!isOwner) {
      return res.status(404).json({ message: "Resume not found" });
    }

    // Get the database ID from the resume_id
    const [resumeResults] = await pool.query(
      "SELECT id FROM user_resumes WHERE resume_id = ? AND user_id = ?",
      [id, userId],
    );

    if (resumeResults.length === 0) {
      return res.status(404).json({ message: "Resume not found" });
    }

    const resumeDbId = resumeResults[0].id;
    console.log("Found resume database ID:", resumeDbId);

    // Update the template using async/await
    const [updateResult] = await pool.query(
      "UPDATE user_resumes SET template = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
      [template, resumeDbId],
    );

    console.log("Update result:", updateResult);

    if (updateResult.affectedRows === 0) {
      return res.status(404).json({ message: "Failed to update template" });
    }

    console.log("Template updated successfully");
    return res.status(200).json({
      message: "Resume template updated successfully",
      template: template,
    });
  } catch (error) {
    console.error("Error updating resume template:", error);
    return res.status(500).json({
      message: "Failed to update resume template",
      error: error.message,
    });
  }
};
// Save custom sections
exports.saveCustomSections = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const { customSections } = req.body;

    if (!customSections || !Array.isArray(customSections)) {
      return res.status(400).json({
        message: "Custom sections data is required and must be an array",
      });
    }

    // Check if the resume exists and belongs to the user
    const isOwner = await checkResumeOwnership(id, userId);
    if (!isOwner) {
      return res.status(404).json({ message: "Resume not found" });
    }

    // First, delete existing custom sections
    await new Promise((resolve, reject) => {
      pool.query(
        "DELETE FROM resume_custom_sections WHERE resume_id = ?",
        [id],
        (err, results) => {
          if (err) {
            console.error("Database error:", err);
            return reject(err);
          }
          resolve(results);
        },
      );
    });

    // Then insert the new custom sections
    if (customSections.length > 0) {
      const values = customSections.map((section) => [
        id,
        section.title,
        section.content,
      ]);

      await new Promise((resolve, reject) => {
        pool.query(
          "INSERT INTO resume_custom_sections (resume_id, title, content) VALUES ?",
          [values],
          (err, results) => {
            if (err) {
              console.error("Database error:", err);
              return reject(err);
            }
            resolve(results);
          },
        );
      });
    }

    res.json({ message: "Custom sections updated successfully" });
  } catch (error) {
    console.error("Error updating custom sections:", error);
    res.status(500).json({
      message: "Failed to update custom sections",
      error: error.message,
    });
  }
};

// Add education
exports.addEducation = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const { school, degree, fieldOfStudy, startDate, endDate, description } =
      req.body;

    console.log("Adding education with data:", req.body);
    console.log("Resume ID:", id);

    // Validate required fields
    if (!school || !degree) {
      return res
        .status(400)
        .json({ message: "School and degree are required" });
    }

    // Get the database ID from the resume_id
    const [resumeResults] = await pool.query(
      "SELECT id FROM user_resumes WHERE resume_id = ? AND user_id = ?",
      [id, userId],
    );

    if (resumeResults.length === 0) {
      return res.status(404).json({ message: "Resume not found" });
    }

    const resumeDbId = resumeResults[0].id;
    console.log("Found resume database ID:", resumeDbId);

    // Insert the education
    const [result] = await pool.query(
      `INSERT INTO resume_education 
      (resume_id, school, degree, field_of_study, start_date, end_date, description) 
      VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        resumeDbId,
        school,
        degree,
        fieldOfStudy || null,
        startDate || null,
        endDate || null,
        description || null,
      ],
    );

    // Update the resume's updated_at timestamp
    await pool.query(
      "UPDATE user_resumes SET updated_at = CURRENT_TIMESTAMP WHERE id = ?",
      [resumeDbId],
    );

    res.status(201).json({
      message: "Education added successfully",
      educationId: result.insertId,
    });
  } catch (error) {
    console.error("Error adding education:", error);
    res
      .status(500)
      .json({ message: "Failed to add education", error: error.message });
  }
};

// Update education
exports.updateEducation = async (req, res) => {
  try {
    const { id, educationId } = req.params;
    const userId = req.user.id;
    const { school, degree, fieldOfStudy, startDate, endDate, description } =
      req.body;

    console.log("Updating education:", {
      id,
      educationId,
      userId,
      requestBody: req.body,
    });

    // Get the database ID from the resume_id
    const [resumeResults] = await pool.query(
      "SELECT id FROM user_resumes WHERE resume_id = ? AND user_id = ?",
      [id, userId],
    );

    if (resumeResults.length === 0) {
      return res.status(404).json({ message: "Resume not found" });
    }

    const resumeDbId = resumeResults[0].id;
    console.log("Found resume database ID:", resumeDbId);

    // Build the query dynamically based on provided fields
    const fields = [];
    const values = [];

    if (school !== undefined) {
      fields.push("school = ?");
      values.push(school);
    }

    if (degree !== undefined) {
      fields.push("degree = ?");
      values.push(degree);
    }

    if (fieldOfStudy !== undefined) {
      fields.push("field_of_study = ?");
      values.push(fieldOfStudy);
    }

    if (startDate !== undefined) {
      fields.push("start_date = ?");
      values.push(startDate);
    }

    if (endDate !== undefined) {
      fields.push("end_date = ?");
      values.push(endDate);
    }

    if (description !== undefined) {
      fields.push("description = ?");
      values.push(description);
    }

    // If no fields to update, return early
    if (fields.length === 0) {
      return res.status(400).json({ message: "No fields to update" });
    }

    // Add the education ID and resume DB ID to values array
    values.push(educationId);
    values.push(resumeDbId);

    // Update the education
    const [updateResult] = await pool.query(
      `UPDATE resume_education SET ${fields.join(
        ", ",
      )} WHERE id = ? AND resume_id = ?`,
      values,
    );

    if (updateResult.affectedRows === 0) {
      return res.status(404).json({ message: "Education not found" });
    }

    // Update the resume's updated_at timestamp
    await pool.query(
      "UPDATE user_resumes SET updated_at = CURRENT_TIMESTAMP WHERE id = ?",
      [resumeDbId],
    );

    res.json({ message: "Education updated successfully" });
  } catch (error) {
    console.error("Error updating education:", error);
    res
      .status(500)
      .json({ message: "Failed to update education", error: error.message });
  }
};

// Delete education
exports.deleteEducation = async (req, res) => {
  try {
    const { id, educationId } = req.params;
    const userId = req.user.id;

    console.log("Deleting education:", { id, educationId, userId });

    // Get the database ID from the resume_id
    const [resumeResults] = await pool.query(
      "SELECT id FROM user_resumes WHERE resume_id = ? AND user_id = ?",
      [id, userId],
    );

    if (resumeResults.length === 0) {
      return res.status(404).json({ message: "Resume not found" });
    }

    const resumeDbId = resumeResults[0].id;
    console.log("Found resume database ID:", resumeDbId);

    // Delete the education
    const [deleteResult] = await pool.query(
      "DELETE FROM resume_education WHERE id = ? AND resume_id = ?",
      [educationId, resumeDbId],
    );

    if (deleteResult.affectedRows === 0) {
      return res.status(404).json({ message: "Education not found" });
    }

    // Update the resume's updated_at timestamp
    await pool.query(
      "UPDATE user_resumes SET updated_at = CURRENT_TIMESTAMP WHERE id = ?",
      [resumeDbId],
    );

    res.json({ message: "Education deleted successfully" });
  } catch (error) {
    console.error("Error deleting education:", error);
    res.status(500).json({
      message: "Failed to delete education",
      error: error.message,
    });
  }
};

// Add experience
exports.addExperience = async (req, res) => {
  console.log("Adding experience with data:", req.body);
  console.log("Request params:", req.params);
  try {
    const { id } = req.params;
    console.log("Resume ID:", id);
    const userId = req.user.id;

    // Handle both direct properties and nested experience array
    let experienceData;
    if (
      req.body.experience &&
      Array.isArray(req.body.experience) &&
      req.body.experience.length > 0
    ) {
      // Extract the first experience object from the array
      experienceData = req.body.experience[0];
      console.log("Extracted experience data from array:", experienceData);
    } else {
      // Use the direct properties
      experienceData = req.body;
    }

    // Extract fields with support for both naming conventions
    const company = experienceData.company;
    const position = experienceData.position;
    const startDate = experienceData.startDate || experienceData.start_date;
    const endDate = experienceData.endDate || experienceData.end_date;
    const description = experienceData.description;
    const location = experienceData.location;
    const current = experienceData.current;

    console.log("User ID:", userId);
    console.log("Company:", company);
    console.log("Position:", position);
    console.log("Start Date:", startDate);
    console.log("End Date:", endDate);
    console.log("Description:", description);
    console.log("Location:", location);
    console.log("Current:", current);

    // Validate required fields
    if (!company || !position) {
      return res
        .status(400)
        .json({ message: "Company and position are required fields" });
    }

    // Get the database ID from the resume_id
    const [resumeResults] = await pool.query(
      "SELECT id FROM user_resumes WHERE resume_id = ? AND user_id = ?",
      [id, userId],
    );

    if (resumeResults.length === 0) {
      return res.status(404).json({ message: "Resume not found" });
    }

    const resumeDbId = resumeResults[0].id;

    // Insert the experience
    const [result] = await pool.query(
      `INSERT INTO resume_experience 
      (resume_id, company, position, start_date, end_date, description, location, current) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        resumeDbId,
        company,
        position,
        startDate || null,
        endDate || null,
        description || null,
        location || null,
        current || 0,
      ],
    );

    // Update the resume's updated_at timestamp
    await pool.query(
      "UPDATE user_resumes SET updated_at = CURRENT_TIMESTAMP WHERE id = ?",
      [resumeDbId],
    );

    res.status(201).json({
      message: "Experience added successfully",
      experienceId: result.insertId,
    });
  } catch (error) {
    console.error("Error adding experience:", error);
    res.status(500).json({
      message: "Failed to add experience",
      error: error.message,
    });
  }
};

// Update experience
exports.updateExperience = async (req, res) => {
  try {
    const { id, experienceId } = req.params;
    const userId = req.user.id;
    const {
      company,
      position,
      startDate,
      endDate,
      current,
      description,
      location,
    } = req.body;

    console.log("Updating experience:", {
      id,
      experienceId,
      userId,
      requestBody: req.body,
    });

    // Get the database ID from the resume_id
    const [resumeResults] = await pool.query(
      "SELECT id FROM user_resumes WHERE resume_id = ? AND user_id = ?",
      [id, userId],
    );

    if (resumeResults.length === 0) {
      return res.status(404).json({ message: "Resume not found" });
    }

    const resumeDbId = resumeResults[0].id;
    console.log("Found resume database ID:", resumeDbId);

    // Build the query dynamically based on provided fields
    const fields = [];
    const values = [];

    if (company !== undefined) {
      fields.push("company = ?");
      values.push(company);
    }

    if (position !== undefined) {
      fields.push("position = ?");
      values.push(position);
    }

    if (startDate !== undefined) {
      fields.push("start_date = ?");
      values.push(startDate);
    }

    if (endDate !== undefined) {
      fields.push("end_date = ?");
      values.push(endDate);
    }

    if (current !== undefined) {
      fields.push("current = ?");
      values.push(current);
    }

    if (description !== undefined) {
      fields.push("description = ?");
      values.push(description);
    }

    if (location !== undefined) {
      fields.push("location = ?");
      values.push(location);
    }

    // If no fields to update, return early
    if (fields.length === 0) {
      return res.status(400).json({ message: "No fields to update" });
    }

    // Add the experience ID and resume DB ID to values array
    values.push(experienceId);
    values.push(resumeDbId);

    // Update the experience
    const [updateResult] = await pool.query(
      `UPDATE resume_experience SET ${fields.join(
        ", ",
      )} WHERE id = ? AND resume_id = ?`,
      values,
    );

    if (updateResult.affectedRows === 0) {
      return res.status(404).json({ message: "Experience not found" });
    }

    // Update the resume's updated_at timestamp
    await pool.query(
      "UPDATE user_resumes SET updated_at = CURRENT_TIMESTAMP WHERE id = ?",
      [resumeDbId],
    );

    res.json({ message: "Experience updated successfully" });
  } catch (error) {
    console.error("Error updating experience:", error);
    res.status(500).json({
      message: "Failed to update experience",
      error: error.message,
    });
  }
};

// Delete experience
exports.deleteExperience = async (req, res) => {
  try {
    const { id, experienceId } = req.params;
    const userId = req.user.id;

    console.log("Deleting experience:", { id, experienceId, userId });

    // Get the database ID from the resume_id
    const [resumeResults] = await pool.query(
      "SELECT id FROM user_resumes WHERE resume_id = ? AND user_id = ?",
      [id, userId],
    );

    if (resumeResults.length === 0) {
      return res.status(404).json({ message: "Resume not found" });
    }

    const resumeDbId = resumeResults[0].id;
    console.log("Found resume database ID:", resumeDbId);

    // Delete the experience
    const [deleteResult] = await pool.query(
      "DELETE FROM resume_experience WHERE id = ? AND resume_id = ?",
      [experienceId, resumeDbId],
    );

    if (deleteResult.affectedRows === 0) {
      return res.status(404).json({ message: "Experience not found" });
    }

    // Update the resume's updated_at timestamp
    await pool.query(
      "UPDATE user_resumes SET updated_at = CURRENT_TIMESTAMP WHERE id = ?",
      [resumeDbId],
    );

    res.json({ message: "Experience deleted successfully" });
  } catch (error) {
    console.error("Error deleting experience:", error);
    res.status(500).json({
      message: "Failed to delete experience",
      error: error.message,
    });
  }
};

// Add skill
exports.addSkill = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const { name, level } = req.body;

    console.log("Adding skill with data:", req.body);
    console.log("Resume ID:", id);

    // Validate required fields
    if (!name) {
      return res.status(400).json({ message: "Skill name is required" });
    }

    // Get the database ID from the resume_id
    const [resumeResults] = await pool.query(
      "SELECT id FROM user_resumes WHERE resume_id = ? AND user_id = ?",
      [id, userId],
    );

    if (resumeResults.length === 0) {
      return res.status(404).json({ message: "Resume not found" });
    }

    const resumeDbId = resumeResults[0].id;
    console.log("Found resume database ID:", resumeDbId);

    // Insert the skill
    const [result] = await pool.query(
      "INSERT INTO resume_skills (resume_id, skill, level) VALUES (?, ?, ?)",
      [resumeDbId, name, level || 0],
    );

    // Update the resume's updated_at timestamp
    await pool.query(
      "UPDATE user_resumes SET updated_at = CURRENT_TIMESTAMP WHERE id = ?",
      [resumeDbId],
    );

    res.status(201).json({
      message: "Skill added successfully",
      skillId: result.insertId,
    });
  } catch (error) {
    console.error("Error adding skill:", error);
    res
      .status(500)
      .json({ message: "Failed to add skill", error: error.message });
  }
};

// Update skill
exports.updateSkill = async (req, res) => {
  try {
    const { id, skillId } = req.params;
    const userId = req.user.id;
    const { name, level } = req.body;

    console.log("Updating skill:", {
      id,
      skillId,
      userId,
      requestBody: req.body,
    });

    // Get the database ID from the resume_id
    const [resumeResults] = await pool.query(
      "SELECT id FROM user_resumes WHERE resume_id = ? AND user_id = ?",
      [id, userId],
    );

    if (resumeResults.length === 0) {
      return res.status(404).json({ message: "Resume not found" });
    }

    const resumeDbId = resumeResults[0].id;
    console.log("Found resume database ID:", resumeDbId);

    // Build the query dynamically based on provided fields
    const fields = [];
    const values = [];

    if (name !== undefined) {
      fields.push("skill = ?");
      values.push(name);
    }

    if (level !== undefined) {
      fields.push("level = ?");
      values.push(level);
    }

    // If no fields to update, return early
    if (fields.length === 0) {
      return res.status(400).json({ message: "No fields to update" });
    }

    // Add the skill ID and resume DB ID to values array
    values.push(skillId);
    values.push(resumeDbId);

    // Update the skill
    const [updateResult] = await pool.query(
      `UPDATE resume_skills SET ${fields.join(
        ", ",
      )} WHERE id = ? AND resume_id = ?`,
      values,
    );

    if (updateResult.affectedRows === 0) {
      return res.status(404).json({ message: "Skill not found" });
    }

    // Update the resume's updated_at timestamp
    await pool.query(
      "UPDATE user_resumes SET updated_at = CURRENT_TIMESTAMP WHERE id = ?",
      [resumeDbId],
    );

    res.json({ message: "Skill updated successfully" });
  } catch (error) {
    console.error("Error updating skill:", error);
    res
      .status(500)
      .json({ message: "Failed to update skill", error: error.message });
  }
};

// Delete skill
exports.deleteSkill = async (req, res) => {
  try {
    const { id, skillId } = req.params;
    const userId = req.user.id;

    console.log("Deleting skill:", { id, skillId, userId });

    // Get the database ID from the resume_id
    const [resumeResults] = await pool.query(
      "SELECT id FROM user_resumes WHERE resume_id = ? AND user_id = ?",
      [id, userId],
    );

    if (resumeResults.length === 0) {
      return res.status(404).json({ message: "Resume not found" });
    }

    const resumeDbId = resumeResults[0].id;
    console.log("Found resume database ID:", resumeDbId);

    // Delete the skill
    const [deleteResult] = await pool.query(
      "DELETE FROM resume_skills WHERE id = ? AND resume_id = ?",
      [skillId, resumeDbId],
    );

    if (deleteResult.affectedRows === 0) {
      return res.status(404).json({ message: "Skill not found" });
    }

    // Update the resume's updated_at timestamp
    await pool.query(
      "UPDATE user_resumes SET updated_at = CURRENT_TIMESTAMP WHERE id = ?",
      [resumeDbId],
    );

    res.json({ message: "Skill deleted successfully" });
  } catch (error) {
    console.error("Error deleting skill:", error);
    res.status(500).json({
      message: "Failed to delete skill",
      error: error.message,
    });
  }
};

// Add language
exports.addLanguage = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const { language, proficiency } = req.body;

    console.log("Adding language with data:", req.body);
    console.log("Resume ID:", id);

    // Validate required fields
    if (!language) {
      return res.status(400).json({ message: "Language name is required" });
    }

    // Get the database ID from the resume_id
    const [resumeResults] = await pool.query(
      "SELECT id FROM user_resumes WHERE resume_id = ? AND user_id = ?",
      [id, userId],
    );

    if (resumeResults.length === 0) {
      return res.status(404).json({ message: "Resume not found" });
    }

    const resumeDbId = resumeResults[0].id;
    console.log("Found resume database ID:", resumeDbId);

    // Insert the language
    const [result] = await pool.query(
      "INSERT INTO resume_language (resume_id, language, proficiency) VALUES (?, ?, ?)",
      [resumeDbId, language, proficiency || "Intermediate"],
    );

    // Update the resume's updated_at timestamp
    await pool.query(
      "UPDATE user_resumes SET updated_at = CURRENT_TIMESTAMP WHERE id = ?",
      [resumeDbId],
    );

    res.status(201).json({
      message: "Language added successfully",
      languageId: result.insertId,
    });
  } catch (error) {
    console.error("Error adding language:", error);
    res
      .status(500)
      .json({ message: "Failed to add language", error: error.message });
  }
};

// Update language
exports.updateLanguage = async (req, res) => {
  try {
    const { id, languageId } = req.params;
    const userId = req.user.id;
    const { language, proficiency } = req.body;

    console.log("Updating language:", {
      id,
      languageId,
      userId,
      requestBody: req.body,
    });

    // Get the database ID from the resume_id
    const [resumeResults] = await pool.query(
      "SELECT id FROM user_resumes WHERE resume_id = ? AND user_id = ?",
      [id, userId],
    );

    if (resumeResults.length === 0) {
      return res.status(404).json({ message: "Resume not found" });
    }

    const resumeDbId = resumeResults[0].id;
    console.log("Found resume database ID:", resumeDbId);

    // Build the query dynamically based on provided fields
    const fields = [];
    const values = [];

    if (language !== undefined) {
      fields.push("language = ?");
      values.push(language);
    }

    if (proficiency !== undefined) {
      fields.push("proficiency = ?");
      values.push(proficiency);
    }

    // If no fields to update, return early
    if (fields.length === 0) {
      return res.status(400).json({ message: "No fields to update" });
    }

    // Add the language ID and resume DB ID to values array
    values.push(languageId);
    values.push(resumeDbId);

    // Update the language
    const [updateResult] = await pool.query(
      `UPDATE resume_language SET ${fields.join(
        ", ",
      )} WHERE id = ? AND resume_id = ?`,
      values,
    );

    if (updateResult.affectedRows === 0) {
      return res.status(404).json({ message: "Language not found" });
    }

    // Update the resume's updated_at timestamp
    await pool.query(
      "UPDATE user_resumes SET updated_at = CURRENT_TIMESTAMP WHERE id = ?",
      [resumeDbId],
    );

    res.json({ message: "Language updated successfully" });
  } catch (error) {
    console.error("Error updating language:", error);
    res
      .status(500)
      .json({ message: "Failed to update language", error: error.message });
  }
};

// Delete language
exports.deleteLanguage = async (req, res) => {
  try {
    const { id, languageId } = req.params;
    const userId = req.user.id;

    console.log("Deleting language:", { id, languageId, userId });

    // Get the database ID from the resume_id
    const [resumeResults] = await pool.query(
      "SELECT id FROM user_resumes WHERE resume_id = ? AND user_id = ?",
      [id, userId],
    );

    if (resumeResults.length === 0) {
      return res.status(404).json({ message: "Resume not found" });
    }

    const resumeDbId = resumeResults[0].id;
    console.log("Found resume database ID:", resumeDbId);

    // Delete the language
    const [deleteResult] = await pool.query(
      "DELETE FROM resume_language WHERE id = ? AND resume_id = ?",
      [languageId, resumeDbId],
    );

    if (deleteResult.affectedRows === 0) {
      return res.status(404).json({ message: "Language not found" });
    }

    // Update the resume's updated_at timestamp
    await pool.query(
      "UPDATE user_resumes SET updated_at = CURRENT_TIMESTAMP WHERE id = ?",
      [resumeDbId],
    );

    res.json({ message: "Language deleted successfully" });
  } catch (error) {
    console.error("Error deleting language:", error);
    res.status(500).json({
      message: "Failed to delete language",
      error: error.message,
    });
  }
};

// Add certification
exports.addCertification = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const {
      name,
      issuer,
      issue_date,
      expiration_date,
      credential_id,
      credential_url,
    } = req.body;

    console.log("Adding certification with data:", req.body);
    console.log("Resume ID:", id);

    // Validate required fields
    if (!name || !issuer) {
      return res
        .status(400)
        .json({ message: "Certification name and issuer are required" });
    }

    // Get the database ID from the resume_id
    const [resumeResults] = await pool.query(
      "SELECT id FROM user_resumes WHERE resume_id = ? AND user_id = ?",
      [id, userId],
    );

    if (resumeResults.length === 0) {
      return res.status(404).json({ message: "Resume not found" });
    }

    const resumeDbId = resumeResults[0].id;
    console.log("Found resume database ID:", resumeDbId);

    // Insert the certification
    const [result] = await pool.query(
      `INSERT INTO resume_certifications 
        (resume_id, name, issuer, issue_date, expiration_date, credential_id, credential_url) 
        VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        resumeDbId,
        name,
        issuer,
        issue_date || null,
        expiration_date || null,
        credential_id || null,
        credential_url || null,
      ],
    );

    // Update the resume's updated_at timestamp
    await pool.query(
      "UPDATE user_resumes SET updated_at = CURRENT_TIMESTAMP WHERE id = ?",
      [resumeDbId],
    );

    res.status(201).json({
      message: "Certification added successfully",
      certificationId: result.insertId,
    });
  } catch (error) {
    console.error("Error adding certification:", error);
    res
      .status(500)
      .json({ message: "Failed to add certification", error: error.message });
  }
};

// Update certification
exports.updateCertification = async (req, res) => {
  try {
    const { id, certificationId } = req.params;
    const userId = req.user.id;
    const {
      name,
      issuer,
      issue_date,
      expiration_date,
      credential_id,
      credential_url,
    } = req.body;

    console.log("Updating certification:", {
      id,
      certificationId,
      userId,
      requestBody: req.body,
    });

    // Get the database ID from the resume_id
    const [resumeResults] = await pool.query(
      "SELECT id FROM user_resumes WHERE resume_id = ? AND user_id = ?",
      [id, userId],
    );

    if (resumeResults.length === 0) {
      return res.status(404).json({ message: "Resume not found" });
    }

    const resumeDbId = resumeResults[0].id;
    console.log("Found resume database ID:", resumeDbId);

    // Build the query dynamically based on provided fields
    const fields = [];
    const values = [];

    if (name !== undefined) {
      fields.push("name = ?");
      values.push(name);
    }

    if (issuer !== undefined) {
      fields.push("issuer = ?");
      values.push(issuer);
    }

    if (issue_date !== undefined) {
      fields.push("issue_date = ?");
      values.push(issue_date);
    }

    if (expiration_date !== undefined) {
      fields.push("expiration_date = ?");
      values.push(expiration_date);
    }

    if (credential_id !== undefined) {
      fields.push("credential_id = ?");
      values.push(credential_id);
    }

    if (credential_url !== undefined) {
      fields.push("credential_url = ?");
      values.push(credential_url);
    }

    // If no fields to update, return early
    if (fields.length === 0) {
      return res.status(400).json({ message: "No fields to update" });
    }

    // Add the certification ID and resume DB ID to values array
    values.push(certificationId);
    values.push(resumeDbId);

    // Update the certification
    const [updateResult] = await pool.query(
      `UPDATE resume_certifications SET ${fields.join(
        ", ",
      )} WHERE id = ? AND resume_id = ?`,
      values,
    );

    if (updateResult.affectedRows === 0) {
      return res.status(404).json({ message: "Certification not found" });
    }

    // Update the resume's updated_at timestamp
    await pool.query(
      "UPDATE user_resumes SET updated_at = CURRENT_TIMESTAMP WHERE id = ?",
      [resumeDbId],
    );

    res.json({ message: "Certification updated successfully" });
  } catch (error) {
    console.error("Error updating certification:", error);
    res.status(500).json({
      message: "Failed to update certification",
      error: error.message,
    });
  }
};

// Delete certification
exports.deleteCertification = async (req, res) => {
  try {
    const { id, certificationId } = req.params;
    const userId = req.user.id;

    console.log("Deleting certification:", { id, certificationId, userId });

    // Get the database ID from the resume_id
    const [resumeResults] = await pool.query(
      "SELECT id FROM user_resumes WHERE resume_id = ? AND user_id = ?",
      [id, userId],
    );

    if (resumeResults.length === 0) {
      return res.status(404).json({ message: "Resume not found" });
    }

    const resumeDbId = resumeResults[0].id;
    console.log("Found resume database ID:", resumeDbId);

    // Delete the certification
    const [deleteResult] = await pool.query(
      "DELETE FROM resume_certifications WHERE id = ? AND resume_id = ?",
      [certificationId, resumeDbId],
    );

    if (deleteResult.affectedRows === 0) {
      return res.status(404).json({ message: "Certification not found" });
    }

    // Update the resume's updated_at timestamp
    await pool.query(
      "UPDATE user_resumes SET updated_at = CURRENT_TIMESTAMP WHERE id = ?",
      [resumeDbId],
    );

    res.json({ message: "Certification deleted successfully" });
  } catch (error) {
    console.error("Error deleting certification:", error);
    res.status(500).json({
      message: "Failed to delete certification",
      error: error.message,
    });
  }
};

// Track resume view
exports.trackResumeView = async (req, res) => {
  try {
    const { resumeId, source } = req.body;

    if (!resumeId) {
      return res.status(400).json({ message: "Resume ID is required" });
    }

    // Insert the view record
    await new Promise((resolve, reject) => {
      pool.query(
        "INSERT INTO resume_views (resume_id, view_date, source) VALUES (?, NOW(), ?)",
        [resumeId, source || null],
        (err, results) => {
          if (err) {
            console.error("Database error:", err);
            return reject(err);
          }
          resolve(results);
        },
      );
    });

    res.status(201).json({ message: "View tracked successfully" });
  } catch (error) {
    console.error("Error tracking view:", error);
    res
      .status(500)
      .json({ message: "Failed to track view", error: error.message });
  }
};

// Get resume analytics
exports.getResumeAnalytics = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // Check if the resume exists and belongs to the user
    const isOwner = await checkResumeOwnership(id, userId);
    if (!isOwner) {
      return res.status(404).json({ message: "Resume not found" });
    }

    // Get total views
    const totalViews = await new Promise((resolve, reject) => {
      pool.query(
        "SELECT COUNT(*) as total FROM resume_views WHERE resume_id = ?",
        [id],
        (err, results) => {
          if (err) {
            console.error("Database error:", err);
            return reject(err);
          }
          resolve(results[0].total);
        },
      );
    });

    // Get views by date (last 30 days)
    const viewsByDate = await new Promise((resolve, reject) => {
      pool.query(
        `SELECT 
            DATE(view_date) as date, 
            COUNT(*) as views 
          FROM resume_views 
          WHERE resume_id = ? AND view_date >= DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY) 
          GROUP BY DATE(view_date) 
          ORDER BY date`,
        [id],
        (err, results) => {
          if (err) {
            console.error("Database error:", err);
            return reject(err);
          }
          resolve(results);
        },
      );
    });

    // Get views by source
    const viewsBySource = await new Promise((resolve, reject) => {
      pool.query(
        `SELECT 
            IFNULL(source, 'Direct') as source, 
            COUNT(*) as views 
          FROM resume_views 
          WHERE resume_id = ? 
          GROUP BY source 
          ORDER BY views DESC`,
        [id],
        (err, results) => {
          if (err) {
            console.error("Database error:", err);
            return reject(err);
          }
          resolve(results);
        },
      );
    });

    res.json({
      totalViews,
      viewsByDate,
      viewsBySource,
    });
  } catch (error) {
    console.error("Error fetching analytics:", error);
    res
      .status(500)
      .json({ message: "Failed to fetch analytics", error: error.message });
  }
};

// Get public resume by UUID
exports.getPublicResume = async (req, res) => {
  try {
    const { uuid } = req.params;

    if (!uuid) {
      return res.status(400).json({ message: "Resume UUID is required" });
    }

    // Get the resume
    const resume = await new Promise((resolve, reject) => {
      pool.query(
        "SELECT * FROM user_resumes WHERE resume_id = ? AND published = true",
        [uuid],
        (err, results) => {
          if (err) {
            console.error("Database error:", err);
            return reject(err);
          }

          if (results.length === 0) {
            return reject(new Error("Resume not found or not published"));
          }

          resolve(results[0]);
        },
      );
    });

    // Get all resume components
    const resumeId = resume.id;

    // Get education
    const education = await new Promise((resolve, reject) => {
      pool.query(
        "SELECT * FROM resume_education WHERE resume_id = ? ORDER BY end_date DESC",
        [resumeId],
        (err, results) => {
          if (err) {
            console.error("Database error:", err);
            return reject(err);
          }
          resolve(results);
        },
      );
    });

    // Get experience
    const experience = await new Promise((resolve, reject) => {
      pool.query(
        "SELECT * FROM resume_experience WHERE resume_id = ? ORDER BY end_date DESC",
        [resumeId],
        (err, results) => {
          if (err) {
            console.error("Database error:", err);
            return reject(err);
          }
          resolve(results);
        },
      );
    });

    // Get skills
    const skills = await new Promise((resolve, reject) => {
      pool.query(
        "SELECT * FROM resume_skills WHERE resume_id = ? ORDER BY level DESC",
        [resumeId],
        (err, results) => {
          if (err) {
            console.error("Database error:", err);
            return reject(err);
          }
          resolve(results);
        },
      );
    });

    // Get languages
    const languages = await new Promise((resolve, reject) => {
      pool.query(
        "SELECT * FROM resume_language WHERE resume_id = ?",
        [resumeId],
        (err, results) => {
          if (err) {
            console.error("Database error:", err);
            return reject(err);
          }
          resolve(results);
        },
      );
    });

    // Get certifications
    const certifications = await new Promise((resolve, reject) => {
      pool.query(
        "SELECT * FROM resume_certifications WHERE resume_id = ? ORDER BY issue_date DESC",
        [resumeId],
        (err, results) => {
          if (err) {
            console.error("Database error:", err);
            return reject(err);
          }
          resolve(results);
        },
      );
    });

    // Get custom sections
    const customSections = await new Promise((resolve, reject) => {
      pool.query(
        "SELECT * FROM resume_custom_sections WHERE resume_id = ?",
        [resumeId],
        (err, results) => {
          if (err) {
            console.error("Database error:", err);
            return reject(err);
          }
          resolve(results);
        },
      );
    });

    // Track this view
    try {
      const source = req.query.source || req.get("Referer") || null;
      await new Promise((resolve, reject) => {
        pool.query(
          "INSERT INTO resume_views (resume_id, view_date, source) VALUES (?, NOW(), ?)",
          [resumeId, source],
          (err, results) => {
            if (err) {
              console.error("Error tracking view:", err);
              // Don't reject, just log the error
            }
            resolve();
          },
        );
      });
    } catch (viewError) {
      console.error("Error tracking view:", viewError);
      // Continue execution even if tracking fails
    }

    // Combine all data
    const completeResume = {
      ...resume,
      education,
      experience,
      skills,
      languages,
      certifications,
      customSections,
    };

    res.json({ resume: completeResume });
  } catch (error) {
    console.error("Error fetching public resume:", error);
    res.status(404).json({ message: "Resume not found or not published" });
  }
};

// Toggle resume publication status
exports.togglePublishStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const { published } = req.body;

    if (published === undefined) {
      return res.status(400).json({ message: "Published status is required" });
    }

    // Check if the resume exists and belongs to the user
    const isOwner = await checkResumeOwnership(id, userId);
    if (!isOwner) {
      return res.status(404).json({ message: "Resume not found" });
    }

    // Update the publication status
    await new Promise((resolve, reject) => {
      pool.query(
        "UPDATE user_resumes SET published = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
        [published, id],
        (err, results) => {
          if (err) {
            console.error("Database error:", err);
            return reject(err);
          }
          resolve(results);
        },
      );
    });

    // If publishing, generate or update the public UUID if not already set
    if (published) {
      const resume = await new Promise((resolve, reject) => {
        pool.query(
          "SELECT resume_id FROM user_resumes WHERE id = ?",
          [id],
          (err, results) => {
            if (err) {
              console.error("Database error:", err);
              return reject(err);
            }
            resolve(results[0]);
          },
        );
      });

      if (!resume.resume_id) {
        const uuid = require("uuid").v4();
        await new Promise((resolve, reject) => {
          pool.query(
            "UPDATE user_resumes SET resume_id = ? WHERE id = ?",
            [uuid, id],
            (err, results) => {
              if (err) {
                console.error("Database error:", err);
                return reject(err);
              }
              resolve(results);
            },
          );
        });
      }
    }

    // Get the updated resume with the UUID
    const updatedResume = await new Promise((resolve, reject) => {
      pool.query(
        "SELECT id, title, resume_id, published FROM user_resumes WHERE id = ?",
        [id],
        (err, results) => {
          if (err) {
            console.error("Database error:", err);
            return reject(err);
          }
          resolve(results[0]);
        },
      );
    });

    res.json({
      message: published
        ? "Resume published successfully"
        : "Resume unpublished successfully",
      resume: updatedResume,
    });
  } catch (error) {
    console.error("Error toggling publication status:", error);
    res.status(500).json({
      message: "Failed to update publication status",
      error: error.message,
    });
  }
};

// Generate PDF version of resume
exports.generateResumePDF = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // Check if the resume exists and belongs to the user
    const isOwner = await checkResumeOwnership(id, userId);
    if (!isOwner) {
      return res.status(404).json({ message: "Resume not found" });
    }

    // Get the complete resume data
    const resume = await getCompleteResumeById(id);

    // Use a PDF generation library like PDFKit or html-pdf
    // This is a placeholder for the actual PDF generation logic
    // You would need to implement this based on your chosen PDF library

    // For example, with html-pdf:
    // 1. Generate HTML from resume data
    // 2. Convert HTML to PDF
    // 3. Send the PDF as a response

    // Placeholder response
    res.status(501).json({
      message: "PDF generation not implemented yet",
      resume: resume,
    });

    // When implemented, you would use something like:
    // res.setHeader('Content-Type', 'application/pdf');
    // res.setHeader('Content-Disposition', `attachment; filename="resume-${id}.pdf"`);
    // pdfStream.pipe(res);
  } catch (error) {
    console.error("Error generating PDF:", error);
    res
      .status(500)
      .json({ message: "Failed to generate PDF", error: error.message });
  }
};

// Helper function to get complete resume data by ID
const getCompleteResumeById = async (id) => {
  // Get the resume
  const resume = await new Promise((resolve, reject) => {
    pool.query(
      "SELECT * FROM user_resumes WHERE id = ?",
      [id],
      (err, results) => {
        if (err) {
          console.error("Database error:", err);
          return reject(err);
        }

        if (results.length === 0) {
          return reject(new Error("Resume not found"));
        }

        resolve(results[0]);
      },
    );
  });

  // Get education
  const education = await new Promise((resolve, reject) => {
    pool.query(
      "SELECT * FROM resume_education WHERE resume_id = ? ORDER BY end_date DESC",
      [id],
      (err, results) => {
        if (err) {
          console.error("Database error:", err);
          return reject(err);
        }
        resolve(results);
      },
    );
  });

  // Get experience
  const experience = await new Promise((resolve, reject) => {
    pool.query(
      "SELECT * FROM resume_experience WHERE resume_id = ? ORDER BY end_date DESC",
      [id],
      (err, results) => {
        if (err) {
          console.error("Database error:", err);
          return reject(err);
        }
        resolve(results);
      },
    );
  });

  // Get skills
  const skills = await new Promise((resolve, reject) => {
    pool.query(
      "SELECT * FROM resume_skills WHERE resume_id = ? ORDER BY level DESC",
      [id],
      (err, results) => {
        if (err) {
          console.error("Database error:", err);
          return reject(err);
        }
        resolve(results);
      },
    );
  });

  // Get languages
  const languages = await new Promise((resolve, reject) => {
    pool.query(
      "SELECT * FROM resume_language WHERE resume_id = ?",
      [id],
      (err, results) => {
        if (err) {
          console.error("Database error:", err);
          return reject(err);
        }
        resolve(results);
      },
    );
  });

  // Get certifications
  const certifications = await new Promise((resolve, reject) => {
    pool.query(
      "SELECT * FROM resume_certifications WHERE resume_id = ? ORDER BY issue_date DESC",
      [id],
      (err, results) => {
        if (err) {
          console.error("Database error:", err);
          return reject(err);
        }
        resolve(results);
      },
    );
  });

  // Get custom sections
  const customSections = await new Promise((resolve, reject) => {
    pool.query(
      "SELECT * FROM resume_custom_sections WHERE resume_id = ?",
      [id],
      (err, results) => {
        if (err) {
          console.error("Database error:", err);
          return reject(err);
        }
        resolve(results);
      },
    );
  });

  // Combine all data
  return {
    ...resume,
    education,
    experience,
    skills,
    languages,
    certifications,
    customSections,
  };
};

// Export resume as JSON
exports.exportResumeJson = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // Check if the resume exists and belongs to the user
    const isOwner = await checkResumeOwnership(id, userId);
    if (!isOwner) {
      return res.status(404).json({ message: "Resume not found" });
    }

    // Get the complete resume data
    const resume = await getCompleteResumeById(id);

    // Set headers for file download
    res.setHeader("Content-Type", "application/json");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="resume-${id}.json"`,
    );

    // Send the JSON data
    res.json(resume);
  } catch (error) {
    console.error("Error exporting resume:", error);
    res
      .status(500)
      .json({ message: "Failed to export resume", error: error.message });
  }
};

// Import resume from JSON
exports.importResumeJson = async (req, res) => {
  try {
    const userId = req.user.id;
    const resumeData = req.body;

    if (!resumeData || !resumeData.title) {
      return res.status(400).json({ message: "Invalid resume data" });
    }

    // Start a transaction
    const connection = await new Promise((resolve, reject) => {
      pool.getConnection((err, connection) => {
        if (err) {
          console.error("Database connection error:", err);
          return reject(err);
        }
        resolve(connection);
      });
    });

    try {
      await new Promise((resolve, reject) => {
        connection.beginTransaction((err) => {
          if (err) {
            console.error("Transaction error:", err);
            return reject(err);
          }
          resolve();
        });
      });

      // Create the resume
      const insertResult = await new Promise((resolve, reject) => {
        connection.query(
          `INSERT INTO user_resumes 
            (user_id, title, summary, contact_email, contact_phone, website, location, template) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            userId,
            resumeData.title,
            resumeData.summary || null,
            resumeData.contact_email || null,
            resumeData.contact_phone || null,
            resumeData.website || null,
            resumeData.location || null,
            resumeData.template || "default",
          ],
          (err, results) => {
            if (err) {
              console.error("Database error:", err);
              return reject(err);
            }
            resolve(results);
          },
        );
      });

      const resumeId = insertResult.insertId;

      // Import education if available
      if (
        resumeData.education &&
        Array.isArray(resumeData.education) &&
        resumeData.education.length > 0
      ) {
        const educationValues = resumeData.education.map((edu) => [
          resumeId,
          edu.school,
          edu.degree,
          edu.field_of_study || null,
          edu.start_date || null,
          edu.end_date || null,
          edu.description || null,
        ]);

        await new Promise((resolve, reject) => {
          connection.query(
            `INSERT INTO resume_education 
              (resume_id, school, degree, field_of_study, start_date, end_date, description) 
              VALUES ?`,
            [educationValues],
            (err, results) => {
              if (err) {
                console.error("Database error:", err);
                return reject(err);
              }
              resolve(results);
            },
          );
        });
      }

      // Import experience if available
      if (
        resumeData.experience &&
        Array.isArray(resumeData.experience) &&
        resumeData.experience.length > 0
      ) {
        const experienceValues = resumeData.experience.map((exp) => [
          resumeId,
          exp.company,
          exp.position,
          exp.start_date || null,
          exp.end_date || null,
          exp.current || false,
          exp.description || null,
        ]);

        await new Promise((resolve, reject) => {
          connection.query(
            `INSERT INTO resume_experience 
              (resume_id, company, position, start_date, end_date, current, description) 
              VALUES ?`,
            [experienceValues],
            (err, results) => {
              if (err) {
                console.error("Database error:", err);
                return reject(err);
              }
              resolve(results);
            },
          );
        });
      }

      // Import skills if available
      if (
        resumeData.skills &&
        Array.isArray(resumeData.skills) &&
        resumeData.skills.length > 0
      ) {
        const skillValues = resumeData.skills.map((skill) => [
          resumeId,
          skill.name,
          skill.level || 0,
        ]);

        await new Promise((resolve, reject) => {
          connection.query(
            "INSERT INTO resume_skills (resume_id, name, level) VALUES ?",
            [skillValues],
            (err, results) => {
              if (err) {
                console.error("Database error:", err);
                return reject(err);
              }
              resolve(results);
            },
          );
        });
      }

      // Import languages if available
      if (
        resumeData.languages &&
        Array.isArray(resumeData.languages) &&
        resumeData.languages.length > 0
      ) {
        const languageValues = resumeData.languages.map((lang) => [
          resumeId,
          lang.language,
          lang.proficiency || null,
        ]);

        await new Promise((resolve, reject) => {
          connection.query(
            "INSERT INTO resume_language (resume_id, language, proficiency) VALUES ?",
            [languageValues],
            (err, results) => {
              if (err) {
                console.error("Database error:", err);
                return reject(err);
              }
              resolve(results);
            },
          );
        });
      }

      // Import certifications if available
      if (
        resumeData.certifications &&
        Array.isArray(resumeData.certifications) &&
        resumeData.certifications.length > 0
      ) {
        const certValues = resumeData.certifications.map((cert) => [
          resumeId,
          cert.name,
          cert.issuer,
          cert.issue_date || null,
          cert.expiration_date || null,
          cert.credential_id || null,
          cert.credential_url || null,
        ]);

        await new Promise((resolve, reject) => {
          connection.query(
            `INSERT INTO resume_certifications 
              (resume_id, name, issuer, issue_date, expiration_date, credential_id, credential_url) 
              VALUES ?`,
            [certValues],
            (err, results) => {
              if (err) {
                console.error("Database error:", err);
                return reject(err);
              }
              resolve(results);
            },
          );
        });
      }

      // Import custom sections if available
      if (
        resumeData.customSections &&
        Array.isArray(resumeData.customSections) &&
        resumeData.customSections.length > 0
      ) {
        const sectionValues = resumeData.customSections.map((section) => [
          resumeId,
          section.title,
          section.content,
        ]);

        await new Promise((resolve, reject) => {
          connection.query(
            "INSERT INTO resume_custom_sections (resume_id, title, content) VALUES ?",
            [sectionValues],
            (err, results) => {
              if (err) {
                console.error("Database error:", err);
                return reject(err);
              }
              resolve(results);
            },
          );
        });
      }

      // Commit the transaction
      // Commit the transaction
      await new Promise((resolve, reject) => {
        connection.commit((err) => {
          if (err) {
            console.error("Commit error:", err);
            return connection.rollback(() => {
              reject(err);
            });
          }
          resolve();
        });
      });

      // Release the connection
      connection.release();

      res.status(201).json({
        message: "Resume imported successfully",
        resumeId: resumeId,
      });
    } catch (error) {
      // Rollback the transaction on error
      await new Promise((resolve) => {
        connection.rollback(() => {
          connection.release();
          resolve();
        });
      });

      throw error;
    }
  } catch (error) {
    console.error("Error importing resume:", error);
    res
      .status(500)
      .json({ message: "Failed to import resume", error: error.message });
  }
};

// Add custom section
exports.addCustomSection = async (req, res) => {
  console.log("addCustomSection endpoint hit");
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const { title, content } = req.body;

    console.log("Adding custom section with data:", req.body);
    console.log("Resume ID:", id);

    // Validate required fields
    if (!title || !content) {
      return res
        .status(400)
        .json({ message: "Section title and content are required" });
    }

    // Get the database ID from the resume_id
    const [resumeResults] = await pool.query(
      "SELECT id FROM user_resumes WHERE resume_id = ? AND user_id = ?",
      [id, userId],
    );

    if (resumeResults.length === 0) {
      return res.status(404).json({ message: "Resume not found" });
    }

    const resumeDbId = resumeResults[0].id;
    console.log("Found resume database ID:", resumeDbId);

    // Insert the custom section
    const [result] = await pool.query(
      "INSERT INTO resume_custom_sections (resume_id, title, content) VALUES (?, ?, ?)",
      [resumeDbId, title, content],
    );

    // Update the resume's updated_at timestamp
    await pool.query(
      "UPDATE user_resumes SET updated_at = CURRENT_TIMESTAMP WHERE id = ?",
      [resumeDbId],
    );

    res.status(201).json({
      message: "Custom section added successfully",
      sectionId: result.insertId,
    });
  } catch (error) {
    console.error("Error adding custom section:", error);
    res
      .status(500)
      .json({ message: "Failed to add custom section", error: error.message });
  }
};

// Update custom section
exports.updateCustomSection = async (req, res) => {
  try {
    const { id, sectionId } = req.params;
    const userId = req.user.id;
    const { title, content } = req.body;

    console.log("Updating custom section:", {
      id,
      sectionId,
      userId,
      requestBody: req.body,
    });

    // Get the database ID from the resume_id
    const [resumeResults] = await pool.query(
      "SELECT id FROM user_resumes WHERE resume_id = ? AND user_id = ?",
      [id, userId],
    );

    if (resumeResults.length === 0) {
      return res.status(404).json({ message: "Resume not found" });
    }

    const resumeDbId = resumeResults[0].id;
    console.log("Found resume database ID:", resumeDbId);

    // Build the query dynamically based on provided fields
    const fields = [];
    const values = [];

    if (title !== undefined) {
      fields.push("title = ?");
      values.push(title);
    }

    if (content !== undefined) {
      fields.push("content = ?");
      values.push(content);
    }

    // If no fields to update, return early
    if (fields.length === 0) {
      return res.status(400).json({ message: "No fields to update" });
    }

    // Add the section ID and resume DB ID to values array
    values.push(sectionId);
    values.push(resumeDbId);

    // Update the custom section
    const [updateResult] = await pool.query(
      `UPDATE resume_custom_sections SET ${fields.join(
        ", ",
      )} WHERE id = ? AND resume_id = ?`,
      values,
    );

    if (updateResult.affectedRows === 0) {
      return res.status(404).json({ message: "Custom section not found" });
    }

    // Update the resume's updated_at timestamp
    await pool.query(
      "UPDATE user_resumes SET updated_at = CURRENT_TIMESTAMP WHERE id = ?",
      [resumeDbId],
    );

    res.json({ message: "Custom section updated successfully" });
  } catch (error) {
    console.error("Error updating custom section:", error);
    res.status(500).json({
      message: "Failed to update custom section",
      error: error.message,
    });
  }
};

// Delete custom section
exports.deleteCustomSection = async (req, res) => {
  try {
    const { id, sectionId } = req.params;
    const userId = req.user.id;

    console.log("Deleting custom section:", { id, sectionId, userId });

    // Get the database ID from the resume_id
    const [resumeResults] = await pool.query(
      "SELECT id FROM user_resumes WHERE resume_id = ? AND user_id = ?",
      [id, userId],
    );

    if (resumeResults.length === 0) {
      return res.status(404).json({ message: "Resume not found" });
    }

    const resumeDbId = resumeResults[0].id;
    console.log("Found resume database ID:", resumeDbId);

    // Delete the custom section
    const [deleteResult] = await pool.query(
      "DELETE FROM resume_custom_sections WHERE id = ? AND resume_id = ?",
      [sectionId, resumeDbId],
    );

    if (deleteResult.affectedRows === 0) {
      return res.status(404).json({ message: "Custom section not found" });
    }

    // Update the resume's updated_at timestamp
    await pool.query(
      "UPDATE user_resumes SET updated_at = CURRENT_TIMESTAMP WHERE id = ?",
      [resumeDbId],
    );

    res.json({ message: "Custom section deleted successfully" });
  } catch (error) {
    console.error("Error deleting custom section:", error);
    res.status(500).json({
      message: "Failed to delete custom section",
      error: error.message,
    });
  }
};
