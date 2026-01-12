const sqlite3 = require("sqlite3").verbose();
const path = require("path");

const dbPath = path.join(__dirname, "..", "..", "users.db");
const db = new sqlite3.Database(dbPath);

console.log("🔄 Running watchlist database migration...");

db.serialize(() => {
    // 1. Create watchlists table
    db.run(
        `
    CREATE TABLE IF NOT EXISTS watchlists (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      owner_id INTEGER NOT NULL,
      is_public BOOLEAN DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `,
        (err) => {
            if (err) {
                console.error("❌ Error creating watchlists table:", err);
            } else {
                console.log("✅ watchlists table created successfully");
            }
        }
    );

    // 2. Create watchlist_repositories table
    db.run(
        `
    CREATE TABLE IF NOT EXISTS watchlist_repositories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      watchlist_id INTEGER NOT NULL,
      repo_full_name TEXT NOT NULL,
      repo_data TEXT,
      added_by INTEGER NOT NULL,
      added_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (watchlist_id) REFERENCES watchlists(id) ON DELETE CASCADE,
      FOREIGN KEY (added_by) REFERENCES users(id),
      UNIQUE(watchlist_id, repo_full_name)
    )
  `,
        (err) => {
            if (err) {
                console.error("❌ Error creating watchlist_repositories table:", err);
            } else {
                console.log("✅ watchlist_repositories table created successfully");
            }
        }
    );

    // 3. Create watchlist_collaborators table
    db.run(
        `
    CREATE TABLE IF NOT EXISTS watchlist_collaborators (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      watchlist_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      role TEXT DEFAULT 'viewer',
      added_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (watchlist_id) REFERENCES watchlists(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      UNIQUE(watchlist_id, user_id)
    )
  `,
        (err) => {
            if (err) {
                console.error("❌ Error creating watchlist_collaborators table:", err);
            } else {
                console.log("✅ watchlist_collaborators table created successfully");
            }
        }
    );

    // 4. Create notifications table
    db.run(
        `
    CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      watchlist_id INTEGER,
      repo_full_name TEXT,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      message TEXT,
      data TEXT,
      is_read BOOLEAN DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (watchlist_id) REFERENCES watchlists(id) ON DELETE SET NULL
    )
  `,
        (err) => {
            if (err) {
                console.error("❌ Error creating notifications table:", err);
            } else {
                console.log("✅ notifications table created successfully");
            }
        }
    );

    // 5. Create notification_preferences table
    db.run(
        `
    CREATE TABLE IF NOT EXISTS notification_preferences (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      notify_releases BOOLEAN DEFAULT 1,
      notify_stars BOOLEAN DEFAULT 1,
      notify_issues BOOLEAN DEFAULT 0,
      notify_prs BOOLEAN DEFAULT 0,
      notify_commits BOOLEAN DEFAULT 0,
      star_milestone_threshold INTEGER DEFAULT 100,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      UNIQUE(user_id)
    )
  `,
        (err) => {
            if (err) {
                console.error("❌ Error creating notification_preferences table:", err);
            } else {
                console.log("✅ notification_preferences table created successfully");
            }
        }
    );

    // Create indexes for better query performance
    db.run(
        `CREATE INDEX IF NOT EXISTS idx_watchlists_owner 
     ON watchlists(owner_id)`,
        (err) => {
            if (err) console.error("❌ Error creating watchlists owner index:", err);
            else console.log("✅ Index on watchlists.owner_id created");
        }
    );

    db.run(
        `CREATE INDEX IF NOT EXISTS idx_watchlist_repos_watchlist 
     ON watchlist_repositories(watchlist_id)`,
        (err) => {
            if (err) console.error("❌ Error creating repos watchlist index:", err);
            else console.log("✅ Index on watchlist_repositories.watchlist_id created");
        }
    );

    db.run(
        `CREATE INDEX IF NOT EXISTS idx_notifications_user 
     ON notifications(user_id, is_read)`,
        (err) => {
            if (err) console.error("❌ Error creating notifications user index:", err);
            else console.log("✅ Index on notifications.user_id created");
        }
    );

    db.run(
        `CREATE INDEX IF NOT EXISTS idx_collaborators_watchlist 
     ON watchlist_collaborators(watchlist_id)`,
        (err) => {
            if (err) console.error("❌ Error creating collaborators index:", err);
            else console.log("✅ Index on watchlist_collaborators.watchlist_id created");
        }
    );
});

db.close((err) => {
    if (err) {
        console.error("❌ Error closing database:", err);
    } else {
        console.log("✅ Watchlist migration completed successfully!");
        console.log("📦 Database closed");
    }
});
