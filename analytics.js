/**
 * Analytics Dashboard JavaScript
 * Handles data fetching, chart rendering, and user interactions
 */

// Configuration
const API_BASE_URL = 'http://localhost:3000/api';
let currentUser = null;
let analyticsData = [];
let charts = {};

// Chart color schemes
const COLORS = {
    primary: '#6366f1',
    secondary: '#8b5cf6',
    success: '#10b981',
    warning: '#f59e0b',
    danger: '#ef4444',
    info: '#3b82f6',
    gradient: ['#6366f1', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981'],
};

// Initialize dashboard
document.addEventListener('DOMContentLoaded', async () => {
    console.log('📊 Initializing Analytics Dashboard...');

    // Check authentication
    await checkAuthentication();

    // Set up event listeners
    setupEventListeners();

    // Set default date range (last 30 days)
    setDefaultDateRange(30);

    // Load initial data
    if (currentUser) {
        await loadAnalyticsData();
    }
});

/**
 * Check if user is authenticated
 */
async function checkAuthentication() {
    try {
        const token = localStorage.getItem('authToken');

        if (!token) {
            showAuthWarning();
            return;
        }

        // Verify token with backend
        const response = await fetch(`${API_BASE_URL}/user/profile`, {
            headers: {
                'Authorization': `Bearer ${token}`,
            },
        });

        if (response.ok) {
            currentUser = await response.json();
            hideAuthWarning();
        } else {
            showAuthWarning();
        }
    } catch (error) {
        console.error('Authentication check failed:', error);
        showAuthWarning();
    }
}

/**
 * Show authentication warning
 */
function showAuthWarning() {
    const warning = document.getElementById('auth-warning');
    if (warning) {
        warning.style.display = 'flex';
    }

    // Hide main content
    document.getElementById('metrics-grid').style.display = 'none';
    document.querySelector('.charts-grid').style.display = 'none';
    document.querySelector('.table-card').style.display = 'none';
    document.querySelector('.date-range-card').style.display = 'none';
}

/**
 * Hide authentication warning
 */
function hideAuthWarning() {
    const warning = document.getElementById('auth-warning');
    if (warning) {
        warning.style.display = 'none';
    }
}

/**
 * Set up event listeners
 */
function setupEventListeners() {
    // Date range quick buttons
    document.querySelectorAll('[data-range]').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const days = parseInt(e.target.dataset.range);
            setDefaultDateRange(days);
            loadAnalyticsData();
        });
    });

    // Date inputs
    document.getElementById('start-date').addEventListener('change', loadAnalyticsData);
    document.getElementById('end-date').addEventListener('change', loadAnalyticsData);

    // Refresh button
    document.getElementById('refresh-data-btn').addEventListener('click', () => {
        loadAnalyticsData(true);
    });

    // Export button
    document.getElementById('export-data-btn').addEventListener('click', showExportModal);

    // Export modal
    document.getElementById('close-export-modal').addEventListener('click', hideExportModal);
    document.querySelectorAll('.export-option').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const format = e.currentTarget.dataset.format;
            exportData(format);
        });
    });

    // Table toggle
    document.getElementById('toggle-table-btn').addEventListener('click', toggleTable);

    // Chart type selectors
    document.getElementById('stars-chart-type').addEventListener('change', (e) => {
        updateChartType('stars', e.target.value);
    });

    document.getElementById('followers-chart-type').addEventListener('change', (e) => {
        updateChartType('followers', e.target.value);
    });
}

/**
 * Set default date range
 */
function setDefaultDateRange(days) {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    document.getElementById('start-date').value = startDate.toISOString().split('T')[0];
    document.getElementById('end-date').value = endDate.toISOString().split('T')[0];
}

/**
 * Load analytics data from API
 */
