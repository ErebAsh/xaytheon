const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const User = require("../models/user.model");
const { validateEmail, validatePassword, validateString } = require("../utils/validation");

const ACCESS_TOKEN_EXPIRY = "15m";
const REFRESH_TOKEN_EXPIRY = "7d";

function generateTokens(userId) {
  const accessToken = jwt.sign(
    { id: userId, type: "access" },
    process.env.JWT_SECRET,
    { expiresIn: ACCESS_TOKEN_EXPIRY }
  );

  const refreshToken = jwt.sign(
    { id: userId, type: "refresh" },
    process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET,
    { expiresIn: REFRESH_TOKEN_EXPIRY }
  );

  return { accessToken, refreshToken };
}

function getCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax", // Changed from strict to lax for better compat
    maxAge: 7 * 24 * 60 * 60 * 1000,
  };
}

exports.register = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validate and sanitize inputs
    const sanitizedEmail = validateEmail(email);
    const sanitizedPassword = validatePassword(password);

    const hashedPassword = await bcrypt.hash(sanitizedPassword, 10);
    await User.createUser(sanitizedEmail, hashedPassword);

    res.status(201).json({ message: "User registered successfully" });
  } catch (err) {
    console.error("Registration error:", err);

    // Handle specific database errors
    if (err.code === 'SQLITE_CONSTRAINT_UNIQUE' || err.message.includes('UNIQUE constraint failed')) {
      return res.status(409).json({ message: "An account with this email already exists" });
    }

    // Handle validation errors
    if (err.name === 'ValidationError') {
      return res.status(err.statusCode).json({ message: err.message, field: err.field });
    }

    // Generic error response
    res.status(500).json({ message: "Registration failed. Please try again later." });
  }
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validate and sanitize inputs
    const sanitizedEmail = validateEmail(email);
    const sanitizedPassword = validatePassword(password);

    const user = await User.findByEmail(sanitizedEmail);
    if (!user) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    const isMatch = await bcrypt.compare(sanitizedPassword, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: "Invalid email or password" });
    }

    const { accessToken, refreshToken } = generateTokens(user.id);
    await User.updateRefreshToken(user.id, refreshToken);
    res.cookie("refreshToken", refreshToken, getCookieOptions());

    res.json({
      accessToken,
      refreshToken, // Return in body for localStorage fallback
      user: { id: user.id, email: user.email },
      expiresIn: 15 * 60,
      message: "Login successful"
    });
  } catch (err) {
    console.error("Login error:", err);

    // Handle validation errors
    if (err.name === 'ValidationError') {
      return res.status(err.statusCode).json({ message: err.message, field: err.field });
    }

    res.status(500).json({ message: "Login failed. Please try again later." });
  }
};

exports.refresh = async (req, res) => {
  try {
    // Try cookie first, then body (for non-cookie envs like file://)
    const refreshToken = req.cookies.refreshToken || req.body.refreshToken;

    if (!refreshToken) {
      return res.status(401).json({ message: "Refresh token not found" });
    }

    const decoded = jwt.verify(
      refreshToken,
      process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET
    );

    if (decoded.type !== "refresh") {
      return res.status(401).json({ message: "Invalid token type" });
    }

    const user = await User.findById(decoded.id);
    if (!user || user.refresh_token !== refreshToken) {
      return res.status(401).json({ message: "Invalid refresh token" });
    }

    const tokens = generateTokens(user.id);
    await User.updateRefreshToken(user.id, tokens.refreshToken);
    res.cookie("refreshToken", tokens.refreshToken, getCookieOptions());
    res.json({
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken, // Return new refresh token
      user: { id: user.id, email: user.email },
      expiresIn: 15 * 60,
      message: "Token refreshed successfully"
    });
  } catch (err) {
    console.error("Token refresh error:", err);
    res.status(401).json({ message: "Invalid or expired refresh token" });
  }
};

exports.logout = async (req, res) => {
  try {
    const { refreshToken } = req.cookies;

    if (refreshToken) {
      try {
        const decoded = jwt.verify(
          refreshToken,
          process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET
        );
        await User.updateRefreshToken(decoded.id, null);
      } catch (err) {
        console.log("Token already expired or invalid");
      }
    }
    res.clearCookie("refreshToken", getCookieOptions());
    res.json({ message: "Logged out successfully" });
  } catch (err) {
    console.error("Logout error:", err);
    res.status(500).json({ message: "Logout failed" });
  }
};

exports.verifyToken = async (req, res) => {
  res.json({
    valid: true,
    userId: req.userId,
    message: "Token is valid"
  });
};
