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
                // Check for updates
                registration.addEventListener('updatefound', () => {
                    const newWorker = registration.installing;
                    newWorker.addEventListener('statechange', () => {
                        if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                            // New version available — could show update prompt here
                        }
                    });
                });
            })
            .catch((error) => {
                console.error('[PWA] Service Worker registration failed:', error);
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

// ═══════════════════════════════════════════════════════════════════════════════
// MULTI-TAB CONFLICT DETECTION
// ═══════════════════════════════════════════════════════════════════════════════

window.addEventListener('storage', (e) => {
    if (!e.key || !e.key.startsWith('0500_')) return;

    // Another tab changed our data — invalidate caches and refresh UI
    switch (e.key) {
        case '0500_goals':
            // Another tab updated goals — invalidate cache and re-render
            if (typeof goalsCache !== 'undefined') {
                goalsCache = null;
            }
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
        // Apply theme + wire dot click handlers
        initTheme();

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
            initBedtimeNotifications();
        });
        deferInit(() => initWeeklyReview());

        // Initialize HUD elements (gracefully skips globe HUD if canvas absent)
        initHUD();

        // Get initial location (may be from localStorage or default)
        const savedLocation = localStorage.getItem('0500_user_location');
        const initialLocation = savedLocation
            ? JSON.parse(savedLocation)
            : CONFIG.defaultLocation;

        // Track current location for news layer
        let currentUserLocation = initialLocation;

        // ── Initialize globe.gl (Three.js globe) ──
        const globeContainer = document.getElementById('globe-container');
        const initLng = initialLocation.lon || initialLocation.lng;

        // Start hidden — reveal only after globe + data are both ready
        globeContainer.style.opacity = '0';
        globeContainer.style.transition = 'opacity 2s ease';

        let globeReady = false;
        let dataReady = false;
        function tryReveal() {
            if (globeReady && dataReady) {
                requestAnimationFrame(() => {
                    globeContainer.style.opacity = '1';
                });
            }
        }

        const mainGlobe = Globe()
            .backgroundColor('rgba(0,0,0,0)')
            .showGlobe(false)
            .showAtmosphere(true)
            .atmosphereColor('#ffb090')
            .atmosphereAltitude(0.25)
            .width(550)
            .height(550)
            (globeContainer);

        // Configure holographic look once WebGL is ready
        mainGlobe.onGlobeReady(() => {
            // ── Background-matched occluder — blocks far side, invisible against bg ──
            try {
                const occluderGeom = new THREE.SphereGeometry(99.8, 64, 64);
                // MeshBasicMaterial ignores scene lighting — always renders as exact color
                const occluderMat = new THREE.MeshBasicMaterial({
                    color: 0x0f0a12
                });
                const occluder = new THREE.Mesh(occluderGeom, occluderMat);
                occluder.renderOrder = -1;
                mainGlobe.scene().add(occluder);
            } catch (e) {
                console.log('[GLOBE] Occluder skipped:', e.message);
            }

            // ── Lighting — warm ambient glow ──
            const scene = mainGlobe.scene();
            scene.traverse(obj => {
                if (obj.isDirectionalLight) {
                    obj.intensity = 0.4;
                    obj.color.set('#ffcdaa');
                }
                if (obj.isAmbientLight) {
                    obj.intensity = 2.0;
                    obj.color.set('#1e1428');
                }
            });

            // ── Graticule (lat/lon grid lines) ──
            try {
                const globeRadius = 100;
                const gratPoints = [];

                for (let lng = -180; lng < 180; lng += 30) {
                    for (let lat = -90; lat < 90; lat += 2) {
                        const phi1 = (90 - lat) * Math.PI / 180;
                        const theta1 = (lng + 180) * Math.PI / 180;
                        const phi2 = (90 - (lat + 2)) * Math.PI / 180;
                        const r = globeRadius * 1.001;
                        gratPoints.push(
                            r * Math.sin(phi1) * Math.cos(theta1), r * Math.cos(phi1), -r * Math.sin(phi1) * Math.sin(theta1),
                            r * Math.sin(phi2) * Math.cos(theta1), r * Math.cos(phi2), -r * Math.sin(phi2) * Math.sin(theta1)
                        );
                    }
                }
                for (let lat = -60; lat <= 60; lat += 30) {
                    for (let lng = -180; lng < 180; lng += 2) {
                        const phi = (90 - lat) * Math.PI / 180;
                        const theta1 = (lng + 180) * Math.PI / 180;
                        const theta2 = (lng + 2 + 180) * Math.PI / 180;
                        const r = globeRadius * 1.001;
                        gratPoints.push(
                            r * Math.sin(phi) * Math.cos(theta1), r * Math.cos(phi), -r * Math.sin(phi) * Math.sin(theta1),
                            r * Math.sin(phi) * Math.cos(theta2), r * Math.cos(phi), -r * Math.sin(phi) * Math.sin(theta2)
                        );
                    }
                }

                const gratGeom = new THREE.BufferGeometry();
                gratGeom.setAttribute('position', new THREE.Float32BufferAttribute(gratPoints, 3));
                const gratMat = new THREE.LineBasicMaterial({
                    color: 0xffb090, transparent: true, opacity: 0.06, depthWrite: false
                });
                scene.add(new THREE.LineSegments(gratGeom, gratMat));
            } catch (e) {
                console.log('[GLOBE] Graticule skipped:', e.message);
            }

            // ── Fresnel edge glow ──
            try {
                const fresnelGeom = new THREE.SphereGeometry(100.8, 64, 64);
                const fresnelMat = new THREE.ShaderMaterial({
                    transparent: true, depthWrite: false, side: THREE.FrontSide,
                    uniforms: {
                        glowColor: { value: new THREE.Color(0xffb090) },
                        intensity: { value: 1.4 },
                        power: { value: 3.0 }
                    },
                    vertexShader: `
                        varying vec3 vNormal;
                        varying vec3 vViewDir;
                        void main() {
                            vNormal = normalize(normalMatrix * normal);
                            vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
                            vViewDir = normalize(-mvPos.xyz);
                            gl_Position = projectionMatrix * mvPos;
                        }
                    `,
                    fragmentShader: `
                        uniform vec3 glowColor;
                        uniform float intensity;
                        uniform float power;
                        varying vec3 vNormal;
                        varying vec3 vViewDir;
                        void main() {
                            float fresnel = 1.0 - dot(vNormal, vViewDir);
                            fresnel = pow(fresnel, power) * intensity;
                            gl_FragColor = vec4(glowColor, fresnel * 0.45);
                        }
                    `
                });
                scene.add(new THREE.Mesh(fresnelGeom, fresnelMat));
            } catch (e) {
                console.log('[GLOBE] Fresnel glow skipped:', e.message);
            }

            mainGlobe.pointOfView({ lat: initialLocation.lat, lng: initLng, altitude: 2.2 });
            globeReady = true;
            tryReveal();
        });

        // ── Load hex bins + country borders ──
        fetch('https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json')
            .then(r => r.json())
            .then(worldData => {
                if (!window.topojson) return;
                const countries = window.topojson.feature(worldData, worldData.objects.countries);

                mainGlobe
                    .hexPolygonsData(countries.features)
                    .hexPolygonResolution(3)
                    .hexPolygonMargin(0.35)
                    .hexPolygonUseDots(true)
                    .hexPolygonColor(() => 'rgba(255, 176, 144, 0.55)')
                    .hexPolygonAltitude(0.005);

                try {
                    const borders = window.topojson.mesh(worldData, worldData.objects.countries, (a, b) => a !== b);
                    const R = 100.5;
                    const pts = [];

                    borders.coordinates.forEach(line => {
                        for (let i = 0; i < line.length - 1; i++) {
                            const [lng1, lat1] = line[i];
                            const [lng2, lat2] = line[i + 1];
                            const phi1 = (90 - lat1) * Math.PI / 180;
                            const th1 = (lng1 + 180) * Math.PI / 180;
                            const phi2 = (90 - lat2) * Math.PI / 180;
                            const th2 = (lng2 + 180) * Math.PI / 180;
                            pts.push(
                                R * Math.sin(phi1) * Math.cos(th1), R * Math.cos(phi1), -R * Math.sin(phi1) * Math.sin(th1),
                                R * Math.sin(phi2) * Math.cos(th2), R * Math.cos(phi2), -R * Math.sin(phi2) * Math.sin(th2)
                            );
                        }
                    });

                    const geom = new THREE.BufferGeometry();
                    geom.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
                    const borderMat = new THREE.LineBasicMaterial({
                        color: 0xffb090, transparent: true, opacity: 0.15, depthWrite: false
                    });
                    mainGlobe.scene().add(new THREE.LineSegments(geom, borderMat));
                } catch (e) {
                    console.log('[GLOBE] Borders skipped:', e.message);
                }

                dataReady = true;
                tryReveal();
            })
            .catch(err => {
                console.warn('[GLOBE] Hex/borders failed:', err);
                dataReady = true;
                tryReveal();
            });

        // Auto-rotation
        const controls = mainGlobe.controls();
        controls.autoRotate = true;
        controls.autoRotateSpeed = 0.3;
        controls.enableZoom = false;
        controls.enablePan = false;
        controls.minPolarAngle = Math.PI * 0.35;
        controls.maxPolarAngle = Math.PI * 0.65;

        // Ring pulse at user location
        mainGlobe
            .ringsData([{
                lat: initialLocation.lat,
                lng: initLng,
                maxR: 3,
                propagationSpeed: 1.5,
                repeatPeriod: 1200
            }])
            .ringColor(() => t => `rgba(255, 176, 144, ${1 - t})`)
            .ringMaxRadius('maxR')
            .ringPropagationSpeed('propagationSpeed')
            .ringRepeatPeriod('repeatPeriod');

        // ── Timer globe (keep old canvas DottedGlobe) ──
        const timerGlobe = new DottedGlobe(document.getElementById('timer-globe-canvas'), {
            size: 650,
            highlightLocation: initialLocation,
            rotationSpeed: 0.0006,
            dotSpacing: 2.5,
            dotColor: 'rgba(255, 180, 150, 0.35)',
            highlightColor: '#ffb090',
            initialRotation: 1.4
        });
        timerGlobe.loadLandData();

        // Update globe location when weather fetches actual location
        const checkLocation = setInterval(() => {
            if (window.userLocation) {
                currentUserLocation = window.userLocation;
                const lng = window.userLocation.lon || window.userLocation.lng;

                // Update location ring
                mainGlobe.ringsData([{
                    lat: window.userLocation.lat,
                    lng: lng,
                    maxR: 3,
                    propagationSpeed: 1.5,
                    repeatPeriod: 1200
                }]);

                timerGlobe.setHighlightLocation(window.userLocation);
                clearInterval(checkLocation);
            }
        }, 500);

        // ── Initialize NEWS layer ──
        try {
            if (typeof initNewsLayer === 'function') {
                initNewsLayer(mainGlobe, () => currentUserLocation);
                console.log('[NEWS] Layer initialized');
            }
        } catch (newsErr) {
            console.error('[NEWS] Layer init failed:', newsErr);
        }

        // ── Initialize WORLD CLOCK layer ──
        try {
            if (typeof initClockLayer === 'function') {
                initClockLayer(mainGlobe, () => currentUserLocation);
                console.log('[CLOCK] Layer initialized');
            }
        } catch (clockErr) {
            console.error('[CLOCK] Layer init failed:', clockErr);
        }

        // Handle window resize
        window.addEventListener('resize', () => {
            mainGlobe.width(550).height(550);
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
