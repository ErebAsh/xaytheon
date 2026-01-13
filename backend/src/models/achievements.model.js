/**
 * Achievements Model
 * Handles database operations for achievements and user progress
 */

const db = require('../config/db');

// ==================== ACHIEVEMENTS ====================

/**
 * Get all achievements (optionally filter by category)
 */
const getAllAchievements = (category = null, includeSecret = false) => {
    return new Promise((resolve, reject) => {
        let query = 'SELECT * FROM achievements';
        const params = [];
        const conditions = [];

        if (category) {
            conditions.push('category = ?');
            params.push(category);
        }

        if (!includeSecret) {
            conditions.push('is_secret = 0');
        }

        if (conditions.length > 0) {
            query += ' WHERE ' + conditions.join(' AND ');
        }

        query += ' ORDER BY requirement_value ASC';

        db.all(query, params, (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
        });
    });
};

/**
 * Get achievement by code
 */
const getAchievementByCode = (code) => {
    return new Promise((resolve, reject) => {
        db.get('SELECT * FROM achievements WHERE code = ?', [code], (err, row) => {
            if (err) reject(err);
            else resolve(row);
        });
    });
};

/**
 * Get user's unlocked achievements
 */
const getUserAchievements = (userId) => {
    return new Promise((resolve, reject) => {
        db.all(`
      SELECT a.*, ua.unlocked_at, ua.progress
      FROM user_achievements ua
      JOIN achievements a ON ua.achievement_id = a.id
      WHERE ua.user_id = ?
      ORDER BY ua.unlocked_at DESC
    `, [userId], (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
        });
    });
};

/**
 * Get user's achievement progress (unlocked + progress on locked)
 */
const getUserAchievementProgress = (userId) => {
    return new Promise((resolve, reject) => {
        db.all(`
      SELECT 
        a.*,
        CASE WHEN ua.id IS NOT NULL THEN 1 ELSE 0 END as unlocked,
        ua.unlocked_at,
        COALESCE(ua.progress, 0) as progress
      FROM achievements a
      LEFT JOIN user_achievements ua ON a.id = ua.achievement_id AND ua.user_id = ?
      WHERE a.is_secret = 0 OR ua.id IS NOT NULL
      ORDER BY a.category, a.requirement_value
    `, [userId], (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
        });
    });
};

/**
 * Unlock an achievement for a user
 */
const unlockAchievement = (userId, achievementId) => {
    return new Promise((resolve, reject) => {
        db.run(`
      INSERT OR IGNORE INTO user_achievements (user_id, achievement_id, unlocked_at)
      VALUES (?, ?, CURRENT_TIMESTAMP)
    `, [userId, achievementId], function (err) {
            if (err) reject(err);
            else resolve({ unlocked: this.changes > 0, id: this.lastID });
        });
    });
};

/**
 * Update achievement progress
 */
const updateAchievementProgress = (userId, achievementId, progress) => {
    return new Promise((resolve, reject) => {
        db.run(`
      INSERT INTO user_achievements (user_id, achievement_id, progress)
      VALUES (?, ?, ?)
      ON CONFLICT(user_id, achievement_id) DO UPDATE SET progress = ?
    `, [userId, achievementId, progress, progress], function (err) {
            if (err) reject(err);
            else resolve({ updated: this.changes > 0 });
        });
    });
};

// ==================== XP SYSTEM ====================

/**
 * Get user's XP and level
 */
const getUserXP = (userId) => {
    return new Promise((resolve, reject) => {
        db.get('SELECT * FROM user_xp WHERE user_id = ?', [userId], (err, row) => {
            if (err) reject(err);
            else resolve(row || { user_id: userId, total_xp: 0, level: 1, current_streak: 0 });
        });
    });
};

/**
 * Add XP to user
 */
const addXP = (userId, amount, source, description = '') => {
    return new Promise((resolve, reject) => {
        db.serialize(() => {
            // Log the XP gain
            db.run(`
        INSERT INTO xp_log (user_id, xp_amount, source, description)
        VALUES (?, ?, ?, ?)
      `, [userId, amount, source, description]);

            // Update total XP and recalculate level
            db.run(`
        INSERT INTO user_xp (user_id, total_xp, level, updated_at)
        VALUES (?, ?, 1, CURRENT_TIMESTAMP)
        ON CONFLICT(user_id) DO UPDATE SET 
          total_xp = total_xp + ?,
          level = CAST((total_xp + ?) / 100 AS INTEGER) + 1,
          updated_at = CURRENT_TIMESTAMP
      `, [userId, amount, amount, amount], function (err) {
                if (err) reject(err);
                else {
                    // Get updated XP info
                    db.get('SELECT * FROM user_xp WHERE user_id = ?', [userId], (err2, row) => {
                        if (err2) reject(err2);
                        else resolve(row);
                    });
                }
            });
        });
    });
};

