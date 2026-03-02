// ═══════════════════════════════════════════════════════════════════════════════
// THEME SWITCHER — Shared between index.html and sleep.html
// ═══════════════════════════════════════════════════════════════════════════════

const THEME_GRADIENTS = {
    aurora:   ['#c87090', '#ffb090'],
    arctic:   ['#5090d0', '#8cc8ff'],
    solar:    ['#e08820', '#ffb040'],
    lavender: ['#8860c0', '#b888e8'],
    mono:     ['#999999', '#ffffff']
};

function applyTheme(name) {
    if (name && name !== 'aurora') {
        document.documentElement.setAttribute('data-theme', name);
    } else {
        document.documentElement.removeAttribute('data-theme');
        name = 'aurora';
    }
    // Update SVG gradient stops if present (sleep.html score ring)
    const colors = THEME_GRADIENTS[name];
    if (colors) {
        const stops = document.querySelectorAll('#scoreGradient stop');
        if (stops.length >= 2) {
            stops[0].style.stopColor = colors[0];
            stops[1].style.stopColor = colors[1];
        }
    }
    // Update active dot on all theme-dot elements
    document.querySelectorAll('.theme-dot').forEach(d => {
        d.classList.toggle('active', d.dataset.theme === name);
    });
}

function initTheme() {
    const saved = localStorage.getItem('0500_theme');
    applyTheme(saved || 'aurora');

    document.querySelectorAll('.theme-dot').forEach(dot => {
        dot.addEventListener('click', () => {
            const name = dot.dataset.theme;
            localStorage.setItem('0500_theme', name);
            applyTheme(name);
        });
    });

    // Time-of-day ambience
    initAmbienceShift();
}

// ═══════════════════════════════════════════════════════════════════════════════
// TIME-OF-DAY AMBIENCE — Very subtle background tint that shifts with the hour
// ═══════════════════════════════════════════════════════════════════════════════

function initAmbienceShift() {
    // Color stops throughout the day (hour → tint overlay)
    // Each is a subtle RGBA overlay blended on top of the theme
    const stops = [
        // hour, hue-rotate(deg), bg-tint-rgba, orb-opacity-multiplier
        { h: 0,  tint: 'rgba(15, 5, 40, 0.35)',    orbMul: 0.4 },   // midnight — deep cool
        { h: 4,  tint: 'rgba(10, 12, 35, 0.3)',   orbMul: 0.35 },  // pre-dawn — quiet blue
        { h: 5,  tint: 'rgba(20, 10, 45, 0.2)',   orbMul: 0.5 },   // 5AM — first hint
        { h: 6,  tint: 'rgba(35, 15, 20, 0.15)',  orbMul: 0.7 },   // dawn — warming
        { h: 8,  tint: 'rgba(0, 0, 0, 0)',        orbMul: 1.0 },   // morning — neutral
        { h: 12, tint: 'rgba(15, 8, 0, 0.08)',    orbMul: 1.0 },   // noon — warmth
        { h: 16, tint: 'rgba(25, 12, 0, 0.14)',   orbMul: 0.9 },   // afternoon — amber
        { h: 19, tint: 'rgba(40, 15, 5, 0.22)',   orbMul: 0.65 },  // sunset — warm
        { h: 21, tint: 'rgba(25, 8, 40, 0.28)',   orbMul: 0.5 },   // evening — purple
        { h: 23, tint: 'rgba(18, 8, 38, 0.32)',   orbMul: 0.4 },   // late night — deep
    ];

    function parseRGBA(str) {
        const m = str.match(/[\d.]+/g);
        return m ? m.map(Number) : [0, 0, 0, 0];
    }

    function lerpRGBA(a, b, t) {
        return `rgba(${Math.round(a[0] + (b[0] - a[0]) * t)}, ${Math.round(a[1] + (b[1] - a[1]) * t)}, ${Math.round(a[2] + (b[2] - a[2]) * t)}, ${(a[3] + (b[3] - a[3]) * t).toFixed(3)})`;
    }

    function lerp(a, b, t) { return a + (b - a) * t; }

    function update() {
        const now = new Date();
        const hour = now.getHours() + now.getMinutes() / 60;

        // Find surrounding stops
        let lo = stops[stops.length - 1];
        let hi = stops[0];
        for (let i = 0; i < stops.length - 1; i++) {
            if (hour >= stops[i].h && hour < stops[i + 1].h) {
                lo = stops[i];
                hi = stops[i + 1];
                break;
            }
        }

        // Handle wrap-around (23→0)
        let t;
        if (lo.h <= hi.h) {
            t = (hour - lo.h) / (hi.h - lo.h);
        } else {
            const range = (24 - lo.h) + hi.h;
            const elapsed = hour >= lo.h ? hour - lo.h : hour + 24 - lo.h;
            t = elapsed / range;
        }
        t = Math.max(0, Math.min(1, t));

        const tintA = parseRGBA(lo.tint);
        const tintB = parseRGBA(hi.tint);
        const tint = lerpRGBA(tintA, tintB, t);
        const orbMul = lerp(lo.orbMul, hi.orbMul, t);

        // Apply as overlay
        document.documentElement.style.setProperty('--ambience-tint', tint);
        document.documentElement.style.setProperty('--ambience-orb-mul', orbMul);
    }

    update();
    setInterval(update, 60000); // update every minute
}
