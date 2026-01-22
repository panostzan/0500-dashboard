// ═══════════════════════════════════════════════════════════════════════════════
// MAIN - Application Initialization
// ═══════════════════════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════════════════════
// SERVICE WORKER REGISTRATION
// ═══════════════════════════════════════════════════════════════════════════════

if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js')
            .then((registration) => {
                console.log('[PWA] Service Worker registered:', registration.scope);

                // Check for updates
                registration.addEventListener('updatefound', () => {
                    const newWorker = registration.installing;
                    newWorker.addEventListener('statechange', () => {
                        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                            // New version available
                            console.log('[PWA] New version available');
                        }
                    });
                });
            })
            .catch((error) => {
                console.log('[PWA] Service Worker registration failed:', error);
            });
    });
}

// ═══════════════════════════════════════════════════════════════════════════════
// STATUS INDICATOR MANAGEMENT
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Show sync indicator briefly when data is saved
 */
function showSyncIndicator() {
    const indicator = document.getElementById('sync-indicator');
    if (!indicator) return;

    indicator.classList.add('visible');

    // Update indicator to syncing state
    const statusDot = indicator.querySelector('.status-indicator');
    if (statusDot) {
        statusDot.classList.remove('status-active', 'status-offline');
        statusDot.classList.add('status-syncing');
    }

    // Show for 1 second, then fade out
    setTimeout(() => {
        indicator.classList.remove('visible');
    }, 1000);
}

/**
 * Hook into localStorage to show sync indicator on saves
 */
function initSyncIndicator() {
    const originalSetItem = localStorage.setItem;
    localStorage.setItem = function(key, value) {
        originalSetItem.call(this, key, value);
        // Only show for our app's data keys
        if (key.startsWith('0500_')) {
            showSyncIndicator();
        }
    };
}

/**
 * Update sleep tracking status indicator
 */
function updateSleepTrackingStatus() {
    const indicator = document.getElementById('sleep-tracking-indicator');
    if (!indicator) return;

    // Check if there's pending sleep tracking (bedtime logged but not wake)
    const log = localStorage.getItem('0500_sleep_log');
    if (log) {
        const parsed = JSON.parse(log);
        const lastEntry = parsed[parsed.length - 1];
        const isPending = lastEntry && lastEntry.bedtime && !lastEntry.wakeTime;

        indicator.classList.remove('status-active', 'status-syncing', 'status-offline');
        if (isPending) {
            indicator.classList.add('status-syncing');
        } else {
            indicator.classList.add('status-active');
        }
    }
}

// Initialize all components when DOM is ready
document.addEventListener('DOMContentLoaded', async () => {
    try {
        // Initialize status indicator system
        initSyncIndicator();

        // Initialize lava lamp background
        const lavaLamp = new LavaLamp(document.getElementById('lava-canvas'));

        // Initialize clock
        initClock();

        // Initialize goals
        initGoals();

        // Initialize schedule
        initSchedule();

        // Initialize timer
        initTimer();

        // Initialize weather
        initWeather();

        // Initialize notes
        initNotes();

        // Initialize sleep card
        initSleepCard();

        // Update sleep tracking status
        updateSleepTrackingStatus();

        // Initialize HUD elements (globe arcs)
        const hud = initHUD();

        // Calculate initial globe size based on container
        const globeContainer = document.querySelector('.globe-section');
        const getGlobeSize = () => {
            if (window.innerWidth <= 768) {
                // Mobile: fit within container
                return Math.min(globeContainer.offsetWidth, globeContainer.offsetHeight, 180);
            }
            return 450; // Desktop size
        };

        // Initialize globes
        const mainGlobe = new DottedGlobe(document.getElementById('globe-canvas'), {
            size: getGlobeSize(),
            highlightLocation: CONFIG.location,
            rotationSpeed: 0.001,
            dotSpacing: 2.0,
            dotColor: '#2d2d2d',
            highlightColor: '#e67635',
            initialRotation: 1.4
        });

        const timerGlobe = new DottedGlobe(document.getElementById('timer-globe-canvas'), {
            size: 650,
            highlightLocation: CONFIG.location,
            rotationSpeed: 0.0006,
            dotSpacing: 2.5,
            dotColor: '#4a4a4a',
            highlightColor: '#e67635',
            initialRotation: 1.4
        });

        // Load land data for both globes
        await Promise.all([
            mainGlobe.loadLandData(),
            timerGlobe.loadLandData()
        ]);

        // Handle window resize
        window.addEventListener('resize', () => {
            const newSize = getGlobeSize();
            mainGlobe.size = newSize;
            mainGlobe.resize();
            timerGlobe.resize();
        });
    } catch (error) {
        console.error('Initialization error:', error);
        // Hide loading indicator even on error
        const loading = document.getElementById('globe-loading');
        if (loading) loading.style.display = 'none';
    }
});
