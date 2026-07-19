const mysql = require("mysql2/promise");
const bcrypt = require("bcryptjs");
(async () => {
  const conn = await mysql.createConnection({
    host: "localhost",
    user: "root",
    password: "12345678",
    database: "prosummo_db",
    socketPath: "/tmp/mysql.sock",
  });
  const [rows] = await conn.query(
    "SELECT id, name, email FROM users WHERE email = ?",
    ["mageshkumar.it@gmail.com"],
  );
  console.log("Found user:", rows[0]);

  const [urows] = await conn.query(
    "SELECT password FROM users WHERE email = ?",
    ["mageshkumar.it@gmail.com"],
  );
  if (urows.length > 0) {
    const match = await bcrypt.compare("12345678", urows[0].password);
    console.log("Password 12345678 matches:", match);
    if (!match) {
      const salt = await bcrypt.genSalt(10);
      const hash = await bcrypt.hash("12345678", salt);
      await conn.query("UPDATE users SET password = ? WHERE email = ?", [
        hash,
        "mageshkumar.it@gmail.com",
      ]);
      console.log("Password updated!");
    } else {
      console.log("Password already correct");
    }
  }
  await conn.end();
})().catch((e) => console.error(e.message));
