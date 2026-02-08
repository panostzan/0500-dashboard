// ═══════════════════════════════════════════════════════════════════════════════
// HUD ELEMENTS - Iron Man style overlays
// ═══════════════════════════════════════════════════════════════════════════════

const HUD_COLOR = 'rgba(212, 145, 92, 0.6)';
const HUD_COLOR_DIM = 'rgba(212, 145, 92, 0.25)';
const HUD_COLOR_BRIGHT = 'rgba(212, 145, 92, 0.9)';

// ═══════════════════════════════════════════════════════════════════════════════
// CLOCK DAY PROGRESS ARC
// ═══════════════════════════════════════════════════════════════════════════════

class ClockArc {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.size = 280;
        this.breathPhase = 0;

        this.resize();
        this.animate();
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
    }

    getDayProgress() {
        const now = new Date();
        const hours = now.getHours();
        const minutes = now.getMinutes();
        // Day progress from 5am to midnight (19 hours)
        const dayStart = 5;
        const dayEnd = 24;
        const totalMinutes = (hours - dayStart) * 60 + minutes;
        const totalDayMinutes = (dayEnd - dayStart) * 60;
        return Math.max(0, Math.min(1, totalMinutes / totalDayMinutes));
    }

    draw() {
        this.ctx.clearRect(0, 0, this.size, this.size);

        const radius = this.size / 2 - 20;
        const lineWidth = 1.5;
        const progress = this.getDayProgress();

        // Breathing effect
        this.breathPhase += 0.015;
        const breathOpacity = 0.4 + Math.sin(this.breathPhase) * 0.2;

        // Background arc (full circle, very dim)
        this.ctx.beginPath();
        this.ctx.arc(this.centerX, this.centerY, radius, 0, Math.PI * 2);
        this.ctx.strokeStyle = HUD_COLOR_DIM;
        this.ctx.lineWidth = lineWidth;
        this.ctx.stroke();

        // Progress arc (from top, clockwise)
        const startAngle = -Math.PI / 2;
        const endAngle = startAngle + (Math.PI * 2 * progress);

        this.ctx.beginPath();
        this.ctx.arc(this.centerX, this.centerY, radius, startAngle, endAngle);
        this.ctx.strokeStyle = `rgba(212, 145, 92, ${breathOpacity + 0.2})`;
        this.ctx.lineWidth = lineWidth;
        this.ctx.stroke();

        // Small tick marks around the arc
        for (let i = 0; i < 24; i++) {
            const angle = (i / 24) * Math.PI * 2 - Math.PI / 2;
            const isHour = i % 6 === 0;
            const tickLength = isHour ? 8 : 4;
            const innerRadius = radius - tickLength;

            const x1 = this.centerX + Math.cos(angle) * innerRadius;
            const y1 = this.centerY + Math.sin(angle) * innerRadius;
            const x2 = this.centerX + Math.cos(angle) * radius;
            const y2 = this.centerY + Math.sin(angle) * radius;

            this.ctx.beginPath();
            this.ctx.moveTo(x1, y1);
            this.ctx.lineTo(x2, y2);
            this.ctx.strokeStyle = i < progress * 24 ?
                `rgba(212, 145, 92, ${breathOpacity})` : HUD_COLOR_DIM;
            this.ctx.lineWidth = 1;
            this.ctx.stroke();
        }

        // Current position indicator (small dot)
        const indicatorAngle = startAngle + (Math.PI * 2 * progress);
        const indicatorX = this.centerX + Math.cos(indicatorAngle) * radius;
        const indicatorY = this.centerY + Math.sin(indicatorAngle) * radius;

        // Glow
        const gradient = this.ctx.createRadialGradient(
            indicatorX, indicatorY, 0,
            indicatorX, indicatorY, 8
        );
        gradient.addColorStop(0, `rgba(212, 145, 92, ${breathOpacity + 0.3})`);
        gradient.addColorStop(0.5, `rgba(212, 145, 92, ${breathOpacity * 0.5})`);
        gradient.addColorStop(1, 'transparent');

        this.ctx.beginPath();
        this.ctx.arc(indicatorX, indicatorY, 8, 0, Math.PI * 2);
        this.ctx.fillStyle = gradient;
        this.ctx.fill();

        // Solid center
        this.ctx.beginPath();
        this.ctx.arc(indicatorX, indicatorY, 3, 0, Math.PI * 2);
        this.ctx.fillStyle = HUD_COLOR_BRIGHT;
        this.ctx.fill();
    }

    animate() {
        this.draw();
        requestAnimationFrame(() => this.animate());
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// GLOBE HUD ARCS
// ═══════════════════════════════════════════════════════════════════════════════

class GlobeHUD {
    constructor(canvas, globeSize) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.size = globeSize + 100; // Slightly larger than globe
        this.globeRadius = globeSize * 0.45;
        this.breathPhase = 0;
        this.rotationPhase = 0;

        this.resize();
        this.animate();
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
    }

    draw() {
        this.ctx.clearRect(0, 0, this.size, this.size);

        // Breathing effect
        this.breathPhase += 0.012;
        const breathOpacity = 0.3 + Math.sin(this.breathPhase) * 0.15;

        // Slow rotation for arcs
        this.rotationPhase += 0.002;

        const baseRadius = this.globeRadius + 15;

        // Outer arc segments (tactical targeting style)
        this.drawArcSegment(baseRadius + 25, 0.15, this.rotationPhase, breathOpacity);
        this.drawArcSegment(baseRadius + 25, 0.15, this.rotationPhase + Math.PI, breathOpacity);

        this.drawArcSegment(baseRadius + 35, 0.08, this.rotationPhase + 0.5, breathOpacity * 0.7);
        this.drawArcSegment(baseRadius + 35, 0.08, this.rotationPhase + Math.PI + 0.5, breathOpacity * 0.7);

        // Inner ring (very subtle)
        this.ctx.beginPath();
        this.ctx.arc(this.centerX, this.centerY, baseRadius, 0, Math.PI * 2);
        this.ctx.strokeStyle = `rgba(212, 145, 92, ${breathOpacity * 0.4})`;
        this.ctx.lineWidth = 0.5;
        this.ctx.stroke();

        // Corner markers (like targeting reticle)
        this.drawCornerMarkers(baseRadius + 45, breathOpacity);

        // Small tick marks on inner ring
        for (let i = 0; i < 36; i++) {
            const angle = (i / 36) * Math.PI * 2;
            const tickLength = i % 3 === 0 ? 6 : 3;
            const innerR = baseRadius - tickLength;

            const x1 = this.centerX + Math.cos(angle) * innerR;
            const y1 = this.centerY + Math.sin(angle) * innerR;
            const x2 = this.centerX + Math.cos(angle) * baseRadius;
            const y2 = this.centerY + Math.sin(angle) * baseRadius;

            this.ctx.beginPath();
            this.ctx.moveTo(x1, y1);
            this.ctx.lineTo(x2, y2);
            this.ctx.strokeStyle = `rgba(212, 145, 92, ${breathOpacity * 0.5})`;
            this.ctx.lineWidth = 0.5;
            this.ctx.stroke();
        }
    }

    drawArcSegment(radius, length, startAngle, opacity) {
        const arcLength = Math.PI * 2 * length;

        this.ctx.beginPath();
        this.ctx.arc(
            this.centerX,
            this.centerY,
            radius,
            startAngle,
            startAngle + arcLength
        );
        this.ctx.strokeStyle = `rgba(212, 145, 92, ${opacity})`;
        this.ctx.lineWidth = 1;
        this.ctx.lineCap = 'round';
        this.ctx.stroke();

        // Small dots at the ends
        const startX = this.centerX + Math.cos(startAngle) * radius;
        const startY = this.centerY + Math.sin(startAngle) * radius;
        const endX = this.centerX + Math.cos(startAngle + arcLength) * radius;
        const endY = this.centerY + Math.sin(startAngle + arcLength) * radius;

        this.ctx.beginPath();
        this.ctx.arc(startX, startY, 2, 0, Math.PI * 2);
        this.ctx.fillStyle = `rgba(212, 145, 92, ${opacity * 1.5})`;
        this.ctx.fill();

        this.ctx.beginPath();
        this.ctx.arc(endX, endY, 2, 0, Math.PI * 2);
        this.ctx.fillStyle = `rgba(212, 145, 92, ${opacity * 1.5})`;
        this.ctx.fill();
    }

    drawCornerMarkers(radius, opacity) {
        const markerSize = 12;
        const positions = [
            { angle: -Math.PI / 4 },           // Top right
            { angle: Math.PI / 4 },            // Bottom right
            { angle: Math.PI * 3 / 4 },        // Bottom left
            { angle: -Math.PI * 3 / 4 }        // Top left
        ];

        positions.forEach(pos => {
            const x = this.centerX + Math.cos(pos.angle) * radius;
            const y = this.centerY + Math.sin(pos.angle) * radius;

            // L-shaped corner marker
            this.ctx.save();
            this.ctx.translate(x, y);
            this.ctx.rotate(pos.angle + Math.PI / 4);

            this.ctx.beginPath();
            this.ctx.moveTo(-markerSize / 2, 0);
            this.ctx.lineTo(0, 0);
            this.ctx.lineTo(0, markerSize / 2);
            this.ctx.strokeStyle = `rgba(212, 145, 92, ${opacity * 0.8})`;
            this.ctx.lineWidth = 1;
            this.ctx.stroke();

            this.ctx.restore();
        });
    }

    animate() {
        this.draw();
        requestAnimationFrame(() => this.animate());
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// INITIALIZE HUD ELEMENTS
// ═══════════════════════════════════════════════════════════════════════════════

function initHUD() {
    // Globe HUD (450 is the globe size from main.js)
    const globeHUD = new GlobeHUD(document.getElementById('globe-hud-canvas'), 450);

    return { globeHUD };
}
