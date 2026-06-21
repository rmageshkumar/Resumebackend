const mysql = require("mysql2/promise");
require("dotenv").config();

// Create a connection pool
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10, // Adjust as needed
  queueLimit: 0,
});

// Test the connection (optional)
async function testDBConnection() {
  try {
    const connection = await pool.getConnection();
    console.log("✅ MySQL Connected...");
    connection.release(); // Release the connection back to the pool
  } catch (err) {
    console.error("❌ MySQL Connection Failed:", err.message);
    console.error(
      "Server will keep running so health checks can pass; database-backed routes may fail until MySQL is reachable.",
    );
  }
}

testDBConnection(); // Run the test on startup

module.exports = pool;
