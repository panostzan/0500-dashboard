// ═══════════════════════════════════════════════════════════════════════════════
// CLOCK
// ═══════════════════════════════════════════════════════════════════════════════

function getDayProgress() {
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

function updateClock() {
    const now = new Date();
    let hours = now.getHours();
    const minutes = now.getMinutes().toString().padStart(2, '0');
    const period = hours >= 12 ? 'PM' : 'AM';

    hours = hours % 12 || 12;

    document.getElementById('clock').textContent = `${hours}:${minutes}`;
    document.getElementById('clock-period').textContent = period;

    // Update progress bar
    const progress = getDayProgress() * 100;
    document.getElementById('clock-progress').style.setProperty('--progress', `${progress}%`);
}

function initClock() {
    // Run boot animation on first load
    if (typeof shouldRunBootAnimation === 'function' && shouldRunBootAnimation()) {
        const clockElement = document.getElementById('clock');
        if (clockElement) {
            const now = new Date();
            let hours = now.getHours();
            const minutes = now.getMinutes().toString().padStart(2, '0');
            hours = hours % 12 || 12;
            const targetTime = `${hours}:${minutes}`;

            // Animate clock ticker on boot
            animateClockTicker(clockElement, targetTime, 1200);
        }
    } else {
        updateClock();
    }

    setInterval(updateClock, 1000);
}
