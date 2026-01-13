/**
 * Achievements Routes
 * API endpoints for gamification features
 */

const express = require('express');
const router = express.Router();
const achievementsController = require('../controllers/achievements.controller');
const { verifyAccessToken, optionalAuth } = require('../middleware/auth.middleware');

// Public routes (with optional auth for personalized data)
router.get('/', optionalAuth, achievementsController.getAllAchievements);
router.get('/leaderboard', optionalAuth, achievementsController.getLeaderboard);

// Protected routes (require authentication)
router.get('/user', verifyAccessToken, achievementsController.getUserAchievements);
router.get('/xp', verifyAccessToken, achievementsController.getUserXP);
router.get('/xp/history', verifyAccessToken, achievementsController.getXPHistory);
router.get('/summary', verifyAccessToken, achievementsController.getGamificationSummary);

router.post('/check', verifyAccessToken, achievementsController.checkAchievements);
router.post('/xp/award', verifyAccessToken, achievementsController.awardXP);

module.exports = router;
