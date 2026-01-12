const watchlistModel = require("../models/watchlist.model");

/**
 * Create a new watchlist
 * POST /api/watchlists
 */
exports.createWatchlist = async (req, res) => {
    try {
        const userId = req.userId;
        const { name, description, isPublic } = req.body;

        if (!name) {
            return res.status(400).json({
                success: false,
                message: "Watchlist name is required",
            });
        }

        const watchlistId = await watchlistModel.createWatchlist(
            userId,
            name,
            description,
            isPublic
        );

        res.status(201).json({
            success: true,
            message: "Watchlist created successfully",
            watchlistId,
        });
    } catch (error) {
        console.error("Error creating watchlist:", error);
        res.status(500).json({
            success: false,
            message: "Failed to create watchlist",
            error: error.message,
        });
    }
};

/**
 * Get all watchlists for current user
 * GET /api/watchlists
 */
exports.getUserWatchlists = async (req, res) => {
    try {
        const userId = req.userId;
        const watchlists = await watchlistModel.getUserWatchlists(userId);

        res.json({
            success: true,
            count: watchlists.length,
            watchlists,
        });
    } catch (error) {
        console.error("Error fetching watchlists:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch watchlists",
            error: error.message,
        });
    }
};

/**
 * Get specific watchlist
 * GET /api/watchlists/:id
 */
exports.getWatchlist = async (req, res) => {
    try {
        const userId = req.userId;
        const { id } = req.params;

        // Check access
        const hasAccess = await watchlistModel.userHasAccess(id, userId);
        if (!hasAccess) {
            return res.status(403).json({
                success: false,
                message: "Access denied to this watchlist",
            });
        }

        const watchlist = await watchlistModel.getWatchlistById(id);
        if (!watchlist) {
            return res.status(404).json({
                success: false,
                message: "Watchlist not found",
            });
        }

        // Get repositories and collaborators
        const repositories = await watchlistModel.getWatchlistRepositories(id);
        const collaborators = await watchlistModel.getWatchlistCollaborators(id);

        res.json({
            success: true,
            watchlist: {
                ...watchlist,
                repositories,
                collaborators,
            },
        });
    } catch (error) {
        console.error("Error fetching watchlist:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch watchlist",
            error: error.message,
        });
    }
};

/**
 * Update watchlist
 * PUT /api/watchlists/:id
 */
exports.updateWatchlist = async (req, res) => {
    try {
        const userId = req.userId;
        const { id } = req.params;
        const { name, description, isPublic } = req.body;

        // Check if user is owner
        const watchlist = await watchlistModel.getWatchlistById(id);
        if (!watchlist || watchlist.owner_id !== userId) {
            return res.status(403).json({
                success: false,
                message: "Only the owner can update this watchlist",
            });
        }

        await watchlistModel.updateWatchlist(id, name, description, isPublic);

        res.json({
            success: true,
            message: "Watchlist updated successfully",
        });
    } catch (error) {
        console.error("Error updating watchlist:", error);
        res.status(500).json({
            success: false,
            message: "Failed to update watchlist",
            error: error.message,
        });
    }
};

/**
 * Delete watchlist
 * DELETE /api/watchlists/:id
 */
exports.deleteWatchlist = async (req, res) => {
    try {
        const userId = req.userId;
        const { id } = req.params;

        // Check if user is owner
        const watchlist = await watchlistModel.getWatchlistById(id);
        if (!watchlist || watchlist.owner_id !== userId) {
            return res.status(403).json({
                success: false,
                message: "Only the owner can delete this watchlist",
            });
        }

        await watchlistModel.deleteWatchlist(id);

        res.json({
            success: true,
            message: "Watchlist deleted successfully",
        });
    } catch (error) {
        console.error("Error deleting watchlist:", error);
        res.status(500).json({
            success: false,
            message: "Failed to delete watchlist",
            error: error.message,
        });
    }
};

/**
 * Add repository to watchlist
 * POST /api/watchlists/:id/repositories
 */
exports.addRepository = async (req, res) => {
    try {
        const userId = req.userId;
        const { id } = req.params;
        const { repoFullName, repoData } = req.body;

        if (!repoFullName) {
            return res.status(400).json({
                success: false,
                message: "Repository name is required",
            });
        }

        // Check access
        const hasAccess = await watchlistModel.userHasAccess(id, userId);
        if (!hasAccess) {
            return res.status(403).json({
                success: false,
                message: "Access denied to this watchlist",
            });
        }

        await watchlistModel.addRepository(id, repoFullName, repoData, userId);

        res.status(201).json({
            success: true,
            message: "Repository added successfully",
        });
    } catch (error) {
        console.error("Error adding repository:", error);
        res.status(500).json({
            success: false,
            message: "Failed to add repository",
            error: error.message,
        });
    }
};

/**
 * Remove repository from watchlist
 * DELETE /api/watchlists/:id/repositories/:repoName
 */
exports.removeRepository = async (req, res) => {
    try {
        const userId = req.userId;
        const { id, repoName } = req.params;

        // Check access
        const hasAccess = await watchlistModel.userHasAccess(id, userId);
        if (!hasAccess) {
            return res.status(403).json({
                success: false,
                message: "Access denied to this watchlist",
            });
        }

        // Decode repo name (it might have slashes)
        const repoFullName = decodeURIComponent(repoName);

        await watchlistModel.removeRepository(id, repoFullName);

        res.json({
            success: true,
            message: "Repository removed successfully",
        });
    } catch (error) {
        console.error("Error removing repository:", error);
        res.status(500).json({
            success: false,
            message: "Failed to remove repository",
            error: error.message,
        });
    }
};

/**
 * Add collaborator to watchlist
 * POST /api/watchlists/:id/collaborators
 */
exports.addCollaborator = async (req, res) => {
    try {
        const userId = req.userId;
        const { id } = req.params;
        const { email, role } = req.body;

        // Check if user is owner
        const watchlist = await watchlistModel.getWatchlistById(id);
        if (!watchlist || watchlist.owner_id !== userId) {
            return res.status(403).json({
                success: false,
                message: "Only the owner can add collaborators",
            });
        }

        // Find user by email
        const userModel = require("../models/user.model");
        const collaborator = await userModel.findByEmail(email);
        if (!collaborator) {
            return res.status(404).json({
                success: false,
                message: "User not found",
            });
        }

        await watchlistModel.addCollaborator(id, collaborator.id, role);

        res.status(201).json({
            success: true,
            message: "Collaborator added successfully",
        });
    } catch (error) {
        console.error("Error adding collaborator:", error);
        res.status(500).json({
            success: false,
            message: "Failed to add collaborator",
            error: error.message,
        });
    }
};

/**
 * Remove collaborator from watchlist
 * DELETE /api/watchlists/:id/collaborators/:userId
 */
exports.removeCollaborator = async (req, res) => {
    try {
        const userId = req.userId;
        const { id, userId: collaboratorId } = req.params;

        // Check if user is owner
        const watchlist = await watchlistModel.getWatchlistById(id);
        if (!watchlist || watchlist.owner_id !== userId) {
            return res.status(403).json({
                success: false,
                message: "Only the owner can remove collaborators",
            });
        }

        await watchlistModel.removeCollaborator(id, collaboratorId);

        res.json({
            success: true,
            message: "Collaborator removed successfully",
        });
    } catch (error) {
        console.error("Error removing collaborator:", error);
        res.status(500).json({
            success: false,
            message: "Failed to remove collaborator",
            error: error.message,
        });
    }
};
