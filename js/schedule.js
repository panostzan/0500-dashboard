// ═══════════════════════════════════════════════════════════════════════════════
// SCHEDULE - Notebook Style with cloud sync
// ═══════════════════════════════════════════════════════════════════════════════

let scheduleCache = null;

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
                >
                <div class="schedule-row-divider"></div>
                <input
                    type="text"
                    class="schedule-activity-input"
                    placeholder="..."
                    value="${entry.activity}"
                    data-field="activity"
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
}

function attachScheduleListeners() {
    const rows = document.querySelectorAll('.schedule-row');

    rows.forEach(row => {
        const inputs = row.querySelectorAll('input');

        inputs.forEach(input => {
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

    await saveScheduleEntries(entries);
}

async function initSchedule() {
    await renderSchedule();

    // Re-render when user changes
    window.addEventListener('userChanged', async () => {
        scheduleCache = null;
        await renderSchedule();
    });
}
