const pool = require("../config/db");
require("dotenv").config();

/**
 * Slugify a string for URL use
 */
function slugify(text) {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^\w-]+/g, "")
    .replace(/--+/g, "-")
    .replace(/^-+/, "")
    .replace(/-+$/, "")
    .substring(0, 100);
}

async function runMigration() {
  try {
    console.log("Running migration: Adding slug column to user_resumes...");

    // Step 1: Add slug column (nullable initially)
    await pool.execute(`
      ALTER TABLE user_resumes
      ADD COLUMN slug VARCHAR(255) NULL,
      ADD UNIQUE INDEX idx_slug_unique (slug)
    `);

    console.log("✅ slug column added successfully!");

    // Step 2: Backfill slugs for existing resumes
    console.log("Backfilling slugs for existing resumes...");

    const [resumes] = await pool.query(
      "SELECT id, resume_id, first_name, last_name, title FROM user_resumes WHERE slug IS NULL",
    );

    let updated = 0;
    let skipped = 0;

    for (const resume of resumes) {
      const baseSlug =
        slugify(
          [resume.first_name, resume.last_name, resume.title]
            .filter(Boolean)
            .join("-"),
        ) || resume.resume_id.substring(0, 8);

      // Ensure uniqueness
      let slug = baseSlug;
      let counter = 0;
      let unique = false;

      while (!unique && counter < 100) {
        try {
          const suffix = counter > 0 ? `-${counter}` : "";
          await pool.execute("UPDATE user_resumes SET slug = ? WHERE id = ?", [
            slug + suffix,
            resume.id,
          ]);
          unique = true;
          updated++;
        } catch (err) {
          if (err.code === "ER_DUP_ENTRY") {
            counter++;
          } else {
            throw err;
          }
        }
      }

      if (!unique) {
        // Fallback: use UUID-based slug
        const fallbackSlug = `resume-${resume.resume_id.substring(0, 8)}`;
        await pool.execute("UPDATE user_resumes SET slug = ? WHERE id = ?", [
          fallbackSlug,
          resume.id,
        ]);
        updated++;
      }
    }

    console.log(`✅ Backfilled ${updated} resumes with slugs`);

    process.exit(0);
  } catch (error) {
    if (error.code === "ER_DUP_FIELDNAME") {
      console.log("ℹ️ slug column already exists, skipping...");
      process.exit(0);
    } else {
      console.error("❌ Migration failed:", error);
      process.exit(1);
    }
  }
}

runMigration();
