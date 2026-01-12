# Real-Time Collaborative Watchlist - Implementation Plan

## 🎯 Feature Overview
Build a sophisticated real-time watchlist system with WebSocket notifications, collaborative features, and GitHub event tracking.

**Issue**: #143 (SWoC 2026)  
**Complexity**: Advanced (200 points)  
**Branch**: `feature/realtime-collaborative-watchlist`

---

## 📋 Implementation Phases

### Phase 1: Backend Foundation
**Priority**: HIGH

#### 1.1 Database Schema
- [ ] `watchlists` table - Store watchlist metadata
- [ ] `watchlist_repositories` table - Track repositories in watchlists
- [ ] `watchlist_collaborators` table - Manage team members
- [ ] `notifications` table - Store notification history
- [ ] `notification_preferences` table - User notification settings
- [ ] Database migration scripts

#### 1.2 REST API Endpoints
- [ ] POST `/api/watchlists` - Create watchlist
- [ ] GET `/api/watchlists` - Get user's watchlists
- [ ] GET `/api/watchlists/:id` - Get specific watchlist
- [ ] PUT `/api/watchlists/:id` - Update watchlist
- [ ] DELETE `/api/watchlists/:id` - Delete watchlist
- [ ] POST `/api/watchlists/:id/repositories` - Add repository
- [ ] DELETE `/api/watchlists/:id/repositories/:repoId` - Remove repository
- [ ] POST `/api/watchlists/:id/collaborators` - Add collaborator
- [ ] DELETE `/api/watchlists/:id/collaborators/:userId` - Remove collaborator
- [ ] GET `/api/notifications` - Get user notifications
- [ ] PUT `/api/notifications/:id/read` - Mark as read
- [ ] PUT `/api/notifications/read-all` - Mark all as read

#### 1.3 WebSocket Server (Socket.io)
- [ ] Install Socket.io dependencies
- [ ] Create WebSocket server configuration
- [ ] Implement JWT authentication for WebSocket connections
- [ ] Create event handlers (join, leave, subscribe, unsubscribe)
- [ ] Implement room-based broadcasting
- [ ] Add connection/disconnection logging
- [ ] Implement auto-reconnection logic

#### 1.4 GitHub Integration Service
- [ ] Create GitHub polling service
- [ ] Implement webhook receiver (optional)
- [ ] Track repository events:
  - New releases
  - Star milestones (100, 500, 1k, 5k, 10k)
  - New issues
  - Pull requests
  - Commits to main branch
- [ ] Rate limit management
- [ ] Event deduplication

### Phase 2: Real-Time Features
**Priority**: HIGH

#### 2.1 Notification System
- [ ] Notification creation service
- [ ] Event-to-notification mapper
- [ ] Notification filtering by preferences
- [ ] Broadcast notifications via WebSocket
- [ ] Notification persistence

#### 2.2 Presence System
- [ ] Track online users per watchlist
- [ ] Broadcast presence updates
- [ ] Handle user join/leave events
- [ ] Display "who's viewing" indicators

#### 2.3 Collaborative Features
- [ ] Real-time activity feed
- [ ] Collaborative comments on repositories
- [ ] Live cursor/viewing indicators
- [ ] Shared watchlist updates

### Phase 3: Frontend Implementation
**Priority**: HIGH

#### 3.1 Watchlist Management UI
- [ ] Create `watchlist.html` page
- [ ] Watchlist creation modal
- [ ] Repository search and add interface
- [ ] Collaborator management UI
- [ ] Watchlist settings panel

#### 3.2 Real-Time Components
- [ ] WebSocket connection manager
- [ ] Toast notification system
- [ ] Live-updating repository cards
- [ ] Notification center with badge
- [ ] Presence indicators
- [ ] Activity feed component

#### 3.3 Notification Center
- [ ] Notification dropdown/panel
- [ ] Filter by type (releases, stars, issues, PRs)
- [ ] Search functionality
- [ ] Mark as read/unread
- [ ] Clear all notifications
- [ ] Notification preferences UI

### Phase 4: Polish & Optimization
**Priority**: MEDIUM

#### 4.1 Performance
- [ ] Connection pooling
- [ ] Event debouncing
- [ ] Lazy loading for notifications
- [ ] Pagination for watchlists
- [ ] Caching strategy

#### 4.2 Error Handling
- [ ] WebSocket reconnection logic
- [ ] Offline mode support
- [ ] Error toast notifications
- [ ] Graceful degradation

#### 4.3 Testing
- [ ] WebSocket connection tests
- [ ] API endpoint tests
- [ ] Real-time event broadcasting tests
- [ ] UI interaction tests

---

## 🗂️ File Structure

```
xaytheon/
├── backend/
│   └── src/
│       ├── models/
│       │   ├── watchlist.model.js
│       │   ├── notification.model.js
│       │   └── collaborator.model.js
│       ├── controllers/
│       │   ├── watchlist.controller.js
│       │   └── notification.controller.js
│       ├── routes/
│       │   ├── watchlist.routes.js
│       │   └── notification.routes.js
│       ├── services/
│       │   ├── websocket.service.js
│       │   ├── github-polling.service.js
│       │   ├── notification.service.js
│       │   └── presence.service.js
│       ├── migrations/
│       │   └── create-watchlist-tables.js
│       └── socket/
│           ├── socket.server.js
│           └── socket.handlers.js
├── watchlist.html
├── watchlist.css
├── watchlist.js
└── docs/
    └── WATCHLIST_FEATURE.md
```

