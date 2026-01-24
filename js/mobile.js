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

    // Check for URL parameter to set initial tab
    const urlParams = new URLSearchParams(window.location.search);
    const tabParam = urlParams.get('tab');

    // Set initial state based on URL param or default to goals
    if (isMobileView()) {
        let initialTab = 'goals';
        if (tabParam === 'schedule') {
            initialTab = 'schedule';
        } else if (tabParam === 'sleep') {
            initialTab = 'sleep';
        }

        // Update tab active state
        tabs.forEach(t => {
            t.classList.toggle('active', t.dataset.tab === initialTab);
        });

        // Update panel visibility
        panels.forEach(panel => {
            panel.classList.toggle('active', panel.dataset.panel === initialTab);
        });

        // Clean up URL (remove the param so it doesn't persist on refresh)
        if (tabParam) {
            window.history.replaceState({}, '', window.location.pathname);
        }
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

function updateMobileSleepScore() {
    const container = document.getElementById('mobile-sleep-score');
    if (!container || !isMobileView()) return;

    const last14 = getLastNDaysLog(14);
    const score = calculateSleepScore(last14);
    const streak = calculateSleepStreak();

    if (!score) {
        container.innerHTML = `
            <div class="mobile-score-gauge">
                <span class="mobile-score-value">--</span>
                <span class="mobile-score-label">SCORE</span>
            </div>
            <div class="mobile-streak">
                <span class="mobile-streak-flame">🔥</span>
                <span class="mobile-streak-value">0</span>
            </div>
        `;
        return;
    }

    let colorClass = 'score-poor';
    if (score.total >= 85) colorClass = 'score-ideal';
    else if (score.total >= 70) colorClass = 'score-good';
    else if (score.total >= 50) colorClass = 'score-ok';

    container.innerHTML = `
        <div class="mobile-score-gauge ${colorClass}">
            <span class="mobile-score-value">${score.total}</span>
            <span class="mobile-score-label">SCORE</span>
        </div>
        <div class="mobile-streak">
            <span class="mobile-streak-flame ${streak.current > 0 ? 'active' : ''}">🔥</span>
            <span class="mobile-streak-value">${streak.current}</span>
        </div>
    `;
}

function updateMobileSleepStats() {
    const container = document.getElementById('mobile-sleep-extra-stats');
    if (!container || !isMobileView()) return;

    const days = getLastNDaysLog(7);
    const stats = calculatePeriodStats(days);
    const debt = calculateCumulativeSleepDebt(7);

    container.innerHTML = `
        <div class="mobile-extra-stat">
            <span class="mobile-extra-value">${stats.avgDuration ? stats.avgDuration.toFixed(1) + 'h' : '--'}</span>
            <span class="mobile-extra-label">AVG</span>
        </div>
        <div class="mobile-extra-stat">
            <span class="mobile-extra-value ${debt.total < 0 ? 'debt-negative' : 'debt-positive'}">${debt.total >= 0 ? '+' : ''}${debt.total.toFixed(1)}h</span>
            <span class="mobile-extra-label">DEBT</span>
        </div>
        <div class="mobile-extra-stat">
            <span class="mobile-extra-value">${stats.bestNight ? stats.bestNight.duration.toFixed(1) + 'h' : '--'}</span>
            <span class="mobile-extra-label">BEST</span>
        </div>
    `;
}

function updateMobileSleepInsight() {
    const container = document.getElementById('mobile-sleep-insight');
    if (!container || !isMobileView()) return;

    const insights = generateSleepInsights();

    if (insights.length === 0) {
        container.innerHTML = '';
        return;
    }

    const insight = insights[0];
    const icon = insight.type === 'success' ? '✓' : insight.type === 'warning' ? '!' : 'i';

    container.innerHTML = `
        <div class="mobile-insight mobile-insight-${insight.type}">
            <span class="mobile-insight-icon">${icon}</span>
            <span class="mobile-insight-text">${insight.text}</span>
        </div>
    `;
}

function updateMobileSleepPanel() {
    if (!isMobileView()) return;

    const settings = loadSleepSettings();
    const bedtime = calculateBedtime(settings);
    const msUntilBedtime = getTimeUntilBedtime(settings);
    const msIfSleepNow = getSleepIfNow(settings);
    const state = getSleepState(msUntilBedtime);
    const progress = getProgressPercent(settings);
    const qualityPercent = getQualityPercent(msIfSleepNow / 1000 / 60 / 60);

    // Update new mobile features
    updateMobileSleepScore();
    updateMobileSleepStats();
    updateMobileSleepInsight();

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

        // Remove readonly on focus (prevents iOS autofill)
        wakeInput.addEventListener('focus', () => wakeInput.removeAttribute('readonly'));

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

        // Remove readonly on focus (prevents iOS autofill)
        hoursInput.addEventListener('focus', () => hoursInput.removeAttribute('readonly'));

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

    // Mobile manual entry
    const mobileManualDate = document.getElementById('mobile-manual-date');
    const mobileManualBed = document.getElementById('mobile-manual-bed');
    const mobileManualWake = document.getElementById('mobile-manual-wake');
    const mobileAddBtn = document.getElementById('mobile-btn-add-sleep');

    if (mobileManualDate) {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        mobileManualDate.value = yesterday.toISOString().split('T')[0];
        mobileManualDate.max = new Date().toISOString().split('T')[0];

        // Remove readonly on focus (prevents iOS autofill)
        mobileManualDate.addEventListener('focus', () => mobileManualDate.removeAttribute('readonly'));
    }

    if (mobileManualBed) {
        mobileManualBed.addEventListener('focus', () => mobileManualBed.removeAttribute('readonly'));
    }

    if (mobileManualWake) {
        mobileManualWake.addEventListener('focus', () => mobileManualWake.removeAttribute('readonly'));
    }

    if (mobileAddBtn) {
        mobileAddBtn.addEventListener('click', () => {
            const date = mobileManualDate.value;
            const bedTime = mobileManualBed.value;
            const wakeTime = mobileManualWake.value;

            if (!date || !bedTime || !wakeTime) return;

            const bedDate = new Date(date);
            const [bedH, bedM] = bedTime.split(':').map(Number);
            bedDate.setHours(bedH, bedM, 0, 0);

            const wakeDate = new Date(date);
            const [wakeH, wakeM] = wakeTime.split(':').map(Number);
            wakeDate.setHours(wakeH, wakeM, 0, 0);

            if (wakeDate <= bedDate) {
                bedDate.setDate(bedDate.getDate() - 1);
            }

            const duration = (wakeDate - bedDate) / 1000 / 60 / 60;

            const log = loadSleepLog();
            const existingIdx = log.findIndex(e => e.date === date);
            const entry = {
                date: date,
                bedtime: bedDate.toISOString(),
                wakeTime: wakeDate.toISOString(),
                duration: duration
            };

            if (existingIdx >= 0) {
                log[existingIdx] = entry;
            } else {
                log.push(entry);
                log.sort((a, b) => new Date(a.date) - new Date(b.date));
            }

            saveSleepLog(log);
            updateMobileSleepPanel();
            renderMobileWeeklyChart();

            mobileAddBtn.textContent = '✓';
            mobileAddBtn.style.background = 'var(--check-green)';
            setTimeout(() => {
                mobileAddBtn.textContent = '+';
                mobileAddBtn.style.background = '';
                const nextDate = new Date(date);
                nextDate.setDate(nextDate.getDate() - 1);
                mobileManualDate.value = nextDate.toISOString().split('T')[0];
            }, 1000);
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
