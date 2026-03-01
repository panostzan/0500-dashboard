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
        deferInit(() => initDailyFact());

        // Initialize HUD elements (gracefully skips globe HUD if canvas absent)
        initHUD();

        // ── CINEMATIC BOOT SEQUENCE ──
        // Everything hidden from first paint via CSS (.dashboard:not(.booted)).
        // This async sequence reveals each section with typing + fade effects.
        (async function cinematicBoot() {
            var wait = function(ms) { return new Promise(function(r) { setTimeout(r, ms); }); };
            var dashboard = document.getElementById('dashboard');

            // Type text into element char by char
            function typeText(el, speed) {
                speed = speed || 35;
                return new Promise(function(resolve) {
                    var text = el.textContent;
                    el.textContent = '';
                    var i = 0;
                    var timer = setInterval(function() {
                        el.textContent = text.substring(0, i + 1);
                        i++;
                        if (i >= text.length) { clearInterval(timer); resolve(); }
                    }, speed);
                });
            }

            // Fade element in with optional upward drift
            function fadeIn(el, duration, drift) {
                duration = duration || 600;
                drift = drift || 0;
                if (drift) el.style.transform = 'translateY(' + drift + 'px)';
                el.style.opacity = '0';
                void el.offsetWidth;
                el.style.transition = 'opacity ' + duration + 'ms ease-out, transform ' + duration + 'ms ease-out';
                el.style.opacity = '1';
                if (drift) el.style.transform = 'translateY(0)';
            }

            // Safety fallback
            var bootTimer = setTimeout(function() { dashboard.classList.add('booted'); }, 10000);

            // Let all component JS finish initializing
            await wait(300);

            // ─── Phase 1: Clock ───
            var topBar = document.querySelector('.top-bar');
            var clockEl = document.getElementById('clock');
            var periodEl = document.getElementById('clock-period');

            topBar.style.opacity = '1';
            topBar.style.pointerEvents = 'auto';
            clockEl.style.opacity = '1';
            periodEl.style.opacity = '0';

            await typeText(clockEl, 55);
            await wait(100);
            periodEl.style.transition = 'opacity 0.4s ease-out';
            periodEl.style.opacity = '1';

            var weatherEl = document.getElementById('weather-display');
            if (weatherEl && weatherEl.textContent.trim()) {
                fadeIn(weatherEl, 500);
            }

            // ─── Phase 2: Goals cascade (clean fade-ups, no typing) ───
            await wait(300);
            var goalsSection = document.getElementById('goals-section');
            goalsSection.style.opacity = '1';
            goalsSection.style.pointerEvents = 'auto';

            var goalGroups = goalsSection.querySelectorAll('.goal-group');
            for (var g = 0; g < goalGroups.length; g++) {
                goalGroups[g].style.opacity = '0';
                goalGroups[g].style.transform = 'translateY(6px)';
            }

            for (var g = 0; g < goalGroups.length; g++) {
                var group = goalGroups[g];
                void group.offsetWidth;
                group.style.transition = 'opacity 0.45s ease-out, transform 0.45s ease-out';
                group.style.opacity = '1';
                group.style.transform = 'translateY(0)';
                await wait(140);
            }

            // ─── Phase 3: Schedule + chips (overlap for tighter flow) ───
            await wait(200);
            var scheduleSection = document.querySelector('.schedule-section');
            scheduleSection.style.pointerEvents = 'auto';
            fadeIn(scheduleSection, 700, 8);

            var schedHeaderSpan = scheduleSection.querySelector('.schedule-header span');
            if (schedHeaderSpan) typeText(schedHeaderSpan, 45);

            // ─── Phase 4: Bottom chips ripple (start while schedule fades) ───
            await wait(350);
            var chipsBar = document.getElementById('bottom-chips');
            chipsBar.style.opacity = '1';
            chipsBar.style.pointerEvents = 'auto';

            var chipChildren = chipsBar.children;
            for (var i = 0; i < chipChildren.length; i++) {
                (function(child, delay) {
                    child.style.opacity = '0';
                    setTimeout(function() {
                        child.style.transition = 'opacity 0.3s ease-out';
                        child.style.opacity = '1';
                    }, delay);
                })(chipChildren[i], i * 70);
            }

            // Boot complete
            await wait(800);
            dashboard.classList.add('booted');
            clearTimeout(bootTimer);
        })();

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

        // Start hidden — cinematic reveal on a fixed timer
        globeContainer.style.opacity = '0';

        // Collect refs for cinematic reveal animation
        const _revealCityMeshes = [];  // array of [dot, mid, glow] per city
        const _revealArcLines = [];    // all arc Line objects

        // Cinematic reveal — fires on a fixed 3.5s timer after page load.
        // By then globe + hex data + material swap are all complete.
        setTimeout(() => {
            // Easing functions
            function easeInOut(t) {
                return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
            }
            function easeOutCubic(t) {
                return 1 - Math.pow(1 - t, 3);
            }

            // Phase 1: Globe fades in
            globeContainer.style.transition = 'opacity 2.5s ease-in';
            globeContainer.style.opacity = '1';

            // Phase 2 + 3: Single animation loop for cities + arcs
            const t0 = performance.now();
            const CITY_START    = 1200;
            const CITY_STAGGER  = 220;
            const CITY_DURATION = 800;
            const ARC_START     = 1800;
            const ARC_STAGGER   = 130;
            const ARC_DURATION  = 1400;
            const ARC_POINTS    = 65;
            const cityTargets   = [0.9, 0.35, 0.1];

            function tick() {
                const elapsed = performance.now() - t0;
                let animating = false;

                // City dots — smooth sequential fade-in
                _revealCityMeshes.forEach((meshes, i) => {
                    const start = CITY_START + i * CITY_STAGGER;
                    if (elapsed < start) { animating = true; return; }
                    const p = Math.min((elapsed - start) / CITY_DURATION, 1);
                    if (p < 1) animating = true;
                    const e = easeInOut(p);
                    meshes[0].material.opacity = e * cityTargets[0];
                    meshes[1].material.opacity = e * cityTargets[1];
                    meshes[2].material.opacity = e * cityTargets[2];
                });

                // Arcs — trace from start to end
                _revealArcLines.forEach((line, i) => {
                    const start = ARC_START + i * ARC_STAGGER;
                    if (elapsed < start) { animating = true; return; }
                    const p = Math.min((elapsed - start) / ARC_DURATION, 1);
                    if (p < 1) animating = true;
                    const e = easeOutCubic(p);
                    line.geometry.setDrawRange(0, Math.floor(e * ARC_POINTS));
                });

                if (animating) requestAnimationFrame(tick);
            }

            requestAnimationFrame(tick);
        }, 3500);

        const mainGlobe = Globe()
            .backgroundColor('rgba(0,0,0,0)')
            .showGlobe(true)
            .showAtmosphere(true)
            .atmosphereColor('#ffb090')
            .atmosphereAltitude(0.12)
            .width(550)
            .height(550)
            (globeContainer);

        // Configure holographic look once WebGL is ready
        mainGlobe.onGlobeReady(() => {
            // ── Globe sphere as background-matched occluder ──
            // Opaque + color-matched to app background so it's invisible
            // but blocks all back-facing hex dots, borders, and grid lines
            const mat = mainGlobe.globeMaterial();
            mat.color.set('#0a0c12');
            mat.emissive.set('#0e1a22');
            mat.emissiveIntensity = 0.35;
            mat.transparent = false;
            mat.opacity = 1.0;
            mat.depthWrite = true;

            // ── Lighting — warm ambient glow ──
            const scene = mainGlobe.scene();
            scene.traverse(obj => {
                if (obj.isDirectionalLight) {
                    obj.intensity = 0.25;
                    obj.color.set('#ffcdaa');
                }
                if (obj.isAmbientLight) {
                    obj.intensity = 1.2;
                    obj.color.set('#ffd8c0');
                }
            });

            // ── Graticule (lat/lon grid lines) ──
            try {
                const globeRadius = 100;
                const gratPoints = [];

                // Meridians (longitude) every 15°
                for (let lng = -180; lng < 180; lng += 15) {
                    for (let lat = -90; lat < 90; lat += 2) {
                        const phi1 = (90 - lat) * Math.PI / 180;
                        const theta1 = (90 - lng) * Math.PI / 180;
                        const phi2 = (90 - (lat + 2)) * Math.PI / 180;
                        const r = globeRadius * 1.001;
                        gratPoints.push(
                            r * Math.sin(phi1) * Math.cos(theta1), r * Math.cos(phi1), r * Math.sin(phi1) * Math.sin(theta1),
                            r * Math.sin(phi2) * Math.cos(theta1), r * Math.cos(phi2), r * Math.sin(phi2) * Math.sin(theta1)
                        );
                    }
                }
                // Parallels (latitude) every 15°
                for (let lat = -75; lat <= 75; lat += 15) {
                    for (let lng = -180; lng < 180; lng += 2) {
                        const phi = (90 - lat) * Math.PI / 180;
                        const theta1 = (90 - lng) * Math.PI / 180;
                        const theta2 = (90 - (lng + 2)) * Math.PI / 180;
                        const r = globeRadius * 1.001;
                        gratPoints.push(
                            r * Math.sin(phi) * Math.cos(theta1), r * Math.cos(phi), r * Math.sin(phi) * Math.sin(theta1),
                            r * Math.sin(phi) * Math.cos(theta2), r * Math.cos(phi), r * Math.sin(phi) * Math.sin(theta2)
                        );
                    }
                }

                const gratGeom = new THREE.BufferGeometry();
                gratGeom.setAttribute('position', new THREE.Float32BufferAttribute(gratPoints, 3));
                const gratMat = new THREE.LineBasicMaterial({
                    color: 0x90b8ff, transparent: true, opacity: 0.04, depthWrite: false, depthTest: true
                });
                scene.add(new THREE.LineSegments(gratGeom, gratMat));
            } catch (e) {
                console.log('[GLOBE] Graticule skipped:', e.message);
            }

            // ── Fresnel edge glow ──
            try {
                const fresnelGeom = new THREE.SphereGeometry(100.5, 64, 64);
                const fresnelMat = new THREE.ShaderMaterial({
                    transparent: true, depthWrite: false, side: THREE.FrontSide,
                    uniforms: {
                        glowColor: { value: new THREE.Color(0xffb090) },
                        intensity: { value: 1.2 },
                        power: { value: 3.5 }
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
                            gl_FragColor = vec4(glowColor, fresnel * 0.55);
                        }
                    `
                });
                scene.add(new THREE.Mesh(fresnelGeom, fresnelMat));
            } catch (e) {
                console.log('[GLOBE] Fresnel glow skipped:', e.message);
            }

            // ── Secondary deep atmosphere (soft outer haze) ──
            try {
                const deepAtmoGeom = new THREE.SphereGeometry(103, 64, 64);
                const deepAtmoMat = new THREE.ShaderMaterial({
                    transparent: true, depthWrite: false, side: THREE.FrontSide,
                    uniforms: {
                        glowColor: { value: new THREE.Color(0xffb090) },
                        intensity: { value: 0.8 },
                        power: { value: 1.5 }
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
                            gl_FragColor = vec4(glowColor, fresnel * 0.15);
                        }
                    `
                });
                scene.add(new THREE.Mesh(deepAtmoGeom, deepAtmoMat));
            } catch (e) {
                console.log('[GLOBE] Deep atmosphere skipped:', e.message);
            }

            // ── Ambient city glow points ──
            try {
                const ambientCities = [
                    { lat: 35.7, lng: 139.7 },   // Tokyo
                    { lat: 51.5, lng: -0.1 },    // London
                    { lat: 48.9, lng: 2.35 },    // Paris
                    { lat: -33.9, lng: 151.2 },  // Sydney
                    { lat: 55.8, lng: 37.6 },    // Moscow
                    { lat: 19.4, lng: -99.1 },   // Mexico City
                    { lat: 1.3, lng: 103.8 },    // Singapore
                    { lat: -23.5, lng: -46.6 },  // São Paulo
                    { lat: 25.2, lng: 55.3 },    // Dubai
                    { lat: 37.6, lng: 127.0 },   // Seoul
                ];

                const ambientGroup = new THREE.Group();
                ambientCities.forEach(city => {
                    const phi = (90 - city.lat) * Math.PI / 180;
                    const theta = (90 - city.lng) * Math.PI / 180;
                    const R = 101.2;
                    const x = R * Math.sin(phi) * Math.cos(theta);
                    const y = R * Math.cos(phi);
                    const z = R * Math.sin(phi) * Math.sin(theta);

                    // Bright core dot (starts hidden for cinematic reveal)
                    const dotGeom = new THREE.SphereGeometry(0.8, 12, 12);
                    const dotMat = new THREE.MeshBasicMaterial({
                        color: 0xffffff, transparent: true, opacity: 0, depthWrite: false
                    });
                    const dot = new THREE.Mesh(dotGeom, dotMat);
                    dot.position.set(x, y, z);
                    ambientGroup.add(dot);

                    // Mid glow ring
                    const midGeom = new THREE.SphereGeometry(1.8, 12, 12);
                    const midMat = new THREE.MeshBasicMaterial({
                        color: 0xffb090, transparent: true, opacity: 0, depthWrite: false
                    });
                    const mid = new THREE.Mesh(midGeom, midMat);
                    mid.position.set(x, y, z);
                    ambientGroup.add(mid);

                    // Soft outer glow
                    const glowGeom = new THREE.SphereGeometry(3.0, 12, 12);
                    const glowMat = new THREE.MeshBasicMaterial({
                        color: 0xffb090, transparent: true, opacity: 0, depthWrite: false
                    });
                    const glow = new THREE.Mesh(glowGeom, glowMat);
                    glow.position.set(x, y, z);
                    ambientGroup.add(glow);

                    // Collect for cinematic reveal
                    _revealCityMeshes.push([dot, mid, glow]);
                });
                scene.add(ambientGroup);
            } catch (e) {
                console.log('[GLOBE] Ambient points skipped:', e.message);
            }

            // ── Idle connection arcs ──
            try {
                function latLngToVec3(lat, lng, r) {
                    const phi = (90 - lat) * Math.PI / 180;
                    const theta = (90 - lng) * Math.PI / 180;
                    return new THREE.Vector3(
                        r * Math.sin(phi) * Math.cos(theta),
                        r * Math.cos(phi),
                        r * Math.sin(phi) * Math.sin(theta)
                    );
                }

                const arcTargets = [
                    { lat: 35.7, lng: 139.7 },   // Tokyo
                    { lat: 51.5, lng: -0.1 },    // London
                    { lat: 48.9, lng: 2.35 },    // Paris
                    { lat: -33.9, lng: 151.2 },  // Sydney
                    { lat: 55.8, lng: 37.6 },    // Moscow
                    { lat: 19.4, lng: -99.1 },   // Mexico City
                    { lat: 1.3, lng: 103.8 },    // Singapore
                    { lat: -23.5, lng: -46.6 },  // Sao Paulo
                    { lat: 25.2, lng: 55.3 },    // Dubai
                    { lat: 37.6, lng: 127.0 },   // Seoul
                ];

                // Named refs for intercity connections
                const cities = {
                    tokyo:    { lat: 35.7, lng: 139.7 },
                    london:   { lat: 51.5, lng: -0.1 },
                    paris:    { lat: 48.9, lng: 2.35 },
                    sydney:   { lat: -33.9, lng: 151.2 },
                    moscow:   { lat: 55.8, lng: 37.6 },
                    mexico:   { lat: 19.4, lng: -99.1 },
                    singapore:{ lat: 1.3, lng: 103.8 },
                    saoPaulo: { lat: -23.5, lng: -46.6 },
                    dubai:    { lat: 25.2, lng: 55.3 },
                    seoul:    { lat: 37.6, lng: 127.0 },
                };

                // Intercity network routes (natural global web)
                const intercityRoutes = [
                    ['london', 'paris'],
                    ['london', 'moscow'],
                    ['london', 'dubai'],
                    ['paris', 'dubai'],
                    ['moscow', 'dubai'],
                    ['dubai', 'singapore'],
                    ['singapore', 'tokyo'],
                    ['singapore', 'sydney'],
                    ['tokyo', 'seoul'],
                    ['tokyo', 'sydney'],
                    ['mexico', 'saoPaulo'],
                    ['seoul', 'dubai'],
                ];

                function makeArc(from, to, color, opacity) {
                    const start = latLngToVec3(from.lat, from.lng, 101);
                    const end = latLngToVec3(to.lat, to.lng, 101);
                    const mid = start.clone().add(end).multiplyScalar(0.5);
                    const dist = start.distanceTo(end);
                    mid.normalize().multiplyScalar(100 + dist * 0.3);
                    const curve = new THREE.QuadraticBezierCurve3(start, mid, end);
                    const arcPts = curve.getPoints(64);
                    const geom = new THREE.BufferGeometry().setFromPoints(arcPts);
                    geom.setDrawRange(0, 0); // hidden for cinematic reveal
                    const mat = new THREE.LineBasicMaterial({
                        color: color, transparent: true, opacity: opacity, depthWrite: false
                    });
                    const line = new THREE.Line(geom, mat);
                    _revealArcLines.push(line);
                    return line;
                }

                const idleArcsGroup = new THREE.Group();

                // User → each city (warm amber→rose, hero arcs)
                const userLoc = { lat: initialLocation.lat, lng: initLng };
                arcTargets.forEach((city, i) => {
                    const t = i / arcTargets.length;
                    const cr = 255;
                    const cg = Math.round(185 - t * 55);
                    const cb = Math.round(100 + t * 55);
                    const color = new THREE.Color(`rgb(${cr}, ${cg}, ${cb})`);
                    idleArcsGroup.add(makeArc(userLoc, city, color, 0.45));
                });

                // City ↔ city (slightly dimmer warm)
                intercityRoutes.forEach(([a, b]) => {
                    idleArcsGroup.add(makeArc(cities[a], cities[b], 0xffaa88, 0.25));
                });

                scene.add(idleArcsGroup);
                window._idleArcsGroup = idleArcsGroup;
            } catch (e) {
                console.log('[GLOBE] Idle arcs skipped:', e.message);
            }



            mainGlobe.pointOfView({ lat: initialLocation.lat, lng: initLng, altitude: 2.2 });
        });

        // ── Load hex bins + country borders ──
        // Use countries-50m for better coverage (more countries, finer boundaries)
        fetch('https://cdn.jsdelivr.net/npm/world-atlas@2/countries-50m.json')
            .then(r => r.json())
            .then(worldData => {
                if (!window.topojson) return;
                const countries = window.topojson.feature(worldData, worldData.objects.countries);

                mainGlobe
                    .hexPolygonsData(countries.features)
                    .hexPolygonResolution(3)
                    .hexPolygonMargin(0.35)
                    .hexPolygonUseDots(true)
                    .hexPolygonColor(() => 'rgba(200, 180, 160, 0.3)')
                    .hexPolygonAltitude(0.005);

                // Ghost gradient shader: warm amber near user → cool purple far away
                // Replaces lit MeshLambertMaterial so scene lighting doesn't override
                setTimeout(() => {
                    const uPhi = (90 - initialLocation.lat) * Math.PI / 180;
                    const uTheta = (90 - initLng) * Math.PI / 180;
                    const uR = 100.5;
                    const userPos = new THREE.Vector3(
                        uR * Math.sin(uPhi) * Math.cos(uTheta),
                        uR * Math.cos(uPhi),
                        uR * Math.sin(uPhi) * Math.sin(uTheta)
                    );

                    const gradientHexMat = new THREE.ShaderMaterial({
                        transparent: true,
                        depthWrite: false,
                        side: THREE.DoubleSide,
                        uniforms: {
                            userPos: { value: userPos },
                            color1: { value: new THREE.Color(0xffcc77) },  // warm gold
                            color2: { value: new THREE.Color(0xffaa70) },  // soft amber
                            color3: { value: new THREE.Color(0xff9572) },  // peach
                            color4: { value: new THREE.Color(0xf08070) },  // soft coral
                            opacity: { value: 0.40 },
                            maxDist: { value: 180.0 }
                        },
                        vertexShader: `
                            uniform vec3 userPos;
                            varying float vDist;
                            void main() {
                                vec4 worldPos = modelMatrix * vec4(position, 1.0);
                                vDist = distance(worldPos.xyz, userPos);
                                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                            }
                        `,
                        fragmentShader: `
                            uniform vec3 color1;
                            uniform vec3 color2;
                            uniform vec3 color3;
                            uniform vec3 color4;
                            uniform float opacity;
                            uniform float maxDist;
                            varying float vDist;
                            void main() {
                                float t = clamp(vDist / maxDist, 0.0, 1.0);
                                vec3 color;
                                if (t < 0.33) {
                                    color = mix(color1, color2, t / 0.33);
                                } else if (t < 0.66) {
                                    color = mix(color2, color3, (t - 0.33) / 0.33);
                                } else {
                                    color = mix(color3, color4, (t - 0.66) / 0.34);
                                }
                                gl_FragColor = vec4(color, opacity);
                            }
                        `
                    });

                    mainGlobe.scene().traverse(obj => {
                        if (obj.isMesh && obj.material && !obj.__hexFixed) {
                            const mat = obj.material;
                            if (mat.type === 'MeshLambertMaterial' && mat.transparent) {
                                obj.material = gradientHexMat.clone();
                                obj.__hexFixed = true;
                            }
                        }
                    });
                }, 1500);
            })
            .catch(err => {
                console.warn('[GLOBE] Hex/borders failed:', err);
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

        // ── Location label (Three.js sprite) ──
        var locationLabelSprite = null;

        function setGlobeLocationLabel(lat, lng, name) {
            // Remove old sprite
            if (locationLabelSprite) {
                mainGlobe.scene().remove(locationLabelSprite);
                locationLabelSprite = null;
            }

            // Draw text to canvas, then make a sprite
            var canvas = document.createElement('canvas');
            var ctx = canvas.getContext('2d');
            canvas.width = 256;
            canvas.height = 40;

            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.font = '500 18px Inter, sans-serif';
            ctx.fillStyle = 'rgba(255, 176, 144, 0.6)';
            ctx.textAlign = 'left';
            ctx.textBaseline = 'middle';
            ctx.fillText(name.toUpperCase(), 0, 20);

            var texture = new THREE.CanvasTexture(canvas);
            texture.needsUpdate = true;
            var mat = new THREE.SpriteMaterial({
                map: texture,
                transparent: true,
                depthWrite: false,
                depthTest: false
            });
            var sprite = new THREE.Sprite(mat);

            // Position on globe surface offset to the right of the dot
            var R = 102;
            var phi = (90 - lat) * Math.PI / 180;
            var theta = (90 - lng) * Math.PI / 180;
            sprite.position.set(
                R * Math.sin(phi) * Math.cos(theta),
                R * Math.cos(phi),
                R * Math.sin(phi) * Math.sin(theta)
            );
            sprite.scale.set(14, 2.2, 1);

            mainGlobe.scene().add(sprite);
            locationLabelSprite = sprite;
        }

        async function resolveAndLabelLocation(lat, lng) {
            try {
                var res = await fetch(
                    'https://nominatim.openstreetmap.org/reverse?lat=' + lat + '&lon=' + lng + '&format=json&zoom=10'
                );
                var data = await res.json();
                var addr = data.address || {};
                var city = addr.city || addr.town || addr.village || addr.hamlet || '';
                var state = addr.state || '';
                var label = '';
                if (city && state) label = city + ', ' + state;
                else if (city) label = city;
                else if (state) label = state;

                if (label) {
                    if (window.userLocation) {
                        window.userLocation.name = label;
                        localStorage.setItem('0500_user_location', JSON.stringify(window.userLocation));
                    }
                    setGlobeLocationLabel(lat, lng, label);
                }
            } catch (e) {
                console.warn('[GLOBE] Reverse geocode failed:', e.message);
            }
        }

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

                // Add city label — resolve name if needed
                var locName = window.userLocation.name || '';
                if (locName && locName !== 'Current Location') {
                    setGlobeLocationLabel(window.userLocation.lat, lng, locName);
                } else {
                    resolveAndLabelLocation(window.userLocation.lat, lng);
                }

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

        // ── Globe expand/collapse toggle ──
        let globeExpanded = false;

        function resizeGlobe() {
            mainGlobe.width(550).height(550);
        }

        function toggleGlobeExpand() {
            globeExpanded = !globeExpanded;
            const dashboard = document.getElementById('dashboard');
            dashboard.classList.toggle('globe-expanded', globeExpanded);
        }

        // Double-click globe to expand/collapse
        globeContainer.addEventListener('dblclick', toggleGlobeExpand);

        // Escape to exit
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && globeExpanded) {
                toggleGlobeExpand();
            }
        });

        // Handle window resize
        window.addEventListener('resize', () => {
            resizeGlobe();
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
