/**
 * XAYTHEON Internationalization (i18n) Engine
 * Handles translation loading, language switching, and text replacement.
 */

const i18n = {
    currentLang: 'en',
    defaultLang: 'en',
    supportedLangs: ['en', 'hi', 'es', 'fr', 'ar'],
    translations: {},

    // Initialize the i18n engine
    async init() {
        console.log('[i18n] Initializing...');

        // 1. Detect language preferences
        const savedLang = localStorage.getItem('xaytheon_lang');
        const browserLang = navigator.language.split('-')[0];

        if (savedLang && this.supportedLangs.includes(savedLang)) {
            this.currentLang = savedLang;
        } else if (this.supportedLangs.includes(browserLang)) {
            this.currentLang = savedLang || browserLang;
        } else {
            this.currentLang = this.defaultLang;
        }

        console.log(`[i18n] Selected language: ${this.currentLang}`);

        // 2. Load translations for the selected language
        await this.loadTranslations(this.currentLang);

        // 3. Apply translations to the page
        this.applyTranslations();

        // 4. Setup language switcher
        this.setupLanguageSwitcher();

        // 5. Build dynamic language selector in UI if exists
        this.renderLanguageSelector();

        // 6. Handle RTL languages (future proofing)
        this.handleDirection();

        // 7. Sync preference with backend if logged in
        this.syncPreference();

        // Dispatch event for other scripts
        window.dispatchEvent(new CustomEvent('i18nReady', { detail: { lang: this.currentLang } }));
    },

    // Load translation JSON file
    async loadTranslations(lang) {
        if (this.translations[lang]) return; // Already loaded

        try {
            const response = await fetch(`locales/${lang}.json`);
            if (!response.ok) throw new Error(`Failed to load ${lang} translations`);
            this.translations[lang] = await response.json();
            console.log(`[i18n] Loaded ${lang} translations`);
        } catch (error) {
            console.error('[i18n] Error loading translations:', error);
            // Fallback to default if loading fails
            if (lang !== this.defaultLang) {
                console.warn('[i18n] Falling back to default language');
                this.currentLang = this.defaultLang;
                await this.loadTranslations(this.defaultLang);
            }
        }
    },

    // Switch language dynamically
    async setLanguage(lang) {
        if (!this.supportedLangs.includes(lang)) return;

        if (lang === this.currentLang) return;

        // Show loading state if needed
        document.body.classList.add('lang-switching');

        this.currentLang = lang;
        localStorage.setItem('xaytheon_lang', lang);

        await this.loadTranslations(lang);
        this.applyTranslations();
        this.handleDirection();
        this.updateActiveLanguageInSelector();

        // Sync with backend
        this.syncPreference();

        document.body.classList.remove('lang-switching');

        // Dispatch change event
        window.dispatchEvent(new CustomEvent('languageChanged', { detail: { lang } }));
    },

    // Get nested property from object using dot notation
    getNestedTranslation(obj, path) {
        return path.split('.').reduce((prev, curr) => {
            return prev ? prev[curr] : null;
        }, obj);
    },

    // recursive traverse and translate
    applyTranslations() {
        const elements = document.querySelectorAll('[data-i18n]');

        elements.forEach(element => {
            const key = element.getAttribute('data-i18n');
            const translation = this.getNestedTranslation(this.translations[this.currentLang], key);

            if (translation) {
                // If input placeholder
                if (element.tagName === 'INPUT' && element.getAttribute('placeholder')) {
                    element.setAttribute('placeholder', translation);
                }
                // If image alt text
                else if (element.tagName === 'IMG' && element.getAttribute('alt')) {
                    element.setAttribute('alt', translation);
                }
                // Standard text content
                else {
                    // Check if element has children that shouldn't be overwritten (like icons)
                    // Strategy: Only replace text nodes or specifically targeted content
                    if (element.children.length > 0 && !element.hasAttribute('data-i18n-unsafe')) {
                        // Complex case: Element has HTML structure. 
                        // For now, we assume simple text replacement unless specific care is needed.
                        // Or we can assume the structure in JSON includes the HTML if 'data-i18n-html' is set.
                        if (element.hasAttribute('data-i18n-html')) {
                            element.innerHTML = translation;
                        } else {
                            // Safe default: only replace text node children if mixed content? 
                            // For simplicity in this project, we often replace innerText or HTML if specified.
                            // Let's stick to textContent for safety unless html attr is present.
                            // However, replacing textContent wipes icons.
                            // Better approach for mixed content: Use specific spans for text.
                            // But to not break existing structure, let's try to be smart.

                            // If element contains just text, replace it.
                            // If it contains elements, we might be overwriting icons.
                            // Ideally the HTML should have spans around text. 

                            // Current Hack: Check if we have child nodes that are elements.
                            const hasChildElements = element.firstElementChild !== null;
                            if (hasChildElements) {
                                // If specifically flagged to replace HTML
                                // element.innerHTML = translation; 
                                // Caution: XSS risk if JSON is tainted. In this app, JSON is trusted.
                                // Actually, let's look for a text node and replace it?
                                // Too complex. Let's assume the user of the library wrapped separate text in spans,
                                // OR provided HTML in the translation file.

                                // NOTE: For this implementation, I will treat the translation as text content
                                // but if the element has children (like icons), I'll respect them if I can find a text node.

                                let textNode = Array.from(element.childNodes).find(node => node.nodeType === Node.TEXT_NODE && node.textContent.trim().length > 0);
                                if (textNode) {
                                    textNode.textContent = translation;
                                } else {
                                    // No text node found, maybe it's just text inside?
                                    // Just overwrite if no children to be safe, else warn or use innerHTML if explicitly allowed.
                                    // element.textContent = translation; 
                                    // Let's use innerHTML if the translation string contains tags, else textContent
                                    // Actually usually navigation links like <a><i class="icon"></i> Text</a>
                                    // I should duplicate the icon? No.
                                    // Correct HTML structure should be <a><i class="icon"></i> <span data-i18n="key">Text</span></a>
                                    // I will proceed to update HTML files to wrap text in spans where necessary later.
                                    // For elements with no children, straightforward.
                                    element.textContent = translation;
                                }
                            } else {
                                element.textContent = translation;
                            }
                        }
                    } else {
                        element.textContent = translation;
                    }
                }
            } else {
                console.warn(`[i18n] Missing translation for key: ${key}`);
            }
        });

        // Update Date/Number formatting 
        this.formatDates();
        this.formatNumbers();
    },

    // Format elements with data-i18n-date
    formatDates() {
        const elements = document.querySelectorAll('[data-i18n-date]');
        const options = { year: 'numeric', month: 'long', day: 'numeric' };

        elements.forEach(element => {
            const dateStr = element.getAttribute('data-i18n-date');
            const date = new Date(dateStr);
            if (!isNaN(date.getTime())) {
                element.textContent = new Intl.DateTimeFormat(this.currentLang, options).format(date);
            }
        });
    },

    // Format elements with data-i18n-number
    formatNumbers() {
        const elements = document.querySelectorAll('[data-i18n-number]');

        elements.forEach(element => {
            const num = parseFloat(element.getAttribute('data-i18n-number'));
            if (!isNaN(num)) {
                element.textContent = new Intl.NumberFormat(this.currentLang).format(num);
            }
        });
    },

    // Initial setup of the dropdown
    setupLanguageSwitcher() {
        // Try to find existing container
        const navMenu = document.querySelector('.nav-menu');
        if (!navMenu) return;

        // Check if switcher already exists
        if (document.getElementById('lang-switcher')) return;

        // Create LI item
        const li = document.createElement('li');
        li.className = 'lang-item';

        // Create select/dropdown
        // Using a custom dropdown for better styling capability matching Xaytheon theme
        const container = document.createElement('div');
        container.id = 'lang-switcher';
        container.className = 'lang-switcher';

        // Current lang display (icon + code)
        const currentBtn = document.createElement('button');
        currentBtn.className = 'lang-btn';
        currentBtn.setAttribute('aria-label', 'Change Language');
        currentBtn.innerHTML = `
            <i class="ri-global-line"></i>
            <span class="lang-code">${this.currentLang.toUpperCase()}</span>
            <i class="ri-arrow-down-s-line"></i>
        `;

        // Dropdown list
        const dropdown = document.createElement('ul');
        dropdown.className = 'lang-dropdown';

        this.supportedLangs.forEach(lang => {
            const option = document.createElement('li');
            const link = document.createElement('a');
            link.href = '#';
            link.dataset.lang = lang;
            link.innerText = this.getLangName(lang);
            if (lang === this.currentLang) link.classList.add('active');

            link.addEventListener('click', (e) => {
                e.preventDefault();
                this.setLanguage(lang);
                dropdown.classList.remove('show');
            });

            option.appendChild(link);
            dropdown.appendChild(option);
        });

        // Toggle dropdown
        currentBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            dropdown.classList.toggle('show');
        });

        // Close on click outside
        document.addEventListener('click', () => {
            dropdown.classList.remove('show');
        });

        container.appendChild(currentBtn);
        container.appendChild(dropdown);
        li.appendChild(container);

        // Insert before the Theme Toggle (last item usually)
        // Assuming the last item is theme toggle, insert before it.
        const themeItem = navMenu.lastElementChild;
        navMenu.insertBefore(li, themeItem);
    },

    updateActiveLanguageInSelector() {
        const btnText = document.querySelector('.lang-code');
        if (btnText) btnText.innerText = this.currentLang.toUpperCase();

        document.querySelectorAll('.lang-dropdown a').forEach(el => {
            el.classList.toggle('active', el.dataset.lang === this.currentLang);
        });
    },

    getLangName(code) {
        const names = {
            'en': 'English',
            'hi': 'Hindi',
            'es': 'Español',
            'fr': 'Français',
            'ar': 'العربية'
        };
        return names[code] || code.toUpperCase();
    },

    handleDirection() {
        // Set dir="ltr" or "rtl" on html tag
        const dir = this.translations[this.currentLang]?.meta?.dir || 'ltr';
        document.documentElement.setAttribute('dir', dir);
        document.documentElement.setAttribute('lang', this.currentLang);
    },

    // Sync language preference with backend if user is authenticated
    async syncPreference() {
        // We assume authenticateToken is available via fetch headers or cookies
        // and we check if we have a token (localStorage has xaytheon_token or similar)
        const token = localStorage.getItem('xaytheon_token');
        if (!token) return;

        try {
            await fetch('/api/i18n/preference', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ lang: this.currentLang })
            });
        } catch (error) {
            console.warn('[i18n] Failed to sync preference with backend:', error);
        }
    },

    // Explicit translate function for use in JS logic
    t(key, params = {}) {
        let str = this.getNestedTranslation(this.translations[this.currentLang], key);
        if (!str) return key;

        // Replace parameters: "Hello {name}" -> "Hello World"
        Object.keys(params).forEach(param => {
            str = str.replace(new RegExp(`{${param}}`, 'g'), params[param]);
        });

        return str;
    }
};

// Auto-init when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => i18n.init());
} else {
    i18n.init();
}

window.i18n = i18n;
