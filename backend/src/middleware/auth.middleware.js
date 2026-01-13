const jwt = require("jsonwebtoken");

exports.verifyAccessToken = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ message: "Access token required" });
    }

    const token = authHeader.split(" ")[1];

    if (!token || token.length > 1000) {
      return res.status(401).json({ message: "Invalid token format" });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    if (decoded.type !== "access") {
      return res.status(401).json({ message: "Invalid token type" });
    }

    req.userId = decoded.id;
    next();
  } catch (err) {
    if (err.name === "TokenExpiredError") {
      return res.status(401).json({
        message: "Access token expired",
        expired: true
      });
    }

    return res.status(401).json({ message: "Invalid access token" });
  }
};

// Optional authentication - extracts user ID if token present, but doesn't require it
exports.optionalAuth = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (authHeader && authHeader.startsWith("Bearer ")) {
      const token = authHeader.split(" ")[1];
      if (token && token.length <= 1000) {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        if (decoded.type === "access") {
          req.userId = decoded.id;
        }
      }
    }
  } catch (err) {
    // Token invalid or expired - just continue without user ID
  }

  next();
};

exports.loginRateLimiter = (() => {
  const attempts = new Map();
  const MAX_ATTEMPTS = 100; // Increased for development/testing
  const WINDOW_MS = 15 * 60 * 1000; // 15 minutes

  return (req, res, next) => {
    const identifier = req.ip || req.connection.remoteAddress;
    const now = Date.now();

    if (!attempts.has(identifier)) {
      attempts.set(identifier, []);
    }

    const userAttempts = attempts.get(identifier);
    const recentAttempts = userAttempts.filter(time => now - time < WINDOW_MS);

    if (recentAttempts.length >= MAX_ATTEMPTS) {
      return res.status(429).json({
        message: "Too many login attempts. Please try again later.",
        retryAfter: Math.ceil((WINDOW_MS - (now - recentAttempts[0])) / 1000)
      });
    }

    recentAttempts.push(now);
    attempts.set(identifier, recentAttempts);
    next();
  };
})();

exports.generalRateLimiter = (() => {
  const requests = new Map();
  const MAX_REQUESTS = 100; // requests per window
  const WINDOW_MS = 15 * 60 * 1000; // 15 minutes

  return (req, res, next) => {
    const identifier = req.ip || req.connection.remoteAddress;
    const now = Date.now();

    if (!requests.has(identifier)) {
      requests.set(identifier, []);
    }

    const userRequests = requests.get(identifier);
    const recentRequests = userRequests.filter(time => now - time < WINDOW_MS);

    if (recentRequests.length >= MAX_REQUESTS) {
      return res.status(429).json({
        message: "Too many requests. Please try again later.",
        retryAfter: Math.ceil((WINDOW_MS - (now - recentRequests[0])) / 1000)
      });
    }

    recentRequests.push(now);
    requests.set(identifier, recentRequests);
    next();
  };
})();
