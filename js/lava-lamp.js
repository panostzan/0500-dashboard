// ═══════════════════════════════════════════════════════════════════════════════
// LAVA LAMP BACKGROUND
// ═══════════════════════════════════════════════════════════════════════════════

class LavaLamp {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.blobs = [];
        this.time = 0;
        this.numBlobs = 8;

        // Narrow warm palette - similar hues for seamless blending
        this.colors = [
            { h: 20, s: 70, l: 65 },    // Soft orange
            { h: 25, s: 65, l: 68 },    // Light amber
            { h: 18, s: 60, l: 70 },    // Peach
            { h: 28, s: 70, l: 62 },    // Warm amber
            { h: 15, s: 55, l: 72 },    // Pale coral
            { h: 22, s: 68, l: 66 },    // Muted orange
        ];

        this.resize();
        this.initBlobs();
        this.animate();

        window.addEventListener('resize', () => this.resize());
    }

    resize() {
        const dpr = window.devicePixelRatio || 1;
        this.width = window.innerWidth;
        this.height = window.innerHeight;
        this.canvas.width = this.width * dpr;
        this.canvas.height = this.height * dpr;
        this.canvas.style.width = this.width + 'px';
        this.canvas.style.height = this.height + 'px';
        this.ctx.setTransform(1, 0, 0, 1, 0, 0);
        this.ctx.scale(dpr, dpr);
    }

    initBlobs() {
        for (let i = 0; i < this.numBlobs; i++) {
            this.blobs.push({
                x: Math.random() * this.width,
                y: Math.random() * this.height,
                baseRadius: 250 + Math.random() * 300,
                vx: 0,
                vy: (Math.random() - 0.5) * 0.4,
                wobbleOffset: Math.random() * Math.PI * 2,
                wobbleSpeed: 0.002 + Math.random() * 0.002,
                colorIndex: i % this.colors.length,
                colorShiftSpeed: 0.0003 + Math.random() * 0.0002,
                colorPhase: Math.random() * Math.PI * 2
            });
        }
    }

    getColor(blob, alpha = 1) {
        const phase = blob.colorPhase + this.time * blob.colorShiftSpeed;
        const idx1 = Math.floor(phase) % this.colors.length;
        const idx2 = (idx1 + 1) % this.colors.length;
        const t = phase % 1;

        const c1 = this.colors[idx1];
        const c2 = this.colors[idx2];

        const h = c1.h + (c2.h - c1.h) * t;
        const s = c1.s + (c2.s - c1.s) * t;
        const l = c1.l + (c2.l - c1.l) * t;

        return `hsla(${h}, ${s}%, ${l}%, ${alpha})`;
    }

    updateBlob(blob) {
        blob.y += blob.vy;

        if (blob.y < blob.baseRadius * 0.5) {
            blob.vy += 0.005;
        } else if (blob.y > this.height - blob.baseRadius * 0.5) {
            blob.vy -= 0.005;
        }

        blob.vy *= 0.999;
        blob.vy = Math.max(-0.5, Math.min(0.5, blob.vy));

        const wobble = Math.sin(this.time * blob.wobbleSpeed + blob.wobbleOffset);
        blob.x += wobble * 0.3;

        if (blob.x < blob.baseRadius * 0.3) blob.x = blob.baseRadius * 0.3;
        if (blob.x > this.width - blob.baseRadius * 0.3) blob.x = this.width - blob.baseRadius * 0.3;
    }

    drawBlob(blob) {
        const ctx = this.ctx;

        const stretch = 1 + Math.abs(blob.vy) * 0.3;
        const squash = 1 / Math.sqrt(stretch);

        const radiusX = blob.baseRadius * squash;
        const radiusY = blob.baseRadius * stretch;

        const gradient = ctx.createRadialGradient(
            blob.x, blob.y, 0,
            blob.x, blob.y, Math.max(radiusX, radiusY)
        );

        gradient.addColorStop(0, this.getColor(blob, 0.4));
        gradient.addColorStop(0.3, this.getColor(blob, 0.3));
        gradient.addColorStop(0.6, this.getColor(blob, 0.15));
        gradient.addColorStop(1, this.getColor(blob, 0));

        ctx.save();
        ctx.translate(blob.x, blob.y);

        const wobble = Math.sin(this.time * blob.wobbleSpeed + blob.wobbleOffset);
        ctx.rotate(wobble * 0.05);

        ctx.beginPath();
        ctx.ellipse(0, 0, radiusX, radiusY, 0, 0, Math.PI * 2);
        ctx.fillStyle = gradient;
        ctx.fill();

        ctx.restore();
    }

    draw() {
        const bgGradient = this.ctx.createLinearGradient(0, 0, 0, this.height);
        bgGradient.addColorStop(0, '#ffd4b8');
        bgGradient.addColorStop(0.5, '#ffc9a8');
        bgGradient.addColorStop(1, '#ffbe98');

        this.ctx.fillStyle = bgGradient;
        this.ctx.fillRect(0, 0, this.width, this.height);

        this.ctx.filter = 'blur(80px)';

        for (const blob of this.blobs) {
            this.updateBlob(blob);
            this.drawBlob(blob);
        }

        this.ctx.filter = 'none';

        this.ctx.filter = 'blur(60px)';
        for (const blob of this.blobs) {
            const ctx = this.ctx;
            const innerRadius = blob.baseRadius * 0.7;

            const gradient = ctx.createRadialGradient(
                blob.x, blob.y, 0,
                blob.x, blob.y, innerRadius
            );

            gradient.addColorStop(0, this.getColor(blob, 0.2));
            gradient.addColorStop(0.5, this.getColor(blob, 0.1));
            gradient.addColorStop(1, this.getColor(blob, 0));

            ctx.beginPath();
            ctx.arc(blob.x, blob.y, innerRadius, 0, Math.PI * 2);
            ctx.fillStyle = gradient;
            ctx.fill();
        }

        this.ctx.filter = 'none';
    }

    animate() {
        this.time++;
        this.draw();
        requestAnimationFrame(() => this.animate());
    }
}
