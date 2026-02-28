// ═══════════════════════════════════════════════════════════════════════════════
// DOTTED GLOBE WITH REAL GEOGRAPHIC DATA
// Uses Natural Earth land data via TopoJSON
// ═══════════════════════════════════════════════════════════════════════════════

// TopoJSON decoder (minimal implementation)
function decodeArc(topology, arc) {
    let x = 0, y = 0;
    return arc.map(([dx, dy]) => {
        x += dx;
        y += dy;
        return [
            x * topology.transform.scale[0] + topology.transform.translate[0],
            y * topology.transform.scale[1] + topology.transform.translate[1]
        ];
    });
}

function decodeArcs(topology, arcs) {
    return arcs.map(index => {
        const arc = topology.arcs[index < 0 ? ~index : index];
        const decoded = decodeArc(topology, arc);
        return index < 0 ? decoded.reverse() : decoded;
    }).flat();
}

function topoFeature(topology, object) {
    if (object.type === 'GeometryCollection') {
        return {
            type: 'FeatureCollection',
            features: object.geometries.map(geom => topoFeature(topology, geom))
        };
    }

    const coords = [];

    if (object.type === 'Polygon') {
        object.arcs.forEach(ring => {
            coords.push(decodeArcs(topology, ring));
        });
    } else if (object.type === 'MultiPolygon') {
        object.arcs.forEach(polygon => {
            const polyCoords = [];
            polygon.forEach(ring => {
                polyCoords.push(decodeArcs(topology, ring));
            });
            coords.push(polyCoords);
        });
    }

    return { type: 'Feature', geometry: { type: object.type, coordinates: coords } };
}

// Point in polygon test using ray casting
function pointInPolygon(point, polygon) {
    const [x, y] = point;
    let inside = false;

    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
        const [xi, yi] = polygon[i];
        const [xj, yj] = polygon[j];

        if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) {
            inside = !inside;
        }
    }

    return inside;
}

// Check if point is on land
function createLandChecker(landFeature) {
    const polygons = [];

    function extractPolygons(geometry) {
        if (geometry.type === 'Polygon') {
            polygons.push(geometry.coordinates[0]);
        } else if (geometry.type === 'MultiPolygon') {
            geometry.coordinates.forEach(poly => {
                polygons.push(poly[0]);
            });
        }
    }

    if (landFeature.type === 'FeatureCollection') {
        landFeature.features.forEach(f => extractPolygons(f.geometry));
    } else if (landFeature.geometry) {
        extractPolygons(landFeature.geometry);
    }

    return function isLand(lon, lat) {
        for (const poly of polygons) {
            if (pointInPolygon([lon, lat], poly)) {
                return true;
            }
        }
        return false;
    };
}

class DottedGlobe {
    constructor(canvas, options = {}) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.rotation = options.initialRotation || 1.5;
        this.rotationSpeed = options.rotationSpeed || 0.001;
        this.dotColor = options.dotColor || '#2d2d2d';
        this.highlightColor = options.highlightColor || '#e67635';
        this.highlightLocation = options.highlightLocation || null;
        this.size = options.size || 400;
        this.dotSpacing = options.dotSpacing || 2.5;
        this.landPoints = [];
        this.isLand = null;
        this.ready = false;
        this.breathPhase = 0;
        this.dotSeeds = []; // Per-dot random seeds for size variation

