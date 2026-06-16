
const bcrypt = require("bcryptjs");
const pool = require("./config/db");
require("dotenv").config();

// Configure readline for user input
const readline = require("readline").createInterface({
  input: process.stdin,
  output: process.stdout,
});

const askQuestion = (query) =>
  new Promise((resolve) => readline.question(query, resolve));

async function resetPassword() {
  try {
    console.log("=== Password Reset Tool ===");
    const email = await askQuestion("Enter your registered email: ");
    const newPassword = await askQuestion("Enter your new password: ");
    readline.close();

    // Find user by email
    const [users] = await pool.execute("SELECT * FROM users WHERE email = ?", [email]);
    if (users.length === 0) {
      console.error("❌ No user found with that email.");
      process.exit(1);
    }
    const user = users[0];

    // Hash new password
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(newPassword, salt);

    // Update password in database
    await pool.execute("UPDATE users SET password = ? WHERE id = ?", [passwordHash, user.id]);

    console.log("✅ Password reset successful!");
    console.log(`You can now log in with email: ${email} and your new password.`);
    process.exit(0);
  } catch (error) {
    console.error("❌ Error resetting password:", error);
    process.exit(1);
  }
}

resetPassword();
