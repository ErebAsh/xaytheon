const User = require("../models/user.model");
const { validateArray, validateString, validateUrl, validateNumber } = require("../utils/validation");

// Input validation functions
function isValidHistoryItem(item) {
  return (
    typeof item === 'object' &&
    item !== null &&
    validateString(item.id, 'id', { required: true, maxLength: 100 }).length > 0 &&
    validateString(item.title, 'title', { maxLength: 200 }).length >= 0 &&
    validateUrl(item.url, 'url').length >= 0 &&
    (item.timestamp === undefined || (typeof item.timestamp === 'number' && item.timestamp > 0))
  );
}

function sanitizeHistoryItem(item) {
  if (!isValidHistoryItem(item)) {
    return null;
  }

  return {
    id: validateString(item.id, 'id', { required: true, maxLength: 100 }),
    title: validateString(item.title, 'title', { maxLength: 200 }),
    url: validateUrl(item.url, 'url'),
    timestamp: item.timestamp || Date.now()
  };
}

exports.getHistory = async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    let history = [];
    if (user.view_history) {
      try {
        const parsed = JSON.parse(user.view_history);
        if (Array.isArray(parsed)) {
          history = parsed.filter(item => isValidHistoryItem(item));
        }
      } catch (err) {
        console.warn("Invalid history JSON for user", req.userId, err);
        // Continue with empty history
      }
    }

    res.json(history);
  } catch (err) {
    console.error("Get history error:", err);
    res.status(500).json({ message: "Failed to fetch history" });
  }
};

exports.updateHistory = async (req, res) => {
  try {
    const { history } = req.body;

    // Validate input
    const validatedHistory = validateArray(history, 'history', {
      required: true,
      maxLength: 100,
      itemValidator: (item) => {
        const sanitized = sanitizeHistoryItem(item);
        if (!sanitized) {
          throw new Error('Invalid history item');
        }
        return sanitized;
      }
    });

    // Limit to 50 items as before
    const limitedHistory = validatedHistory.slice(0, 50);

    await User.updateViewHistory(req.userId, JSON.stringify(limitedHistory));
    res.json({ message: "History updated successfully" });
  } catch (err) {
    console.error("Update history error:", err);

    // Handle validation errors
    if (err.name === 'ValidationError') {
      return res.status(err.statusCode).json({ message: err.message, field: err.field });
    }

    res.status(500).json({ message: "Failed to update history" });
  }
};
