const User = require("../models/user.model");

exports.getHistory = async (req, res) => {
    try {
        const user = await User.findById(req.userId);
        if (!user) {
            return res.status(404).json({ message: "User not found" });
        }
        const history = user.view_history ? JSON.parse(user.view_history) : [];
        res.json(history);
    } catch (err) {
        console.error("Get history error:", err);
        res.status(500).json({ message: "Failed to fetch history" });
    }
};

exports.updateHistory = async (req, res) => {
    try {
        const { history } = req.body;
        if (!Array.isArray(history)) {
            return res.status(400).json({ message: "History must be an array" });
        }

        // Sanitize/Limit on backend as well just in case
        const limitedHistory = history.slice(0, 50);

        await User.updateViewHistory(req.userId, JSON.stringify(limitedHistory));
        res.json({ message: "History updated" });
    } catch (err) {
        console.error("Update history error:", err);
        res.status(500).json({ message: "Failed to update history" });
    }
};
