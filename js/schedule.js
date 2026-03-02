// ═══════════════════════════════════════════════════════════════════════════════
// SCHEDULE - Notebook Style with cloud sync
// ═══════════════════════════════════════════════════════════════════════════════

const SCHEDULE_DATE_KEY = '0500_schedule_date';
let scheduleCache = null;
let scheduleSaveTimeout = null;

function getTodayDateString() {
    return new Date().toISOString().split('T')[0];
}

function checkAndResetSchedule() {
    const lastDate = localStorage.getItem(SCHEDULE_DATE_KEY);
    const today = getTodayDateString();

    if (lastDate && lastDate !== today) {
        // New day - reset the schedule
        scheduleCache = null;
        return true; // Indicates reset is needed
    }

    // Update the date
    localStorage.setItem(SCHEDULE_DATE_KEY, today);
    return false;
}

async function clearScheduleFull() {
    // Cancel any pending debounced save to prevent stale data overwriting
    clearTimeout(scheduleSaveTimeout);
    scheduleSaveTimeout = null;

    // Reset to a fresh 20 rows (removes any extra rows added by user)
    const clearedEntries = Array(20).fill(null).map(() => ({ time: '', activity: '' }));

    scheduleCache = clearedEntries;
    await DataService.saveSchedule(clearedEntries);
    localStorage.setItem(SCHEDULE_DATE_KEY, getTodayDateString());

    return clearedEntries;
}

async function loadScheduleEntries() {
    if (!scheduleCache) {
        scheduleCache = await DataService.loadSchedule();
    }
    return scheduleCache;
}

async function saveScheduleEntries(entries) {
    scheduleCache = entries;
    await DataService.saveSchedule(entries);
}

async function renderSchedule() {
    const container = document.getElementById('schedule-scroll');
    const entries = await loadScheduleEntries();

    let html = '<div class="schedule-notebook">';

    entries.forEach((entry, index) => {
        html += `
            <div class="schedule-row" data-index="${index}">
                <input
                    type="text"
                    class="schedule-time-input"
                    placeholder="--:--"
                    value="${entry.time}"
                    data-field="time"
                    maxlength="7"
                    autocomplete="off"
                    data-form-type="other"
                    aria-label="Time for row ${index + 1}"
                    readonly
                >
                <div class="schedule-row-divider"></div>
                <input
                    type="text"
                    class="schedule-activity-input"
                    placeholder="..."
                    value="${entry.activity}"
                    data-field="activity"
                    autocomplete="off"
                    data-form-type="other"
                    aria-label="Activity for row ${index + 1}"
                    readonly
                >
            </div>
        `;
    });

    // Add new row button
    html += `
        <button class="schedule-add-row" id="add-schedule-row">+ add row</button>
    </div>`;

    container.innerHTML = html;

    // Attach event listeners
    attachScheduleListeners();

    // Render time rail
    renderTimeRail();
}

function attachScheduleListeners() {
    const rows = document.querySelectorAll('.schedule-row');

    rows.forEach(row => {
        const inputs = row.querySelectorAll('input');

        inputs.forEach(input => {
            // Remove readonly on focus, restore on blur (prevents iOS autofill popup)
            input.addEventListener('focus', () => {
                input.removeAttribute('readonly');
            });
            input.addEventListener('blur', () => {
                input.setAttribute('readonly', '');
            }, { capture: true });

            // Save on input change
            input.addEventListener('input', () => {
                saveCurrentSchedule();
            });

            // Auto-format time input
            if (input.dataset.field === 'time') {
                input.addEventListener('blur', () => {
                    input.value = formatTimeInput(input.value);
                    saveCurrentSchedule();
                });
            }

            // Handle Enter key: time → activity → next time → next activity...
            input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();

                    if (input.dataset.field === 'time') {
                        // Time field → move to activity in same row
                        row.querySelector('[data-field="activity"]')?.focus();
                    } else {
                        // Activity field → move to time in next row
                        const nextRow = row.nextElementSibling;
                        if (nextRow && nextRow.classList.contains('schedule-row')) {
                            nextRow.querySelector('[data-field="time"]')?.focus();
                        }
                    }
                }
            });
        });
    });

    // Add row button
    const addBtn = document.getElementById('add-schedule-row');
    if (addBtn) {
        addBtn.addEventListener('click', async () => {
            // Cancel any pending debounced save to prevent stale data overwriting
            clearTimeout(scheduleSaveTimeout);
            scheduleSaveTimeout = null;

            const entries = await loadScheduleEntries();
            entries.push({ time: '', activity: '' });
            await saveScheduleEntries(entries);
            renderSchedule();
            // Focus the new row
            const rows = document.querySelectorAll('.schedule-row');
            const lastRow = rows[rows.length - 1];
            lastRow?.querySelector('[data-field="time"]')?.focus();
        });
    }
}