---

## 🔧 Technical Stack

### Backend
- **WebSocket**: Socket.io 4.x
- **Database**: SQLite3 (with indexes)
- **Authentication**: JWT for both HTTP and WebSocket
- **Polling**: Node-cron for scheduled tasks
- **Events**: EventEmitter for pub/sub

### Frontend
- **WebSocket Client**: Socket.io-client 4.x
- **UI**: HTML5, CSS3, JavaScript (ES6+)
- **Notifications**: Custom toast system
- **State Management**: Local state with event-driven updates

---

## 📊 Database Schema

### watchlists
```sql
CREATE TABLE watchlists (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  description TEXT,
  owner_id INTEGER NOT NULL,
  is_public BOOLEAN DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
);
```

### watchlist_repositories
```sql
CREATE TABLE watchlist_repositories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  watchlist_id INTEGER NOT NULL,
  repo_full_name TEXT NOT NULL,
  repo_data TEXT, -- JSON: stars, description, language, etc.
  added_by INTEGER NOT NULL,
  added_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (watchlist_id) REFERENCES watchlists(id) ON DELETE CASCADE,
  FOREIGN KEY (added_by) REFERENCES users(id)
);
```

### watchlist_collaborators
```sql
CREATE TABLE watchlist_collaborators (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  watchlist_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  role TEXT DEFAULT 'viewer', -- viewer, editor, admin
  added_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (watchlist_id) REFERENCES watchlists(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE(watchlist_id, user_id)
);
```

### notifications
```sql
CREATE TABLE notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  watchlist_id INTEGER,
  repo_full_name TEXT,
  type TEXT NOT NULL, -- release, star_milestone, issue, pr, commit
  title TEXT NOT NULL,
  message TEXT,
  data TEXT, -- JSON: event details
  is_read BOOLEAN DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (watchlist_id) REFERENCES watchlists(id) ON DELETE SET NULL
);
```

### notification_preferences
```sql
CREATE TABLE notification_preferences (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  notify_releases BOOLEAN DEFAULT 1,
  notify_stars BOOLEAN DEFAULT 1,
  notify_issues BOOLEAN DEFAULT 0,
  notify_prs BOOLEAN DEFAULT 0,
  notify_commits BOOLEAN DEFAULT 0,
  star_milestone_threshold INTEGER DEFAULT 100,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE(user_id)
);
```

---

## 🔄 WebSocket Events

### Client → Server
- `authenticate` - Authenticate WebSocket connection
- `join_watchlist` - Join a watchlist room
- `leave_watchlist` - Leave a watchlist room
- `subscribe_repo` - Subscribe to repository events
- `unsubscribe_repo` - Unsubscribe from repository
- `send_comment` - Send comment to watchlist
- `update_presence` - Update user presence status

### Server → Client
- `authenticated` - Authentication successful
- `notification` - New notification
- `repo_update` - Repository data updated
- `user_joined` - User joined watchlist
- `user_left` - User left watchlist
- `presence_update` - Presence status changed
- `comment_received` - New comment in watchlist
- `error` - Error occurred

---

## 🎨 UI Components

### 1. Watchlist Page
- Sidebar with watchlist list
- Main area with repository cards
- Top bar with search and filters
- Notification bell icon with badge

### 2. Repository Card
- Repository name and description
- Star count, language, last update
- Live update indicator
- Quick actions (remove, view on GitHub)

### 3. Notification Center
- Dropdown panel from bell icon
- Notification list with icons
- Filter tabs (All, Releases, Stars, etc.)
- Mark all as read button

### 4. Presence Indicators
- Avatar list of online users
- "X people viewing" text
- Live join/leave animations

### 5. Toast Notifications
- Slide-in from top-right
- Auto-dismiss after 5 seconds
- Click to view details
- Different colors by type

---

## 🚀 Implementation Order

1. **Day 1**: Database schema + migrations
2. **Day 1-2**: REST API endpoints
3. **Day 2**: WebSocket server setup
4. **Day 2-3**: GitHub polling service
5. **Day 3**: Notification system
6. **Day 3-4**: Frontend watchlist UI
7. **Day 4**: WebSocket client integration
8. **Day 4-5**: Real-time features (presence, notifications)
9. **Day 5**: Polish, testing, documentation

---

## ✅ Success Criteria

- [ ] Users can create and manage watchlists
- [ ] Real-time notifications for repository events
- [ ] WebSocket connections stable and auto-reconnect
- [ ] Collaborative features working (presence, comments)
- [ ] Notification center functional
- [ ] GitHub API rate limits respected
- [ ] Responsive design
- [ ] Documentation complete

---

**Status**: Ready to implement  
**Estimated Time**: 5-7 days  
**Complexity**: Advanced (200 points)
