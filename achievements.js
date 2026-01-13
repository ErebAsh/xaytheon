/**
 * Achievements JavaScript
 * Handles frontend logic for gamification features
 */

const API_BASE_URL = 'http://localhost:5000/api';
let currentUser = null;
let achievements = [];
let currentCategory = 'all';

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
    setupTabs();
    setupFilters();

    // Check authentication
    const token = localStorage.getItem('authToken');
    if (!token) {
        showAuthWarning();
        // Still load public achievements and leaderboard
        loadPublicAchievements();
        loadLeaderboard();
        return;
    }

    try {
        // Load user data
        await loadUserSummary();
        await loadAchievements();
        await loadLeaderboard();
        await loadXPHistory();
    } catch (error) {
        console.error('Initialization error:', error);
        showAuthWarning();
    }
});

/**
 * Load user's gamification summary
 */
async function loadUserSummary() {
    const token = localStorage.getItem('authToken');

    try {
        const response = await fetch(`${API_BASE_URL}/achievements/summary`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) throw new Error('Failed to load summary');

        const data = await response.json();
        updateUserStats(data);
    } catch (error) {
        console.error('Error loading summary:', error);
    }
}

/**
 * Update UI with user stats
 */
function updateUserStats(data) {
    // Level
    document.querySelector('.level-number').textContent = data.xp.level;

    // XP bar
    document.getElementById('xp-bar').style.width = `${data.xp.progress_percent}%`;
    document.getElementById('current-xp').textContent = data.xp.total.toLocaleString();
    document.getElementById('next-level-xp').textContent = data.xp.xp_for_next_level.toLocaleString();

    // Streak
    document.getElementById('streak-count').textContent = data.streak.current;

    // Quick stats
    document.getElementById('achievements-unlocked').textContent = data.achievements.unlocked;
    document.getElementById('total-achievements').textContent = data.achievements.total;
    document.getElementById('user-rank').textContent = `#${data.rank}`;
}

/**
 * Load achievements with user progress
 */
async function loadAchievements() {
    const token = localStorage.getItem('authToken');

    try {
        const response = await fetch(`${API_BASE_URL}/achievements`, {
            headers: token ? { 'Authorization': `Bearer ${token}` } : {}
        });

        if (!response.ok) throw new Error('Failed to load achievements');

        const data = await response.json();
        achievements = data.achievements;
        renderAchievements();
    } catch (error) {
        console.error('Error loading achievements:', error);
    }
}

/**
 * Load public achievements (no auth)
 */
async function loadPublicAchievements() {
    try {
        const response = await fetch(`${API_BASE_URL}/achievements`);

        if (!response.ok) throw new Error('Failed to load achievements');

        const data = await response.json();
        achievements = data.achievements.map(a => ({ ...a, unlocked: 0, progress: 0 }));
        renderAchievements();
    } catch (error) {
        console.error('Error loading public achievements:', error);
    }
}

/**
 * Render achievements grid
 */
function renderAchievements() {
    const grid = document.getElementById('badges-grid');
    grid.innerHTML = '';

    const filtered = currentCategory === 'all'
        ? achievements
        : achievements.filter(a => a.category === currentCategory);

    if (filtered.length === 0) {
        grid.innerHTML = '<p style="text-align: center; color: var(--text-secondary); grid-column: 1/-1;">No achievements in this category yet.</p>';
        return;
    }

    filtered.forEach(achievement => {
        const card = createBadgeCard(achievement);
        grid.appendChild(card);
    });
}

/**
 * Create badge card element
 */
function createBadgeCard(achievement) {
    const card = document.createElement('div');
    const isUnlocked = achievement.unlocked === 1;

    card.className = `badge-card ${isUnlocked ? 'unlocked' : 'locked'}`;

    // Calculate progress percentage
    const progressPercent = isUnlocked
        ? 100
        : Math.min(100, (achievement.progress / achievement.requirement_value) * 100);

    card.innerHTML = `
    <span class="tier-indicator tier-${achievement.tier}">${achievement.tier}</span>
    <span class="badge-icon">${achievement.icon}</span>
    <div class="badge-name">${achievement.name}</div>
    <div class="badge-desc">${achievement.description}</div>
    <div class="badge-xp">+${achievement.xp_reward} XP</div>
    ${!isUnlocked ? `
      <div class="badge-progress">
        <div class="badge-progress-bar">
          <div class="badge-progress-fill" style="width: ${progressPercent}%"></div>
        </div>
        <div class="badge-progress-text">${achievement.progress || 0} / ${achievement.requirement_value}</div>
      </div>
    ` : `
      <div class="unlocked-date">✓ Unlocked ${achievement.unlocked_at ? formatDate(achievement.unlocked_at) : ''}</div>
    `}
  `;

    return card;
}

/**
 * Load leaderboard
 */
async function loadLeaderboard() {
    const token = localStorage.getItem('authToken');

    try {
        const response = await fetch(`${API_BASE_URL}/achievements/leaderboard?limit=10`, {
            headers: token ? { 'Authorization': `Bearer ${token}` } : {}
        });

        if (!response.ok) throw new Error('Failed to load leaderboard');

        const data = await response.json();
        renderLeaderboard(data.leaderboard, data.user_rank);
    } catch (error) {
        console.error('Error loading leaderboard:', error);
    }
}

