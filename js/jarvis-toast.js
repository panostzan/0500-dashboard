// ═══════════════════════════════════════════════════════════════════════════════
// JARVIS — Toast Nudge System
// Time-aware proactive nudges, one at a time, 24h dedup
// ═══════════════════════════════════════════════════════════════════════════════

const TOAST_SHOWN_KEY = '0500_toast_shown';
const TOAST_AUTO_DISMISS_MS = 8000;
const TOAST_CHECK_INTERVAL_MS = 5 * 60 * 1000; // 5 min
const TOAST_FIRST_CHECK_MS = 60 * 1000; // 60s after init

// ─── Dedup ───

function getToastShown() {
    try { return JSON.parse(localStorage.getItem(TOAST_SHOWN_KEY) || '{}'); }
    catch { return {}; }
}

function markToastShown(id) {
    const shown = getToastShown();
    shown[id] = new Date().toISOString();
    safeSetItem(TOAST_SHOWN_KEY, JSON.stringify(shown));
}

function wasToastShownToday(id) {
    const shown = getToastShown();
    if (!shown[id]) return false;
    const shownDate = new Date(shown[id]).toDateString();
    return shownDate === new Date().toDateString();
}

// ─── Nudge Generators ───
// Each returns { id, text } or null

function nudgeEveningBedtime() {
    const h = new Date().getHours();
    if (h < 21) return null;

    const log = typeof getLastNDaysLog === 'function' ? getLastNDaysLog(14) : [];
    const withBedtime = log.filter(d => d.bedtime);
    if (withBedtime.length < 3) {
        const msgs = [
            "It's past 9. Maybe start winding down.",
            "Evening check-in. How much longer are you going?",
            "The clock says it's time to start shutting down.",
        ];
        return { id: 'evening-bedtime', text: msgs[Math.floor(Math.random() * msgs.length)] };
    }

    // Calculate average bedtime
    const bedtimeMinutes = withBedtime.map(d => {
        const dt = new Date(d.bedtime);
        let mins = dt.getHours() * 60 + dt.getMinutes();
        if (mins < 360) mins += 1440; // After midnight → treat as late
        return mins;
    });
    const avgMins = bedtimeMinutes.reduce((a, b) => a + b, 0) / bedtimeMinutes.length;
    const avgH = Math.floor((avgMins % 1440) / 60);
    const avgM = Math.round(avgMins % 60);
    const avgStr = `${avgH > 12 ? avgH - 12 : avgH}:${String(avgM).padStart(2, '0')}${avgH >= 12 ? 'p' : 'a'}`;

    return { id: 'evening-bedtime', text: `Avg bedtime: ${avgStr}. Maybe start the shutdown sequence.` };
}

function nudgeAfternoonGoals() {
    const h = new Date().getHours();
    if (h < 13 || h > 20) return null;

    try {
        const goals = JSON.parse(localStorage.getItem('0500_goals') || '{}');
        const daily = goals.daily || [];
        if (daily.length === 0) return null;

        const unchecked = daily.filter(g => !g.checked).length;
        if (unchecked <= 2 || unchecked === daily.length) return null; // All done or none done (early in day)

        const hour12 = h > 12 ? `${h - 12}pm` : `${h}pm`;
        return { id: 'afternoon-goals', text: `${unchecked} of ${daily.length} goals unchecked and it's ${hour12}. Just saying.` };
    } catch { return null; }
}

function nudgeMorningNoSchedule() {
    const h = new Date().getHours();
    if (h < 5 || h > 10) return null;

    try {
        const schedule = JSON.parse(localStorage.getItem('0500_schedule_entries') || '[]');
        const hasContent = schedule.some(e => (e.activity || '').trim().length > 0);
        if (hasContent) return null;
        const msgs = [
            "No schedule yet. Are we improvising?",
            "Morning and no plan. Bold strategy.",
            "Empty schedule. Time to give today some structure.",
        ];
        return { id: 'morning-schedule', text: msgs[Math.floor(Math.random() * msgs.length)] };
    } catch { return null; }
}

function nudgeStaleContact() {
    try {
        const people = JSON.parse(localStorage.getItem('0500_people') || '[]');
        if (people.length === 0) return null;

        const stale = people.filter(p => {
            if (!p.lastContact || !p.name) return false;
            const days = Math.floor((Date.now() - new Date(p.lastContact).getTime()) / (1000 * 60 * 60 * 24));
            return days > 14;
        });
        if (stale.length === 0) return null;

        stale.sort((a, b) => new Date(a.lastContact) - new Date(b.lastContact));
        const top = stale[0];
        const days = Math.floor((Date.now() - new Date(top.lastContact).getTime()) / (1000 * 60 * 60 * 24));

        return { id: 'stale-contact', text: `Haven't talked to ${top.name} in ${days} days.` };
    } catch { return null; }
}

function nudgeNoSleepLog() {
    const h = new Date().getHours();
    if (h < 8) return null;

    try {
        const log = typeof loadSleepLog === 'function' ? loadSleepLog() : [];
        if (log.length === 0) return null;

        const today = new Date().toISOString().slice(0, 10);
        const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
        const hasRecent = log.some(e => e.date === today || e.date === yesterday);
        if (hasRecent) return null;

        const msgs = [
            "No sleep logged. Can't track what you don't log.",
            "Missing sleep data. I work better with data.",
            "No sleep entry for last night. Log it while you still remember.",
        ];
        return { id: 'no-sleep-log', text: msgs[Math.floor(Math.random() * msgs.length)] };
    } catch { return null; }
}

