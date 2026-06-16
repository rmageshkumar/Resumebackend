const pool = require("./config/db");
require("dotenv").config();

async function debug() {
  try {
    console.log("=== Users Table ===");
    const [users] = await pool.query("SELECT id, name, email FROM users");
    console.table(users);
  } catch (error) {
    console.error("Error:", error);
  } finally {
    process.exit(0);
  }
}

debug();
