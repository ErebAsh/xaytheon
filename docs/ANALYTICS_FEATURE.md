# Advanced Analytics Dashboard - Feature Documentation

## Overview

The Advanced Analytics Dashboard is a comprehensive feature that enables users to track their GitHub growth over time through interactive visualizations, historical data tracking, and exportable analytics reports.

## Features

### 📊 **Historical Data Tracking**
- Automatic snapshot creation of GitHub metrics
- Stores data points including:
  - Total stars across repositories
  - Follower and following counts
  - Public repository count
  - Total commits
  - Language distribution
  - Contribution velocity

### 📈 **Interactive Visualizations**
- **Line Charts**: Track trends over time for stars, followers, and contributions
- **Bar Charts**: Visualize commit activity and repository growth
- **Doughnut Chart**: Language distribution breakdown
- **Growth Metrics**: Calculate percentage changes and growth rates

### 🎯 **Date Range Filtering**
- Custom date range selection
- Quick filters:
  - Last 7 days
  - Last 30 days
  - Last 90 days
  - Last year

### 💾 **Data Export**
- Export analytics data in multiple formats:
  - **JSON**: Complete data with metadata
  - **CSV**: Spreadsheet-compatible format
- Includes all historical snapshots within selected date range

### 🔄 **Automated Snapshots**
- Scheduled periodic data collection
- Configurable snapshot intervals
- Automatic cleanup of old data (365+ days)

## Architecture

### Backend Components

#### 1. **Database Schema** (`analytics_snapshots` table)
```sql
CREATE TABLE analytics_snapshots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  github_username TEXT NOT NULL,
  stars INTEGER DEFAULT 0,
  followers INTEGER DEFAULT 0,
  following INTEGER DEFAULT 0,
  public_repos INTEGER DEFAULT 0,
  total_commits INTEGER DEFAULT 0,
  language_stats TEXT DEFAULT '{}',
  contribution_count INTEGER DEFAULT 0,
  snapshot_date DATETIME DEFAULT CURRENT_TIMESTAMP,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
)
```

**Indexes for Performance:**
- `idx_analytics_user_id` - Fast user-specific queries
- `idx_analytics_snapshot_date` - Efficient date range filtering
- `idx_analytics_user_date` - Composite index for common query patterns

#### 2. **API Endpoints**

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/api/analytics/snapshot` | Create new snapshot | ✅ |
| GET | `/api/analytics/snapshots` | Get snapshots (with date range) | ✅ |
| GET | `/api/analytics/latest` | Get most recent snapshot | ✅ |
| GET | `/api/analytics/stats` | Get aggregated statistics | ✅ |
| GET | `/api/analytics/growth` | Calculate growth metrics | ✅ |
| GET | `/api/analytics/export` | Export data (JSON/CSV) | ✅ |
| DELETE | `/api/analytics/cleanup` | Remove old snapshots | ✅ |

#### 3. **Models** (`analytics.model.js`)
- `createSnapshot()` - Store new analytics snapshot
- `getSnapshotsByDateRange()` - Retrieve snapshots within date range
- `getLatestSnapshot()` - Get most recent snapshot
- `getAllSnapshots()` - Retrieve all user snapshots
- `getAggregatedStats()` - Calculate min/max/average metrics
- `getGrowthMetrics()` - Compute growth rates and changes
- `deleteOldSnapshots()` - Cleanup maintenance

#### 4. **Controllers** (`analytics.controller.js`)
Handles HTTP request/response logic for all analytics endpoints

#### 5. **Scheduler Service** (`analytics.scheduler.js`)
- Automated periodic snapshot creation
- Scheduled data cleanup
- Configurable intervals
- Manual snapshot triggering

### Frontend Components

#### 1. **HTML** (`analytics.html`)
- Responsive dashboard layout
- Chart containers
- Date range selectors
- Metrics cards
- Data table
- Export modal

#### 2. **CSS** (`analytics.css`)
- Modern, premium design
- Dark mode support
- Responsive grid layouts
- Smooth animations
- Interactive hover effects

#### 3. **JavaScript** (`analytics.js`)
- Chart.js integration
- API communication
- Dynamic chart rendering
- Date range management
- Export functionality
- Real-time data updates

## Usage Guide

### For Users

#### 1. **Accessing the Dashboard**
Navigate to `analytics.html` after logging in to your Xaytheon account.

#### 2. **Viewing Analytics**
- Select a date range using the date pickers or quick filter buttons
- View growth metrics in the overview cards
- Explore interactive charts by hovering over data points
- Switch between chart types (line/bar) using the dropdown selectors

#### 3. **Exporting Data**
1. Click the "Export Data" button
2. Choose your preferred format (JSON or CSV)
3. File will download automatically

#### 4. **Creating Snapshots**
Snapshots are created automatically, but you can also:
- Manually trigger a snapshot from the GitHub Dashboard
- Use the API to create snapshots programmatically

### For Developers

#### 1. **Running the Backend**
```bash
cd backend
npm install
npm run dev
```

#### 2. **Database Migration**
```bash
node src/migrations/create-analytics-table.js
```

#### 3. **Starting the Scheduler**
In `server.js` or your main app file:
```javascript
const analyticsScheduler = require('./services/analytics.scheduler');

