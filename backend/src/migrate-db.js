/**
 * Database Migration Script
 * Adds refresh_token and timestamp columns to existing users table
 * 
 * Run this script if you have an existing database:
 * node migrate-db.js
 */

const sqlite3 = require("sqlite3").verbose();
const path = require("path");

const dbPath = path.join(__dirname, "users.db");
const db = new sqlite3.Database(dbPath);

console.log("🔄 Starting database migration...\n");

db.serialize(() => {
  // Check if columns already exist
  db.all("PRAGMA table_info(users)", (err, columns) => {
    if (err) {
      console.error("❌ Error reading table info:", err);
      return;
    }

    const columnNames = columns.map(col => col.name);
    const hasRefreshToken = columnNames.includes("refresh_token");
    const hasCreatedAt = columnNames.includes("created_at");
    const hasUpdatedAt = columnNames.includes("updated_at");
    const hasViewHistory = columnNames.includes("view_history");
    const hasResetToken = columnNames.includes("password_reset_token");
    const hasResetExpires = columnNames.includes("password_reset_expires");
    const hasPreferredLang = columnNames.includes("preferred_language");

    if (hasRefreshToken && hasCreatedAt && hasUpdatedAt && hasViewHistory && hasResetToken && hasResetExpires && hasPreferredLang) {
      console.log("✅ Database is already up to date!");
      db.close();
      return;
    }

    console.log("📋 Current columns:", columnNames.join(", "));
    console.log("\n🔧 Applying migrations...\n");

    // Add refresh_token column
    if (!hasRefreshToken) {
      db.run(
        "ALTER TABLE users ADD COLUMN refresh_token TEXT",
        (err) => {
          if (err) {
            console.error("❌ Error adding refresh_token column:", err);
          } else {
            console.log("✅ Added refresh_token column");
          }
        }
      );
    }

    // Add view_history column
    if (!hasViewHistory) {
      db.run(
        "ALTER TABLE users ADD COLUMN view_history TEXT DEFAULT '[]'",
        (err) => {
          if (err) {
            console.error("❌ Error adding view_history column:", err);
          } else {
            console.log("✅ Added view_history column");
          }
        }
      );
    }

    // Add created_at column
    if (!hasCreatedAt) {
      db.run(
        "ALTER TABLE users ADD COLUMN created_at DATETIME DEFAULT CURRENT_TIMESTAMP",
        (err) => {
          if (err) {
            console.error("❌ Error adding created_at column:", err);
          } else {
            console.log("✅ Added created_at column");
          }
        }
      );
    }

    // Add updated_at column
    if (!hasUpdatedAt) {
      db.run(
        "ALTER TABLE users ADD COLUMN updated_at DATETIME DEFAULT CURRENT_TIMESTAMP",
        (err) => {
          if (err) {
            console.error("❌ Error adding updated_at column:", err);
          } else {
            console.log("✅ Added updated_at column");
          }
        }
      );
    }

    if (!hasResetToken) {
      db.run(
        "ALTER TABLE users ADD COLUMN password_reset_token TEXT",
        (err) => {
          if (err) {
            console.error("❌ Error adding password_reset_token:", err);
          } else {
            console.log("✅ Added password_reset_token column");
          }
        }
      );
    }

    if (!hasResetExpires) {
      db.run(
        "ALTER TABLE users ADD COLUMN password_reset_expires DATETIME",
        (err) => {
          if (err) {
            console.error("❌ Error adding password_reset_expires column:", err);
          } else {
            console.log("✅ Added password_reset_expires column");
          }
        }
      );
    }

    if (!hasPreferredLang) {
      db.run(
        "ALTER TABLE users ADD COLUMN preferred_language TEXT DEFAULT 'en'",
        (err) => {
          if (err) {
            console.error("❌ Error adding preferred_language column:", err);
          } else {
            console.log("✅ Added preferred_language column");
          }
          // After all migrations, verify the schema
          db.all("PRAGMA table_info(users)", (err, newColumns) => {
            if (err) console.error("❌ Error verifying migration:", err);
            else {
              console.log("\n📋 Updated columns:", newColumns.map(col => col.name).join(", "));
              console.log("\n✅ Migration completed successfully!");
            }
            db.close();
          });
        }
      );
    } else {
      // Close if no preferred_language migration needed but we got here
      db.close();
    }
  });
});
