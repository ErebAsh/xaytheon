/**
 * Push Notification Routes
 * API endpoints for push notification management
 */

const express = require('express');
const router = express.Router();
const pushController = require('../controllers/push.controller');
const { verifyAccessToken, optionalAuth } = require('../middleware/auth.middleware');

// Public routes
router.get('/vapid-public-key', pushController.getVapidPublicKey);

// Routes that work with or without auth
router.post('/subscribe', optionalAuth, pushController.subscribe);
router.post('/unsubscribe', pushController.unsubscribe);

// Protected routes (admin only in production)
router.post('/send', verifyAccessToken, pushController.sendNotification);

module.exports = router;
