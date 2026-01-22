// ═══════════════════════════════════════════════════════════════════════════════
// SLEEP - Comprehensive Sleep Dashboard
// ═══════════════════════════════════════════════════════════════════════════════

const SLEEP_STORAGE_KEY = '0500_sleep_settings';
const SLEEP_LOG_KEY = '0500_sleep_log';

function getDefaultBedtime() {
    const now = new Date();
    const currentHour = now.getHours();
    const currentMin = now.getMinutes();
    const currentMinutes = currentHour * 60 + currentMin;
    const nineThirtyPM = 21 * 60 + 30; // 21:30 = 9:30 PM

    if (currentMinutes >= nineThirtyPM) {
        // Past 9:30 PM - use current time
        const h = currentHour.toString().padStart(2, '0');
        const m = currentMin.toString().padStart(2, '0');
        return `${h}:${m}`;
    }
    // Before 9:30 PM - default to 9:30 PM
    return '21:30';
}

const SLEEP_DEFAULTS = {
    wakeHour: 5,
    wakeMinute: 0,
    targetSleepHours: 7.5,
    idealBedtimeStart: '21:30', // 9:30 PM
    idealBedtimeEnd: '22:30'    // 10:30 PM (1 hour window)
};

// ═══════════════════════════════════════════════════════════════════════════════
// DATA STORAGE
// ═══════════════════════════════════════════════════════════════════════════════

