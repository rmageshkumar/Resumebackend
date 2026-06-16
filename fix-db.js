const pool = require("./config/db");

async function fixDatabase() {
  console.log("=== Fixing database...");
  try {
    console.log("\n1. Checking current users table columns:");
    const [cols] = await pool.execute("DESCRIBE users");
    console.log(cols.map((c) => "   - " + c.Field));

    const hasProfileImage = cols.some((c) => c.Field === "profileImage");

    if (!hasProfileImage) {
      console.log("\n2. Adding profileImage column...");
      await pool.execute("ALTER TABLE users ADD COLUMN profileImage TEXT");
      console.log("✅ profileImage column added successfully!");
    } else {
      console.log("\n2. profileImage column already exists!");
    }

    console.log("\n✅ Database is ready!");
    process.exit(0);
  } catch (error) {
    console.error("\n❌ Error:", error);
    process.exit(1);
  }
}

fixDatabase();
