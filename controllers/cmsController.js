const pool = require("../config/db");

// Public: Get a page by slug
exports.getPage = async (req, res) => {
  try {
    const { slug } = req.params;
    const [rows] = await pool.query("SELECT * FROM cms_pages WHERE slug = ?", [
      slug,
    ]);
    if (rows.length === 0) {
      return res.status(404).json({ message: "Page not found" });
    }
    res.json(rows[0]);
  } catch (error) {
    console.error("Error fetching CMS page:", error);
    res.status(500).json({ message: "Failed to fetch page" });
  }
};

// Admin: Get all pages
exports.listPages = async (req, res) => {
  try {
    const [rows] = await pool.query(
      "SELECT id, slug, title, updated_at FROM cms_pages ORDER BY id",
    );
    res.json(rows);
  } catch (error) {
    console.error("Error listing CMS pages:", error);
    res.status(500).json({ message: "Failed to list pages" });
  }
};

// Admin: Get a single page by ID
exports.getPageById = async (req, res) => {
  try {
    const { id } = req.params;
    const [rows] = await pool.query("SELECT * FROM cms_pages WHERE id = ?", [
      id,
    ]);
    if (rows.length === 0) {
      return res.status(404).json({ message: "Page not found" });
    }
    res.json(rows[0]);
  } catch (error) {
    console.error("Error fetching CMS page:", error);
    res.status(500).json({ message: "Failed to fetch page" });
  }
};

// Admin: Update a page
exports.updatePage = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, content } = req.body;

    if (!title) {
      return res.status(400).json({ message: "Title is required" });
    }

    await pool.query(
      "UPDATE cms_pages SET title = ?, content = ? WHERE id = ?",
      [title, content, id],
    );

    const [rows] = await pool.query("SELECT * FROM cms_pages WHERE id = ?", [
      id,
    ]);
    res.json(rows[0]);
  } catch (error) {
    console.error("Error updating CMS page:", error);
    res.status(500).json({ message: "Failed to update page" });
  }
};

// Admin: Get admin notification emails (returns array)
exports.getAdminEmail = async (req, res) => {
  try {
    const [rows] = await pool.query(
      "SELECT setting_value FROM settings WHERE setting_key = 'admin_emails'",
    );
    let emails = [];
    if (rows.length > 0) {
      try {
        emails = JSON.parse(rows[0].setting_value);
      } catch {
        emails = [rows[0].setting_value];
      }
    }
    if (emails.length === 0) {
      const fallback =
        process.env.ADMIN_EMAIL ||
        process.env.EMAIL_USER ||
        "prosummocom@gmail.com";
      emails = [fallback];
    }
    res.json({ emails });
  } catch (error) {
    console.error("Error getting admin emails:", error);
    res.status(500).json({ message: "Failed to get admin emails" });
  }
};

// Admin: Add a notification email
exports.addAdminEmail = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: "Email is required" });

    const [rows] = await pool.query(
      "SELECT setting_value FROM settings WHERE setting_key = 'admin_emails'",
    );
    let emails = [];
    if (rows.length > 0) {
      try {
        emails = JSON.parse(rows[0].setting_value);
      } catch {
        emails = [rows[0].setting_value];
      }
    }
    if (!Array.isArray(emails)) emails = [emails];

    if (emails.includes(email.trim())) {
      return res.status(400).json({ message: "Email already exists" });
    }

    emails.push(email.trim());
    await pool.query(
      "INSERT INTO settings (setting_key, setting_value) VALUES ('admin_emails', ?) ON DUPLICATE KEY UPDATE setting_value = ?",
      [JSON.stringify(emails), JSON.stringify(emails)],
    );
    res.json({ emails, message: "Email added successfully" });
  } catch (error) {
    console.error("Error adding admin email:", error);
    res.status(500).json({ message: "Failed to add email" });
  }
};