async function loadAnalyticsData(forceRefresh = false) {
    if (!currentUser) return;

    try {
        const startDate = document.getElementById('start-date').value;
        const endDate = document.getElementById('end-date').value;

        if (!startDate || !endDate) {
            console.warn('Please select both start and end dates');
            return;
        }

        const token = localStorage.getItem('authToken');

        // Fetch snapshots
        const response = await fetch(
            `${API_BASE_URL}/analytics/snapshots?startDate=${startDate}&endDate=${endDate}`,
            {
                headers: {
                    'Authorization': `Bearer ${token}`,
                },
            }
        );

        if (!response.ok) {
            throw new Error('Failed to fetch analytics data');
        }

        const data = await response.json();
        analyticsData = data.snapshots || [];

        if (analyticsData.length === 0) {
            showEmptyState();
            return;
        }

        // Update UI
        updateMetrics();
        renderCharts();
        updateTable();

    } catch (error) {
        console.error('Error loading analytics data:', error);
        showError('Failed to load analytics data. Please try again.');
    }
}

/**
 * Update metrics cards
 */
function updateMetrics() {
    if (analyticsData.length === 0) return;

    const latest = analyticsData[analyticsData.length - 1];
    const first = analyticsData[0];

    // Update values
    document.getElementById('metric-stars').textContent = latest.stars.toLocaleString();
    document.getElementById('metric-followers').textContent = latest.followers.toLocaleString();
    document.getElementById('metric-repos').textContent = latest.public_repos.toLocaleString();
    document.getElementById('metric-commits').textContent = latest.total_commits.toLocaleString();

    // Calculate and display changes
    updateMetricChange('stars', first.stars, latest.stars);
    updateMetricChange('followers', first.followers, latest.followers);
    updateMetricChange('repos', first.public_repos, latest.public_repos);
    updateMetricChange('commits', first.total_commits, latest.total_commits);
}

/**
 * Update metric change indicator
 */
function updateMetricChange(metric, oldValue, newValue) {
    const changeEl = document.getElementById(`metric-${metric}-change`);
    const change = newValue - oldValue;
    const percentChange = oldValue > 0 ? ((change / oldValue) * 100).toFixed(1) : 0;

    let className = 'neutral';
    let symbol = '';

    if (change > 0) {
        className = 'positive';
        symbol = '↑';
    } else if (change < 0) {
        className = 'negative';
        symbol = '↓';
    } else {
        symbol = '→';
    }

    changeEl.className = `metric-change ${className}`;
    changeEl.textContent = `${symbol} ${Math.abs(change).toLocaleString()} (${percentChange}%)`;
}

/**
 * Render all charts
 */
function renderCharts() {
    renderStarsChart();
    renderFollowersChart();
    renderReposChart();
    renderCommitsChart();
    renderLanguageChart();
    renderContributionChart();
}

/**
 * Render stars growth chart
 */
function renderStarsChart() {
    const ctx = document.getElementById('stars-chart').getContext('2d');
    const chartType = document.getElementById('stars-chart-type').value;

    if (charts.stars) {
        charts.stars.destroy();
    }

    const labels = analyticsData.map(d => new Date(d.snapshot_date).toLocaleDateString());
    const data = analyticsData.map(d => d.stars);

    charts.stars = new Chart(ctx, {
        type: chartType,
        data: {
            labels,
            datasets: [{
                label: 'Total Stars',
                data,
                backgroundColor: chartType === 'bar' ? COLORS.primary : `${COLORS.primary}20`,
                borderColor: COLORS.primary,
                borderWidth: 2,
                fill: chartType === 'line',
                tension: 0.4,
            }],
        },
        options: getChartOptions('Stars'),
    });
}

/**
 * Render followers growth chart
 */
