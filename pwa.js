/**
 * PWA Manager - Handles Service Worker registration, updates, and offline functionality
 */

const PWA = {
    deferredPrompt: null,
    swRegistration: null,
    isOnline: navigator.onLine,
    dbName: 'xaytheon-offline-db',
    dbVersion: 1,
    db: null,

    // ==================== INITIALIZATION ====================
    async init() {
        console.log('[PWA] Initializing...');

        // Setup online/offline detection
        this.setupNetworkListeners();

        // Register Service Worker
        await this.registerServiceWorker();

        // Setup Install Prompt
        this.setupInstallPrompt();

        // Initialize IndexedDB
        await this.initIndexedDB();

        // Check for updates periodically
        setInterval(() => this.checkForUpdates(), 60 * 60 * 1000); // Every hour

        console.log('[PWA] Initialized successfully');
    },

    // ==================== SERVICE WORKER ====================
    async registerServiceWorker() {
        if (!('serviceWorker' in navigator)) {
            console.warn('[PWA] Service Workers not supported');
            return;
        }

        try {
            this.swRegistration = await navigator.serviceWorker.register('/service-worker.js', {
                scope: '/'
            });

            console.log('[PWA] Service Worker registered:', this.swRegistration.scope);

            // Handle updates
            this.swRegistration.addEventListener('updatefound', () => {
                this.handleUpdateFound();
            });

            // Check if there's a waiting worker
            if (this.swRegistration.waiting) {
                this.showUpdateNotification();
            }

        } catch (error) {
            console.error('[PWA] Service Worker registration failed:', error);
        }
    },

    handleUpdateFound() {
        const newWorker = this.swRegistration.installing;
        console.log('[PWA] New Service Worker found');

        newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                this.showUpdateNotification();
            }
        });
    },

    showUpdateNotification() {
        // Create update banner
        const banner = document.createElement('div');
        banner.id = 'pwa-update-banner';
        banner.innerHTML = `
      <div class="pwa-update-content">
        <span>🔄 A new version of XAYTHEON is available!</span>
        <button id="pwa-update-btn" class="btn btn-primary btn-sm">Update Now</button>
        <button id="pwa-dismiss-btn" class="btn btn-outline btn-sm">Later</button>
      </div>
    `;
        banner.style.cssText = `
      position: fixed;
      bottom: 20px;
      left: 50%;
      transform: translateX(-50%);
      background: linear-gradient(135deg, #6366f1, #8b5cf6);
      color: white;
      padding: 16px 24px;
      border-radius: 12px;
      box-shadow: 0 10px 40px rgba(99, 102, 241, 0.4);
      z-index: 10000;
      animation: slideUp 0.3s ease;
    `;

        document.body.appendChild(banner);

        document.getElementById('pwa-update-btn').addEventListener('click', () => {
            this.applyUpdate();
            banner.remove();
        });

        document.getElementById('pwa-dismiss-btn').addEventListener('click', () => {
            banner.remove();
        });
    },

    applyUpdate() {
        if (this.swRegistration.waiting) {
            this.swRegistration.waiting.postMessage({ type: 'SKIP_WAITING' });
        }
        window.location.reload();
    },

    async checkForUpdates() {
        if (this.swRegistration) {
            await this.swRegistration.update();
        }
    },

    // ==================== INSTALL PROMPT ====================
    setupInstallPrompt() {
        window.addEventListener('beforeinstallprompt', (e) => {
            console.log('[PWA] Install prompt available');
            e.preventDefault();
            this.deferredPrompt = e;
            this.showInstallButton();
        });

        window.addEventListener('appinstalled', () => {
            console.log('[PWA] App installed successfully');
            this.deferredPrompt = null;
            this.hideInstallButton();
            this.showToast('🎉 XAYTHEON installed successfully!');
        });
    },

    showInstallButton() {
        // Check if install button already exists
        if (document.getElementById('pwa-install-btn')) return;

        const btn = document.createElement('button');
        btn.id = 'pwa-install-btn';
        btn.innerHTML = `
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
        <polyline points="7 10 12 15 17 10"/>
        <line x1="12" y1="15" x2="12" y2="3"/>
      </svg>
      Install App
    `;
        btn.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      background: linear-gradient(135deg, #6366f1, #8b5cf6);
      color: white;
      border: none;
      padding: 12px 20px;
      border-radius: 25px;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 8px;
      font-weight: 600;
      box-shadow: 0 4px 20px rgba(99, 102, 241, 0.4);
      z-index: 9999;
      transition: transform 0.2s, box-shadow 0.2s;
    `;
        btn.addEventListener('mouseenter', () => {
            btn.style.transform = 'scale(1.05)';
            btn.style.boxShadow = '0 6px 30px rgba(99, 102, 241, 0.5)';
        });
        btn.addEventListener('mouseleave', () => {
            btn.style.transform = 'scale(1)';
            btn.style.boxShadow = '0 4px 20px rgba(99, 102, 241, 0.4)';
        });
        btn.addEventListener('click', () => this.promptInstall());

        document.body.appendChild(btn);
    },

    hideInstallButton() {
        const btn = document.getElementById('pwa-install-btn');
        if (btn) btn.remove();
    },

    async promptInstall() {
        if (!this.deferredPrompt) return;

        this.deferredPrompt.prompt();
        const { outcome } = await this.deferredPrompt.userChoice;
        console.log('[PWA] Install prompt outcome:', outcome);
        this.deferredPrompt = null;
    },

    // ==================== NETWORK STATUS ====================
    setupNetworkListeners() {
        window.addEventListener('online', () => {
            console.log('[PWA] Back online');
            this.isOnline = true;
            this.hideOfflineIndicator();
            this.syncPendingRequests();
            this.showToast('✅ You are back online!');
        });

        window.addEventListener('offline', () => {
            console.log('[PWA] Gone offline');
            this.isOnline = false;
            this.showOfflineIndicator();
            this.showToast('📴 You are offline. Some features may be limited.');
        });

        // Initial check
        if (!navigator.onLine) {
            this.showOfflineIndicator();
        }
    },

    showOfflineIndicator() {
        if (document.getElementById('offline-indicator')) return;

        const indicator = document.createElement('div');
        indicator.id = 'offline-indicator';
        indicator.innerHTML = '📴 Offline Mode';
        indicator.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      background: #ef4444;
      color: white;
      text-align: center;
      padding: 8px;
      font-size: 14px;
      font-weight: 600;
      z-index: 10001;
    `;
        document.body.appendChild(indicator);
        document.body.style.paddingTop = '36px';
    },

    hideOfflineIndicator() {
        const indicator = document.getElementById('offline-indicator');
        if (indicator) {
            indicator.remove();
            document.body.style.paddingTop = '0';
        }
    },

    // ==================== INDEXED DB ====================
    async initIndexedDB() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.dbVersion);

            request.onerror = () => {
                console.error('[PWA] IndexedDB error:', request.error);
                reject(request.error);
            };

            request.onsuccess = () => {
                this.db = request.result;
                console.log('[PWA] IndexedDB initialized');
                resolve(this.db);
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;

                // Pending requests store
                if (!db.objectStoreNames.contains('pendingRequests')) {
                    const store = db.createObjectStore('pendingRequests', { keyPath: 'id', autoIncrement: true });
                    store.createIndex('timestamp', 'timestamp', { unique: false });
                }

                // Cached data store
                if (!db.objectStoreNames.contains('cachedData')) {
                    const store = db.createObjectStore('cachedData', { keyPath: 'key' });
                    store.createIndex('expiry', 'expiry', { unique: false });
                }

                // User preferences store
                if (!db.objectStoreNames.contains('preferences')) {
                    db.createObjectStore('preferences', { keyPath: 'key' });
                }

                console.log('[PWA] IndexedDB schema created');
            };
        });
    },

    // Save pending request for background sync
    async savePendingRequest(url, method, headers, body) {
        if (!this.db) return;

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['pendingRequests'], 'readwrite');
            const store = transaction.objectStore('pendingRequests');

            const request = store.add({
                url,
                method,
                headers: Object.fromEntries(headers.entries?.() || []),
                body,
                timestamp: Date.now()
            });

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    },

    // Get all pending requests
    async getPendingRequests() {
        if (!this.db) return [];

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['pendingRequests'], 'readonly');
            const store = transaction.objectStore('pendingRequests');
            const request = store.getAll();

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    },

    // Remove pending request
    async removePendingRequest(id) {
        if (!this.db) return;

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(['pendingRequests'], 'readwrite');
            const store = transaction.objectStore('pendingRequests');
            const request = store.delete(id);

            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    },

    // Sync pending requests when back online
    async syncPendingRequests() {
        const pendingRequests = await this.getPendingRequests();
        console.log('[PWA] Syncing', pendingRequests.length, 'pending requests');

        for (const req of pendingRequests) {
            try {
                const response = await fetch(req.url, {
                    method: req.method,
                    headers: req.headers,
                    body: req.body
                });

                if (response.ok) {
                    await this.removePendingRequest(req.id);
                    console.log('[PWA] Synced:', req.url);
                }
            } catch (error) {
                console.error('[PWA] Sync failed:', error);
            }
        }

        // Trigger background sync if available
        if ('sync' in self.registration) {
            await this.swRegistration.sync.register('sync-pending-requests');
        }
    },

    // ==================== PUSH NOTIFICATIONS ====================
    async requestNotificationPermission() {
        if (!('Notification' in window)) {
            console.warn('[PWA] Notifications not supported');
            return false;
        }

        const permission = await Notification.requestPermission();
        console.log('[PWA] Notification permission:', permission);
        return permission === 'granted';
    },

    async subscribeToPush() {
        if (!this.swRegistration) {
            console.error('[PWA] Service Worker not registered');
            return null;
        }

        try {
            // Get VAPID public key from server
            const response = await fetch('/api/push/vapid-public-key');
            const { publicKey } = await response.json();

            const subscription = await this.swRegistration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: this.urlBase64ToUint8Array(publicKey)
            });

            console.log('[PWA] Push subscription:', subscription);

            // Send subscription to server
            await fetch('/api/push/subscribe', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(subscription)
            });

            return subscription;
        } catch (error) {
            console.error('[PWA] Push subscription failed:', error);
            return null;
        }
    },

    async unsubscribeFromPush() {
        if (!this.swRegistration) return;

        try {
            const subscription = await this.swRegistration.pushManager.getSubscription();
            if (subscription) {
                await subscription.unsubscribe();
                console.log('[PWA] Unsubscribed from push');
            }
        } catch (error) {
            console.error('[PWA] Unsubscribe failed:', error);
        }
    },

    urlBase64ToUint8Array(base64String) {
        const padding = '='.repeat((4 - base64String.length % 4) % 4);
        const base64 = (base64String + padding)
            .replace(/-/g, '+')
            .replace(/_/g, '/');

        const rawData = window.atob(base64);
        const outputArray = new Uint8Array(rawData.length);

        for (let i = 0; i < rawData.length; ++i) {
            outputArray[i] = rawData.charCodeAt(i);
        }
        return outputArray;
    },

    // ==================== UTILITIES ====================
    showToast(message, duration = 3000) {
        const toast = document.createElement('div');
        toast.className = 'pwa-toast';
        toast.textContent = message;
        toast.style.cssText = `
      position: fixed;
      bottom: 80px;
      left: 50%;
      transform: translateX(-50%);
      background: rgba(0, 0, 0, 0.9);
      color: white;
      padding: 12px 24px;
      border-radius: 8px;
      z-index: 10000;
      animation: fadeIn 0.3s ease;
    `;

        document.body.appendChild(toast);

        setTimeout(() => {
            toast.style.animation = 'fadeOut 0.3s ease forwards';
            setTimeout(() => toast.remove(), 300);
        }, duration);
    },

    // Check if app is installed
    isInstalled() {
        return window.matchMedia('(display-mode: standalone)').matches ||
            window.navigator.standalone === true;
    }
};

// Initialize PWA when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => PWA.init());
} else {
    PWA.init();
}

// Export for global access
window.PWA = PWA;
