const express = require("express");
const router = express.Router();
const watchlistController = require("../controllers/watchlist.controller");
const { verifyAccessToken } = require("../middleware/auth.middleware");

router.use(verifyAccessToken);

router.post("/", watchlistController.createWatchlist);
router.get("/", watchlistController.getUserWatchlists);
router.get("/:id", watchlistController.getWatchlist);
router.put("/:id", watchlistController.updateWatchlist);
router.delete("/:id", watchlistController.deleteWatchlist);

router.post("/:id/repositories", watchlistController.addRepository);
router.delete("/:id/repositories/:repoName", watchlistController.removeRepository);

router.post("/:id/collaborators", watchlistController.addCollaborator);
router.delete("/:id/collaborators/:userId", watchlistController.removeCollaborator);

module.exports = router;
