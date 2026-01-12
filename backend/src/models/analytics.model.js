const db = require("../config/db");

/**
 * Create a new analytics snapshot
 */
exports.createSnapshot = (userId, githubUsername, snapshotData) =>
  new Promise((resolve, reject) => {
    const {
      stars,
      followers,
      following,
      publicRepos,
      totalCommits,
      languageStats,
      contributionCount,
    } = snapshotData;

    db.run(
      `INSERT INTO analytics_snapshots 
      (user_id, github_username, stars, followers, following, public_repos, 
       total_commits, language_stats, contribution_count, snapshot_date) 
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
      [
        userId,
        githubUsername,
        stars,
        followers,
        following,
        publicRepos,
        totalCommits,
        JSON.stringify(languageStats),
        contributionCount,
      ],
      function (err) {
        if (err) reject(err);
        else resolve(this.lastID);
      }
    );
  });

/**
 * Get all snapshots for a user within a date range
 */
exports.getSnapshotsByDateRange = (userId, startDate, endDate) =>
  new Promise((resolve, reject) => {
    db.all(
      `SELECT * FROM analytics_snapshots 
       WHERE user_id = ? 
       AND snapshot_date BETWEEN ? AND ?
       ORDER BY snapshot_date ASC`,
      [userId, startDate, endDate],
      (err, rows) => {
        if (err) reject(err);
        else {
          // Parse language_stats JSON for each row
          const parsedRows = rows.map((row) => ({
            ...row,
            language_stats: JSON.parse(row.language_stats || "{}"),
          }));
          resolve(parsedRows);
        }
      }
    );
  });

/**
 * Get latest snapshot for a user
 */
exports.getLatestSnapshot = (userId) =>
  new Promise((resolve, reject) => {
    db.get(
      `SELECT * FROM analytics_snapshots 
       WHERE user_id = ? 
       ORDER BY snapshot_date DESC 
       LIMIT 1`,
      [userId],
      (err, row) => {
        if (err) reject(err);
        else {
          if (row) {
            row.language_stats = JSON.parse(row.language_stats || "{}");
          }
          resolve(row);
        }
      }
    );
  });

/**
 * Get all snapshots for a user
 */
exports.getAllSnapshots = (userId, limit = 100) =>
  new Promise((resolve, reject) => {
    db.all(
      `SELECT * FROM analytics_snapshots 
       WHERE user_id = ? 
       ORDER BY snapshot_date DESC 
       LIMIT ?`,
      [userId, limit],
      (err, rows) => {
        if (err) reject(err);
        else {
          const parsedRows = rows.map((row) => ({
            ...row,
            language_stats: JSON.parse(row.language_stats || "{}"),
          }));
          resolve(parsedRows);
        }
      }
    );
  });

/**
 * Delete old snapshots (older than specified days)
 */
exports.deleteOldSnapshots = (days = 365) =>
  new Promise((resolve, reject) => {
    db.run(
      `DELETE FROM analytics_snapshots 
       WHERE snapshot_date < datetime('now', '-' || ? || ' days')`,
      [days],
      function (err) {
        if (err) reject(err);
        else resolve(this.changes);
      }
    );
  });

/**
 * Get aggregated statistics for a user
 */
exports.getAggregatedStats = (userId, startDate, endDate) =>
  new Promise((resolve, reject) => {
    db.get(
      `SELECT 
        COUNT(*) as total_snapshots,
        MAX(stars) as max_stars,
        MIN(stars) as min_stars,
        MAX(followers) as max_followers,
        MIN(followers) as min_followers,
        MAX(public_repos) as max_repos,
        MIN(public_repos) as min_repos,
        MAX(total_commits) as max_commits,
        MIN(total_commits) as min_commits
       FROM analytics_snapshots 
       WHERE user_id = ? 
       AND snapshot_date BETWEEN ? AND ?`,
      [userId, startDate, endDate],
      (err, row) => {
        if (err) reject(err);
        else resolve(row);
      }
    );
  });

/**
 * Get growth metrics (comparing first and last snapshot in range)
 */
exports.getGrowthMetrics = (userId, startDate, endDate) =>
  new Promise((resolve, reject) => {
    db.all(
      `SELECT * FROM analytics_snapshots 
       WHERE user_id = ? 
       AND snapshot_date BETWEEN ? AND ?
       ORDER BY snapshot_date ASC`,
      [userId, startDate, endDate],
      (err, rows) => {
        if (err) reject(err);
        else if (rows.length < 2) {
          resolve(null); // Not enough data for growth calculation
        } else {
          const first = rows[0];
          const last = rows[rows.length - 1];

          const growth = {
            stars_growth: last.stars - first.stars,
            followers_growth: last.followers - first.followers,
            repos_growth: last.public_repos - first.public_repos,
            commits_growth: last.total_commits - first.total_commits,
            stars_growth_percent:
              first.stars > 0
                ? ((last.stars - first.stars) / first.stars) * 100
                : 0,
            followers_growth_percent:
              first.followers > 0
                ? ((last.followers - first.followers) / first.followers) * 100
                : 0,
            period_days: Math.ceil(
              (new Date(last.snapshot_date) - new Date(first.snapshot_date)) /
                (1000 * 60 * 60 * 24)
            ),
          };

          resolve(growth);
        }
      }
    );
  });
