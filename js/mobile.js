// ═══════════════════════════════════════════════════════════════════════════════
// MOBILE - Tab Navigation & Mobile-Specific Features
// ═══════════════════════════════════════════════════════════════════════════════

// Check if we're on mobile
function isMobileView() {
    return window.innerWidth <= 768;
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB NAVIGATION
// ═══════════════════════════════════════════════════════════════════════════════

function initMobileNav() {
    const tabs = document.querySelectorAll('.mobile-tab');
    const panels = document.querySelectorAll('.mobile-panel');

    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const targetPanel = tab.dataset.tab;

            // Update active tab
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');

            // Show target panel, hide others
            panels.forEach(panel => {
                const isTarget = panel.dataset.panel === targetPanel;
                if (isTarget) {
                    panel.classList.add('active');
                } else {
                    panel.classList.remove('active');
                }
            });

            // Initialize sleep panel when activated
            if (targetPanel === 'sleep' && typeof onSleepPanelActivate === 'function') {
                onSleepPanelActivate();
            }

            // Scroll to top of content
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });
    });

    // Check for URL parameter to set initial tab
    const urlParams = new URLSearchParams(window.location.search);
    const tabParam = urlParams.get('tab');

    // Set initial state based on URL param or default to goals
    if (isMobileView()) {
        let initialTab = 'goals';
        if (tabParam === 'schedule') {
            initialTab = 'schedule';
        }

        // Update tab active state
        tabs.forEach(t => {
            t.classList.toggle('active', t.dataset.tab === initialTab);
        });

        // Update panel visibility
        panels.forEach(panel => {
            panel.classList.toggle('active', panel.dataset.panel === initialTab);
        });

        // Clean up URL (remove the param so it doesn't persist on refresh)
        if (tabParam) {
            window.history.replaceState({}, '', window.location.pathname);
        }
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// MOBILE TIMER BUTTONS
// ═══════════════════════════════════════════════════════════════════════════════

function initMobileTimerButtons() {
    const buttons = document.querySelectorAll('.mobile-timer-btn');

    buttons.forEach(btn => {
        btn.addEventListener('click', () => {
            const minutes = parseInt(btn.dataset.minutes);
            if (typeof startTimer === 'function') {
                startTimer(minutes);
            }
        });
    });
}


// ═══════════════════════════════════════════════════════════════════════════════
// INITIALIZATION
// ═══════════════════════════════════════════════════════════════════════════════

function initMobile() {
    initMobileNav();
    initMobileTimerButtons();

    // Handle resize
    window.addEventListener('resize', () => {
        const panels = document.querySelectorAll('.mobile-panel');
        if (isMobileView()) {
            // Ensure one panel is active
            const hasActive = [...panels].some(p => p.classList.contains('active'));
            if (!hasActive) {
                document.querySelector('[data-panel="goals"]')?.classList.add('active');
            }
        }
    });
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', initMobile);
