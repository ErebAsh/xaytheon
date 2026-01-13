/**
 * Migration: Create Achievements & Gamification Tables
 * Tables: achievements, user_achievements, user_xp, leaderboard_cache
 */

const db = require('../config/db');

const createAchievementsTables = () => {
    return new Promise((resolve, reject) => {
        db.serialize(() => {

            // 1. Achievements Definition Table
            db.run(`
        CREATE TABLE IF NOT EXISTS achievements (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          code VARCHAR(50) UNIQUE NOT NULL,
          name VARCHAR(100) NOT NULL,
          description TEXT,
          category VARCHAR(50) NOT NULL,
          icon VARCHAR(50) DEFAULT '🏆',
          xp_reward INTEGER DEFAULT 10,
          tier VARCHAR(20) DEFAULT 'bronze',
          requirement_type VARCHAR(50) NOT NULL,
          requirement_value INTEGER NOT NULL,
          is_secret BOOLEAN DEFAULT 0,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `, (err) => {
                if (err) console.error('Error creating achievements table:', err);
                else console.log('✅ achievements table ready');
            });

            // 2. User Achievements (Unlocked badges)
            db.run(`
        CREATE TABLE IF NOT EXISTS user_achievements (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL,
          achievement_id INTEGER NOT NULL,
          unlocked_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          progress INTEGER DEFAULT 0,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
          FOREIGN KEY (achievement_id) REFERENCES achievements(id) ON DELETE CASCADE,
          UNIQUE(user_id, achievement_id)
        )
      `, (err) => {
                if (err) console.error('Error creating user_achievements table:', err);
                else console.log('✅ user_achievements table ready');
            });

            // 3. User XP & Level Tracking
            db.run(`
        CREATE TABLE IF NOT EXISTS user_xp (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER UNIQUE NOT NULL,
          total_xp INTEGER DEFAULT 0,
          level INTEGER DEFAULT 1,
          current_streak INTEGER DEFAULT 0,
          longest_streak INTEGER DEFAULT 0,
          last_activity_date DATE,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
      `, (err) => {
                if (err) console.error('Error creating user_xp table:', err);
                else console.log('✅ user_xp table ready');
            });

            // 4. XP Activity Log
            db.run(`
        CREATE TABLE IF NOT EXISTS xp_log (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL,
          xp_amount INTEGER NOT NULL,
          source VARCHAR(50) NOT NULL,
          description TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
      `, (err) => {
                if (err) console.error('Error creating xp_log table:', err);
                else console.log('✅ xp_log table ready');
            });

            // Create indexes
            db.run(`CREATE INDEX IF NOT EXISTS idx_user_achievements_user ON user_achievements(user_id)`);
            db.run(`CREATE INDEX IF NOT EXISTS idx_user_xp_total ON user_xp(total_xp DESC)`);
            db.run(`CREATE INDEX IF NOT EXISTS idx_xp_log_user ON xp_log(user_id)`);

            // Seed default achievements
            const achievements = [
                // Stars Category
                { code: 'FIRST_STAR', name: 'Rising Star', desc: 'Earn your first GitHub star', cat: 'stars', icon: '⭐', xp: 10, tier: 'bronze', type: 'stars', val: 1 },
                { code: 'STAR_10', name: 'Stargazer', desc: 'Accumulate 10 stars across repos', cat: 'stars', icon: '🌟', xp: 25, tier: 'silver', type: 'stars', val: 10 },
                { code: 'STAR_50', name: 'Constellation', desc: 'Reach 50 total stars', cat: 'stars', icon: '✨', xp: 50, tier: 'gold', type: 'stars', val: 50 },
                { code: 'STAR_100', name: 'Supernova', desc: 'Achieve 100 stars - You are legendary!', cat: 'stars', icon: '💫', xp: 100, tier: 'platinum', type: 'stars', val: 100 },

                // Repositories Category
                { code: 'FIRST_REPO', name: 'Hello World', desc: 'Create your first public repository', cat: 'repos', icon: '📦', xp: 10, tier: 'bronze', type: 'repos', val: 1 },
                { code: 'REPO_5', name: 'Prolific Creator', desc: 'Have 5 public repositories', cat: 'repos', icon: '🗂️', xp: 25, tier: 'silver', type: 'repos', val: 5 },
                { code: 'REPO_10', name: 'Repository Master', desc: 'Maintain 10+ repositories', cat: 'repos', icon: '📚', xp: 50, tier: 'gold', type: 'repos', val: 10 },

                // Followers Category
                { code: 'FIRST_FOLLOWER', name: 'Making Friends', desc: 'Get your first follower', cat: 'social', icon: '👤', xp: 10, tier: 'bronze', type: 'followers', val: 1 },
                { code: 'FOLLOWER_10', name: 'Influencer', desc: 'Reach 10 followers', cat: 'social', icon: '👥', xp: 25, tier: 'silver', type: 'followers', val: 10 },
                { code: 'FOLLOWER_50', name: 'Community Leader', desc: 'Achieve 50 followers', cat: 'social', icon: '🌍', xp: 75, tier: 'gold', type: 'followers', val: 50 },

                // Commits Category
                { code: 'COMMIT_10', name: 'Getting Started', desc: 'Make 10 commits', cat: 'commits', icon: '💾', xp: 10, tier: 'bronze', type: 'commits', val: 10 },
                { code: 'COMMIT_100', name: 'Dedicated Coder', desc: 'Reach 100 commits', cat: 'commits', icon: '⚡', xp: 50, tier: 'silver', type: 'commits', val: 100 },
                { code: 'COMMIT_500', name: 'Code Machine', desc: 'Hit 500 commits milestone', cat: 'commits', icon: '🔥', xp: 100, tier: 'gold', type: 'commits', val: 500 },

                // Streak Category
                { code: 'STREAK_7', name: 'Week Warrior', desc: 'Maintain a 7-day activity streak', cat: 'streak', icon: '📅', xp: 30, tier: 'bronze', type: 'streak', val: 7 },
                { code: 'STREAK_30', name: 'Monthly Master', desc: '30-day contribution streak', cat: 'streak', icon: '🗓️', xp: 75, tier: 'silver', type: 'streak', val: 30 },
                { code: 'STREAK_100', name: 'Unstoppable', desc: '100-day coding streak - Incredible!', cat: 'streak', icon: '🏆', xp: 200, tier: 'platinum', type: 'streak', val: 100 },

                // Special Achievements
                { code: 'EARLY_ADOPTER', name: 'Early Adopter', desc: 'Join XAYTHEON in its early days', cat: 'special', icon: '🚀', xp: 50, tier: 'gold', type: 'special', val: 1 },
                { code: 'NIGHT_OWL', name: 'Night Owl', desc: 'Commit code after midnight', cat: 'special', icon: '🦉', xp: 15, tier: 'bronze', type: 'special', val: 1, secret: 1 },
                { code: 'EARLY_BIRD', name: 'Early Bird', desc: 'Commit code before 6 AM', cat: 'special', icon: '🐦', xp: 15, tier: 'bronze', type: 'special', val: 1, secret: 1 },
            ];

            const insertStmt = db.prepare(`
        INSERT OR IGNORE INTO achievements (code, name, description, category, icon, xp_reward, tier, requirement_type, requirement_value, is_secret)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

            achievements.forEach(a => {
                insertStmt.run(a.code, a.name, a.desc, a.cat, a.icon, a.xp, a.tier, a.type, a.val, a.secret || 0);
            });

            insertStmt.finalize((err) => {
                if (err) reject(err);
                else {
                    console.log('✅ Default achievements seeded');
                    resolve();
                }
            });

        });
    });
};

// Run migration
createAchievementsTables()
    .then(() => console.log('🎮 Gamification tables migration complete!'))
    .catch(err => console.error('Migration failed:', err));

module.exports = { createAchievementsTables };
