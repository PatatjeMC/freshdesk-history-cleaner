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
                hr
            `,
            loadMore: '.more-block.text--xsmall.async-button.default.ember-view',
            navbarAdmin: 'li.navbar-item[data-test-id="Admin-7"]'
        },
        button: {
            clean: '🧻',
            restore: '♻️',
            styles: {
                background: '#ebeff3',
                border: 'none',
                borderRadius: '7px',
                fontSize: '24px',
                width: '100%',
                height: '40px'
            }
        },
        notification: {
            duration: 1750,
            position: { bottom: '20px', left: '90px' }
        }
    };

    const messageBackups = new Map();
    let cleaningActive = false;

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

    const cleanMessage = (message, repriseDivs) => {
        messageBackups.set(message, {
            html: message.innerHTML,
            timestamp: Date.now()
        });

        repriseDivs.forEach((div, index) => {
            div.style.display = 'none';
            const nextDiv = repriseDivs[index + 1];
            hideContent(div, nextDiv || null);
        });
    };

    const cleanMessages = () => {
        console.log('[Freshdesk History Cleaner] Starting cleaning...');

        try {
            const messages = document.querySelectorAll(CONFIG.selectors.message);
            let cleanedCount = 0;

            messages.forEach(msg => {
                if (messageBackups.has(msg)) return;
                
                const repriseDivs = msg.querySelectorAll(CONFIG.selectors.reprise);
                if (repriseDivs.length === 0) return;

                cleanMessage(msg, repriseDivs);
                cleanedCount++;
            });

            console.log(`[Freshdesk History Cleaner] ${cleanedCount} message(s) nettoyé(s).`);
            showNotification(`${cleanedCount} message(s) nettoyé(s).`);
        } catch (err) {
            console.error('[Freshdesk History Cleaner] Cleaning error:', err);
        }
    };

    const restoreMessages = () => {
		let restoredCount = 0;
		
		messageBackups.forEach((backup, msg) => {
			if (msg && backup.html) {
				safelyRestoreContent(msg, backup.html);
				restoredCount++;
			}
		});
		
		messageBackups.clear();
		cleaningActive = false;

		document.getElementById('fdc-clean-btn').textContent = CONFIG.button.clean;
		showNotification(`${restoredCount} message(s) restauré(s).`);
		console.log(`[Freshdesk History Cleaner] ${restoredCount} message(s) restauré(s).`);
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
        const button = document.createElement('button');
        button.id = 'fdc-clean-btn';
        button.className = 'navbar-link ember-view';
        button.type = 'button';
        button.textContent = CONFIG.button.clean;
        
        Object.assign(button.style, {
            ...CONFIG.button.styles,
            color: 'inherit',
            cursor: 'pointer',
            padding: '0',
            margin: '0',
            textAlign: 'center',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px'
        });

        button.onclick = () => {
            cleaningActive ? restoreMessages() : activateCleaning();
        };

        button.onmouseenter = () => button.style.opacity = '0.8';
        button.onmouseleave = () => button.style.opacity = '1';

        return button;
    };

    const addInterfaceButton = () => {
        if (document.getElementById('fdc-clean-container')) return;

        const navbarAdmin = document.querySelector(CONFIG.selectors.navbarAdmin);
        if (!navbarAdmin) return;

        const container = document.createElement('li');
        container.id = 'fdc-clean-container';
        container.className = 'navbar-item';
        container.appendChild(createButton());
        
        navbarAdmin.parentNode.insertBefore(container, navbarAdmin.nextSibling);
        console.log('[Freshdesk History Cleaner] Button integrated into navbar.');
    };

    const activateCleaning = () => {
        cleanMessages();
        cleaningActive = true;
        document.getElementById('fdc-clean-btn').textContent = CONFIG.button.restore;
        observeChanges();
    };

    // Observers
    const observeInterface = () => {
        const observer = new MutationObserver(() => {
            if (!isTicketPage()) {
                document.getElementById('fdc-clean-container')?.remove();
                return;
            }

            if (document.querySelector(CONFIG.selectors.navbarAdmin) && 
                !document.getElementById('fdc-clean-container')) {
                addInterfaceButton();
            }
        });

        observer.observe(document.body, { childList: true, subtree: true });

        if (isTicketPage() && document.querySelector(CONFIG.selectors.navbarAdmin)) {
            addInterfaceButton();
        }
    };

    const observeChanges = () => {
        const loadMoreButton = document.querySelector(CONFIG.selectors.loadMore);
        if (!loadMoreButton) {
            console.log('[Freshdesk History Cleaner] No "load more messages" button detected.');
            return;
        }

        const conversationArea = loadMoreButton.closest('.ticket-thread, .ticket-conversation, body');
        if (!conversationArea) return;

        let cleaningInProgress = false;
        let lastExecution = 0;

        const observer = new MutationObserver((mutations) => {
            if (!cleaningActive || cleaningInProgress) return;

            const hasNewMessages = mutations.some(m =>
                Array.from(m.addedNodes).some(n =>
                    n.nodeType === Node.ELEMENT_NODE && n.matches?.(CONFIG.selectors.message)
                )
            );

            if (!hasNewMessages || Date.now() - lastExecution < 2000) return;

            cleaningInProgress = true;
            lastExecution = Date.now();
            observer.disconnect();

            console.log('[Freshdesk History Cleaner] New messages detected, cleaning...');
            
            setTimeout(() => {
                cleanMessages();
                setTimeout(() => {
                    observer.observe(conversationArea, { childList: true, subtree: true });
                    cleaningInProgress = false;
                }, 1000);
            }, 500);
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
        if (!isTicketPage()) {
            console.log('[Freshdesk History Cleaner] Not a ticket page, skipping initialization.');
            return;
        }
        
        console.log('[Freshdesk History Cleaner] Ticket page detected, initializing...');
        observeInterface();
    }
})();
