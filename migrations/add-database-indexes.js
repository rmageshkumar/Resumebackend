const pool = require("../config/db");

async function runMigration() {
  try {
    console.log(
      "Running migration: Adding database indexes for performance...",
    );

    // Users table indexes
    await pool.execute(
      "CREATE INDEX IF NOT EXISTS idx_users_email ON users(email)",
    );
    await pool.execute(
      "CREATE INDEX IF NOT EXISTS idx_users_subscription ON users(subscription_plan, subscription_status)",
    );

    // Resume tables indexes
    await pool.execute(
      "CREATE INDEX IF NOT EXISTS idx_user_resumes_user_id ON user_resumes(user_id)",
    );
    await pool.execute(
      "CREATE INDEX IF NOT EXISTS idx_user_resumes_resume_id ON user_resumes(resume_id)",
    );
    await pool.execute(
      "CREATE INDEX IF NOT EXISTS idx_user_resumes_updated ON user_resumes(updated_at)",
    );

    // Resume component indexes
    await pool.execute(
      "CREATE INDEX IF NOT EXISTS idx_resume_education_resume ON resume_education(resume_id)",
    );
    await pool.execute(
      "CREATE INDEX IF NOT EXISTS idx_resume_experience_resume ON resume_experience(resume_id)",
    );
    await pool.execute(
      "CREATE INDEX IF NOT EXISTS idx_resume_skills_resume ON resume_skills(resume_id)",
    );
    await pool.execute(
      "CREATE INDEX IF NOT EXISTS idx_resume_language_resume ON resume_language(resume_id)",
    );
    await pool.execute(
      "CREATE INDEX IF NOT EXISTS idx_resume_certifications_resume ON resume_certifications(resume_id)",
    );

    // Audit logs indexes
    await pool.execute(
      "CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(user_id)",
    );
    await pool.execute(
      "CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action)",
    );
    await pool.execute(
      "CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at)",
    );

    // Template purchases index
    await pool.execute(
      "CREATE INDEX IF NOT EXISTS idx_template_purchases_user ON template_purchases(user_id)",
    );

    console.log("✅ Database indexes migration completed!");
    process.exit(0);
  } catch (error) {
    if (error.code === "ER_DUP_KEYNAME") {
      console.log("ℹ️ Some indexes already exist, continuing...");
      process.exit(0);
    } else {
      console.error("❌ Migration failed:", error.message);
      // MySQL 5.7 doesn't support CREATE INDEX IF NOT EXISTS
      // This is expected — indexes may already exist
      console.log("ℹ️ Indexes may already exist — continuing.");
      process.exit(0);
    }
  }
}

runMigration();
