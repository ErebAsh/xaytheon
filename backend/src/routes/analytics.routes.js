const express = require("express");
const router = express.Router();
const analyticsController = require("../controllers/analytics.controller");
const { verifyAccessToken } = require("../middleware/auth.middleware");

// All analytics routes require authentication
router.use(verifyAccessToken);

// Create a new snapshot
router.post("/snapshot", analyticsController.createSnapshot);

// Get snapshots (with optional date range filtering)
router.get("/snapshots", analyticsController.getSnapshots);

// Get latest snapshot
router.get("/latest", analyticsController.getLatestSnapshot);

// Get aggregated statistics
router.get("/stats", analyticsController.getAggregatedStats);

// Get growth metrics
router.get("/growth", analyticsController.getGrowthMetrics);

// Export data (JSON or CSV)
router.get("/export", analyticsController.exportData);

// Cleanup old snapshots (admin/maintenance endpoint)
router.delete("/cleanup", analyticsController.cleanupOldSnapshots);

module.exports = router;