// Start scheduler (snapshots every 24 hours, cleanup every 7 days)
analyticsScheduler.start(24, 7);
```

#### 4. **Creating a Manual Snapshot**
```javascript
const analyticsScheduler = require('./services/analytics.scheduler');

const githubData = {
  stars: 150,
  followers: 200,
  following: 180,
  public_repos: 25,
  total_commits: 1500,
  language_stats: {
    'JavaScript': 45,
    'Python': 30,
    'TypeScript': 25
  },
  contribution_count: 350
};

await analyticsScheduler.createManualSnapshot(
  userId,
  'github-username',
  githubData
);
```

#### 5. **API Usage Examples**

**Create Snapshot:**
```javascript
const response = await fetch('http://localhost:3000/api/analytics/snapshot', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  },
  body: JSON.stringify({
    githubUsername: 'octocat',
    snapshotData: {
      stars: 150,
      followers: 200,
      following: 180,
      publicRepos: 25,
      totalCommits: 1500,
      languageStats: { 'JavaScript': 45, 'Python': 30 },
      contributionCount: 350
    }
  })
});
```

**Get Snapshots:**
```javascript
const response = await fetch(
  'http://localhost:3000/api/analytics/snapshots?startDate=2026-01-01&endDate=2026-01-31',
  {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  }
);
const data = await response.json();
```

**Export Data:**
```javascript
const response = await fetch(
  'http://localhost:3000/api/analytics/export?format=csv&startDate=2026-01-01&endDate=2026-01-31',
  {
    headers: {
      'Authorization': `Bearer ${token}`
    }
  }
);
const blob = await response.blob();
// Download blob as file
```

## Configuration

### Environment Variables
Add to your `.env` file:
```env
# Analytics Configuration
ANALYTICS_SNAPSHOT_INTERVAL_HOURS=24
ANALYTICS_CLEANUP_INTERVAL_DAYS=7
ANALYTICS_DATA_RETENTION_DAYS=365
```

### Scheduler Configuration
Modify in `analytics.scheduler.js`:
```javascript
// Snapshot every 12 hours instead of 24
analyticsScheduler.start(12, 7);

// Cleanup every 30 days instead of 7
analyticsScheduler.start(24, 30);
```

## Performance Considerations

### Database Optimization
- Indexes on frequently queried columns
- Composite indexes for common query patterns
- Automatic cleanup of old data

### Frontend Optimization
- Chart.js lazy loading
- Data caching
- Debounced API calls
- Responsive chart sizing

### API Optimization
- Date range validation
- Result pagination (limit parameter)
- Efficient SQL queries
- JSON compression for exports

## Security

### Authentication
- All endpoints require JWT authentication
- Token verification on every request
- User-specific data isolation

### Data Privacy
- Users can only access their own analytics
- Foreign key constraints ensure data integrity
- Automatic cleanup prevents data accumulation

### Input Validation
- Date range validation
- Snapshot data validation
- SQL injection prevention (parameterized queries)

## Future Enhancements

### Planned Features
- [ ] Real-time analytics updates via WebSockets
- [ ] Comparison mode (compare multiple time periods)
- [ ] Goal setting and tracking
- [ ] Email reports (weekly/monthly summaries)
- [ ] Advanced filtering (by repository, language, etc.)
- [ ] Predictive analytics (growth forecasting)
- [ ] Team analytics (for organizations)
- [ ] Custom dashboard layouts
- [ ] More chart types (scatter, radar, etc.)
- [ ] PDF export with charts

### Integration Opportunities
- GitHub Actions integration
- Slack/Discord notifications
- Google Analytics integration
- Third-party analytics platforms

## Troubleshooting

### Common Issues

**Issue: No data showing in charts**
- Solution: Ensure you have created at least one snapshot
- Check date range selection
- Verify authentication token is valid

**Issue: Export not working**
- Solution: Check browser console for errors
- Ensure date range is selected
- Verify backend is running

**Issue: Charts not rendering**
- Solution: Check Chart.js is loaded (check browser console)
- Verify canvas elements exist in DOM
- Check for JavaScript errors

**Issue: Database errors**
- Solution: Run migration script again
- Check database file permissions
- Verify SQLite is installed

## Contributing

When contributing to the analytics feature:

1. Follow existing code style
2. Add tests for new functionality
3. Update documentation
4. Test with various data scenarios
5. Ensure responsive design works on all devices

## License

This feature is part of the Xaytheon project and follows the same MIT license.

## Credits

- **Developer**: SatyamPandey-07
- **Issue**: #142 (SWoC 2026)
- **Complexity**: Advanced (200 points)
- **Technologies**: Node.js, Express, SQLite, Chart.js, HTML5, CSS3

---

**Last Updated**: January 12, 2026
**Version**: 1.0.0
