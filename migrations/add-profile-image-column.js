const pool = require("../config/db");

async function addProfileImageColumn() {
  try {
    console.log("Adding profileImage column to users table...");
    
    const [result] = await pool.execute(`
      ALTER TABLE users 
      ADD COLUMN profileImage TEXT 
    `);
    
    console.log("Successfully added profileImage column!");
    process.exit(0);
  } catch (error) {
    if (error.code === 'ER_DUP_FIELDNAME') {
      console.log("profileImage column already exists!");
      process.exit(0);
    }
    
    console.error("Error adding profileImage column:", error);
    process.exit(1);
  }
}

addProfileImageColumn();
