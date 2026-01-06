const express = require("express");
const router = express.Router();
const userController = require("../controllers/user.controller");
const authMiddleware = require("../middleware/auth.middleware");

router.get("/history", authMiddleware.verifyAccessToken, userController.getHistory);
router.post("/history", authMiddleware.verifyAccessToken, userController.updateHistory);

module.exports = router;