function formatTimeInput(value) {
    if (!value.trim()) return '';

    // Remove all non-numeric characters except colon
    let cleaned = value.replace(/[^\d:aApPmM\s]/g, '');

    // Try to parse various formats
    let match;

    // Format: "5" or "05" -> "5:00 AM"
    if ((match = cleaned.match(/^(\d{1,2})$/))) {
        let hour = parseInt(match[1]);
        if (hour >= 1 && hour <= 12) {
            return `${hour}:00`;
        }
    }

    // Format: "530" -> "5:30"
    if ((match = cleaned.match(/^(\d{1,2})(\d{2})$/))) {
        let hour = parseInt(match[1]);
        let min = match[2];
        if (hour >= 1 && hour <= 12) {
            return `${hour}:${min}`;
        }
    }

    // Format: "5:30" or "05:30"
    if ((match = cleaned.match(/^(\d{1,2}):(\d{2})$/))) {
        let hour = parseInt(match[1]);
        let min = match[2];
        return `${hour}:${min}`;
    }

    // Format with AM/PM: "5pm", "5:30pm", "5:30 pm"
    if ((match = cleaned.match(/^(\d{1,2}):?(\d{2})?\s*(am|pm|a|p)$/i))) {
        let hour = parseInt(match[1]);
        let min = match[2] || '00';
        let period = match[3].toLowerCase().startsWith('p') ? 'PM' : 'AM';
        return `${hour}:${min} ${period}`;
    }

    // Return original if no match
    return value;
}

async function saveCurrentSchedule() {
    const rows = document.querySelectorAll('.schedule-row');
    const entries = [];

    rows.forEach(row => {
        const time = row.querySelector('[data-field="time"]')?.value || '';
        const activity = row.querySelector('[data-field="activity"]')?.value || '';
        entries.push({ time, activity });
    });

    // Debounce saves to avoid too many API calls
    clearTimeout(scheduleSaveTimeout);
    scheduleSaveTimeout = setTimeout(async () => {
        await saveScheduleEntries(entries);
        renderTimeRail();
    }, 500);
}

// Flush pending debounced save immediately (called before sign-out / page unload)
async function flushScheduleSave() {
    if (scheduleSaveTimeout) {
        clearTimeout(scheduleSaveTimeout);
        scheduleSaveTimeout = null;
        const rows = document.querySelectorAll('.schedule-row');
        const entries = [];
        rows.forEach(row => {
            const time = row.querySelector('[data-field="time"]')?.value || '';
            const activity = row.querySelector('[data-field="activity"]')?.value || '';
            entries.push({ time, activity });
        });
        await saveScheduleEntries(entries);
    }
}

async function initSchedule() {
    // Check if we need to show new day banner
    const isNewDay = checkAndResetSchedule();

    if (!isNewDay) {
        // First time - set today's date
        if (!localStorage.getItem(SCHEDULE_DATE_KEY)) {
            localStorage.setItem(SCHEDULE_DATE_KEY, getTodayDateString());
        }
    }

    await renderSchedule();

    // Show new day banner if it's a new day
    if (isNewDay) {
        showNewDayBanner();
    }

    // Init clear schedule button + popover
    initClearScheduleButton();

    // Re-render when user changes
    window.addEventListener('userChanged', async () => {
        scheduleCache = null;
        await renderSchedule();
    });

    // Schedule midnight reset check
    scheduleMidnightReset();

    // Flush pending save on page unload to prevent data loss
    window.addEventListener('beforeunload', () => {
        if (scheduleSaveTimeout) {
            clearTimeout(scheduleSaveTimeout);
            // Use sendBeacon or sync XHR for last-chance save
            const rows = document.querySelectorAll('.schedule-row');
            const entries = [];
            rows.forEach(row => {
                entries.push({
                    time: row.querySelector('[data-field="time"]')?.value || '',
                    activity: row.querySelector('[data-field="activity"]')?.value || ''
                });
            });
            scheduleCache = entries;
            // Save to localStorage synchronously as last resort
            safeSetItem('0500_schedule_entries', JSON.stringify(entries));
        }
    });
}

let newDayBannerListenersAttached = false;

