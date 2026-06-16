const pool = require("../config/db");
require("dotenv").config();

async function runMigration() {
  try {
    console.log(
      "Running migration: Adding subscription fields and purchase table...",
    );

    await pool.execute(`
      ALTER TABLE users
      ADD COLUMN stripe_customer_id VARCHAR(255) NULL,
      ADD COLUMN stripe_subscription_id VARCHAR(255) NULL,
      ADD COLUMN subscription_plan VARCHAR(50) NOT NULL DEFAULT 'free',
      ADD COLUMN subscription_status VARCHAR(50) NOT NULL DEFAULT 'inactive'
    `);

    await pool.execute(`
      CREATE TABLE IF NOT EXISTS template_purchases (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        template_id VARCHAR(255) NOT NULL,
        price VARCHAR(50) DEFAULT NULL,
        purchased_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY unique_user_template (user_id, template_id),
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    console.log("✅ Subscription migration completed successfully!");
    process.exit(0);
  } catch (error) {
    if (error.code === "ER_DUP_FIELDNAME") {
      console.log("ℹ️ Some subscription fields already exist, continuing...");
    } else if (error.code === "ER_TABLE_EXISTS_ERROR") {
      console.log("ℹ️ template_purchases table already exists, continuing...");
    } else {
      console.error("❌ Migration failed:", error);
      process.exit(1);
    }
  }
}

runMigration();
