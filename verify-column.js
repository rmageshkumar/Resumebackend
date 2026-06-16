const pool = require("./config/db");

async function verifyColumn() {
  try {
    console.log("Checking users table structure...");
    
    const [columns] = await pool.execute("DESCRIBE users");
    
    console.log("\nColumns in users table:");
    columns.forEach(col => console.log(`- ${col.Field} (${col.Type})`));
    
    const hasProfileImage = columns.some(col => col.Field === 'profileImage');
    console.log(`\nprofileImage column exists: ${hasProfileImage ? "✅" : "❌"}`);
    
    process.exit(0);
  } catch (error) {
    console.error("Error verifying column:", error);
    process.exit(1);
  }
}

verifyColumn();
