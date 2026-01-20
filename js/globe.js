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

        this.resize();
    }

    async loadLandData() {
        const loading = document.getElementById('globe-loading');

        try {
            const response = await fetch('https://cdn.jsdelivr.net/npm/world-atlas@2/land-110m.json');
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

    draw() {
        this.ctx.clearRect(0, 0, this.size, this.size);

        const dots = [];
        const dotRadius = this.size / 200;

        this.landPoints.forEach(({ lat, lon }) => {
            const point = this.latLonToXYZ(lat, lon);
            const rotated = this.rotateY(point, this.rotation);

            if (rotated.z > -0.15) {
                const projected = this.project(rotated);
                dots.push({
                    x: projected.x,
                    y: projected.y,
                    z: rotated.z,
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

        dots.forEach(dot => {
            const depthOpacity = Math.max(0.12, (dot.z + 0.15) / 1.15);

            if (dot.isHighlight) {
                // Breathing animation
                const breathScale = 1 + Math.sin(this.breathPhase) * 0.3;
                const breathOpacity = 0.6 + Math.sin(this.breathPhase) * 0.4;

                const glowRadius = dotRadius * 5 * breathScale;

                // Outer glow (breathing)
                const gradient = this.ctx.createRadialGradient(
                    dot.x, dot.y, 0,
                    dot.x, dot.y, glowRadius
                );
                const alpha1 = Math.floor(breathOpacity * 255).toString(16).padStart(2, '0');
                const alpha2 = Math.floor(breathOpacity * 0.6 * 255).toString(16).padStart(2, '0');
                const alpha3 = Math.floor(breathOpacity * 0.2 * 255).toString(16).padStart(2, '0');

                gradient.addColorStop(0, this.highlightColor + alpha1);
                gradient.addColorStop(0.3, this.highlightColor + alpha2);
                gradient.addColorStop(0.6, this.highlightColor + alpha3);
                gradient.addColorStop(1, 'transparent');

                this.ctx.beginPath();
                this.ctx.arc(dot.x, dot.y, glowRadius, 0, Math.PI * 2);
                this.ctx.fillStyle = gradient;
                this.ctx.fill();

                // Inner solid dot (also pulses slightly)
                const coreSize = dotRadius * (1.6 + Math.sin(this.breathPhase) * 0.2);
                this.ctx.beginPath();
                this.ctx.arc(dot.x, dot.y, coreSize, 0, Math.PI * 2);
                this.ctx.fillStyle = this.highlightColor;
                this.ctx.fill();
            } else {
                const alpha = Math.floor(depthOpacity * 255).toString(16).padStart(2, '0');
                this.ctx.beginPath();
                this.ctx.arc(dot.x, dot.y, dotRadius, 0, Math.PI * 2);
                this.ctx.fillStyle = this.dotColor + alpha;
                this.ctx.fill();
            }
        });
    }

    animate() {
        if (!this.ready) return;
        this.rotation += this.rotationSpeed;
        this.breathPhase += 0.03; // Slow breathing cycle (~4 seconds)
        this.draw();
        requestAnimationFrame(() => this.animate());
    }
}