function nudgeReadingReminder() {
    const h = new Date().getHours();
    if (h < 18 || h > 23) return null; // Evening only

    try {
        const books = JSON.parse(localStorage.getItem('0500_books') || '[]');
        const reading = books.filter(b => (b.status || '').toLowerCase() === 'reading');
        if (reading.length === 0) return null;

        const title = reading[0].title;
        const msgs = [
            `Still reading "${title}"? Tonight might be a good night to pick it back up.`,
            `"${title}" is waiting. Even 20 pages counts.`,
            `Reading reminder: "${title}". A chapter before bed beats a scroll session.`,
        ];
        return { id: 'reading-reminder', text: msgs[Math.floor(Math.random() * msgs.length)] };
    } catch { return null; }
}

function nudgeGoalStreakCongrats() {
    try {
        const history = typeof DataService !== 'undefined' ? DataService.loadDailyGoalHistory() : [];
        if (history.length < 5) return null;

        let streak = 0;
        for (let i = history.length - 1; i >= 0; i--) {
            const pct = history[i].total > 0 ? history[i].completed / history[i].total : 0;
            if (pct >= 0.8) streak++;
            else break;
        }
        if (streak < 5) return null;

        const msgs = [
            `${streak}-day goal streak. You're on a roll.`,
            `${streak} days in a row above 80%. That's discipline.`,
            `Streak check: ${streak} days. Don't let today be the one that breaks it.`,
        ];
        return { id: 'goal-streak', text: msgs[Math.floor(Math.random() * msgs.length)] };
    } catch { return null; }
}

function nudgeWeekendReflection() {
    const now = new Date();
    const day = now.getDay();
    const h = now.getHours();
    // Sunday 10am-2pm only
    if (day !== 0 || h < 10 || h > 14) return null;

    const msgs = [
        "Sunday thought: how do you want next week to be different?",
        "Weekend check-in. What's the one thing you want to nail this week?",
        "Slow morning? Good time to set up the week ahead.",
    ];
    return { id: 'weekend-reflection', text: msgs[Math.floor(Math.random() * msgs.length)] };
}

// ─── Toast Rendering ───

let activeToastTimeout = null;

function showJarvisToast(nudge) {
    const container = document.getElementById('jarvis-toast-container');
    if (!container) return;

    // Only one toast at a time
    container.innerHTML = '';
    if (activeToastTimeout) clearTimeout(activeToastTimeout);

    const toast = document.createElement('div');
    toast.className = 'jarvis-toast';
    toast.innerHTML = `
        <div class="jarvis-toast-label">JARVIS</div>
        <div class="jarvis-toast-text">${nudge.text}</div>
        <button class="jarvis-toast-dismiss" title="Dismiss">&times;</button>
    `;

    // Click toast → open JARVIS card
    toast.addEventListener('click', (e) => {
        if (e.target.closest('.jarvis-toast-dismiss')) return;
        dismissToast(toast);
        const chip = document.getElementById('chip-intel');
        const card = document.getElementById('intel-card');
        if (chip && card && !card.classList.contains('open')) {
            chip.click();
        }
    });

    // Dismiss button
    const dismissBtn = toast.querySelector('.jarvis-toast-dismiss');
    dismissBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        dismissToast(toast);
    });

    container.appendChild(toast);
    markToastShown(nudge.id);

    // Auto-dismiss
    activeToastTimeout = setTimeout(() => dismissToast(toast), TOAST_AUTO_DISMISS_MS);
}

function dismissToast(toast) {
    if (!toast || !toast.parentNode) return;
    toast.classList.add('jarvis-toast-out');
    if (activeToastTimeout) { clearTimeout(activeToastTimeout); activeToastTimeout = null; }
    setTimeout(() => { if (toast.parentNode) toast.parentNode.removeChild(toast); }, 400);
}

// ─── Checker ───

function checkJarvisNudges() {
    // Skip if timer overlay is active
    const overlay = document.getElementById('timer-overlay');
    if (overlay && overlay.classList.contains('active')) return;

    const generators = [
        nudgeEveningBedtime,
        nudgeAfternoonGoals,
        nudgeMorningNoSchedule,
        nudgeStaleContact,
        nudgeNoSleepLog,
        nudgeReadingReminder,
        nudgeGoalStreakCongrats,
        nudgeWeekendReflection
    ];

    for (const gen of generators) {
        try {
            const nudge = gen();
            if (nudge && !wasToastShownToday(nudge.id)) {
                showJarvisToast(nudge);
                return; // First match wins
            }
        } catch (e) {
            console.warn('[Jarvis Toast] Nudge error:', e);
        }
    }
}

// ─── Init ───

function initJarvisToast() {
    // First check after 60s
    setTimeout(() => {
        checkJarvisNudges();
        // Then every 5 min
        setInterval(checkJarvisNudges, TOAST_CHECK_INTERVAL_MS);
    }, TOAST_FIRST_CHECK_MS);
}
