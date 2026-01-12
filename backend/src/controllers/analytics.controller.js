const analyticsModel = require("../models/analytics.model");

/**
 * Create a new analytics snapshot
 * POST /api/analytics/snapshot
 */
exports.createSnapshot = async (req, res) => {
    try {
        const userId = req.userId; // From auth middleware
        const { githubUsername, snapshotData } = req.body;

        if (!githubUsername || !snapshotData) {
            return res.status(400).json({
                success: false,
                message: "GitHub username and snapshot data are required",
            });
        }

        const snapshotId = await analyticsModel.createSnapshot(
            userId,
            githubUsername,
            snapshotData
        );

        res.status(201).json({
            success: true,
            message: "Snapshot created successfully",
            snapshotId,
        });
    } catch (error) {
        console.error("Error creating snapshot:", error);
        res.status(500).json({
            success: false,
            message: "Failed to create snapshot",
            error: error.message,
        });
    }
};

/**
 * Get snapshots by date range
 * GET /api/analytics/snapshots?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD
 */
exports.getSnapshots = async (req, res) => {
    try {
        const userId = req.userId;
        const { startDate, endDate, limit } = req.query;

        let snapshots;

        if (startDate && endDate) {
            snapshots = await analyticsModel.getSnapshotsByDateRange(
                userId,
                startDate,
                endDate
            );
        } else {
            snapshots = await analyticsModel.getAllSnapshots(
                userId,
                limit ? parseInt(limit) : 100
            );
        }

        res.json({
            success: true,
            count: snapshots.length,
            snapshots,
        });
    } catch (error) {
        console.error("Error fetching snapshots:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch snapshots",
            error: error.message,
        });
    }
};

/**
 * Get latest snapshot
 * GET /api/analytics/latest
 */
exports.getLatestSnapshot = async (req, res) => {
    try {
        const userId = req.userId;
        const snapshot = await analyticsModel.getLatestSnapshot(userId);

        if (!snapshot) {
            return res.status(404).json({
                success: false,
                message: "No snapshots found",
            });
        }

        res.json({
            success: true,
            snapshot,
        });
    } catch (error) {
        console.error("Error fetching latest snapshot:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch latest snapshot",
            error: error.message,
        });
    }
};

/**
 * Get aggregated statistics
 * GET /api/analytics/stats?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD
 */
exports.getAggregatedStats = async (req, res) => {
    try {
        const userId = req.userId;
        const { startDate, endDate } = req.query;

        if (!startDate || !endDate) {
            return res.status(400).json({
                success: false,
                message: "Start date and end date are required",
            });
        }

        const stats = await analyticsModel.getAggregatedStats(
            userId,
            startDate,
            endDate
        );

        res.json({
            success: true,
            stats,
        });
    } catch (error) {
        console.error("Error fetching aggregated stats:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch aggregated statistics",
            error: error.message,
        });
    }
};

/**
 * Get growth metrics
 * GET /api/analytics/growth?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD
 */
exports.getGrowthMetrics = async (req, res) => {
    try {
        const userId = req.userId;
        const { startDate, endDate } = req.query;

        if (!startDate || !endDate) {
            return res.status(400).json({
                success: false,
                message: "Start date and end date are required",
            });
        }

        const growth = await analyticsModel.getGrowthMetrics(
            userId,
            startDate,
            endDate
        );

        if (!growth) {
            return res.status(404).json({
                success: false,
                message: "Not enough data to calculate growth metrics",
            });
        }

        res.json({
            success: true,
            growth,
        });
    } catch (error) {
        console.error("Error fetching growth metrics:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch growth metrics",
            error: error.message,
        });
    }
};

/**
 * Export analytics data
 * GET /api/analytics/export?format=json|csv&startDate=YYYY-MM-DD&endDate=YYYY-MM-DD
 */
exports.exportData = async (req, res) => {
    try {
        const userId = req.userId;
        const { format = "json", startDate, endDate } = req.query;

        let snapshots;
        if (startDate && endDate) {
            snapshots = await analyticsModel.getSnapshotsByDateRange(
                userId,
                startDate,
                endDate
            );
        } else {
            snapshots = await analyticsModel.getAllSnapshots(userId);
        }

        if (format === "csv") {
            // Convert to CSV
            const headers = [
                "ID",
                "GitHub Username",
                "Stars",
                "Followers",
                "Following",
                "Public Repos",
                "Total Commits",
                "Contribution Count",
                "Snapshot Date",
            ];

            const csvRows = [headers.join(",")];

            snapshots.forEach((snapshot) => {
                const row = [
                    snapshot.id,
                    snapshot.github_username,
                    snapshot.stars,
                    snapshot.followers,
                    snapshot.following,
                    snapshot.public_repos,
                    snapshot.total_commits,
                    snapshot.contribution_count,
                    snapshot.snapshot_date,
                ];
                csvRows.push(row.join(","));
            });

            const csvContent = csvRows.join("\n");

            res.setHeader("Content-Type", "text/csv");
            res.setHeader(
                "Content-Disposition",
                `attachment; filename=analytics-export-${Date.now()}.csv`
            );
            res.send(csvContent);
        } else {
            // JSON format
            res.setHeader("Content-Type", "application/json");
            res.setHeader(
                "Content-Disposition",
                `attachment; filename=analytics-export-${Date.now()}.json`
            );
            res.json({
                exportDate: new Date().toISOString(),
                totalSnapshots: snapshots.length,
                snapshots,
            });
        }
    } catch (error) {
        console.error("Error exporting data:", error);
        res.status(500).json({
            success: false,
            message: "Failed to export data",
            error: error.message,
        });
    }
};

/**
 * Delete old snapshots
 * DELETE /api/analytics/cleanup?days=365
 */
exports.cleanupOldSnapshots = async (req, res) => {
    try {
        const { days = 365 } = req.query;
        const deletedCount = await analyticsModel.deleteOldSnapshots(
            parseInt(days)
        );

        res.json({
            success: true,
            message: `Deleted ${deletedCount} old snapshots`,
            deletedCount,
        });
    } catch (error) {
        console.error("Error cleaning up snapshots:", error);
        res.status(500).json({
            success: false,
            message: "Failed to cleanup old snapshots",
            error: error.message,
        });
    }
};
