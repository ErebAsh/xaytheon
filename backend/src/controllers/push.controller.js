/**
 * Push Notification Controller
 * Handles push subscription and notification sending
 */

const webpush = require('web-push');
const pushModel = require('../models/push-subscription.model');

// Generate VAPID keys if not set (in production, use environment variables)
const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || 'BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U';
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || 'UUxI4O8lZL-d_YW5xLSbDViHG_dI_r4LgaO9HUcVhgc';

// Configure web-push
webpush.setVapidDetails(
    'mailto:contact@xaytheon.com',
    VAPID_PUBLIC_KEY,
    VAPID_PRIVATE_KEY
);

/**
 * GET /api/push/vapid-public-key
 * Get VAPID public key for client subscription
 */
exports.getVapidPublicKey = (req, res) => {
    res.json({ publicKey: VAPID_PUBLIC_KEY });
};

/**
 * POST /api/push/subscribe
 * Subscribe to push notifications
 */
exports.subscribe = async (req, res) => {
    try {
        const userId = req.userId || null;
        const subscription = req.body;

        if (!subscription || !subscription.endpoint) {
            return res.status(400).json({ message: 'Invalid subscription data' });
        }

        await pushModel.saveSubscription(userId, subscription);

        res.json({
            message: 'Subscribed to push notifications',
            success: true
        });
    } catch (error) {
        console.error('Subscribe error:', error);
        res.status(500).json({ message: 'Failed to subscribe' });
    }
};

/**
 * POST /api/push/unsubscribe
 * Unsubscribe from push notifications
 */
exports.unsubscribe = async (req, res) => {
    try {
        const { endpoint } = req.body;

        if (!endpoint) {
            return res.status(400).json({ message: 'Endpoint required' });
        }

        await pushModel.deleteSubscription(endpoint);

        res.json({
            message: 'Unsubscribed from push notifications',
            success: true
        });
    } catch (error) {
        console.error('Unsubscribe error:', error);
        res.status(500).json({ message: 'Failed to unsubscribe' });
    }
};

/**
 * POST /api/push/send
 * Send push notification (admin only)
 */
exports.sendNotification = async (req, res) => {
    try {
        const { title, body, url, userId } = req.body;

        const payload = JSON.stringify({
            title: title || 'XAYTHEON',
            body: body || 'You have a new notification!',
            icon: '/assets/icons/icon-192x192.png',
            badge: '/assets/icons/badge-72x72.png',
            data: { url: url || '/' }
        });

        let subscriptions;
        if (userId) {
            subscriptions = await pushModel.getUserSubscriptions(userId);
        } else {
            subscriptions = await pushModel.getAllSubscriptions();
        }

        const results = await Promise.allSettled(
            subscriptions.map(sub => {
                const subscription = {
                    endpoint: sub.endpoint,
                    keys: JSON.parse(sub.keys)
                };
                return webpush.sendNotification(subscription, payload);
            })
        );

        const successful = results.filter(r => r.status === 'fulfilled').length;
        const failed = results.filter(r => r.status === 'rejected').length;

        // Clean up failed subscriptions (likely expired)
        for (let i = 0; i < results.length; i++) {
            if (results[i].status === 'rejected') {
                const error = results[i].reason;
                if (error.statusCode === 410 || error.statusCode === 404) {
                    await pushModel.deleteSubscription(subscriptions[i].endpoint);
                }
            }
        }

        res.json({
            message: `Sent ${successful} notifications`,
            successful,
            failed
        });
    } catch (error) {
        console.error('Send notification error:', error);
        res.status(500).json({ message: 'Failed to send notification' });
    }
};

/**
 * Send notification to specific user (internal use)
 */
exports.sendToUser = async (userId, notification) => {
    try {
        const subscriptions = await pushModel.getUserSubscriptions(userId);

        const payload = JSON.stringify({
            title: notification.title || 'XAYTHEON',
            body: notification.body,
            icon: '/assets/icons/icon-192x192.png',
            badge: '/assets/icons/badge-72x72.png',
            tag: notification.tag || 'xaytheon-notification',
            data: notification.data || {}
        });

        await Promise.allSettled(
            subscriptions.map(sub => {
                const subscription = {
                    endpoint: sub.endpoint,
                    keys: JSON.parse(sub.keys)
                };
                return webpush.sendNotification(subscription, payload);
            })
        );
    } catch (error) {
        console.error('Send to user error:', error);
    }
};
