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
            mat.color.set('#110d18');
            mat.emissive.set('#1e1430');
            mat.emissiveIntensity = 0.35;
            mat.transparent = false;
            mat.opacity = 1.0;
            mat.depthWrite = true;

            // ── Lighting — warm ambient glow ──
            const scene = mainGlobe.scene();
            scene.traverse(obj => {
                if (obj.isDirectionalLight) {
                    obj.intensity = 0.6;
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

                for (let lng = -180; lng < 180; lng += 30) {
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
                for (let lat = -60; lat <= 60; lat += 30) {
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
                    color: 0x90b8ff, transparent: true, opacity: 0.10, depthWrite: false, depthTest: true
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

                    // Bright core dot
                    const dotGeom = new THREE.SphereGeometry(0.8, 12, 12);
                    const dotMat = new THREE.MeshBasicMaterial({
                        color: 0xffffff, transparent: true, opacity: 0.9, depthWrite: false
                    });
                    const dot = new THREE.Mesh(dotGeom, dotMat);
                    dot.position.set(x, y, z);
                    ambientGroup.add(dot);

                    // Mid glow ring
                    const midGeom = new THREE.SphereGeometry(1.8, 12, 12);
                    const midMat = new THREE.MeshBasicMaterial({
                        color: 0xffb090, transparent: true, opacity: 0.35, depthWrite: false
                    });
                    const mid = new THREE.Mesh(midGeom, midMat);
                    mid.position.set(x, y, z);
                    ambientGroup.add(mid);

                    // Soft outer glow
                    const glowGeom = new THREE.SphereGeometry(3.0, 12, 12);
                    const glowMat = new THREE.MeshBasicMaterial({
                        color: 0xffb090, transparent: true, opacity: 0.1, depthWrite: false
                    });
                    const glow = new THREE.Mesh(glowGeom, glowMat);
                    glow.position.set(x, y, z);
                    ambientGroup.add(glow);
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
                    { lat: 51.5, lng: -0.1 },    // London
                    { lat: 35.7, lng: 139.7 },   // Tokyo
                    { lat: -33.9, lng: 151.2 },  // Sydney
                ];

                const idleArcsGroup = new THREE.Group();
                arcTargets.forEach(city => {
                    const start = latLngToVec3(initialLocation.lat, initLng, 101);
                    const end = latLngToVec3(city.lat, city.lng, 101);
                    const mid = start.clone().add(end).multiplyScalar(0.5);
                    const dist = start.distanceTo(end);
                    mid.normalize().multiplyScalar(100 + dist * 0.4);

                    const curve = new THREE.QuadraticBezierCurve3(start, mid, end);
                    const arcPts = curve.getPoints(80);

                    // Outer glow line (wider, softer)
                    const glowGeom = new THREE.BufferGeometry().setFromPoints(arcPts);
                    const glowMat = new THREE.LineBasicMaterial({
                        color: 0x4da6ff, transparent: true, opacity: 0.12,
                        depthWrite: false, linewidth: 2
                    });
                    idleArcsGroup.add(new THREE.Line(glowGeom, glowMat));

                    // Core arc line (bright blue)
                    const arcGeom = new THREE.BufferGeometry().setFromPoints(arcPts);
                    const arcMat = new THREE.LineBasicMaterial({
                        color: 0x80ccff, transparent: true, opacity: 0.35, depthWrite: false
                    });
                    idleArcsGroup.add(new THREE.Line(arcGeom, arcMat));
                });
                scene.add(idleArcsGroup);
                window._idleArcsGroup = idleArcsGroup;
            } catch (e) {
                console.log('[GLOBE] Idle arcs skipped:', e.message);
            }

            // ── Orbital HUD rings ──
            try {
                // Primary ring — warm dashed orbit
                const ringPoints1 = [];
                for (let i = 0; i <= 128; i++) {
                    const angle = (i / 128) * Math.PI * 2;
                    ringPoints1.push(new THREE.Vector3(115 * Math.cos(angle), 0, 115 * Math.sin(angle)));
                }
                const ringGeom1 = new THREE.BufferGeometry().setFromPoints(ringPoints1);
                const ringMat1 = new THREE.LineDashedMaterial({
                    color: 0xffb090, transparent: true, opacity: 0.12,
                    dashSize: 4, gapSize: 8, depthWrite: false
                });
                const hudRing1 = new THREE.Line(ringGeom1, ringMat1);
                hudRing1.computeLineDistances();
                hudRing1.rotation.x = Math.PI * 0.52;
                hudRing1.rotation.y = Math.PI * 0.1;
                scene.add(hudRing1);

                // Secondary ring — cool accent, wider orbit
                const ringPoints2 = [];
                for (let i = 0; i <= 128; i++) {
                    const angle = (i / 128) * Math.PI * 2;
                    ringPoints2.push(new THREE.Vector3(122 * Math.cos(angle), 0, 122 * Math.sin(angle)));
                }
                const ringGeom2 = new THREE.BufferGeometry().setFromPoints(ringPoints2);
                const ringMat2 = new THREE.LineDashedMaterial({
                    color: 0x90b8ff, transparent: true, opacity: 0.06,
                    dashSize: 3, gapSize: 12, depthWrite: false
                });
                const hudRing2 = new THREE.Line(ringGeom2, ringMat2);
                hudRing2.computeLineDistances();
                hudRing2.rotation.x = Math.PI * 0.42;
                hudRing2.rotation.z = Math.PI * 0.25;
                scene.add(hudRing2);

                // Slow counter-rotation for rings
                (function animateRings() {
                    requestAnimationFrame(animateRings);
                    hudRing1.rotation.z += 0.0003;
                    hudRing2.rotation.z -= 0.0002;
                })();
            } catch (e) {
                console.log('[GLOBE] HUD rings skipped:', e.message);
            }

            // ── Orbiting arc segments (detached satellite trails) ──
            try {
                const orbitArcs = [];

                // Arc 1: horizontal orbit (rotates around Y axis)
                const arc1Pts = [];
                const arc1R = 140;
                for (let i = 0; i <= 64; i++) {
                    const a = (i / 64) * Math.PI * 2 * 0.18;
                    arc1Pts.push(new THREE.Vector3(arc1R * Math.cos(a), 0, arc1R * Math.sin(a)));
                }
                const arc1 = new THREE.Line(
                    new THREE.BufferGeometry().setFromPoints(arc1Pts),
                    new THREE.LineBasicMaterial({ color: 0xffb090, transparent: true, opacity: 0.5, depthWrite: false })
                );
                arc1.rotation.x = Math.PI * 0.5;
                scene.add(arc1);
                orbitArcs.push({ mesh: arc1, axis: 'y', speed: 0.004 });

                // Arc 2: vertical orbit (rotates around X axis)
                const arc2Pts = [];
                const arc2R = 148;
                for (let i = 0; i <= 64; i++) {
                    const a = (i / 64) * Math.PI * 2 * 0.14;
                    arc2Pts.push(new THREE.Vector3(arc2R * Math.cos(a), 0, arc2R * Math.sin(a)));
                }
                const arc2 = new THREE.Line(
                    new THREE.BufferGeometry().setFromPoints(arc2Pts),
                    new THREE.LineBasicMaterial({ color: 0x90b8ff, transparent: true, opacity: 0.4, depthWrite: false })
                );
                arc2.rotation.z = Math.PI * 0.5;
                scene.add(arc2);
                orbitArcs.push({ mesh: arc2, axis: 'y', speed: -0.003 });

                // Arc 3: diagonal orbit
                const arc3Pts = [];
                const arc3R = 135;
                for (let i = 0; i <= 64; i++) {
                    const a = (i / 64) * Math.PI * 2 * 0.16;
                    arc3Pts.push(new THREE.Vector3(arc3R * Math.cos(a), 0, arc3R * Math.sin(a)));
                }
                const arc3 = new THREE.Line(
                    new THREE.BufferGeometry().setFromPoints(arc3Pts),
                    new THREE.LineBasicMaterial({ color: 0xffb090, transparent: true, opacity: 0.35, depthWrite: false })
                );
                arc3.rotation.x = Math.PI * 0.35;
                arc3.rotation.z = Math.PI * 0.25;
                scene.add(arc3);
                orbitArcs.push({ mesh: arc3, axis: 'y', speed: 0.0035 });

                (function animateOrbitArcs() {
                    requestAnimationFrame(animateOrbitArcs);
                    for (const oa of orbitArcs) {
                        oa.mesh.rotation.y += oa.speed;
                    }
                })();
            } catch (e) {
                console.log('[GLOBE] Orbiting arcs skipped:', e.message);
            }

            mainGlobe.pointOfView({ lat: initialLocation.lat, lng: initLng, altitude: 2.2 });
            globeReady = true;
            tryReveal();
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
                    .hexPolygonColor(() => 'rgba(255, 160, 120, 0.8)')
                    .hexPolygonAltitude(0.005);

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
