/**
 * Achievements Controller
 * Handles API endpoints for gamification features
 */

const achievementsModel = require('../models/achievements.model');
const xpService = require('../services/xp-calculator.service');

/**
 * GET /api/achievements
 * Get all achievements (with user progress if authenticated)
 */
exports.getAllAchievements = async (req, res) => {
    try {
        const { category } = req.query;
        const userId = req.userId; // From auth middleware (optional)

        if (userId) {
            // Get achievements with user progress
            const achievements = await achievementsModel.getUserAchievementProgress(userId);
            res.json({ achievements });
        } else {
            // Get public achievements list
            const achievements = await achievementsModel.getAllAchievements(category);
            res.json({ achievements });
        }
    } catch (error) {
        console.error('Error fetching achievements:', error);
        res.status(500).json({ message: 'Failed to fetch achievements' });
    }
};

/**
 * GET /api/achievements/user
 * Get current user's unlocked achievements
 */
exports.getUserAchievements = async (req, res) => {
    try {
        const userId = req.userId;

        const achievements = await achievementsModel.getUserAchievements(userId);
        const stats = await achievementsModel.getAchievementStats(userId);

        res.json({
            achievements,
            stats: {
                unlocked: stats.unlocked_achievements,
                total: stats.total_achievements,
                completion_percent: Math.round((stats.unlocked_achievements / stats.total_achievements) * 100)
            }
        });
    } catch (error) {
        console.error('Error fetching user achievements:', error);
        res.status(500).json({ message: 'Failed to fetch user achievements' });
    }
};

/**
 * POST /api/achievements/check
 * Check and unlock achievements based on user stats
 */
exports.checkAchievements = async (req, res) => {
    try {
        const userId = req.userId;
        const { stats } = req.body; // { stars, repos, followers, commits, streak }

        if (!stats) {
            return res.status(400).json({ message: 'Stats object required' });
        }

        const unlocked = await xpService.checkAchievements(userId, stats);

        res.json({
            unlocked,
            message: unlocked.length > 0
                ? `🎉 Unlocked ${unlocked.length} new achievement(s)!`
                : 'No new achievements unlocked'
        });
    } catch (error) {
        console.error('Error checking achievements:', error);
        res.status(500).json({ message: 'Failed to check achievements' });
    }
};

/**
 * GET /api/achievements/xp
 * Get user's XP and level info
 */
exports.getUserXP = async (req, res) => {
    try {
        const userId = req.userId;

        const xpData = await achievementsModel.getUserXP(userId);
        const level = xpService.calculateLevel(xpData.total_xp || 0);
        const xpForNext = xpService.xpForNextLevel(level);

        res.json({
            total_xp: xpData.total_xp || 0,
            level,
            xp_for_next_level: xpForNext,
            current_streak: xpData.current_streak || 0,
            longest_streak: xpData.longest_streak || 0
        });
    } catch (error) {
        console.error('Error fetching XP:', error);
        res.status(500).json({ message: 'Failed to fetch XP data' });
    }
};

/**
 * GET /api/achievements/xp/history
 * Get user's XP gain history
 */
exports.getXPHistory = async (req, res) => {
    try {
        const userId = req.userId;
        const limit = parseInt(req.query.limit) || 20;

        const history = await achievementsModel.getXPHistory(userId, limit);

        res.json({ history });
    } catch (error) {
        console.error('Error fetching XP history:', error);
        res.status(500).json({ message: 'Failed to fetch XP history' });
    }
};

/**
 * POST /api/achievements/xp/award
 * Award XP for an activity
 */
exports.awardXP = async (req, res) => {
    try {
        const userId = req.userId;
        const { activity, context } = req.body;

        if (!activity) {
            return res.status(400).json({ message: 'Activity type required' });
        }

        const result = await xpService.awardActivityXP(userId, activity, context || {});

        if (!result) {
            return res.status(400).json({ message: 'Invalid activity type' });
        }

        res.json({
            message: `+${result.xp_awarded} XP!`,
            ...result
        });
    } catch (error) {
        console.error('Error awarding XP:', error);
        res.status(500).json({ message: 'Failed to award XP' });
    }
};

/**
 * GET /api/achievements/leaderboard
 * Get global XP leaderboard
 */
exports.getLeaderboard = async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 10;
        const userId = req.userId; // Optional - to include user's rank

        const leaderboard = await achievementsModel.getLeaderboard(limit);

        let userRank = null;
        if (userId) {
            userRank = await achievementsModel.getUserRank(userId);
        }

        res.json({
            leaderboard,
            user_rank: userRank
        });
    } catch (error) {
        console.error('Error fetching leaderboard:', error);
        res.status(500).json({ message: 'Failed to fetch leaderboard' });
    }
};

/**
 * GET /api/achievements/summary
 * Get complete gamification summary for user
 */
exports.getGamificationSummary = async (req, res) => {
    try {
        const userId = req.userId;

        const summary = await xpService.getUserGamificationSummary(userId);

        res.json(summary);
    } catch (error) {
        console.error('Error fetching gamification summary:', error);
        res.status(500).json({ message: 'Failed to fetch gamification summary' });
    }
};
