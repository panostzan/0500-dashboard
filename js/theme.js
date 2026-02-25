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
}