function loadSleepSettings() {
    const saved = localStorage.getItem(SLEEP_STORAGE_KEY);
    if (saved) {
        return { ...SLEEP_DEFAULTS, ...JSON.parse(saved) };
    }
    // First time - set dynamic bedtime based on current time
    const dynamicDefaults = { ...SLEEP_DEFAULTS };
    dynamicDefaults.idealBedtimeStart = getDefaultBedtime();
    // Set end time to 1 hour after start
    const [h, m] = dynamicDefaults.idealBedtimeStart.split(':').map(Number);
    let endH = h + 1;
    if (endH >= 24) endH -= 24;
    dynamicDefaults.idealBedtimeEnd = `${endH.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
    return dynamicDefaults;
}

function saveSleepSettings(settings) {
    localStorage.setItem(SLEEP_STORAGE_KEY, JSON.stringify(settings));
}

function loadSleepLog() {
    const saved = localStorage.getItem(SLEEP_LOG_KEY);
    if (saved) {
        return JSON.parse(saved);
    }
    return [];
}

function saveSleepLog(log) {
    localStorage.setItem(SLEEP_LOG_KEY, JSON.stringify(log));
}

// ═══════════════════════════════════════════════════════════════════════════════
// LOGGING FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

function logBedtime() {
    const now = new Date();
    // Add 20 minutes for fall asleep buffer
    const bedtime = new Date(now.getTime() + 20 * 60 * 1000);

    const log = loadSleepLog();

    // Check if there's an incomplete entry (bedtime without wake)
    const lastEntry = log[log.length - 1];
    if (lastEntry && !lastEntry.wakeTime) {
        // Update existing entry
        lastEntry.bedtime = bedtime.toISOString();
    } else {
        // Create new entry
        log.push({
            date: bedtime.toISOString().split('T')[0],
            bedtime: bedtime.toISOString(),
            wakeTime: null,
            duration: null
        });
    }

    saveSleepLog(log);
    updateSleepDashboard();

    // Update tracking status indicator
    if (typeof updateSleepTrackingStatus === 'function') {
        updateSleepTrackingStatus();
    }

    return bedtime;
}

function logWakeUp() {
    // Subtract 10 minutes (user typically presses ~10 min after waking)
    const now = new Date(Date.now() - 10 * 60 * 1000);
    const log = loadSleepLog();

    // Find the most recent entry with bedtime but no wake time
    const lastEntry = log[log.length - 1];

    if (lastEntry && lastEntry.bedtime && !lastEntry.wakeTime) {
        lastEntry.wakeTime = now.toISOString();
        const bedtime = new Date(lastEntry.bedtime);
        lastEntry.duration = (now - bedtime) / 1000 / 60 / 60; // hours
        saveSleepLog(log);
    } else {
        // No bedtime logged, estimate based on settings
        const settings = loadSleepSettings();
        let estimatedBedtime = new Date(now);
        estimatedBedtime.setHours(settings.wakeHour - settings.targetSleepHours);

        log.push({
            date: now.toISOString().split('T')[0],
            bedtime: estimatedBedtime.toISOString(),
            wakeTime: now.toISOString(),
            duration: settings.targetSleepHours
        });
        saveSleepLog(log);
    }

    updateSleepDashboard();

    // Update tracking status indicator
    if (typeof updateSleepTrackingStatus === 'function') {
        updateSleepTrackingStatus();
    }

    return now;
}

// ═══════════════════════════════════════════════════════════════════════════════
// CALCULATIONS
// ═══════════════════════════════════════════════════════════════════════════════

function getLastNDaysLog(n = 7) {
    const log = loadSleepLog();
    const now = new Date();
    const result = [];

    for (let i = n - 1; i >= 0; i--) {
        const date = new Date(now);
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split('T')[0];

        const entry = log.find(e => e.date === dateStr && e.duration);
        result.push({
            date: dateStr,
            dayName: date.toLocaleDateString('en-US', { weekday: 'short' }),
            duration: entry ? entry.duration : null,
            bedtime: entry ? new Date(entry.bedtime) : null
        });
    }

    return result;
}

function calculateSleepDebt(days = 7) {
    const settings = loadSleepSettings();
    const log = getLastNDaysLog(days);

    let totalTarget = 0;
    let totalActual = 0;

    log.forEach(day => {
        totalTarget += settings.targetSleepHours;
        if (day.duration) {
            totalActual += day.duration;
        }
    });

    // Only count days that have data
    const daysWithData = log.filter(d => d.duration).length;
    if (daysWithData === 0) return 0;

    // Adjust target to only count days with data
    const adjustedTarget = daysWithData * settings.targetSleepHours;

    return totalActual - adjustedTarget;
}

function calculateWeeklyAverage() {
    const log = getLastNDaysLog(7);
    const daysWithData = log.filter(d => d.duration);

    if (daysWithData.length === 0) return null;

    const total = daysWithData.reduce((sum, d) => sum + d.duration, 0);
    return total / daysWithData.length;
}

function getSleepColor(hours) {
    if (hours === null) return 'none';
    if (hours < 5) return 'poor';      // Red
    if (hours < 6) return 'low';       // Orange
    if (hours < 7) return 'ok';        // Yellow
    if (hours < 8) return 'good';      // Green
    return 'ideal';                     // Teal
}

function getQualityPercent(hours) {
    if (hours === null) return 0;
    if (hours <= 4) return 0;
    if (hours >= 9) return 100;
    return ((hours - 4) / 5) * 100;
}

function isBedtimeInIdealZone(bedtime, settings) {
    if (!bedtime) return null;

    const [startH, startM] = settings.idealBedtimeStart.split(':').map(Number);
    const [endH, endM] = settings.idealBedtimeEnd.split(':').map(Number);

    const bedHour = bedtime.getHours();
    const bedMin = bedtime.getMinutes();
    const bedMinutes = bedHour * 60 + bedMin;

    // Handle overnight (e.g., 21:00 to 23:00)
    let startMinutes = startH * 60 + startM;
    let endMinutes = endH * 60 + endM;

    // Adjust for overnight spans
    if (endMinutes < startMinutes) {
        endMinutes += 24 * 60;
        if (bedMinutes < startMinutes) {
            return (bedMinutes + 24 * 60) <= endMinutes;
        }
    }

    return bedMinutes >= startMinutes && bedMinutes <= endMinutes;
}

// ═══════════════════════════════════════════════════════════════════════════════
// TIME CALCULATIONS (for countdown)
// ═══════════════════════════════════════════════════════════════════════════════

function calculateBedtime(settings) {
    const { wakeHour, wakeMinute, targetSleepHours } = settings;

    const wakeMinutes = wakeHour * 60 + wakeMinute;
    const sleepMinutes = targetSleepHours * 60;
    let bedtimeMinutes = wakeMinutes - sleepMinutes;

    if (bedtimeMinutes < 0) {
        bedtimeMinutes += 24 * 60;
    }

    const bedtimeHour = Math.floor(bedtimeMinutes / 60);
    const bedtimeMin = Math.floor(bedtimeMinutes % 60);

    return { hour: bedtimeHour, minute: bedtimeMin };
}

function formatTime12Hour(hour, minute) {
    const period = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    const displayMin = minute.toString().padStart(2, '0');
    return `${displayHour}:${displayMin} ${period}`;
}

function formatCountdown(ms) {
    if (ms <= 0) return '0:00:00';

    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

function formatCountdownShort(ms) {
    if (ms <= 0) return '0:00';

    const totalSeconds = Math.floor(ms / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    if (hours > 0) {
        return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

function formatHoursMinutes(ms) {
    if (ms <= 0) return '0h 0m';

    const totalMinutes = Math.floor(ms / 1000 / 60);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;

    return `${hours}h ${minutes}m`;
}

function getTimeUntilBedtime(settings) {
    const bedtime = calculateBedtime(settings);
    const now = new Date();

    let bedtimeDate = new Date();
    bedtimeDate.setHours(bedtime.hour, bedtime.minute, 0, 0);

    if (bedtime.hour > settings.wakeHour || (bedtime.hour === settings.wakeHour && bedtime.minute > settings.wakeMinute)) {
        if (now.getHours() < settings.wakeHour || (now.getHours() === settings.wakeHour && now.getMinutes() < settings.wakeMinute)) {
            bedtimeDate.setDate(bedtimeDate.getDate() - 1);
        }
    } else {
        const wakeDate = new Date();
        wakeDate.setHours(settings.wakeHour, settings.wakeMinute, 0, 0);
        if (now > bedtimeDate && now < wakeDate) {
            // Past bedtime
        } else if (now >= wakeDate) {
            bedtimeDate.setDate(bedtimeDate.getDate() + 1);
        }
    }

    return bedtimeDate - now;
}

function getSleepIfNow(settings) {
    const now = new Date();

    let wakeDate = new Date();
    wakeDate.setHours(settings.wakeHour, settings.wakeMinute, 0, 0);

    if (now >= wakeDate) {
        wakeDate.setDate(wakeDate.getDate() + 1);
    }

    return wakeDate - now;
}

function getSleepState(msUntilBedtime) {
    const hoursUntil = msUntilBedtime / 1000 / 60 / 60;

    if (hoursUntil <= 0) {
        return 'urgent';
    } else if (hoursUntil <= 1) {
        return 'warning';
    } else if (hoursUntil <= 3) {
        return 'caution';
    } else {
        return 'relaxed';
    }
}

function getProgressPercent(settings) {
    const now = new Date();
    const bedtime = calculateBedtime(settings);

    let wakeDate = new Date();
    wakeDate.setHours(settings.wakeHour, settings.wakeMinute, 0, 0);

    let bedtimeDate = new Date();
    bedtimeDate.setHours(bedtime.hour, bedtime.minute, 0, 0);

    if (bedtime.hour < settings.wakeHour) {
        if (now.getHours() >= settings.wakeHour) {
            bedtimeDate.setDate(bedtimeDate.getDate() + 1);
        } else {
            wakeDate.setDate(wakeDate.getDate() - 1);
        }
    }

    const totalAwakeTime = bedtimeDate - wakeDate;
    const elapsedAwakeTime = now - wakeDate;

    const percent = Math.max(0, Math.min(100, (elapsedAwakeTime / totalAwakeTime) * 100));
    return percent;
}

// ═══════════════════════════════════════════════════════════════════════════════
// RENDER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

function renderWeeklyChart() {
    const container = document.getElementById('weekly-chart');
    if (!container) return;

    const settings = loadSleepSettings();
    const weekData = getLastNDaysLog(7);
    const maxHours = 10;

    let html = '<div class="weekly-bars">';

    weekData.forEach(day => {
        const height = day.duration ? (day.duration / maxHours) * 100 : 0;
        const color = getSleepColor(day.duration);

        html += `
            <div class="weekly-bar-container">
                <div class="weekly-bar color-${color}" style="height: ${height}%">
                    ${day.duration ? `<span class="bar-value">${day.duration.toFixed(1)}</span>` : ''}
                </div>
                <span class="bar-label">${day.dayName}</span>
            </div>
        `;
    });

    html += '</div>';

    // Target line
    const targetHeight = (settings.targetSleepHours / maxHours) * 100;
    html += `<div class="target-line" style="bottom: ${targetHeight}%"><span>${settings.targetSleepHours}h goal</span></div>`;

    container.innerHTML = html;
}

function renderBedtimeBand() {
    const container = document.getElementById('bedtime-band');
    if (!container) return;

    const settings = loadSleepSettings();
    const weekData = getLastNDaysLog(7);

    // Time range: 8 PM (20:00) to 1 AM (25:00 for math)
    const minHour = 20;
    const maxHour = 25; // 1 AM next day
    const range = maxHour - minHour;

    // Ideal zone
    const [startH, startM] = settings.idealBedtimeStart.split(':').map(Number);
    const [endH, endM] = settings.idealBedtimeEnd.split(':').map(Number);

    let idealStart = startH + startM / 60;
    let idealEnd = endH + endM / 60;
    if (idealEnd < idealStart) idealEnd += 24;

    const idealStartPercent = ((idealStart - minHour) / range) * 100;
    const idealEndPercent = ((idealEnd - minHour) / range) * 100;

    let html = `
        <div class="band-ideal-zone" style="top: ${idealStartPercent}%; height: ${idealEndPercent - idealStartPercent}%"></div>
        <div class="band-dots">
    `;

    weekData.forEach((day, i) => {
        if (day.bedtime) {
            let bedHour = day.bedtime.getHours() + day.bedtime.getMinutes() / 60;
            if (bedHour < minHour) bedHour += 24;

            const topPercent = ((bedHour - minHour) / range) * 100;
            const inZone = isBedtimeInIdealZone(day.bedtime, settings);

            html += `<div class="band-dot ${inZone ? 'in-zone' : 'out-zone'}" style="left: ${(i / 6) * 100}%; top: ${topPercent}%"></div>`;
        }
    });

    html += '</div>';

    // Y-axis labels
    html += `
        <div class="band-labels">
            <span class="band-label" style="top: 0%">8 PM</span>
            <span class="band-label" style="top: 40%">10 PM</span>
            <span class="band-label" style="top: 80%">12 AM</span>
        </div>
        <div class="band-x-labels">
            ${weekData.map(d => `<span>${d.dayName}</span>`).join('')}
        </div>
    `;

    container.innerHTML = html;
}

function renderSleepDebt() {
    const container = document.getElementById('sleep-debt');
    if (!container) return;

    const debt = calculateSleepDebt(7);
    const isPositive = debt >= 0;

    container.innerHTML = `
        <span class="debt-value ${isPositive ? 'positive' : 'negative'}">
            ${isPositive ? '+' : ''}${debt.toFixed(1)}h
        </span>
        <span class="debt-label">${isPositive ? 'ahead this week' : 'behind this week'}</span>
    `;
}

function renderWeeklyAverage() {
    const container = document.getElementById('weekly-avg-zone');
    if (!container) return;

    const avg = calculateWeeklyAverage();
    const percent = getQualityPercent(avg);

    container.innerHTML = `
        <div class="avg-zone-bar">
            <div class="avg-zone zone-poor">TERRIBLE</div>
            <div class="avg-zone zone-ok">LOW</div>
            <div class="avg-zone zone-good">SOLID</div>
            <div class="avg-zone zone-ideal">IDEAL</div>
        </div>
        <div class="avg-zone-marker" style="left: calc(${percent}% - 2px)"></div>
        <div class="avg-zone-value">${avg ? avg.toFixed(1) + 'h avg' : 'No data'}</div>
    `;
}

function updateSleepDashboard() {
    renderWeeklyChart();
    renderBedtimeBand();
    renderSleepDebt();
    renderWeeklyAverage();
}

function updateSleepDisplay() {
    const settings = loadSleepSettings();
    const bedtime = calculateBedtime(settings);
    const msUntilBedtime = getTimeUntilBedtime(settings);
    const msIfSleepNow = getSleepIfNow(settings);
    const state = getSleepState(msUntilBedtime);
    const progress = getProgressPercent(settings);
    const qualityPercent = getQualityPercent(msIfSleepNow / 1000 / 60 / 60);

    // Update chip
    const chipCountdown = document.getElementById('chip-rest-countdown');
    const chip = document.getElementById('chip-rest');
    if (chipCountdown) {
        chipCountdown.textContent = formatCountdownShort(Math.max(0, msUntilBedtime));
    }
    if (chip) {
        chip.classList.remove('state-relaxed', 'state-caution', 'state-warning', 'state-urgent');
        chip.classList.add(`state-${state}`);
    }

    // Update modal elements
    const countdownEl = document.getElementById('sleep-countdown');
    if (countdownEl) {
        countdownEl.textContent = formatCountdown(Math.max(0, msUntilBedtime));
    }

    const progressEl = document.getElementById('sleep-progress-fill');
    if (progressEl) {
        progressEl.style.width = `${progress}%`;
    }

    const bedtimeEl = document.getElementById('sleep-bedtime');
    if (bedtimeEl) {
        bedtimeEl.textContent = formatTime12Hour(bedtime.hour, bedtime.minute);
    }

    const sleepNowEl = document.getElementById('sleep-if-now');
    if (sleepNowEl) {
        sleepNowEl.textContent = formatHoursMinutes(msIfSleepNow);
    }

    const wakeDisplayEl = document.getElementById('sleep-wake-display');
    if (wakeDisplayEl) {
        wakeDisplayEl.textContent = formatTime12Hour(settings.wakeHour, settings.wakeMinute);
    }

    // Update sleep quality marker
    const qualityMarker = document.getElementById('sleep-quality-marker');
    if (qualityMarker) {
        qualityMarker.style.left = `calc(${qualityPercent}% - 2px)`;
    }

    // Update status text
    const statusEl = document.getElementById('sleep-status');
    if (statusEl) {
        if (state === 'urgent') {
            statusEl.textContent = 'YOU SHOULD BE SLEEPING';
        } else if (state === 'warning') {
            statusEl.textContent = 'GO TO BED SOON';
        } else if (state === 'caution') {
            statusEl.textContent = 'START WINDING DOWN';
        } else {
            statusEl.textContent = 'TIME UNTIL BED';
        }
    }

    // Update modal state
    const modal = document.getElementById('sleep-modal');
    const modalContent = modal?.querySelector('.modal-sleep');
    if (modalContent) {
        modalContent.classList.remove('state-relaxed', 'state-caution', 'state-warning', 'state-urgent');
        modalContent.classList.add(`state-${state}`);
    }

    // Check for pending bedtime
    const log = loadSleepLog();
    const lastEntry = log[log.length - 1];
    const pendingBedtime = lastEntry && lastEntry.bedtime && !lastEntry.wakeTime;

    const goingToBedBtn = document.getElementById('btn-going-to-bed');
    const wokeUpBtn = document.getElementById('btn-woke-up');

    if (goingToBedBtn && wokeUpBtn) {
        if (pendingBedtime) {
            goingToBedBtn.classList.add('disabled');
            wokeUpBtn.classList.remove('disabled');
        } else {
            goingToBedBtn.classList.remove('disabled');
            wokeUpBtn.classList.add('disabled');
        }
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// MODAL FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

function openSleepModal() {
    const modal = document.getElementById('sleep-modal');
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
    updateSleepDashboard();
}

function closeSleepModal() {
    const modal = document.getElementById('sleep-modal');
    modal.classList.remove('active');
    document.body.style.overflow = '';
}

// ═══════════════════════════════════════════════════════════════════════════════
// INITIALIZATION
// ═══════════════════════════════════════════════════════════════════════════════

function initSleepCard() {
    const chip = document.getElementById('chip-rest');
    const modal = document.getElementById('sleep-modal');
    const backdrop = modal.querySelector('.modal-backdrop');
    const closeBtn = document.getElementById('sleep-modal-close');
    const wakeInput = document.getElementById('sleep-wake-input');
    const hoursInput = document.getElementById('sleep-hours-input');
    const goingToBedBtn = document.getElementById('btn-going-to-bed');
    const wokeUpBtn = document.getElementById('btn-woke-up');

    // Load settings into inputs
    const settings = loadSleepSettings();
    if (wakeInput) {
        const h = settings.wakeHour.toString().padStart(2, '0');
        const m = settings.wakeMinute.toString().padStart(2, '0');
        wakeInput.value = `${h}:${m}`;
    }
    if (hoursInput) {
        hoursInput.value = settings.targetSleepHours;
    }

    // Open modal on chip click
    chip.addEventListener('click', openSleepModal);

    // Close modal
    closeBtn.addEventListener('click', closeSleepModal);
    backdrop.addEventListener('click', closeSleepModal);

    // Close on Escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && modal.classList.contains('active')) {
            closeSleepModal();
        }
    });

    // Quick action buttons
    if (goingToBedBtn) {
        goingToBedBtn.addEventListener('click', () => {
            if (!goingToBedBtn.classList.contains('disabled')) {
                const bedtime = logBedtime();
                goingToBedBtn.classList.add('disabled');
                wokeUpBtn.classList.remove('disabled');

                // Show feedback
                goingToBedBtn.textContent = `Logged ${formatTime12Hour(bedtime.getHours(), bedtime.getMinutes())}`;
                setTimeout(() => {
                    goingToBedBtn.innerHTML = '<span class="btn-icon">🌙</span> Going to bed';
                }, 2000);
            }
        });
    }

    if (wokeUpBtn) {
        wokeUpBtn.addEventListener('click', () => {
            if (!wokeUpBtn.classList.contains('disabled')) {
                const wakeTime = logWakeUp();
                wokeUpBtn.classList.add('disabled');
                goingToBedBtn.classList.remove('disabled');

                // Show feedback
                wokeUpBtn.textContent = `Logged ${formatTime12Hour(wakeTime.getHours(), wakeTime.getMinutes())}`;
                setTimeout(() => {
                    wokeUpBtn.innerHTML = '<span class="btn-icon">☀️</span> Just woke up';
                }, 2000);
            }
        });
    }

    // Save settings on change
    if (wakeInput) {
        wakeInput.addEventListener('change', () => {
            const [h, m] = wakeInput.value.split(':').map(Number);
            const settings = loadSleepSettings();
            settings.wakeHour = h;
            settings.wakeMinute = m;
            saveSleepSettings(settings);
            updateSleepDisplay();
        });
    }

    if (hoursInput) {
        hoursInput.addEventListener('change', () => {
            const settings = loadSleepSettings();
            settings.targetSleepHours = parseFloat(hoursInput.value) || 7.5;
            saveSleepSettings(settings);
            updateSleepDisplay();
        });
    }

    // Initial update
    updateSleepDisplay();
    updateSleepDashboard();

    // Update every second
    setInterval(updateSleepDisplay, 1000);
}
