const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const User = require("../models/user.model");
const crypto = require("crypto");
const { sendPasswordResetEmail, sendPasswordChangedEmail } = require("../utils/email");
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
      user: { id: user.id, email: user.email, preferred_language: user.preferred_language },
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
    // Try body first (explicit user intent), then cookie
    const refreshToken = req.body.refreshToken || req.cookies.refreshToken;

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
      user: { id: user.id, email: user.email, preferred_language: user.preferred_language },
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

exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    const sanitizedEmail = validateEmail(email);

    const user = await User.findByEmail(sanitizedEmail);

    if (!user) {
      console.log(`Password reset requested for non-existent email: ${sanitizedEmail}`);
      return res.status(200).json({
        message: "If an account exists with this email, you will receive a password reset link shortly."
      });
    }

    const resetToken = crypto.randomBytes(32).toString("hex");

    const hashedToken = crypto
      .createHash("sha256")
      .update(resetToken)
      .digest("hex");

    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();

    await User.setPasswordResetToken(sanitizedEmail, hashedToken, expiresAt);

    try {
      await sendPasswordResetEmail(sanitizedEmail, resetToken);
      console.log(`Password reset email sent to: ${sanitizedEmail}`);
    } catch (emailError) {
      console.error("Failed to send reset email:", emailError);

      await User.clearResetToken(user.id);
      return res.status(500).json({
        message: "Failed to send password reset email. Please try again later."
      });
    }

    res.status(200).json({
      message: "If an account exists with this email, you will receive a password reset link shortly."
    });
  } catch (err) {
    console.error("Forgot password error:", err);

    if (err.name === 'ValidationError') {
      return res.status(err.statusCode).json({ message: err.message, field: err.field });
    }

    res.status(500).json({
      message: "An error occurred. Please try again later."
    });
  }
};

exports.resetPassword = async (req, res) => {
  try {
    const { token, newPassword } = req.body;

    if (!token || typeof token !== 'string') {
      return res.status(400).json({ message: "Invalid reset token" });
    }

    const sanitizedPassword = validatePassword(newPassword);

    const hashedToken = crypto
      .createHash("sha256")
      .update(token)
      .digest("hex");

    const user = await User.findByResetToken(hashedToken);

    if (!user) {
      return res.status(400).json({
        message: "Invalid or expired reset token. Please request a new password reset."
      });
    }

    const now = new Date();
    const expiresAt = new Date(user.password_reset_expires);

    if (now > expiresAt) {

      await User.clearResetToken(user.id);
      return res.status(400).json({
        message: "Reset token has expired. Please request a new password reset."
      });
    }

    const hashedPassword = await bcrypt.hash(sanitizedPassword, 10);

    await User.updatePassword(user.id, hashedPassword);

    try {
      await sendPasswordChangedEmail(user.email);
    } catch (emailError) {
      console.error("Failed to send confirmation email:", emailError);
    }

    console.log(`Password successfully reset for user: ${user.email}`);

    res.status(200).json({
      message: "Password reset successfully. You can now log in with your new password."
    });
  } catch (err) {
    console.error("Reset password error:", err);

    if (err.name === 'ValidationError') {
      return res.status(err.statusCode).json({ message: err.message, field: err.field });
    }

    res.status(500).json({
      message: "Failed to reset password. Please try again."
    });
  }
};

exports.validateResetToken = async (req, res) => {
  try {
    const { token } = req.query;

    if (!token || typeof token !== 'string') {
      return res.status(400).json({ valid: false, message: "Invalid token" });
    }

    const hashedToken = crypto
      .createHash("sha256")
      .update(token)
      .digest("hex");

    const user = await User.findByResetToken(hashedToken);

    if (!user) {
      return res.status(400).json({ valid: false, message: "Invalid token" });
    }

    const now = new Date();
    const expiresAt = new Date(user.password_reset_expires);

    if (now > expiresAt) {
      await User.clearResetToken(user.id);
      return res.status(400).json({ valid: false, message: "Token expired" });
    }

    res.status(200).json({ valid: true, message: "Token is valid" });
  } catch (err) {
    console.error("Validate token error:", err);
    res.status(500).json({ valid: false, message: "Validation failed" });
  }
};