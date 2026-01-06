const db = require("../config/db");

exports.createUser = (email, password) =>
  new Promise((resolve, reject) => {
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
    db.get(
      "SELECT * FROM users WHERE email = ?",
      [email],
      (err, row) => {
        if (err) reject(err);
        else resolve(row);
      }
    );
  });

exports.findById = (id) =>
  new Promise((resolve, reject) => {
    db.get(
      "SELECT * FROM users WHERE id = ?",
      [id],
      (err, row) => {
        if (err) reject(err);
        else resolve(row);
      }
    );
  });

exports.updateRefreshToken = (userId, refreshToken) =>
  new Promise((resolve, reject) => {
    db.run(
      "UPDATE users SET refresh_token = ? WHERE id = ?",
      [refreshToken, userId],
      function (err) {
        if (err) reject(err);
        else resolve(this.changes);
      }
    );
  });

exports.updateViewHistory = (userId, historyJson) =>
  new Promise((resolve, reject) => {
    db.run(
      "UPDATE users SET view_history = ? WHERE id = ?",
      [historyJson, userId],
      function (err) {
        if (err) reject(err);
        else resolve(this.changes);
      }
    );
  });