/**
 * Get XP history for user
 */
const getXPHistory = (userId, limit = 20) => {
    return new Promise((resolve, reject) => {
        db.all(`
      SELECT * FROM xp_log 
      WHERE user_id = ? 
      ORDER BY created_at DESC 
      LIMIT ?
    `, [userId, limit], (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
        });
    });
};

/**
 * Update user streak
 */
const updateStreak = (userId) => {
    return new Promise((resolve, reject) => {
        const today = new Date().toISOString().split('T')[0];

        db.get('SELECT * FROM user_xp WHERE user_id = ?', [userId], (err, row) => {
            if (err) return reject(err);

            let newStreak = 1;
            let longestStreak = row?.longest_streak || 0;

            if (row && row.last_activity_date) {
                const lastDate = new Date(row.last_activity_date);
                const todayDate = new Date(today);
                const diffDays = Math.floor((todayDate - lastDate) / (1000 * 60 * 60 * 24));

                if (diffDays === 1) {
                    newStreak = (row.current_streak || 0) + 1;
                } else if (diffDays === 0) {
                    newStreak = row.current_streak || 1;
                }
            }

            longestStreak = Math.max(longestStreak, newStreak);

            db.run(`
        INSERT INTO user_xp (user_id, current_streak, longest_streak, last_activity_date, updated_at)
        VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(user_id) DO UPDATE SET 
          current_streak = ?,
          longest_streak = ?,
          last_activity_date = ?,
          updated_at = CURRENT_TIMESTAMP
      `, [userId, newStreak, longestStreak, today, newStreak, longestStreak, today], function (err2) {
                if (err2) reject(err2);
                else resolve({ current_streak: newStreak, longest_streak: longestStreak });
            });
        });
    });
};

// ==================== LEADERBOARD ====================

/**
 * Get global leaderboard
 */
const getLeaderboard = (limit = 10) => {
    return new Promise((resolve, reject) => {
        db.all(`
      SELECT 
        ux.user_id,
        u.username,
        u.github_username,
        ux.total_xp,
        ux.level,
        ux.current_streak,
        (SELECT COUNT(*) FROM user_achievements WHERE user_id = ux.user_id) as achievement_count
      FROM user_xp ux
      JOIN users u ON ux.user_id = u.id
      ORDER BY ux.total_xp DESC
      LIMIT ?
    `, [limit], (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
        });
    });
};

/**
 * Get user's rank
 */
const getUserRank = (userId) => {
    return new Promise((resolve, reject) => {
        db.get(`
      SELECT COUNT(*) + 1 as rank
      FROM user_xp
      WHERE total_xp > (SELECT COALESCE(total_xp, 0) FROM user_xp WHERE user_id = ?)
    `, [userId], (err, row) => {
            if (err) reject(err);
            else resolve(row?.rank || 0);
        });
    });
};

/**
 * Get achievement statistics
 */
const getAchievementStats = (userId) => {
    return new Promise((resolve, reject) => {
        db.get(`
      SELECT 
        (SELECT COUNT(*) FROM achievements WHERE is_secret = 0) as total_achievements,
        (SELECT COUNT(*) FROM user_achievements WHERE user_id = ?) as unlocked_achievements,
        (SELECT SUM(a.xp_reward) FROM user_achievements ua JOIN achievements a ON ua.achievement_id = a.id WHERE ua.user_id = ?) as total_xp_from_achievements
    `, [userId, userId], (err, row) => {
            if (err) reject(err);
            else resolve(row);
        });
    });
};

module.exports = {
    getAllAchievements,
    getAchievementByCode,
    getUserAchievements,
    getUserAchievementProgress,
    unlockAchievement,
    updateAchievementProgress,
    getUserXP,
    addXP,
    getXPHistory,
    updateStreak,
    getLeaderboard,
    getUserRank,
    getAchievementStats
};