function renderFollowersChart() {
    const ctx = document.getElementById('followers-chart').getContext('2d');
    const chartType = document.getElementById('followers-chart-type').value;

    if (charts.followers) {
        charts.followers.destroy();
    }

    const labels = analyticsData.map(d => new Date(d.snapshot_date).toLocaleDateString());
    const followersData = analyticsData.map(d => d.followers);
    const followingData = analyticsData.map(d => d.following);

    charts.followers = new Chart(ctx, {
        type: chartType,
        data: {
            labels,
            datasets: [
                {
                    label: 'Followers',
                    data: followersData,
                    backgroundColor: chartType === 'bar' ? COLORS.success : `${COLORS.success}20`,
                    borderColor: COLORS.success,
                    borderWidth: 2,
                    fill: chartType === 'line',
                    tension: 0.4,
                },
                {
                    label: 'Following',
                    data: followingData,
                    backgroundColor: chartType === 'bar' ? COLORS.info : `${COLORS.info}20`,
                    borderColor: COLORS.info,
                    borderWidth: 2,
                    fill: chartType === 'line',
                    tension: 0.4,
                },
            ],
        },
        options: getChartOptions('Followers'),
    });
}

/**
 * Render repositories chart
 */
function renderReposChart() {
    const ctx = document.getElementById('repos-chart').getContext('2d');

    if (charts.repos) {
        charts.repos.destroy();
    }

    const labels = analyticsData.map(d => new Date(d.snapshot_date).toLocaleDateString());
    const data = analyticsData.map(d => d.public_repos);

    charts.repos = new Chart(ctx, {
        type: 'line',
        data: {
            labels,
            datasets: [{
                label: 'Public Repositories',
                data,
                backgroundColor: `${COLORS.secondary}20`,
                borderColor: COLORS.secondary,
                borderWidth: 2,
                fill: true,
                tension: 0.4,
            }],
        },
        options: getChartOptions('Repositories'),
    });
}

/**
 * Render commits chart
 */
function renderCommitsChart() {
    const ctx = document.getElementById('commits-chart').getContext('2d');

    if (charts.commits) {
        charts.commits.destroy();
    }

    const labels = analyticsData.map(d => new Date(d.snapshot_date).toLocaleDateString());
    const data = analyticsData.map(d => d.total_commits);

    charts.commits = new Chart(ctx, {
        type: 'bar',
        data: {
            labels,
            datasets: [{
                label: 'Total Commits',
                data,
                backgroundColor: COLORS.warning,
                borderColor: COLORS.warning,
                borderWidth: 1,
            }],
        },
        options: getChartOptions('Commits'),
    });
}

/**
 * Render language distribution chart
 */
function renderLanguageChart() {
    const ctx = document.getElementById('language-chart').getContext('2d');

    if (charts.language) {
        charts.language.destroy();
    }

    // Aggregate language stats from latest snapshot
    const latest = analyticsData[analyticsData.length - 1];
    const languageStats = latest.language_stats || {};

    const labels = Object.keys(languageStats);
    const data = Object.values(languageStats);

    if (labels.length === 0) {
        // Show empty state
        ctx.canvas.parentElement.innerHTML = '<div class="empty-state"><div class="empty-state-icon">📊</div><h3>No Language Data</h3><p>Language statistics will appear here once available.</p></div>';
        return;
    }

    charts.language = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels,
            datasets: [{
                data,
                backgroundColor: COLORS.gradient,
                borderWidth: 2,
                borderColor: '#fff',
            }],
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            plugins: {
                legend: {
                    position: 'bottom',
                },
                tooltip: {
                    callbacks: {
                        label: function (context) {
                            const total = context.dataset.data.reduce((a, b) => a + b, 0);
                            const percentage = ((context.parsed / total) * 100).toFixed(1);
                            return `${context.label}: ${percentage}%`;
                        }
                    }
                }
            },
        },
    });
}

/**
 * Render contribution velocity chart
 */
