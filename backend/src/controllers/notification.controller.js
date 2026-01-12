const notificationModel = require("../models/notification.model");

exports.getNotifications = async (req, res) => {
    try {
        const userId = req.userId;
        const { limit = 50, unreadOnly = false } = req.query;

        const notifications = await notificationModel.getUserNotifications(
            userId,
            parseInt(limit),
            unreadOnly === 'true'
        );

        const unreadCount = await notificationModel.getUnreadCount(userId);

        res.json({
            success: true,
            notifications,
            unreadCount,
        });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.markAsRead = async (req, res) => {
    try {
        await notificationModel.markAsRead(req.params.id, req.userId);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.markAllAsRead = async (req, res) => {
    try {
        await notificationModel.markAllAsRead(req.userId);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.getPreferences = async (req, res) => {
    try {
        let prefs = await notificationModel.getPreferences(req.userId);
        if (!prefs) {
            await notificationModel.upsertPreferences(req.userId, {});
            prefs = await notificationModel.getPreferences(req.userId);
        }
        res.json({ success: true, preferences: prefs });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.updatePreferences = async (req, res) => {
    try {
        await notificationModel.upsertPreferences(req.userId, req.body);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};
