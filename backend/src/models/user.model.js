const db = require("../config/db");

exports.createUser = (email, password) =>
  new Promise((resolve, reject) => {
    // Additional validation
    if (!email || typeof email !== 'string' || email.length > 254) {
      return reject(new Error('Invalid email'));
    }
    if (!password || typeof password !== 'string' || password.length > 128) {
      return reject(new Error('Invalid password'));
    }

    db.run(
      "INSERT INTO users (email, password) VALUES (?, ?)",
      [email, password],
      function (err) {
        if (err) reject(err);
        else resolve(this.lastID);
      }
    );
  });

exports.findByEmail = (email) =>
  new Promise((resolve, reject) => {
    if (!email || typeof email !== 'string' || email.length > 254) {
      return reject(new Error('Invalid email'));
    }

    db.get(
      "SELECT id, email, password, view_history, preferred_language FROM users WHERE email = ?",
      [email],
      (err, row) => {
        if (err) reject(err);
        else resolve(row);
      }
    );
  });

exports.findById = (id) =>
  new Promise((resolve, reject) => {
    if (!id || (typeof id !== 'number' && typeof id !== 'string')) {
      return reject(new Error('Invalid user ID'));
    }

    const userId = typeof id === 'string' ? parseInt(id, 10) : id;
    if (isNaN(userId) || userId <= 0) {
      return reject(new Error('Invalid user ID'));
    }

    db.get(
      "SELECT id, email, view_history, refresh_token, preferred_language FROM users WHERE id = ?",
      [userId],
      (err, row) => {
        if (err) reject(err);
        else resolve(row);
      }
    );
  });

exports.updateRefreshToken = (userId, refreshToken) =>
  new Promise((resolve, reject) => {
    if (!userId || (typeof userId !== 'number' && typeof userId !== 'string')) {
      return reject(new Error('Invalid user ID'));
    }
    if (refreshToken && (typeof refreshToken !== 'string' || refreshToken.length > 1000)) {
      return reject(new Error('Invalid refresh token'));
    }

    const id = typeof userId === 'string' ? parseInt(userId, 10) : userId;
    if (isNaN(id) || id <= 0) {
      return reject(new Error('Invalid user ID'));
    }

    db.run(
      "UPDATE users SET refresh_token = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
      [refreshToken, id],
      function (err) {
        if (err) reject(err);
        else resolve(this.changes);
      }
    );
  });

exports.updateViewHistory = (userId, historyJson) =>
  new Promise((resolve, reject) => {
    if (!userId || (typeof userId !== 'number' && typeof userId !== 'string')) {
      return reject(new Error('Invalid user ID'));
    }
    if (historyJson && (typeof historyJson !== 'string' || historyJson.length > 10000)) {
      return reject(new Error('Invalid history data'));
    }

    const id = typeof userId === 'string' ? parseInt(userId, 10) : userId;
    if (isNaN(id) || id <= 0) {
      return reject(new Error('Invalid user ID'));
    }

    db.run(
      "UPDATE users SET view_history = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
      [historyJson, id],
      function (err) {
        if (err) reject(err);
        else resolve(this.changes);
      }
    );
  });

exports.setPasswordResetToken = (email, token, expiresAt) =>
  new Promise((resolve, reject) => {
    if (!email || typeof email !== 'string' || email.length > 254) {
      return reject(new Error('Invalid email'));
    }
    if (!token || typeof token !== 'string' || token.length > 255) {
      return reject(new Error('Invalid token'));
    }

    db.run(
      `UPDATE users 
       SET password_reset_token = ?, 
           password_reset_expires = ?,
           updated_at = CURRENT_TIMESTAMP 
       WHERE email = ?`,
      [token, expiresAt, email],
      function (err) {
        if (err) reject(err);
        else if (this.changes === 0) reject(new Error('User not found'));
        else resolve(this.changes);
      }
    );
  });

exports.findByResetToken = (token) =>
  new Promise((resolve, reject) => {
    if (!token || typeof token !== 'string' || token.length > 255) {
      return reject(new Error('Invalid token'));
    }

    db.get(
      `SELECT id, email, password_reset_token, password_reset_expires 
       FROM users 
       WHERE password_reset_token = ?`,
      [token],
      (err, row) => {
        if (err) reject(err);
        else resolve(row);
      }
    );
  });

exports.updatePassword = (userId, hashedPassword) =>
  new Promise((resolve, reject) => {
    if (!userId || (typeof userId !== 'number' && typeof userId !== 'string')) {
      return reject(new Error('Invalid user ID'));
    }
    if (!hashedPassword || typeof hashedPassword !== 'string') {
      return reject(new Error('Invalid password'));
    }

    const id = typeof userId === 'string' ? parseInt(userId, 10) : userId;
    if (isNaN(id) || id <= 0) {
      return reject(new Error('Invalid user ID'));
    }

    db.run(
      `UPDATE users 
       SET password = ?, 
           password_reset_token = NULL,
           password_reset_expires = NULL,
           updated_at = CURRENT_TIMESTAMP 
       WHERE id = ?`,
      [hashedPassword, id],
      function (err) {
        if (err) reject(err);
        else if (this.changes === 0) reject(new Error('User not found'));
        else resolve(this.changes);
      }
    );
  });

exports.clearResetToken = (userId) =>
  new Promise((resolve, reject) => {
    if (!userId || (typeof userId !== 'number' && typeof userId !== 'string')) {
      return reject(new Error('Invalid user ID'));
    }

    const id = typeof userId === 'string' ? parseInt(userId, 10) : userId;
    if (isNaN(id) || id <= 0) {
      return reject(new Error('Invalid user ID'));
    }

    db.run(
      `UPDATE users 
       SET password_reset_token = NULL,
           password_reset_expires = NULL,
           updated_at = CURRENT_TIMESTAMP 
       WHERE id = ?`,
      [id],
      function (err) {
        if (err) reject(err);
        else resolve(this.changes);
      }
    );
  });

exports.updatePreferredLanguage = (userId, lang) =>
  new Promise((resolve, reject) => {
    if (!userId || (typeof userId !== 'number' && typeof userId !== 'string')) {
      return reject(new Error('Invalid user ID'));
    }
    if (!lang || typeof lang !== 'string' || lang.length > 10) {
      return reject(new Error('Invalid language code'));
    }

    const id = typeof userId === 'string' ? parseInt(userId, 10) : userId;
    if (isNaN(id) || id <= 0) {
      return reject(new Error('Invalid user ID'));
    }

    db.run(
      "UPDATE users SET preferred_language = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
      [lang, id],
      function (err) {
        if (err) reject(err);
        else resolve(this.changes);
      }
    );
  });
