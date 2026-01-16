/**
 * Push Subscription Model
 * Handles database operations for push notification subscriptions
 */

const db = require('../config/db');

/**
 * Save or update push subscription
 */
const saveSubscription = (userId, subscription) => {
    return new Promise((resolve, reject) => {
        const endpoint = subscription.endpoint;
        const keys = JSON.stringify(subscription.keys);

        db.run(`
      INSERT INTO push_subscriptions (user_id, endpoint, keys, created_at)
      VALUES (?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(endpoint) DO UPDATE SET
        user_id = ?,
        keys = ?,
        updated_at = CURRENT_TIMESTAMP
    `, [userId, endpoint, keys, userId, keys], function (err) {
            if (err) reject(err);
            else resolve({ id: this.lastID, changes: this.changes });
        });
    });
};

/**
 * Get subscription by endpoint
 */
const getSubscriptionByEndpoint = (endpoint) => {
    return new Promise((resolve, reject) => {
        db.get('SELECT * FROM push_subscriptions WHERE endpoint = ?', [endpoint], (err, row) => {
            if (err) reject(err);
            else resolve(row);
        });
    });
};

/**
 * Get all subscriptions for a user
 */
const getUserSubscriptions = (userId) => {
    return new Promise((resolve, reject) => {
        db.all('SELECT * FROM push_subscriptions WHERE user_id = ?', [userId], (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
        });
    });
};

/**
 * Get all active subscriptions
 */
const getAllSubscriptions = () => {
    return new Promise((resolve, reject) => {
        db.all('SELECT * FROM push_subscriptions', [], (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
        });
    });
};

/**
 * Delete subscription by endpoint
 */
const deleteSubscription = (endpoint) => {
    return new Promise((resolve, reject) => {
        db.run('DELETE FROM push_subscriptions WHERE endpoint = ?', [endpoint], function (err) {
            if (err) reject(err);
            else resolve({ deleted: this.changes > 0 });
        });
    });
};

/**
 * Delete all subscriptions for a user
 */
const deleteUserSubscriptions = (userId) => {
    return new Promise((resolve, reject) => {
        db.run('DELETE FROM push_subscriptions WHERE user_id = ?', [userId], function (err) {
            if (err) reject(err);
            else resolve({ deleted: this.changes });
        });
    });
};

module.exports = {
    saveSubscription,
    getSubscriptionByEndpoint,
    getUserSubscriptions,
    getAllSubscriptions,
    deleteSubscription,
    deleteUserSubscriptions
};
