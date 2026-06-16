
const pool = require("../config/db");
require("dotenv").config();

async function runMigration() {
  try {
    console.log("Running migration: Adding reset password token columns to users table...");

    await pool.execute(`
      ALTER TABLE users 
      ADD COLUMN reset_password_token VARCHAR(255) NULL,
      ADD COLUMN reset_password_expires DATETIME NULL
    `);

    console.log("✅ Migration completed successfully!");
    process.exit(0);
  } catch (error) {
    if (error.code === "ER_DUP_FIELDNAME") {
      console.log("ℹ️ Columns already exist, skipping migration.");
      process.exit(0);
    } else {
      console.error("❌ Migration failed:", error);
      process.exit(1);
    }
  }
}

runMigration();
