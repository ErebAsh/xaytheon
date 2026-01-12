const express = require("express");
const router = express.Router();
const notificationController = require("../controllers/notification.controller");
const { verifyAccessToken } = require("../middleware/auth.middleware");

router.use(verifyAccessToken);

router.get("/", notificationController.getNotifications);
router.put("/:id/read", notificationController.markAsRead);
router.put("/read-all", notificationController.markAllAsRead);
router.get("/preferences", notificationController.getPreferences);
router.put("/preferences", notificationController.updatePreferences);

module.exports = router;
