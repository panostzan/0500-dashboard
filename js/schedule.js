// ═══════════════════════════════════════════════════════════════════════════════
// SCHEDULE
// ═══════════════════════════════════════════════════════════════════════════════

function renderSchedule() {
    const gridContainer = document.getElementById('time-grid');
    const eventsContainer = document.getElementById('schedule-events');

    const startHour = 5;
    const endHour = 24;
    let gridHTML = '';

    for (let hour = startHour; hour <= endHour; hour++) {
        for (let quarter = 0; quarter < 4; quarter++) {
            if (hour === endHour && quarter > 0) break;

            const showLabel = quarter === 0;
            const displayHour = hour % 12 || 12;
            const period = hour >= 12 ? 'PM' : 'AM';

            gridHTML += `
                <div class="time-slot">
                    <span class="time-label">${showLabel ? `${displayHour} ${period}` : ''}</span>
                    <div class="time-line" style="opacity: ${showLabel ? 0.18 : 0.06}"></div>
                </div>
            `;
        }
    }

    gridContainer.innerHTML = gridHTML;

    const slotHeight = 20;

    eventsContainer.innerHTML = CONFIG.schedule.map(event => {
        const [hours, minutes] = event.time.split(':').map(Number);
        const startSlot = (hours - startHour) * 4 + (minutes / 15);
        const durationSlots = event.duration / 15;

        const top = startSlot * slotHeight;
        const height = durationSlots * slotHeight - 4;

        return `
            <div class="schedule-event ${event.type}" style="top: ${top}px; height: ${height}px;">
                ${event.title}
            </div>
        `;
    }).join('');

    // Scroll to current time
    setTimeout(() => {
        const now = new Date();
        const currentHour = now.getHours();
        const currentMinute = now.getMinutes();

        if (currentHour >= startHour) {
            const currentSlot = (currentHour - startHour) * 4 + Math.floor(currentMinute / 15);
            const scrollTo = Math.max(0, (currentSlot - 4) * slotHeight);
            document.getElementById('schedule-scroll').scrollTop = scrollTo;
        }
    }, 100);
}

function initSchedule() {
    renderSchedule();
}
