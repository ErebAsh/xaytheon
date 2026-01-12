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
      "SELECT id, email, password, view_history FROM users WHERE email = ?",
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
      "SELECT id, email, view_history FROM users WHERE id = ?",
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
