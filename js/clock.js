// ═══════════════════════════════════════════════════════════════════════════════
// CLOCK
// ═══════════════════════════════════════════════════════════════════════════════

function updateClock() {
    const now = new Date();
    let hours = now.getHours();
    const minutes = now.getMinutes().toString().padStart(2, '0');
    const period = hours >= 12 ? 'PM' : 'AM';

    hours = hours % 12 || 12;

    document.getElementById('clock').textContent = `${hours}:${minutes}`;
    document.getElementById('clock-period').textContent = period;
}

function initClock() {
    setInterval(updateClock, 1000);
    updateClock();
}
