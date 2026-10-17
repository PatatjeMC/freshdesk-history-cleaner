(() => {
    'use strict';

    const defaults = {
        skipFirstMessage: true,
        defaultAutoClean: false
    };

    const controls = {
        skipFirstMessage: document.getElementById('skip-first-message'),
        defaultAutoClean: document.getElementById('default-auto-clean')
    };

    chrome.storage.sync.get(defaults, settings => {
        controls.skipFirstMessage.checked = settings.skipFirstMessage;
        controls.defaultAutoClean.checked = settings.defaultAutoClean;
    });

    Object.entries(controls).forEach(([setting, control]) => {
        control.addEventListener('change', () => {
            chrome.storage.sync.set({ [setting]: control.checked });
        });
    });
})();