// Admin: Delete a notification email
exports.deleteAdminEmail = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: "Email is required" });

    const [rows] = await pool.query(
      "SELECT setting_value FROM settings WHERE setting_key = 'admin_emails'",
    );
    let emails = [];
    if (rows.length > 0) {
      try {
        emails = JSON.parse(rows[0].setting_value);
      } catch {
        emails = [rows[0].setting_value];
      }
    }
    if (!Array.isArray(emails)) emails = [emails];

    emails = emails.filter((e) => e !== email.trim());
    await pool.query(
      "INSERT INTO settings (setting_key, setting_value) VALUES ('admin_emails', ?) ON DUPLICATE KEY UPDATE setting_value = ?",
      [JSON.stringify(emails), JSON.stringify(emails)],
    );
    res.json({ emails, message: "Email removed successfully" });
  } catch (error) {
    console.error("Error deleting admin email:", error);
    res.status(500).json({ message: "Failed to delete email" });
  }
};

// Contact form submission
exports.submitContact = async (req, res) => {
  try {
    const { name, email, subject, message } = req.body;
    if (!name || !email || !message) {
      return res
        .status(400)
        .json({ message: "Name, email, and message are required" });
    }

    // Get admin emails from settings (stored as JSON array)
    const [rows] = await pool.query(
      "SELECT setting_value FROM settings WHERE setting_key = 'admin_emails'",
    );
    let adminEmails = [];
    if (rows.length > 0) {
      try {
        adminEmails = JSON.parse(rows[0].setting_value);
      } catch {
        adminEmails = [rows[0].setting_value];
      }
    }
    if (!Array.isArray(adminEmails) || adminEmails.length === 0) {
      adminEmails = [
        process.env.ADMIN_EMAIL ||
          process.env.EMAIL_USER ||
          "prosummocom@gmail.com",
      ];
    }

    console.log(
      `Contact form from ${name} (${email}): ${subject || "No subject"} -> ${adminEmails.join(", ")}`,
    );

    // Create contact_submissions table if not exists
    await pool.query(
      "CREATE TABLE IF NOT EXISTS contact_submissions (id INT AUTO_INCREMENT PRIMARY KEY, name VARCHAR(255), email VARCHAR(255), subject VARCHAR(255), message TEXT, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)",
    );

    // Store submission
    await pool.query(
      "INSERT INTO contact_submissions (name, email, subject, message) VALUES (?, ?, ?, ?)",
      [name, email, subject || "", message],
    );

    // Try email notification to all admin emails
    try {
      const nodemailer = require("nodemailer");
      const transporter = nodemailer.createTransport({
        service: "gmail",
        auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
      });
      const mailBody = `<h2>Contact Form Submission</h2><p><strong>Name:</strong> ${name}</p><p><strong>Email:</strong> ${email}</p><p><strong>Subject:</strong> ${subject || "N/A"}</p><p><strong>Message:</strong></p><p>${message}</p>`;
      for (const adminEmail of adminEmails) {
        try {
          await transporter.sendMail({
            from: `"${name}" <${process.env.EMAIL_USER}>`,
            replyTo: email,
            to: adminEmail,
            subject: `[ProSummo Contact] ${subject || "New Message"} from ${name}`,
            html: mailBody,
          });
        } catch (e) {
          console.error(`Failed to send to ${adminEmail}:`, e.message);
        }
      }
    } catch (mailErr) {
      console.error("Contact email send failed:", mailErr.message);
    }

    res.json({
      message: "Message sent successfully. We'll get back to you soon.",
    });
  } catch (error) {
    console.error("Contact form error:", error);
    res.status(500).json({ message: "Failed to submit message" });
  }
};

// Admin: List contact submissions
exports.listContacts = async (req, res) => {
  try {
    await pool.query(
      "CREATE TABLE IF NOT EXISTS contact_submissions (id INT AUTO_INCREMENT PRIMARY KEY, name VARCHAR(255), email VARCHAR(255), subject VARCHAR(255), message TEXT, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)",
    );
    const [rows] = await pool.query(
      "SELECT * FROM contact_submissions ORDER BY created_at DESC",
    );
    res.json(rows);
  } catch (error) {
    console.error("Error listing contacts:", error);
    res.status(500).json({ message: "Failed to list contacts" });
  }
};
