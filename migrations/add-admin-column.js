const pool = require("../config/db");

async function runMigration() {
  try {
    console.log("Running migration: Adding is_admin column to users...");

    await pool.execute(`
      ALTER TABLE users
      ADD COLUMN is_admin TINYINT(1) NOT NULL DEFAULT 0
    `);

    // Set existing admin user
    await pool.execute(
      "UPDATE users SET is_admin = 1 WHERE email = 'mageshkumar.it@gmail.com'",
    );

    console.log("✅ Admin column added successfully!");
    process.exit(0);
  } catch (error) {
    if (error.code === "ER_DUP_FIELDNAME") {
      console.log("ℹ️ is_admin column already exists.");
      process.exit(0);
    } else {
      console.error("❌ Migration failed:", error.message);
      process.exit(1);
    }
  }
}

runMigration();
