const sqlite3 = require("sqlite3").verbose();
const path = require("path");

const dbPath = path.join(__dirname, "..", "users.db");
const db = new sqlite3.Database(dbPath);

console.log("🔄 Running analytics database migration...");

db.serialize(() => {
    // Create analytics_snapshots table
    db.run(
        `
    CREATE TABLE IF NOT EXISTS analytics_snapshots (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      github_username TEXT NOT NULL,
      stars INTEGER DEFAULT 0,
      followers INTEGER DEFAULT 0,
      following INTEGER DEFAULT 0,
      public_repos INTEGER DEFAULT 0,
      total_commits INTEGER DEFAULT 0,
      language_stats TEXT DEFAULT '{}',
      contribution_count INTEGER DEFAULT 0,
      snapshot_date DATETIME DEFAULT CURRENT_TIMESTAMP,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `,
        (err) => {
            if (err) {
                console.error("❌ Error creating analytics_snapshots table:", err);
            } else {
                console.log("✅ analytics_snapshots table created successfully");
            }
        }
    );

    // Create index on user_id for faster queries
    db.run(
        `CREATE INDEX IF NOT EXISTS idx_analytics_user_id 
     ON analytics_snapshots(user_id)`,
        (err) => {
            if (err) {
                console.error("❌ Error creating user_id index:", err);
            } else {
                console.log("✅ Index on user_id created successfully");
            }
        }
    );

    // Create index on snapshot_date for faster date range queries
    db.run(
        `CREATE INDEX IF NOT EXISTS idx_analytics_snapshot_date 
     ON analytics_snapshots(snapshot_date)`,
        (err) => {
            if (err) {
                console.error("❌ Error creating snapshot_date index:", err);
            } else {
                console.log("✅ Index on snapshot_date created successfully");
            }
        }
    );

    // Create composite index for common query patterns
    db.run(
        `CREATE INDEX IF NOT EXISTS idx_analytics_user_date 
     ON analytics_snapshots(user_id, snapshot_date)`,
        (err) => {
            if (err) {
                console.error("❌ Error creating composite index:", err);
            } else {
                console.log("✅ Composite index created successfully");
            }
        }
    );
});

db.close((err) => {
    if (err) {
        console.error("❌ Error closing database:", err);
    } else {
        console.log("✅ Analytics migration completed successfully!");
        console.log("📦 Database closed");
    }
});
