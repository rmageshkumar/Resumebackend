require("dotenv").config();
const mysql = require("mysql2/promise");

async function main() {
  const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME,
    waitForConnections: true,
    connectionLimit: 1,
    queueLimit: 0,
  });

  try {
    await pool.execute(
      "ALTER TABLE users ADD COLUMN is_admin TINYINT(1) NOT NULL DEFAULT 0",
    );
    console.log("✅ is_admin column added");
  } catch (e) {
    console.log("Column may already exist:", e.message.substring(0, 80));
  }

  const [rows] = await pool.execute(
    "SELECT id, email, is_admin FROM users WHERE email = ?",
    ["mageshkumar.it@gmail.com"],
  );

  if (rows.length > 0) {
    console.log("Found user:", rows[0]);
    await pool.execute("UPDATE users SET is_admin = 1 WHERE email = ?", [
      "mageshkumar.it@gmail.com",
    ]);
    console.log("✅ is_admin set to 1 for mageshkumar.it@gmail.com");
  } else {
    console.log("User not found with that email. Checking all users...");
    const [all] = await pool.execute(
      "SELECT id, email, is_admin FROM users LIMIT 10",
    );
    console.log("Users:", all);
  }

  await pool.end();
}

main().catch((e) => console.error("Error:", e.message));
