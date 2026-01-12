const db = require("../config/db");

/**
 * Create a new watchlist
 */
exports.createWatchlist = (userId, name, description, isPublic = false) =>
    new Promise((resolve, reject) => {
        db.run(
            `INSERT INTO watchlists (owner_id, name, description, is_public) 
       VALUES (?, ?, ?, ?)`,
            [userId, name, description, isPublic ? 1 : 0],
            function (err) {
                if (err) reject(err);
                else resolve(this.lastID);
            }
        );
    });

/**
 * Get all watchlists for a user (owned + collaborated)
 */
exports.getUserWatchlists = (userId) =>
    new Promise((resolve, reject) => {
        db.all(
            `SELECT DISTINCT w.*, u.email as owner_email,
        (SELECT COUNT(*) FROM watchlist_repositories WHERE watchlist_id = w.id) as repo_count,
        (SELECT COUNT(*) FROM watchlist_collaborators WHERE watchlist_id = w.id) + 1 as collaborator_count
       FROM watchlists w
       LEFT JOIN users u ON w.owner_id = u.id
       LEFT JOIN watchlist_collaborators wc ON w.id = wc.watchlist_id
       WHERE w.owner_id = ? OR wc.user_id = ?
       ORDER BY w.updated_at DESC`,
            [userId, userId],
            (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            }
        );
    });

/**
 * Get watchlist by ID
 */
exports.getWatchlistById = (watchlistId) =>
    new Promise((resolve, reject) => {
        db.get(
            `SELECT w.*, u.email as owner_email
       FROM watchlists w
       LEFT JOIN users u ON w.owner_id = u.id
       WHERE w.id = ?`,
            [watchlistId],
            (err, row) => {
                if (err) reject(err);
                else resolve(row);
            }
        );
    });

/**
 * Update watchlist
 */
exports.updateWatchlist = (watchlistId, name, description, isPublic) =>
    new Promise((resolve, reject) => {
        db.run(
            `UPDATE watchlists 
       SET name = ?, description = ?, is_public = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
            [name, description, isPublic ? 1 : 0, watchlistId],
            function (err) {
                if (err) reject(err);
                else resolve(this.changes);
            }
        );
    });

/**
 * Delete watchlist
 */
exports.deleteWatchlist = (watchlistId) =>
    new Promise((resolve, reject) => {
        db.run(
            `DELETE FROM watchlists WHERE id = ?`,
            [watchlistId],
            function (err) {
                if (err) reject(err);
                else resolve(this.changes);
            }
        );
    });

/**
 * Add repository to watchlist
 */
exports.addRepository = (watchlistId, repoFullName, repoData, userId) =>
    new Promise((resolve, reject) => {
        db.run(
            `INSERT INTO watchlist_repositories (watchlist_id, repo_full_name, repo_data, added_by)
       VALUES (?, ?, ?, ?)`,
            [watchlistId, repoFullName, JSON.stringify(repoData), userId],
            function (err) {
                if (err) reject(err);
                else resolve(this.lastID);
            }
        );
    });

/**
 * Remove repository from watchlist
 */
exports.removeRepository = (watchlistId, repoFullName) =>
    new Promise((resolve, reject) => {
        db.run(
            `DELETE FROM watchlist_repositories 
       WHERE watchlist_id = ? AND repo_full_name = ?`,
            [watchlistId, repoFullName],
            function (err) {
                if (err) reject(err);
                else resolve(this.changes);
            }
        );
    });

/**
 * Get all repositories in a watchlist
 */
exports.getWatchlistRepositories = (watchlistId) =>
    new Promise((resolve, reject) => {
        db.all(
            `SELECT wr.*, u.email as added_by_email
       FROM watchlist_repositories wr
       LEFT JOIN users u ON wr.added_by = u.id
       WHERE wr.watchlist_id = ?
       ORDER BY wr.added_at DESC`,
            [watchlistId],
            (err, rows) => {
                if (err) reject(err);
                else {
                    const parsedRows = rows.map((row) => ({
                        ...row,
                        repo_data: JSON.parse(row.repo_data || "{}"),
                    }));
                    resolve(parsedRows);
                }
            }
        );
    });

/**
 * Add collaborator to watchlist
 */
exports.addCollaborator = (watchlistId, userId, role = "viewer") =>
    new Promise((resolve, reject) => {
        db.run(
            `INSERT INTO watchlist_collaborators (watchlist_id, user_id, role)
       VALUES (?, ?, ?)`,
            [watchlistId, userId, role],
            function (err) {
                if (err) reject(err);
                else resolve(this.lastID);
            }
        );
    });

/**
 * Remove collaborator from watchlist
 */
exports.removeCollaborator = (watchlistId, userId) =>
    new Promise((resolve, reject) => {
        db.run(
            `DELETE FROM watchlist_collaborators 
       WHERE watchlist_id = ? AND user_id = ?`,
            [watchlistId, userId],
            function (err) {
                if (err) reject(err);
                else resolve(this.changes);
            }
        );
    });

/**
 * Get all collaborators for a watchlist
 */
exports.getWatchlistCollaborators = (watchlistId) =>
    new Promise((resolve, reject) => {
        db.all(
            `SELECT wc.*, u.email
       FROM watchlist_collaborators wc
       LEFT JOIN users u ON wc.user_id = u.id
       WHERE wc.watchlist_id = ?
       ORDER BY wc.added_at ASC`,
            [watchlistId],
            (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            }
        );
    });

/**
 * Check if user has access to watchlist
 */
exports.userHasAccess = (watchlistId, userId) =>
    new Promise((resolve, reject) => {
        db.get(
            `SELECT 1 FROM watchlists WHERE id = ? AND (owner_id = ? OR is_public = 1)
       UNION
       SELECT 1 FROM watchlist_collaborators WHERE watchlist_id = ? AND user_id = ?`,
            [watchlistId, userId, watchlistId, userId],
            (err, row) => {
                if (err) reject(err);
                else resolve(!!row);
            }
        );
    });

/**
 * Get all repositories being watched by user (across all watchlists)
 */
exports.getAllWatchedRepos = (userId) =>
    new Promise((resolve, reject) => {
        db.all(
            `SELECT DISTINCT wr.repo_full_name, wr.repo_data
       FROM watchlist_repositories wr
       INNER JOIN watchlists w ON wr.watchlist_id = w.id
       LEFT JOIN watchlist_collaborators wc ON w.id = wc.watchlist_id
       WHERE w.owner_id = ? OR wc.user_id = ?`,
            [userId, userId],
            (err, rows) => {
                if (err) reject(err);
                else {
                    const parsedRows = rows.map((row) => ({
                        ...row,
                        repo_data: JSON.parse(row.repo_data || "{}"),
                    }));
                    resolve(parsedRows);
                }
            }
        );
    });