        this.resize();
    }

    setHighlightLocation(location) {
        this.highlightLocation = location;
    }


    async loadLandData() {
        const loading = document.getElementById('globe-loading');

        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000);
            const response = await fetch('https://cdn.jsdelivr.net/npm/world-atlas@2/land-110m.json', {
                signal: controller.signal
            });
            clearTimeout(timeoutId);
            if (!response.ok) throw new Error('Network response was not ok');
            const topology = await response.json();
            const landFeature = topoFeature(topology, topology.objects.land);
            this.isLand = createLandChecker(landFeature);
            this.generateLandPoints();
        } catch (error) {
            console.error('Failed to load land data, using fallback:', error);
            this.generateFallbackPoints();
        }

        this.ready = true;
        if (loading) loading.style.display = 'none';
        this.animate();
    }

    generateLandPoints() {
        this.landPoints = [];

        for (let lat = -85; lat <= 85; lat += this.dotSpacing) {
            const latRad = Math.abs(lat) * Math.PI / 180;
            const lonSpacing = this.dotSpacing / Math.max(0.3, Math.cos(latRad));

            for (let lon = -180; lon < 180; lon += lonSpacing) {
                if (this.isLand && this.isLand(lon, lat)) {
                    this.landPoints.push({ lat, lon });
                }
            }
        }

        // Generate per-dot random seeds for size variation
        this.dotSeeds = this.landPoints.map(() => 0.7 + Math.random() * 0.6);
    }

    generateFallbackPoints() {
        this.landPoints = [];
        for (let lat = -60; lat <= 70; lat += 4) {
            for (let lon = -180; lon < 180; lon += 4) {
                if (Math.random() > 0.7) {
                    this.landPoints.push({ lat, lon });
                }
            }
        }
        this.dotSeeds = this.landPoints.map(() => 0.7 + Math.random() * 0.6);
    }

    resize() {
        const dpr = window.devicePixelRatio || 1;
        this.canvas.width = this.size * dpr;
        this.canvas.height = this.size * dpr;
        this.canvas.style.width = this.size + 'px';
        this.canvas.style.height = this.size + 'px';
        this.ctx.setTransform(1, 0, 0, 1, 0, 0);
        this.ctx.scale(dpr, dpr);

        this.centerX = this.size / 2;
        this.centerY = this.size / 2;
        this.radius = this.size * 0.45;
    }

    latLonToXYZ(lat, lon) {
        const phi = (90 - lat) * (Math.PI / 180);
        const theta = (lon + 180) * (Math.PI / 180);

        return {
            x: -Math.sin(phi) * Math.cos(theta),
            y: Math.cos(phi),
            z: Math.sin(phi) * Math.sin(theta)
        };
    }

    rotateY(point, angle) {
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);
        return {
            x: point.x * cos - point.z * sin,
            y: point.y,
            z: point.x * sin + point.z * cos
        };
    }

    project(point) {
        return {
            x: this.centerX + point.x * this.radius,
            y: this.centerY - point.y * this.radius,
            z: point.z
        };
    }

    getSubSolarPoint() {
        const now = new Date();
        const dayOfYear = Math.floor((now - new Date(now.getFullYear(), 0, 0)) / 86400000);
        // Solar declination (approximate): -23.44° * cos(360/365 * (dayOfYear + 10))
        const declination = -23.44 * Math.cos((2 * Math.PI / 365) * (dayOfYear + 10));
        // Hour angle: sun is at longitude based on UTC time
        const utcHours = now.getUTCHours() + now.getUTCMinutes() / 60;
        const sunLon = (12 - utcHours) * 15; // 15° per hour, noon = 0°
        return { lat: declination, lon: sunLon };
    }

    draw() {
        this.ctx.clearRect(0, 0, this.size, this.size);

        // ── Atmospheric glow behind the globe ──
        const atmosRadius = this.radius * 1.12;
        const atmosGradient = this.ctx.createRadialGradient(
            this.centerX, this.centerY, this.radius * 0.88,
            this.centerX, this.centerY, atmosRadius
        );
        const breathGlow = 0.06 + Math.sin(this.breathPhase * 0.5) * 0.02;
        atmosGradient.addColorStop(0, `rgba(255, 176, 144, ${breathGlow})`);
        atmosGradient.addColorStop(0.6, `rgba(255, 176, 144, ${breathGlow * 0.3})`);
        atmosGradient.addColorStop(1, 'transparent');
        this.ctx.beginPath();
        this.ctx.arc(this.centerX, this.centerY, atmosRadius, 0, Math.PI * 2);
        this.ctx.fillStyle = atmosGradient;
        this.ctx.fill();

        const dots = [];
        const baseDotRadius = this.size / 200;

        // Compute sun direction for day/night terminator
        const sunPos = this.getSubSolarPoint();
        const sunXYZ = this.latLonToXYZ(sunPos.lat, sunPos.lon);

        this.landPoints.forEach(({ lat, lon }, i) => {
            const point = this.latLonToXYZ(lat, lon);
            const rotated = this.rotateY(point, this.rotation);

            if (rotated.z > -0.15) {
                // Dot product with sun direction (unrotated space) for lighting
                const dotSun = point.x * sunXYZ.x + point.y * sunXYZ.y + point.z * sunXYZ.z;
                const projected = this.project(rotated);
                dots.push({
                    x: projected.x,
                    y: projected.y,
                    z: rotated.z,
                    sunDot: dotSun,
                    seed: this.dotSeeds[i] || 1,
                    isHighlight: false
                });
            }
        });

        if (this.highlightLocation) {
            const point = this.latLonToXYZ(this.highlightLocation.lat, this.highlightLocation.lon);
            const rotated = this.rotateY(point, this.rotation);

            if (rotated.z > -0.15) {
                const projected = this.project(rotated);
                dots.push({
                    x: projected.x,
                    y: projected.y,
                    z: rotated.z,
                    isHighlight: true
                });
            }
        }

        dots.sort((a, b) => a.z - b.z);

        const regularDots = [];
        const highlightDots = [];
        dots.forEach(dot => {
            if (dot.isHighlight) highlightDots.push(dot);
            else regularDots.push(dot);
        });

        // ── Render land dots with golden terminator lighting ──
        regularDots.forEach(dot => {
            // Base depth opacity
            let depthOpacity = Math.max(0.12, (dot.z + 0.15) / 1.15);

            // Smooth terminator with wider transition band
            const sd = dot.sunDot;
            let sunFactor;
            if (sd > 0.2) {
                sunFactor = 1.0;
            } else if (sd < -0.2) {
                sunFactor = 0.25;
            } else {
                sunFactor = 0.25 + 0.75 * ((sd + 0.2) / 0.4);
            }
            depthOpacity *= sunFactor;

            // ── Golden terminator glow ──
            // Dots near the terminator line (sunDot ~ 0) glow warm gold
            // Bell curve centered at sunDot=0, width ~0.2
            const terminatorProximity = Math.exp(-(sd * sd) / (2 * 0.06 * 0.06));
            // Breathing pulse on the terminator
            const terminatorPulse = 0.85 + Math.sin(this.breathPhase * 0.7) * 0.15;
            const goldIntensity = terminatorProximity * terminatorPulse;

            // Rim lighting on sun side
            const edgeFactor = 1 - Math.abs(dot.z);
            const rimBoost = sd > 0 ? edgeFactor * 0.35 * sd : 0;

            // Per-dot size variation + terminator dots slightly larger
            const sizeBoost = 1 + goldIntensity * 0.5;
            const dotRadius = baseDotRadius * dot.seed * sizeBoost;

            if (goldIntensity > 0.15) {
                // ── Golden terminator dot ──
                // Blend from warm amber to bright gold based on intensity
                const r = 255;
                const g = Math.round(160 + goldIntensity * 80); // 160 → 240
                const b = Math.round(60 + goldIntensity * 40);  // 60 → 100
                this.ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
                this.ctx.globalAlpha = Math.min(1, depthOpacity + goldIntensity * 0.6);

                // Draw glow halo behind golden dots
                if (goldIntensity > 0.4) {
                    const glowR = dotRadius * (2.5 + goldIntensity * 2);
                    const glowAlpha = goldIntensity * 0.15 * terminatorPulse;
                    const glow = this.ctx.createRadialGradient(
                        dot.x, dot.y, dotRadius * 0.5,
                        dot.x, dot.y, glowR
                    );
                    glow.addColorStop(0, `rgba(255, 200, 80, ${glowAlpha})`);
                    glow.addColorStop(0.5, `rgba(255, 160, 60, ${glowAlpha * 0.4})`);
                    glow.addColorStop(1, 'transparent');
                    this.ctx.save();
                    this.ctx.globalAlpha = 1;
                    this.ctx.beginPath();
                    this.ctx.arc(dot.x, dot.y, glowR, 0, Math.PI * 2);
                    this.ctx.fillStyle = glow;
                    this.ctx.fill();
                    this.ctx.restore();
                    // Restore fill for the dot itself
                    this.ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
                    this.ctx.globalAlpha = Math.min(1, depthOpacity + goldIntensity * 0.6);
                }
            } else if (rimBoost > 0.08) {
                // Warm rim-lit dot (sun side edge)
                const g = Math.round(180 + rimBoost * 60);
                const b = Math.round(150 + rimBoost * 40);
                this.ctx.fillStyle = `rgb(255, ${g}, ${b})`;
                this.ctx.globalAlpha = Math.min(1, depthOpacity + rimBoost * 0.4);
            } else {
                this.ctx.fillStyle = this.dotColor;
                this.ctx.globalAlpha = depthOpacity;
            }

            this.ctx.beginPath();
            this.ctx.arc(dot.x, dot.y, dotRadius, 0, Math.PI * 2);
            this.ctx.fill();
        });
        this.ctx.globalAlpha = 1;

        // ── Highlight location dot ──
        highlightDots.forEach(dot => {
            const breathScale = 1 + Math.sin(this.breathPhase) * 0.3;
            const breathOpacity = 0.7 + Math.sin(this.breathPhase) * 0.3;

            // Large outer glow
            const outerGlowRadius = baseDotRadius * 12 * breathScale;
            const outerGradient = this.ctx.createRadialGradient(
                dot.x, dot.y, 0,
                dot.x, dot.y, outerGlowRadius
            );
            outerGradient.addColorStop(0, `rgba(255, 176, 144, ${breathOpacity * 0.5})`);
            outerGradient.addColorStop(0.4, `rgba(255, 176, 144, ${breathOpacity * 0.2})`);
            outerGradient.addColorStop(1, 'transparent');

            this.ctx.beginPath();
            this.ctx.arc(dot.x, dot.y, outerGlowRadius, 0, Math.PI * 2);
            this.ctx.fillStyle = outerGradient;
            this.ctx.fill();

            // Inner glow ring
            const glowRadius = baseDotRadius * 6 * breathScale;
            const gradient = this.ctx.createRadialGradient(
                dot.x, dot.y, 0,
                dot.x, dot.y, glowRadius
            );
            gradient.addColorStop(0, `rgba(255, 255, 255, ${breathOpacity})`);
            gradient.addColorStop(0.2, `rgba(255, 200, 170, ${breathOpacity * 0.8})`);
            gradient.addColorStop(0.5, `rgba(255, 150, 100, ${breathOpacity * 0.4})`);
            gradient.addColorStop(1, 'transparent');

            this.ctx.beginPath();
            this.ctx.arc(dot.x, dot.y, glowRadius, 0, Math.PI * 2);
            this.ctx.fillStyle = gradient;
            this.ctx.fill();

            // Bright white core
            const coreSize = baseDotRadius * (2 + Math.sin(this.breathPhase) * 0.3);
            this.ctx.beginPath();
            this.ctx.arc(dot.x, dot.y, coreSize, 0, Math.PI * 2);
            this.ctx.fillStyle = '#ffffff';
            this.ctx.fill();

            // Inner color ring
            this.ctx.beginPath();
            this.ctx.arc(dot.x, dot.y, coreSize * 0.6, 0, Math.PI * 2);
            this.ctx.fillStyle = this.highlightColor;
            this.ctx.fill();
        });
    }

    animate() {
        if (!this.ready) return;
        if (document.hidden) {
            requestAnimationFrame(() => this.animate());
            return;
        }
        this.rotation += this.rotationSpeed;
        this.breathPhase += 0.03; // Slow breathing cycle (~4 seconds)
        this.draw();
        requestAnimationFrame(() => this.animate());
    }
}
