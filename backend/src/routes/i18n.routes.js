const express = require("express");
const router = express.Router();
const path = require("path");
const fs = require("fs").promises;
const userModel = require("../models/user.model");
const { authenticateToken } = require("../middleware/auth.middleware");

// Get translations for a specific language
router.get("/translations/:lang", async (req, res) => {
    try {
        const { lang } = req.params;
        const localesPath = path.join(__dirname, "../../../locales");
        const filePath = path.join(localesPath, `${lang}.json`);

        // Security check to prevent path traversal
        const absoluteLocalesPath = path.resolve(localesPath);
        const absoluteFilePath = path.resolve(filePath);

        if (!absoluteFilePath.startsWith(absoluteLocalesPath)) {
            return res.status(403).json({ message: "Invalid language code" });
        }

        const data = await fs.readFile(filePath, "utf8");
        const translations = JSON.parse(data);
        res.json(translations);
    } catch (error) {
        if (error.code === 'ENOENT') {
            return res.status(404).json({ message: "Language not supported" });
        }
        console.error("[i18n] Error loading translations:", error);
        res.status(500).json({ message: "Error loading translations" });
    }
});

// Update user preferred language
router.post("/preference", authenticateToken, async (req, res) => {
    try {
        const { lang } = req.body;
        const userId = req.user.id;

        if (!lang || typeof lang !== 'string') {
            return res.status(400).json({ message: "Language code is required" });
        }

        await userModel.updatePreferredLanguage(userId, lang);
        res.json({ message: "Language preference updated", lang });
    } catch (error) {
        console.error("[i18n] Error updating language preference:", error);
        res.status(500).json({ message: "Error updating language preference" });
    }
});

module.exports = router;
