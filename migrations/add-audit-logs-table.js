const pool = require("../config/db");

async function runMigration() {
  try {
    console.log("Running migration: Creating audit_logs table...");

    await pool.execute(`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        action VARCHAR(100) NOT NULL,
        resource VARCHAR(50) DEFAULT NULL,
        resource_id VARCHAR(255) DEFAULT NULL,
        details JSON DEFAULT NULL,
        ip_address VARCHAR(45) DEFAULT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_user_id (user_id),
        INDEX idx_action (action),
        INDEX idx_created_at (created_at),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    console.log("✅ Audit logs table created successfully!");
    process.exit(0);
  } catch (error) {
    if (error.code === "ER_TABLE_EXISTS_ERROR") {
      console.log("ℹ️ audit_logs table already exists.");
      process.exit(0);
    } else {
      console.error("❌ Migration failed:", error);
      process.exit(1);
    }
  }
}

runMigration();