function showNewDayBanner() {
    const banner = document.getElementById('new-day-banner');
    if (!banner) return;

    banner.style.display = '';

    // Show yesterday's missed goals summary
    if (typeof populateMissedGoals === 'function') populateMissedGoals();

    // Only attach listeners once to prevent duplicate handlers
    if (!newDayBannerListenersAttached) {
        newDayBannerListenersAttached = true;

        document.getElementById('new-day-clear-btn')?.addEventListener('click', async () => {
            // Snapshot daily goals before clearing for the new day
            if (typeof snapshotDailyGoals === 'function') await snapshotDailyGoals();
            await clearScheduleFull();
            await renderSchedule();
            banner.style.display = 'none';
        });

        document.getElementById('new-day-keep-btn')?.addEventListener('click', async () => {
            // Snapshot daily goals even if keeping schedule
            if (typeof snapshotDailyGoals === 'function') await snapshotDailyGoals();
            localStorage.setItem(SCHEDULE_DATE_KEY, getTodayDateString());
            banner.style.display = 'none';
        });
    }
}

function initClearScheduleButton() {
    const btn = document.getElementById('clear-schedule-btn');
    const popover = document.getElementById('clear-schedule-popover');
    const confirmBtn = document.getElementById('clear-confirm-btn');
    const cancelBtn = document.getElementById('clear-cancel-btn');

    if (!btn || !popover) return;

    btn.addEventListener('click', (e) => {
        e.stopPropagation();
        popover.classList.toggle('open');
    });

    cancelBtn?.addEventListener('click', (e) => {
        e.stopPropagation();
        popover.classList.remove('open');
    });

    confirmBtn?.addEventListener('click', async (e) => {
        e.stopPropagation();
        popover.classList.remove('open');
        await clearScheduleWithAnimation();
    });

    // Close popover on outside click
    document.addEventListener('click', (e) => {
        if (!btn.contains(e.target) && !popover.contains(e.target)) {
            popover.classList.remove('open');
        }
    });
}

async function clearScheduleWithAnimation() {
    // Cancel any pending debounced save to prevent stale data overwriting during animation
    clearTimeout(scheduleSaveTimeout);
    scheduleSaveTimeout = null;

    const rows = document.querySelectorAll('.schedule-row');

    // Animate rows out
    rows.forEach((row, i) => {
        setTimeout(() => {
            row.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
            row.style.opacity = '0';
            row.style.transform = 'translateX(20px)';
        }, i * 50);
    });

    // After animation, clear data and re-render
    const delay = rows.length * 50 + 300;
    setTimeout(async () => {
        await clearScheduleFull();
        await renderSchedule();
    }, delay);
}

function parseTimeToMinutes(str) {
    if (!str || !str.trim()) return null;
    const cleaned = str.trim();

    // Match "H:MM AM/PM" or "H:MM" formats
    const match = cleaned.match(/^(\d{1,2}):(\d{2})\s*(am|pm)?$/i);
    if (!match) return null;

    let hours = parseInt(match[1]);
    const minutes = parseInt(match[2]);
    const period = match[3];

    if (period) {
        const isPM = period.toLowerCase() === 'pm';
        if (isPM && hours !== 12) hours += 12;
        if (!isPM && hours === 12) hours = 0;
    }

    return hours * 60 + minutes;
}

function renderTimeRail() {
    const rows = document.querySelectorAll('.schedule-row');
    if (!rows.length) return;

    // Remove existing rails
    rows.forEach(row => {
        const existing = row.querySelector('.time-rail');
        if (existing) existing.remove();
    });

    // Parse times and compute durations between adjacent rows
    const times = [];
    rows.forEach(row => {
        const timeInput = row.querySelector('[data-field="time"]');
        times.push(parseTimeToMinutes(timeInput?.value || ''));
    });

    // Find max duration for scaling
    const durations = [];
    for (let i = 0; i < times.length; i++) {
        if (times[i] !== null) {
            // Find next row with a time
            let nextTime = null;
            for (let j = i + 1; j < times.length; j++) {
                if (times[j] !== null) {
                    nextTime = times[j];
                    break;
                }
            }
            if (nextTime !== null && nextTime > times[i]) {
                durations[i] = nextTime - times[i];
            } else {
                durations[i] = null;
            }
        } else {
            durations[i] = null;
        }
    }

    const maxDuration = Math.max(...durations.filter(d => d !== null), 1);

    // Add rail elements
    rows.forEach((row, i) => {
        if (durations[i] !== null) {
            const rail = document.createElement('div');
            rail.className = 'time-rail';
            // Opacity scaled by duration (short = dimmer, long = brighter)
            const opacity = 0.25 + 0.75 * (durations[i] / maxDuration);
            rail.style.opacity = opacity.toFixed(2);
            row.prepend(rail);
        }
    });
}

function scheduleMidnightReset() {
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);

    const msUntilMidnight = tomorrow - now;

    // Set timeout for midnight
    setTimeout(() => {
        showNewDayBanner();

        // Schedule next midnight reset
        scheduleMidnightReset();
    }, msUntilMidnight);
}
