/**
 * Migration: Create Push Subscriptions Table
 */

const db = require('../config/db');

const createPushSubscriptionsTable = () => {
    return new Promise((resolve, reject) => {
        db.run(`
      CREATE TABLE IF NOT EXISTS push_subscriptions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        endpoint TEXT UNIQUE NOT NULL,
        keys TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `, (err) => {
            if (err) {
                console.error('Error creating push_subscriptions table:', err);
                reject(err);
            } else {
                console.log('✅ push_subscriptions table ready');

                // Create index
                db.run('CREATE INDEX IF NOT EXISTS idx_push_user ON push_subscriptions(user_id)', (err2) => {
                    if (err2) console.error('Index error:', err2);
                    resolve();
                });
            }
        });
    });
};

// Run migration
createPushSubscriptionsTable()
    .then(() => console.log('📱 Push subscriptions table migration complete!'))
    .catch(err => console.error('Migration failed:', err));

module.exports = { createPushSubscriptionsTable };
