// ═══════════════════════════════════════════════════════════════════════════════
// MOBILE - Tab Navigation & Mobile-Specific Features
// ═══════════════════════════════════════════════════════════════════════════════

// Check if we're on mobile
function isMobileView() {
    return window.innerWidth <= 768;
}

// ═══════════════════════════════════════════════════════════════════════════════
// TAB NAVIGATION
// ═══════════════════════════════════════════════════════════════════════════════

function initMobileNav() {
    const tabs = document.querySelectorAll('.mobile-tab');
    const panels = document.querySelectorAll('.mobile-panel');

    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const targetPanel = tab.dataset.tab;

            // Update active tab
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');

            // Show target panel, hide others
            panels.forEach(panel => {
                if (panel.dataset.panel === targetPanel) {
                    panel.classList.add('active');
                } else {
                    panel.classList.remove('active');
                }
            });

            // Scroll to top of content
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });
    });

    // Set initial state - goals active by default
    if (isMobileView()) {
        panels.forEach(panel => {
            panel.classList.toggle('active', panel.dataset.panel === 'goals');
        });
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// MOBILE TIMER BUTTONS
// ═══════════════════════════════════════════════════════════════════════════════

function initMobileTimerButtons() {
    const buttons = document.querySelectorAll('.mobile-timer-btn');

    buttons.forEach(btn => {
        btn.addEventListener('click', () => {
            const minutes = parseInt(btn.dataset.minutes);
            if (typeof startTimer === 'function') {
                startTimer(minutes);
            }
        });
    });
}

// ═══════════════════════════════════════════════════════════════════════════════
// MOBILE SLEEP PANEL
// ═══════════════════════════════════════════════════════════════════════════════

function updateMobileSleepPanel() {
    if (!isMobileView()) return;

    const settings = loadSleepSettings();
    const bedtime = calculateBedtime(settings);
    const msUntilBedtime = getTimeUntilBedtime(settings);
    const msIfSleepNow = getSleepIfNow(settings);
    const state = getSleepState(msUntilBedtime);
    const progress = getProgressPercent(settings);
    const qualityPercent = getQualityPercent(msIfSleepNow / 1000 / 60 / 60);

    // Update countdown
    const countdown = document.getElementById('mobile-sleep-countdown');
    if (countdown) {
        countdown.textContent = formatCountdown(Math.max(0, msUntilBedtime));
    }

    // Update status text
    const status = document.getElementById('mobile-sleep-status');
    if (status) {
        if (state === 'urgent') {
            status.textContent = 'YOU SHOULD BE SLEEPING';
        } else if (state === 'warning') {
            status.textContent = 'GO TO BED SOON';
        } else if (state === 'caution') {
            status.textContent = 'START WINDING DOWN';
        } else {
            status.textContent = 'TIME UNTIL BED';
        }
    }

    // Update progress bar
    const progressFill = document.getElementById('mobile-sleep-progress-fill');
    if (progressFill) {
        progressFill.style.width = `${progress}%`;
    }

    // Update stats
    const bedtimeEl = document.getElementById('mobile-sleep-bedtime');
    if (bedtimeEl) {
        bedtimeEl.textContent = formatTime12Hour(bedtime.hour, bedtime.minute);
    }

    const ifNowEl = document.getElementById('mobile-sleep-if-now');
    if (ifNowEl) {
        ifNowEl.textContent = formatHoursMinutes(msIfSleepNow);
    }

    const wakeEl = document.getElementById('mobile-sleep-wake');
    if (wakeEl) {
        wakeEl.textContent = formatTime12Hour(settings.wakeHour, settings.wakeMinute);
    }

    // Update quality marker
    const marker = document.getElementById('mobile-quality-marker');
    if (marker) {
        marker.style.left = `${qualityPercent}%`;
    }

    // Update panel state color
    const panel = document.getElementById('mobile-sleep-panel');
    if (panel) {
        panel.classList.remove('state-relaxed', 'state-caution', 'state-warning', 'state-urgent');
        panel.classList.add(`state-${state}`);
    }

    // Update button states
    const log = loadSleepLog();
    const lastEntry = log[log.length - 1];
    const pendingBedtime = lastEntry && lastEntry.bedtime && !lastEntry.wakeTime;

    const bedBtn = document.getElementById('mobile-btn-bed');
    const wakeBtn = document.getElementById('mobile-btn-wake');

    if (bedBtn && wakeBtn) {
        bedBtn.classList.toggle('disabled', pendingBedtime);
        wakeBtn.classList.toggle('disabled', !pendingBedtime);
    }
}

function renderMobileWeeklyChart() {
    const container = document.getElementById('mobile-weekly-chart');
    if (!container || !isMobileView()) return;

    const weekData = getLastNDaysLog(7);
    const maxHours = 10;

    let html = '<div class="mobile-bars">';

    weekData.forEach(day => {
        const height = day.duration ? (day.duration / maxHours) * 100 : 5;
        const color = getSleepColor(day.duration);

        html += `
            <div class="mobile-bar-wrap">
                <div class="mobile-bar color-${color}" style="height: ${height}%">
                    ${day.duration ? `<span>${day.duration.toFixed(1)}</span>` : ''}
                </div>
                <span class="mobile-bar-label">${day.dayName.charAt(0)}</span>
            </div>
        `;
    });

    html += '</div>';
    container.innerHTML = html;
}

function initMobileSleepPanel() {
    // Quick action buttons
    const bedBtn = document.getElementById('mobile-btn-bed');
    const wakeBtn = document.getElementById('mobile-btn-wake');

    if (bedBtn) {
        bedBtn.addEventListener('click', () => {
            if (!bedBtn.classList.contains('disabled')) {
                logBedtime();
                updateMobileSleepPanel();
            }
        });
    }

    if (wakeBtn) {
        wakeBtn.addEventListener('click', () => {
            if (!wakeBtn.classList.contains('disabled')) {
                logWakeUp();
                updateMobileSleepPanel();
                renderMobileWeeklyChart();
            }
        });
    }

    // Settings inputs
    const wakeInput = document.getElementById('mobile-wake-input');
    const hoursInput = document.getElementById('mobile-hours-input');

    if (wakeInput) {
        const settings = loadSleepSettings();
        wakeInput.value = `${settings.wakeHour.toString().padStart(2, '0')}:${settings.wakeMinute.toString().padStart(2, '0')}`;

        wakeInput.addEventListener('change', () => {
            const [h, m] = wakeInput.value.split(':').map(Number);
            const settings = loadSleepSettings();
            settings.wakeHour = h;
            settings.wakeMinute = m;
            saveSleepSettings(settings);
            updateMobileSleepPanel();

            // Sync with modal input
            const modalInput = document.getElementById('sleep-wake-input');
            if (modalInput) modalInput.value = wakeInput.value;
        });
    }

    if (hoursInput) {
        const settings = loadSleepSettings();
        hoursInput.value = settings.targetSleepHours;

        hoursInput.addEventListener('change', () => {
            const settings = loadSleepSettings();
            settings.targetSleepHours = parseFloat(hoursInput.value) || 7.5;
            saveSleepSettings(settings);
            updateMobileSleepPanel();

            // Sync with modal input
            const modalInput = document.getElementById('sleep-hours-input');
            if (modalInput) modalInput.value = hoursInput.value;
        });
    }

    // Export/Import buttons
    const exportBtn = document.getElementById('mobile-export');
    const importBtn = document.getElementById('mobile-import');

    if (exportBtn) {
        exportBtn.addEventListener('click', exportSleepData);
    }

    if (importBtn) {
        importBtn.addEventListener('click', () => {
            importSleepData();
            setTimeout(() => {
                updateMobileSleepPanel();
                renderMobileWeeklyChart();
            }, 500);
        });
    }

    // Initial render
    updateMobileSleepPanel();
    renderMobileWeeklyChart();

    // Update every second
    setInterval(updateMobileSleepPanel, 1000);
}

// ═══════════════════════════════════════════════════════════════════════════════
// INITIALIZATION
// ═══════════════════════════════════════════════════════════════════════════════

function initMobile() {
    initMobileNav();
    initMobileTimerButtons();
    initMobileSleepPanel();

    // Handle resize
    window.addEventListener('resize', () => {
        const panels = document.querySelectorAll('.mobile-panel');
        if (isMobileView()) {
            // Ensure one panel is active
            const hasActive = [...panels].some(p => p.classList.contains('active'));
            if (!hasActive) {
                document.querySelector('[data-panel="goals"]')?.classList.add('active');
            }
        }
    });
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', initMobile);
