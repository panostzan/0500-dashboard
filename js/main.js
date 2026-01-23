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
        // Initialize Supabase and check auth state first
        await initSupabase();

        // Initialize auth UI
        initAuth();

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
                // Mobile: fixed size for proper aspect ratio
                return 200;
            }
            return 450; // Desktop size
        };

        // Get initial location (may be from localStorage or default)
        const savedLocation = localStorage.getItem('0500_user_location');
        const initialLocation = savedLocation
            ? JSON.parse(savedLocation)
            : CONFIG.defaultLocation;

        // Initialize globes
        const mainGlobe = new DottedGlobe(document.getElementById('globe-canvas'), {
            size: getGlobeSize(),
            highlightLocation: initialLocation,
            rotationSpeed: 0.001,
            dotSpacing: 2.0,
            dotColor: 'rgba(255, 180, 150, 0.5)',
            highlightColor: '#ffb090',
            initialRotation: 1.4
        });

        const timerGlobe = new DottedGlobe(document.getElementById('timer-globe-canvas'), {
            size: 650,
            highlightLocation: initialLocation,
            rotationSpeed: 0.0006,
            dotSpacing: 2.5,
            dotColor: 'rgba(255, 180, 150, 0.35)',
            highlightColor: '#ffb090',
            initialRotation: 1.4
        });

        // Load land data for both globes
        await Promise.all([
            mainGlobe.loadLandData(),
            timerGlobe.loadLandData()
        ]);

        // Update globe location when weather fetches actual location
        const checkLocation = setInterval(() => {
            if (window.userLocation) {
                mainGlobe.setHighlightLocation(window.userLocation);
                timerGlobe.setHighlightLocation(window.userLocation);
                clearInterval(checkLocation);
            }
        }, 500);

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
