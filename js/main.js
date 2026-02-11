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
 * Offline indicator — show/hide based on network status
 */
function initOfflineIndicator() {
    const indicator = document.getElementById('sync-indicator');
    if (!indicator) return;

    function updateStatus() {
        if (!navigator.onLine) {
            indicator.classList.add('visible');
            const dot = indicator.querySelector('.status-indicator');
            const label = indicator.querySelector('span:last-child');
            if (dot) { dot.classList.remove('status-syncing', 'status-active'); dot.classList.add('status-offline'); }
            if (label) label.textContent = 'OFFLINE';
        } else {
            indicator.classList.remove('visible');
            const dot = indicator.querySelector('.status-indicator');
            const label = indicator.querySelector('span:last-child');
            if (dot) { dot.classList.remove('status-offline'); dot.classList.add('status-syncing'); }
            if (label) label.textContent = 'SYNCING';
        }
    }

    window.addEventListener('online', updateStatus);
    window.addEventListener('offline', updateStatus);
    // Show on load if already offline
    if (!navigator.onLine) updateStatus();
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

// ═══════════════════════════════════════════════════════════════════════════════
// MULTI-TAB CONFLICT DETECTION
// ═══════════════════════════════════════════════════════════════════════════════

window.addEventListener('storage', (e) => {
    if (!e.key || !e.key.startsWith('0500_')) return;

    // Another tab changed our data — invalidate caches and refresh UI
    switch (e.key) {
        case '0500_goals':
            if (typeof goalsCache !== 'undefined') goalsCache = null;
            if (typeof renderGoals === 'function') renderGoals();
            break;
        case '0500_schedule_entries':
            if (typeof scheduleCache !== 'undefined') scheduleCache = null;
            if (typeof renderSchedule === 'function') renderSchedule();
            break;
        case '0500_notes':
            if (typeof notesCache !== 'undefined') notesCache = null;
            const notesInput = document.getElementById('notes-input');
            if (notesInput) notesInput.value = e.newValue || '';
            if (typeof updateNotesChip === 'function') updateNotesChip();
            break;
        case '0500_sleep_log':
            if (typeof sleepLogCache !== 'undefined') sleepLogCache = null;
            break;
    }
});

// Initialize all components when DOM is ready
document.addEventListener('DOMContentLoaded', async () => {
    try {
        // Initialize Supabase and check auth state first
        await initSupabase();

        // Initialize auth UI
        initAuth();

        // Initialize status indicator system
        initSyncIndicator();
        initOfflineIndicator();

        // Lava lamp canvas is hidden (opacity: 0) — CSS orbs replaced it.
        // Don't instantiate LavaLamp to avoid wasting CPU on invisible blur ops.

        // Initialize clock
        initClock();

        // Initialize goals
        initGoals();

        // Initialize schedule
        initSchedule();

        // Initialize timer
        initTimer();

        // Initialize notes
        initNotes();

        // Defer non-critical init to after first paint
        const deferInit = (fn) => {
            if ('requestIdleCallback' in window) requestIdleCallback(fn);
            else setTimeout(fn, 100);
        };

        deferInit(() => initWeather());
        deferInit(async () => {
            await initSleepCard();
            updateSleepTrackingStatus();
            initBedtimeNotifications();
        });
        deferInit(() => initWeeklyReview());

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

// ═══════════════════════════════════════════════════════════════════════════════
// BEDTIME NOTIFICATIONS
// ═══════════════════════════════════════════════════════════════════════════════

function initBedtimeNotifications() {
    const NOTIFICATION_KEY = '0500_notifications_enabled';
    const LAST_NOTIFICATION_KEY = '0500_last_bedtime_notification';

    function getNotificationsEnabled() {
        return localStorage.getItem(NOTIFICATION_KEY) === 'true';
    }

    function checkBedtimeNotification() {
        if (!getNotificationsEnabled()) return;
        if (!('Notification' in window) || Notification.permission !== 'granted') return;

        // Use sleep.js functions if available
        if (typeof loadSleepSettings !== 'function' || typeof getTimeUntilBedtime !== 'function') return;

        const settings = loadSleepSettings();
        const msUntilBedtime = getTimeUntilBedtime(settings);
        const minutesUntil = msUntilBedtime / 1000 / 60;

        // Check if we're in the 30-31 minute window
        if (minutesUntil > 29 && minutesUntil <= 31) {
            const today = new Date().toISOString().split('T')[0];
            const lastNotification = localStorage.getItem(LAST_NOTIFICATION_KEY);

            // Only show once per day
            if (lastNotification !== today) {
                showBedtimeNotification();
                localStorage.setItem(LAST_NOTIFICATION_KEY, today);
            }
        }
    }

    function showBedtimeNotification() {
        if (typeof loadSleepSettings !== 'function' || typeof calculateBedtime !== 'function') return;

        const settings = loadSleepSettings();
        const bedtime = calculateBedtime(settings);
        const period = bedtime.hour >= 12 ? 'p' : 'a';
        const displayHour = bedtime.hour % 12 || 12;
        const bedtimeStr = `${displayHour}:${bedtime.minute.toString().padStart(2, '0')}${period}`;

        new Notification('Time to wind down', {
            body: `Bedtime is at ${bedtimeStr}. Put your phone away and prepare for sleep.`,
            icon: '/icons/icon-192.png',
            badge: '/icons/icon-192.png',
            tag: 'bedtime-reminder',
            requireInteraction: false
        });

        // Haptic feedback
        if ('vibrate' in navigator) {
            navigator.vibrate([100, 50, 100]);
        }
    }

    // Check every minute
    setInterval(checkBedtimeNotification, 60000);

    // Also check shortly after page load
    setTimeout(checkBedtimeNotification, 3000);
}