/**
 * Render leaderboard
 */
function renderLeaderboard(leaderboard, userRank) {
    // Podium (top 3)
    const podium = document.getElementById('leaderboard-podium');
    podium.innerHTML = '';

    const top3 = leaderboard.slice(0, 3);
    const positions = ['second', 'first', 'third'];
    const medals = ['🥈', '🥇', '🥉'];

    [1, 0, 2].forEach((index, displayOrder) => {
        if (top3[index]) {
            const user = top3[index];
            const item = document.createElement('div');
            item.className = `podium-item ${positions[displayOrder]}`;
            item.innerHTML = `
        <div class="podium-rank">${medals[index]}</div>
        <div class="podium-avatar">${getInitials(user.username || user.github_username)}</div>
        <div class="podium-name">${user.username || user.github_username}</div>
        <div class="podium-xp">${user.total_xp.toLocaleString()} XP</div>
      `;
            podium.appendChild(item);
        }
    });

    // Rest of leaderboard
    const list = document.getElementById('leaderboard-list');
    list.innerHTML = '';

    leaderboard.slice(3).forEach((user, index) => {
        const item = document.createElement('div');
        item.className = 'leaderboard-item';
        item.innerHTML = `
      <span class="lb-rank">#${index + 4}</span>
      <div class="lb-avatar">${getInitials(user.username || user.github_username)}</div>
      <div class="lb-info">
        <div class="lb-name">${user.username || user.github_username}</div>
        <div class="lb-badges">${user.achievement_count} badges</div>
      </div>
      <span class="lb-xp">${user.total_xp.toLocaleString()} XP</span>
      <span class="lb-level">Lvl ${user.level}</span>
    `;
        list.appendChild(item);
    });

    if (leaderboard.length === 0) {
        list.innerHTML = '<p style="text-align: center; padding: 40px; color: var(--text-secondary);">No rankings yet. Be the first!</p>';
    }
}

/**
 * Load XP activity history
 */
async function loadXPHistory() {
    const token = localStorage.getItem('authToken');
    if (!token) return;

    try {
        const response = await fetch(`${API_BASE_URL}/achievements/xp/history?limit=20`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!response.ok) throw new Error('Failed to load history');

        const data = await response.json();
        renderXPHistory(data.history);
    } catch (error) {
        console.error('Error loading XP history:', error);
    }
}

/**
 * Render XP activity history
 */
function renderXPHistory(history) {
    const list = document.getElementById('activity-list');
    list.innerHTML = '';

    if (history.length === 0) {
        list.innerHTML = '<p style="text-align: center; padding: 40px; color: var(--text-secondary);">No XP activity yet. Start earning!</p>';
        return;
    }

    history.forEach(item => {
        const el = document.createElement('div');
        el.className = 'activity-item';
        el.innerHTML = `
      <div class="activity-icon">${getActivityIcon(item.source)}</div>
      <div class="activity-info">
        <div class="activity-desc">${item.description || item.source}</div>
        <div class="activity-time">${formatDate(item.created_at)}</div>
      </div>
      <span class="activity-xp">+${item.xp_amount} XP</span>
    `;
        list.appendChild(el);
    });
}

/**
 * Setup tab navigation
 */
function setupTabs() {
    const tabs = document.querySelectorAll('.tab-btn');

    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            // Update active tab
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');

            // Show corresponding content
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
            document.getElementById(`${tab.dataset.tab}-tab`).classList.add('active');
        });
    });
}

/**
 * Setup category filters
 */
function setupFilters() {
    const filters = document.querySelectorAll('.filter-btn');

    filters.forEach(filter => {
        filter.addEventListener('click', () => {
            filters.forEach(f => f.classList.remove('active'));
            filter.classList.add('active');

            currentCategory = filter.dataset.category;
            renderAchievements();
        });
    });
}

/**
 * Show achievement unlock modal
 */
function showUnlockModal(achievement) {
    document.getElementById('unlock-badge-icon').textContent = achievement.icon;
    document.getElementById('unlock-badge-name').textContent = achievement.name;
    document.getElementById('unlock-badge-desc').textContent = achievement.description;
    document.getElementById('unlock-xp-amount').textContent = achievement.xp_reward;

    document.getElementById('unlock-modal').style.display = 'flex';
}

function closeUnlockModal() {
    document.getElementById('unlock-modal').style.display = 'none';
}

/**
 * Show auth warning
 */
function showAuthWarning() {
    document.getElementById('auth-warning').style.display = 'flex';
    document.getElementById('user-stats-panel').style.opacity = '0.5';
}

// Utility Functions
function getInitials(name) {
    if (!name) return '?';
    return name.split(/[\s_-]/).map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function getActivityIcon(source) {
    const icons = {
        'achievement': '🏆',
        'daily_login': '📅',
        'profile_view': '👁️',
        'watchlist_add': '👀',
        'star_received': '⭐',
        'follower_gained': '👤'
    };
    return icons[source] || '💎';
}

// Global scope for onclick handlers
window.closeUnlockModal = closeUnlockModal;
window.showUnlockModal = showUnlockModal;