function renderContributionChart() {
    const ctx = document.getElementById('contribution-chart').getContext('2d');

    if (charts.contribution) {
        charts.contribution.destroy();
    }

    const labels = analyticsData.map(d => new Date(d.snapshot_date).toLocaleDateString());
    const data = analyticsData.map(d => d.contribution_count || 0);

    charts.contribution = new Chart(ctx, {
        type: 'line',
        data: {
            labels,
            datasets: [{
                label: 'Contributions',
                data,
                backgroundColor: `${COLORS.danger}20`,
                borderColor: COLORS.danger,
                borderWidth: 2,
                fill: true,
                tension: 0.4,
            }],
        },
        options: getChartOptions('Contributions'),
    });
}

/**
 * Get common chart options
 */
function getChartOptions(title) {
    return {
        responsive: true,
        maintainAspectRatio: true,
        plugins: {
            legend: {
                display: true,
                position: 'top',
            },
            tooltip: {
                mode: 'index',
                intersect: false,
            },
        },
        scales: {
            y: {
                beginAtZero: true,
                ticks: {
                    precision: 0,
                },
            },
        },
    };
}

/**
 * Update chart type
 */
function updateChartType(chartName, type) {
    if (chartName === 'stars') {
        renderStarsChart();
    } else if (chartName === 'followers') {
        renderFollowersChart();
    }
}

/**
 * Update data table
 */
function updateTable() {
    const tbody = document.getElementById('table-body');
    tbody.innerHTML = '';

    analyticsData.forEach(snapshot => {
        const row = document.createElement('tr');
        row.innerHTML = `
      <td>${new Date(snapshot.snapshot_date).toLocaleDateString()}</td>
      <td>${snapshot.stars.toLocaleString()}</td>
      <td>${snapshot.followers.toLocaleString()}</td>
      <td>${snapshot.following.toLocaleString()}</td>
      <td>${snapshot.public_repos.toLocaleString()}</td>
      <td>${snapshot.total_commits.toLocaleString()}</td>
      <td>${(snapshot.contribution_count || 0).toLocaleString()}</td>
    `;
        tbody.appendChild(row);
    });
}

/**
 * Toggle table visibility
 */
function toggleTable() {
    const container = document.getElementById('table-container');
    container.style.display = container.style.display === 'none' ? 'block' : 'none';
}

/**
 * Show export modal
 */
function showExportModal() {
    document.getElementById('export-modal').style.display = 'flex';
}

/**
 * Hide export modal
 */
function hideExportModal() {
    document.getElementById('export-modal').style.display = 'none';
}

/**
 * Export data
 */
async function exportData(format) {
    try {
        const startDate = document.getElementById('start-date').value;
        const endDate = document.getElementById('end-date').value;
        const token = localStorage.getItem('authToken');

        const response = await fetch(
            `${API_BASE_URL}/analytics/export?format=${format}&startDate=${startDate}&endDate=${endDate}`,
            {
                headers: {
                    'Authorization': `Bearer ${token}`,
                },
            }
        );

        if (!response.ok) {
            throw new Error('Export failed');
        }

        // Download file
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `analytics-export-${Date.now()}.${format}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);

        hideExportModal();
        showSuccess(`Data exported successfully as ${format.toUpperCase()}`);
    } catch (error) {
        console.error('Export error:', error);
        showError('Failed to export data. Please try again.');
    }
}

/**
 * Show empty state
 */
function showEmptyState() {
    const metricsGrid = document.getElementById('metrics-grid');
    metricsGrid.innerHTML = `
    <div class="empty-state" style="grid-column: 1 / -1;">
      <div class="empty-state-icon">📊</div>
      <h3>No Analytics Data Available</h3>
      <p>Start tracking your GitHub analytics by creating your first snapshot from the GitHub Dashboard.</p>
    </div>
  `;
}

/**
 * Show success message
 */
function showSuccess(message) {
    // You can implement a toast notification here
    console.log('✅', message);
    alert(message);
}

/**
 * Show error message
 */
function showError(message) {
    // You can implement a toast notification here
    console.error('❌', message);
    alert(message);
}
