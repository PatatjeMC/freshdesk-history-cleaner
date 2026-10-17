// ==UserScript==
// @name         Freshdesk History Cleaner
// @version      3.0
// @description  Hides history repeats in Freshdesk responses for cleaner reading.
// @author       Noah
// @homepageURL  https://github.com/PatatjeMC/freshdesk-history-cleaner
// @match        *://*.freshdesk.com/*
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_registerMenuCommand
// @grant        GM_unregisterMenuCommand
// ==/UserScript==

(() => {
    'use strict';

    console.log('[Freshdesk History Cleaner] Script loaded.');

    // Configuration
    const CONFIG = {
        selectors: {
            message: '.ticket-details__item.ticket-details__requestor, .ticket-details__item:not(.ticket-details__requestor)',
            reprise: `
                div[style*="border:none;border-top:solid"][style*="padding:3.0pt 0cm 0cm 0cm"],
                hr[style*="display:inline-block"][style*="width:98%"],
                hr,
				#mail-editor-reference-message-container
            `,
            blockquote: 'blockquote[style*="border-left"]',
            loadMore: '.more-block.text--xsmall.async-button.default.ember-view',
            navbarList: '#navbar-body > ul.nav-list'
        },
        button: {
            cleanIcon: `<svg class="nav-icon" stroke="#000000" fill="#000000" stroke-width="0" viewBox="0 0 256 256" height="32" width="32" xmlns="http://www.w3.org/2000/svg"><path d="M184,120a8,8,0,0,1-8,8H160a8,8,0,0,1,0-16h16A8,8,0,0,1,184,120Zm56,0v88a16,16,0,0,1-16,16H112a16,16,0,0,1-16-16V186.35C87.37,200.37,76.18,208,64,208c-13.87,0-26.46-9.89-35.44-27.85C20.46,164,16,142.59,16,120s4.46-43.95,12.56-60.15C37.54,41.89,50.13,32,64,32H192c13.87,0,26.46,9.89,35.44,27.85C235.54,76.05,240,97.41,240,120ZM76,120a12,12,0,1,0-12,12A12,12,0,0,0,76,120Zm148,8H208a8,8,0,0,1,0-16h15.79C221.84,73.9,206.16,48,192,48H92.12a73.6,73.6,0,0,1,7.32,11.85c7.14,14.28,11.44,32.56,12.37,52.15H128a8,8,0,0,1,0,16H112v80H224Z"/></svg>`,
			cleanLabel: 'Clean messages',
            restoreIcon: `<svg class="nav-icon" stroke="#000000" fill="#000000" stroke-width="0" viewBox="0 0 256 256" height="32" width="32" xmlns="http://www.w3.org/2000/svg"><path d="M100,208a12,12,0,0,1-12,12H40a28,28,0,0,1-24.23-42l29.45-50.88-4.76,1.27a12,12,0,1,1-6.2-23.18l32.77-8.77a12,12,0,0,1,14.69,8.48l8.79,32.77a12,12,0,1,1-23.17,6.22L66.08,139l-29.5,51A4,4,0,0,0,40,196H88A12,12,0,0,1,100,208ZM128,36a3.87,3.87,0,0,1,3.46,2l29.45,50.87-4.75-1.27A12,12,0,1,0,150,110.78l32.77,8.79a12,12,0,0,0,14.69-8.48L206.2,78.3A12,12,0,1,0,183,72.08l-1.31,4.86L152.23,26a28,28,0,0,0-48.46,0L80.61,66a12,12,0,1,0,20.77,12l23.16-40A3.87,3.87,0,0,1,128,36ZM240.19,178l-23.14-40a12,12,0,1,0-20.77,12l23.14,40a4,4,0,0,1-3.46,6H157l3.51-3.51a12,12,0,1,0-17-17l-24,24a12,12,0,0,0,0,17l24,24a12,12,0,1,0,17-17L157,220h59a28,28,0,0,0,24.23-42Z"/></svg>`,
			restoreLabel: 'Restore messages'
        },
        notification: {
            duration: 1750,
            position: { bottom: '20px', left: '90px' }
        }
    };

    const messageBackups = new Map();
    let settings = {
        skipFirstMessage: GM_getValue('skipFirstMessage', true),
        defaultAutoClean: GM_getValue('defaultAutoClean', false)
    };
    let cleaningActive = false;
    let lastPagePath = window.location.pathname;
    let settingsMenuIds = [];

    // Utilities
    const isTicketPage = () => /\/a\/tickets\/\d+/.test(window.location.pathname);

    const hideNonCriticalErrors = (e) => {
        if (e.filename?.includes('freshconnect-sidebar-core.js')) {
            e.preventDefault();
            return true;
        }
        return false;
    };

    // Core functionality
    const hideContent = (startElement, endElement = null) => {
        let node = startElement.nextSibling;
        while (node && node !== endElement) {
            const next = node.nextSibling;
            try {
                if (node.nodeType === Node.ELEMENT_NODE) {
                    node.style.display = 'none';
                } else if (node.nodeType === Node.TEXT_NODE && node.textContent.trim()) {
                    const span = document.createElement('span');
                    span.textContent = node.textContent;
                    span.style.display = 'none';
                    node.parentNode?.replaceChild(span, node);
                }
            } catch (e) {
                console.warn('[Freshdesk History Cleaner] Ignored deleted node during cleaning.');
            }
            node = next;
        }
    };

    const cleanMessage = (message, repriseDivs, blockquotes) => {
        messageBackups.set(message, {
            html: message.innerHTML,
            timestamp: Date.now()
        });

        repriseDivs.forEach((div, index) => {
            div.style.display = 'none';
            const nextDiv = repriseDivs[index + 1];
            hideContent(div, nextDiv || null);
        });

        blockquotes.forEach(bq => {
            const parent = bq.parentElement;
            if (parent && parent !== message && parent.tagName.toLowerCase() === 'div') {
                const childElements = Array.from(parent.children);
                if (childElements.length === 2 && childElements[1] === bq) {
                    parent.style.display = 'none';
                }
            }
        });
    };

    const cleanMessages = (showStatus = true) => {
        console.log('[Freshdesk History Cleaner] Starting cleaning...');

        try {
            const messages = document.querySelectorAll(CONFIG.selectors.message);
            let cleanedCount = 0;

            messages.forEach((msg, index) => {
                if (settings.skipFirstMessage && index === 0) return;
                if (messageBackups.has(msg)) return;

                const repriseDivs = msg.querySelectorAll(CONFIG.selectors.reprise);
                const blockquotes = msg.querySelectorAll(CONFIG.selectors.blockquote);

                if (repriseDivs.length === 0 && blockquotes.length === 0) return;

                cleanMessage(msg, repriseDivs, blockquotes);
                cleanedCount++;
            });

            console.log(`[Freshdesk History Cleaner] ${cleanedCount} message(s) cleaned.`);
            if (showStatus) {
                showNotification(`${cleanedCount} message(s) cleaned.`);
            }
        } catch (err) {
            console.error('[Freshdesk History Cleaner] Cleaning error:', err);
        }
    };

    const restoreMessages = (showStatus = true) => {
		let restoredCount = 0;

		messageBackups.forEach((backup, msg) => {
			if (msg && backup.html) {
				safelyRestoreContent(msg, backup.html);
				restoredCount++;
			}
		});

		messageBackups.clear();
		cleaningActive = false;

        const span = document.getElementById('fdc-clean-icon');
        if (span) {
            span.setAttribute('aria-label', CONFIG.button.cleanLabel);
            span.innerHTML = CONFIG.button.cleanIcon;
        }

        if (showStatus) {
            showNotification(`${restoredCount} message(s) restored.`);
        }
		console.log(`[Freshdesk History Cleaner] ${restoredCount} message(s) restored.`);
	};

	const safelyRestoreContent = (element, html) => {
		try {
			const parser = new DOMParser();
			const doc = parser.parseFromString(html, 'text/html');

			while (element.firstChild) {
				element.removeChild(element.firstChild);
			}

			Array.from(doc.body.childNodes).forEach(child => {
				element.appendChild(child);
			});
		} catch (error) {
			console.error('[Freshdesk History Cleaner] Restoration error:', error);
		}
	};

    // UI components
    const showNotification = (text) => {
        document.querySelectorAll('[id^="fdc-notif"]').forEach(notif => notif.remove());

        const notification = document.createElement('div');
        notification.id = 'fdc-notif-' + Date.now();
        notification.textContent = text;

        Object.assign(notification.style, {
            position: 'fixed',
            ...CONFIG.notification.position,
            background: '#333',
            color: 'white',
            padding: '10px 16px',
            borderRadius: '6px',
            zIndex: 999999,
            opacity: 0,
            transition: 'opacity 0.3s',
            fontSize: '14px',
            fontWeight: '500'
        });

        document.body.appendChild(notification);

        requestAnimationFrame(() => notification.style.opacity = 1);
        setTimeout(() => {
            notification.style.opacity = 0;
            setTimeout(() => notification.remove(), 300);
        }, CONFIG.notification.duration);
    };

	const createButton = () => {
		const link = document.createElement('a');
		link.id = 'fdc-clean-btn';
		link.className = 'nav-link ember-view';
		link.href = '#';

		const span = document.createElement('span');
		span.id = 'fdc-clean-icon';
		span.className = 'nav-icon-wrapper hint--right hint--rounded';

		span.setAttribute('aria-label', CONFIG.button.cleanLabel);
		span.innerHTML = CONFIG.button.cleanIcon;

		link.appendChild(span);

		link.onclick = (e) => {
			e.preventDefault(); // Prevent page jumps when clicking the '#' anchor link
			cleaningActive ? restoreMessages() : activateCleaning();
		};

		return link;
	};

    const addInterfaceButton = () => {
        if (document.getElementById('fdc-clean-container')) return;

        const navbarList = document.querySelector(CONFIG.selectors.navbarList);
        if (!navbarList) return;

        const container = document.createElement('li');
        container.id = 'fdc-clean-container';
        container.className = 'navbar-item';
        container.appendChild(createButton());

        navbarList.appendChild(container);
        console.log('[Freshdesk History Cleaner] Button integrated into navbar.');
    };

    const activateCleaning = (showStatus = true) => {
        cleanMessages(showStatus);
        cleaningActive = true;
		const span = document.getElementById('fdc-clean-icon');
		if (span) {
			span.setAttribute('aria-label', CONFIG.button.restoreLabel);
            span.innerHTML = CONFIG.button.restoreIcon;
        }
        observeChanges();
    };

    const registerSettingsMenu = () => {
        if (typeof GM_unregisterMenuCommand === 'function') {
            settingsMenuIds.forEach(id => GM_unregisterMenuCommand(id));
        }
        settingsMenuIds = [];

        const registerSettingMenu = (key, label) => {
            const menuId = GM_registerMenuCommand(`${label}: ${settings[key] ? 'On' : 'Off'}`, () => {
                settings[key] = !settings[key];
                GM_setValue(key, settings[key]);

                if (key === 'skipFirstMessage' && cleaningActive) {
                    restoreMessages(false);
                    activateCleaning(false);
                }

                registerSettingsMenu();
            });
            settingsMenuIds.push(menuId);
        };

        registerSettingMenu('skipFirstMessage', 'Skip first message');
        registerSettingMenu('defaultAutoClean', 'Default auto clean');
    };

    const waitForMessagesAndActivate = () => {
        let observer;
        let messagesHaveLoaded = false;

        const containsMessage = (node) => {
            if (node.nodeType !== Node.ELEMENT_NODE) return false;
            return node.matches(CONFIG.selectors.message) ||
                Boolean(node.querySelector(CONFIG.selectors.message));
        };

        const activateWhenReady = (mutations) => {
            if (!settings.defaultAutoClean || cleaningActive) return;

            const messageAdded = mutations.some(mutation =>
                Array.from(mutation.addedNodes).some(containsMessage)
            );
            if (messageAdded) messagesHaveLoaded = true;

            const messages = document.querySelectorAll(CONFIG.selectors.message);
            if (!messagesHaveLoaded || messages.length === 0) return;

            observer.disconnect();
            activateCleaning(false);
        };

        observer = new MutationObserver(activateWhenReady);
        observer.observe(document.body, { childList: true, subtree: true });
    };

    // Observers
    const observeInterface = () => {
        const observer = new MutationObserver(() => {
            if (window.location.pathname !== lastPagePath) {
                lastPagePath = window.location.pathname;

                if(cleaningActive) {
                    console.log('[Freshdesk History Cleaner] Page changed, restoring messages...');
                    restoreMessages();
                }
            }

            if (!isTicketPage()) {
                document.getElementById('fdc-clean-container')?.remove();
                return;
            }

            if (document.querySelector(CONFIG.selectors.navbarList) &&
                !document.getElementById('fdc-clean-container')) {
                addInterfaceButton();
            }
        });

        observer.observe(document.body, { childList: true, subtree: true });

        if (isTicketPage() && document.querySelector(CONFIG.selectors.navbarList)) {
            addInterfaceButton();
        }
    };

    const observeChanges = () => {
        const loadMoreButton = document.querySelector(CONFIG.selectors.loadMore);
        const conversationArea = loadMoreButton?.closest('.ticket-thread, .ticket-conversation, body') || document.body;

        let cleaningInProgress = false;

        const observer = new MutationObserver((mutations) => {
            if (!cleaningActive || cleaningInProgress) return;

            const hasNewMessages = mutations.some(m =>
                Array.from(m.addedNodes).some(n =>
                    n.nodeType === Node.ELEMENT_NODE &&
                    (n.matches?.(CONFIG.selectors.message) || n.querySelector?.(CONFIG.selectors.message))
                )
            );

            if (!hasNewMessages) return;

            cleaningInProgress = true;

            console.log('[Freshdesk History Cleaner] New messages detected, cleaning...');
            cleanMessages(false);
            cleaningInProgress = false;
        });

        observer.observe(conversationArea, { childList: true, subtree: true });
        console.log('[Freshdesk History Cleaner] New messages observer activated.');
    };

    // Initialization
    window.addEventListener('error', hideNonCriticalErrors);

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init, { once: true });
    } else {
        init();
    }

    function init() {
        console.log('[Freshdesk History Cleaner] Initializing...');
        registerSettingsMenu();
        observeInterface();

        if (settings.defaultAutoClean && isTicketPage()) {
            waitForMessagesAndActivate();
        }
    }
})();
