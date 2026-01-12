const db = require("../config/db");

/**
 * Create a new notification
 */
exports.createNotification = (userId, type, title, message, data = {}) =>
    new Promise((resolve, reject) => {
        db.run(
            `INSERT INTO notifications (user_id, watchlist_id, repo_full_name, type, title, message, data)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [
                userId,
                data.watchlist_id || null,
                data.repo_full_name || null,
                type,
                title,
                message,
                JSON.stringify(data),
            ],
            function (err) {
                if (err) reject(err);
                else resolve(this.lastID);
            }
        );
    });

/**
 * Get user notifications
 */
exports.getUserNotifications = (userId, limit = 50, unreadOnly = false) =>
    new Promise((resolve, reject) => {
        let query = `SELECT * FROM notifications WHERE user_id = ?`;
        const params = [userId];

        if (unreadOnly) {
            query += ` AND is_read = 0`;
        }

        query += ` ORDER BY created_at DESC LIMIT ?`;
        params.push(limit);

        db.all(query, params, (err, rows) => {
            if (err) reject(err);
            else {
                const parsedRows = rows.map((row) => ({
                    ...row,
                    data: JSON.parse(row.data || "{}"),
                }));
                resolve(parsedRows);
            }
        });
    });

/**
 * Get unread notification count
 */
exports.getUnreadCount = (userId) =>
    new Promise((resolve, reject) => {
        db.get(
            `SELECT COUNT(*) as count FROM notifications 
       WHERE user_id = ? AND is_read = 0`,
            [userId],
            (err, row) => {
                if (err) reject(err);
                else resolve(row.count);
            }
        );
    });

/**
 * Mark notification as read
 */
exports.markAsRead = (notificationId, userId) =>
    new Promise((resolve, reject) => {
        db.run(
            `UPDATE notifications SET is_read = 1 
       WHERE id = ? AND user_id = ?`,
            [notificationId, userId],
            function (err) {
                if (err) reject(err);
                else resolve(this.changes);
            }
        );
    });

/**
 * Mark all notifications as read
 */
exports.markAllAsRead = (userId) =>
    new Promise((resolve, reject) => {
        db.run(
            `UPDATE notifications SET is_read = 1 
       WHERE user_id = ? AND is_read = 0`,
            [userId],
            function (err) {
                if (err) reject(err);
                else resolve(this.changes);
            }
        );
    });

/**
 * Delete notification
 */
exports.deleteNotification = (notificationId, userId) =>
    new Promise((resolve, reject) => {
        db.run(
            `DELETE FROM notifications 
       WHERE id = ? AND user_id = ?`,
            [notificationId, userId],
            function (err) {
                if (err) reject(err);
                else resolve(this.changes);
            }
        );
    });

/**
 * Delete all read notifications
 */
exports.deleteReadNotifications = (userId) =>
    new Promise((resolve, reject) => {
        db.run(
            `DELETE FROM notifications 
       WHERE user_id = ? AND is_read = 1`,
            [userId],
            function (err) {
                if (err) reject(err);
                else resolve(this.changes);
            }
        );
    });

/**
 * Get notification preferences for user
 */
exports.getPreferences = (userId) =>
    new Promise((resolve, reject) => {
        db.get(
            `SELECT * FROM notification_preferences WHERE user_id = ?`,
            [userId],
            (err, row) => {
                if (err) reject(err);
                else resolve(row);
            }
        );
    });

/**
 * Create or update notification preferences
 */
exports.upsertPreferences = (userId, preferences) =>
    new Promise((resolve, reject) => {
        const {
            notify_releases = 1,
            notify_stars = 1,
            notify_issues = 0,
            notify_prs = 0,
            notify_commits = 0,
            star_milestone_threshold = 100,
        } = preferences;

        db.run(
            `INSERT INTO notification_preferences 
       (user_id, notify_releases, notify_stars, notify_issues, notify_prs, notify_commits, star_milestone_threshold)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(user_id) DO UPDATE SET
         notify_releases = excluded.notify_releases,
         notify_stars = excluded.notify_stars,
         notify_issues = excluded.notify_issues,
         notify_prs = excluded.notify_prs,
         notify_commits = excluded.notify_commits,
         star_milestone_threshold = excluded.star_milestone_threshold,
         updated_at = CURRENT_TIMESTAMP`,
            [
                userId,
                notify_releases,
                notify_stars,
                notify_issues,
                notify_prs,
                notify_commits,
                star_milestone_threshold,
            ],
            function (err) {
                if (err) reject(err);
                else resolve(this.lastID || this.changes);
            }
        );
    });

/**
 * Get notifications by type
 */
exports.getNotificationsByType = (userId, type, limit = 20) =>
    new Promise((resolve, reject) => {
        db.all(
            `SELECT * FROM notifications 
       WHERE user_id = ? AND type = ?
       ORDER BY created_at DESC LIMIT ?`,
            [userId, type, limit],
            (err, rows) => {
                if (err) reject(err);
                else {
                    const parsedRows = rows.map((row) => ({
                        ...row,
                        data: JSON.parse(row.data || "{}"),
                    }));
                    resolve(parsedRows);
                }
            }
        );
    });

/**
 * Delete old notifications (older than specified days)
 */
exports.deleteOldNotifications = (days = 30) =>
    new Promise((resolve, reject) => {
        db.run(
            `DELETE FROM notifications 
       WHERE created_at < datetime('now', '-' || ? || ' days')`,
            [days],
            function (err) {
                if (err) reject(err);
                else resolve(this.changes);
            }
        );
    });
