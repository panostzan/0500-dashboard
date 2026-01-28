// ═══════════════════════════════════════════════════════════════════════════════
// SLEEP PANEL - Inline Aurora Theme Panel for Mobile
// ═══════════════════════════════════════════════════════════════════════════════

let sleepPanelStatsPeriod = 7;
let sleepPanelHeatmapMonth = new Date().getMonth();
let sleepPanelHeatmapYear = new Date().getFullYear();
let sleepPanelInitialized = false;
let sleepPanelUpdateInterval = null;
let sleepPanelLog = []; // Local cache for sleep panel

// Load sleep data directly from DataService (bypasses sleep.js cache)
async function loadSleepPanelData() {
    if (typeof DataService !== 'undefined' && typeof isSignedIn === 'function' && isSignedIn()) {
        try {
            const cloudLog = await DataService.loadSleepLog();
            sleepPanelLog = cloudLog.map(e => ({
                date: e.date,
                bedtime: e.bedtime,
                wakeTime: e.wakeTime,
                duration: e.hours
            }));
        } catch (err) {
            console.error('Sleep panel data load error:', err);
            sleepPanelLog = [];
        }
    } else {
        // Fall back to localStorage
        const saved = localStorage.getItem('0500_sleep_log');
        sleepPanelLog = saved ? JSON.parse(saved) : [];
    }
    return sleepPanelLog;
}

// Get last N days from panel's local cache
function getSleepPanelDaysLog(n = 7) {
    const now = new Date();
    const result = [];

    for (let i = n - 1; i >= 0; i--) {
        const date = new Date(now);
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split('T')[0];
        const dayName = date.toLocaleDateString('en-US', { weekday: 'short' });

        const entry = sleepPanelLog.find(e => e.date === dateStr && e.duration);
        result.push({
            date: dateStr,
            dayName: dayName,
            duration: entry ? entry.duration : null,
            bedtime: entry ? entry.bedtime : null,
            wakeTime: entry ? entry.wakeTime : null
        });
    }
    return result;
}

// Calculate sleep score from log data
function calculateSleepScoreFromLog(days) {
    const daysWithData = days.filter(d => d.duration);
    if (daysWithData.length < 3) return null;

    const targetHours = 7.5;
    let totalScore = 0;

    daysWithData.forEach(day => {
        const diff = Math.abs(day.duration - targetHours);
        const dayScore = Math.max(0, 100 - diff * 15);
        totalScore += dayScore;
    });

    return { total: Math.round(totalScore / daysWithData.length) };
}

// Calculate streak from panel's local cache
function calculateSleepPanelStreak() {
    let current = 0;
    const today = new Date();

    for (let i = 0; i < 30; i++) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split('T')[0];

        const entry = sleepPanelLog.find(e => e.date === dateStr && e.duration && e.duration >= 7);
        if (entry) {
            current++;
        } else if (i > 0) {
            break;
        }
    }

    return { current };
}

// Calculate weekly average from panel's local cache
function calculateSleepPanelAverage() {
    const last7 = getSleepPanelDaysLog(7);
    const daysWithData = last7.filter(d => d.duration);
    if (daysWithData.length === 0) return null;

    const total = daysWithData.reduce((sum, d) => sum + d.duration, 0);
    return total / daysWithData.length;
}

// ═══════════════════════════════════════════════════════════════════════════════
// RENDER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

function renderSleepPanelScore() {
    const scoreNumber = document.getElementById('sleep-score-number');
    const scoreRing = document.getElementById('sleep-score-ring-fill');
    const streakCount = document.getElementById('sleep-streak-count');
    const streakIcon = document.getElementById('sleep-streak-icon');
    const avgHours = document.getElementById('sleep-avg-hours');

    if (!scoreNumber) return;

    const last14 = getSleepPanelDaysLog(14);
    const score = calculateSleepScoreFromLog(last14);
    const streak = calculateSleepPanelStreak();
    const avg = calculateSleepPanelAverage();

    if (score) {
        scoreNumber.textContent = score.total;
        const dashArray = (score.total / 100) * 490;
        scoreRing.setAttribute('stroke-dasharray', `${dashArray} 490`);
    } else {
        scoreNumber.textContent = '--';
        scoreRing.setAttribute('stroke-dasharray', '0 490');
    }

    streakCount.textContent = streak.current;
    streakIcon.style.opacity = streak.current > 0 ? '1' : '0.3';
    avgHours.textContent = avg ? `${avg.toFixed(1)}h` : '--';
}

function renderSleepPanelCountdown() {
    const settings = loadSleepSettings();
    const bedtime = calculateBedtime(settings);
    const msUntilBedtime = getTimeUntilBedtime(settings);
    const msIfSleepNow = getSleepIfNow(settings);
    const state = getSleepState(msUntilBedtime);
    const qualityPercent = getQualityPercent(msIfSleepNow / 1000 / 60 / 60);

    const countdownTime = document.getElementById('sleep-panel-countdown-time');
    const countdownStatus = document.getElementById('sleep-panel-countdown-status');
    const bedtimeDisplay = document.getElementById('sleep-panel-bedtime');
    const ifNowDisplay = document.getElementById('sleep-panel-if-now');
    const wakeDisplay = document.getElementById('sleep-panel-wake');
    const qualityMarker = document.getElementById('sleep-panel-quality-marker');

    if (!countdownTime) return;

    countdownTime.textContent = formatCountdown(Math.max(0, msUntilBedtime));

    if (state === 'urgent') {
        countdownStatus.textContent = 'YOU SHOULD BE SLEEPING';
    } else if (state === 'warning') {
        countdownStatus.textContent = 'GO TO BED SOON';
    } else if (state === 'caution') {
        countdownStatus.textContent = 'START WINDING DOWN';
    } else {
        countdownStatus.textContent = 'TIME UNTIL BED';
    }

    bedtimeDisplay.textContent = formatSleepPanelTime(bedtime.hour, bedtime.minute);
    ifNowDisplay.textContent = formatHoursMinutes(msIfSleepNow);
    wakeDisplay.textContent = formatSleepPanelTime(settings.wakeHour, settings.wakeMinute);
    qualityMarker.style.marginLeft = `calc(${qualityPercent}% - 2px)`;
}

function formatSleepPanelTime(hour, minute) {
    const period = hour >= 12 ? 'p' : 'a';
    const displayHour = hour % 12 || 12;
    const displayMin = minute.toString().padStart(2, '0');
    return `${displayHour}:${displayMin}${period}`;
}

function renderSleepPanelMiniBars() {
    const container = document.getElementById('sleep-panel-mini-bars');
    if (!container) return;

    const weekData = getSleepPanelDaysLog(7);
    const maxHours = 10;
    const today = new Date().toISOString().split('T')[0];

    let html = '';
    weekData.forEach(day => {
        const height = day.duration ? Math.max(8, (day.duration / maxHours) * 70) : 8;
        const colorClass = getSleepPanelBarColor(day.duration);
        const isToday = day.date === today;

        html += `
            <div class="sleep-mini-bar-group">
                <div class="sleep-mini-bar ${colorClass}" style="height: ${height}px;"></div>
                <span class="sleep-mini-bar-label ${isToday ? 'today' : ''}">${day.dayName.charAt(0)}</span>
            </div>
        `;
    });

    container.innerHTML = html;
}

function getSleepPanelBarColor(hours) {
    if (hours === null) return 'none';
    if (hours < 5) return 'poor';
    if (hours < 7) return 'ok';
    return 'good';
}

function renderSleepPanelDebt() {
    const container = document.getElementById('sleep-panel-debt');
    if (!container) return;

    const settings = loadSleepSettings();
    const last14 = getSleepPanelDaysLog(14);
    const daysWithData = last14.filter(d => d.duration);

    if (daysWithData.length < 3) {
        container.style.display = 'none';
        return;
    }
    container.style.display = 'block';

    let totalDebt = 0;
    daysWithData.forEach(day => {
        totalDebt += day.duration - settings.targetSleepHours;
    });

    const minDebt = Math.min(-30, Math.floor(totalDebt / 5) * 5 - 5);
    const maxDebt = 10;
    const displayDebt = Math.max(minDebt, Math.min(maxDebt, totalDebt));

    const range = maxDebt - minDebt;
    const zeroPoint = Math.abs(minDebt) / range;

    let fillPercent;
    let fillClass;
    if (displayDebt < 0) {
        fillPercent = (Math.abs(displayDebt) / Math.abs(minDebt)) * zeroPoint * 100;
        fillClass = 'negative';
    } else {
        fillPercent = (displayDebt / maxDebt) * (1 - zeroPoint) * 100;
        fillClass = 'positive';
    }

    let numberClass = 'neutral';
    if (totalDebt <= -3) numberClass = 'negative';
    else if (totalDebt >= 1) numberClass = 'positive';

    const recoveryDays = totalDebt < 0 ? Math.ceil(Math.abs(totalDebt) / 0.5) : 0;
    const debtStr = (totalDebt >= 0 ? '+' : '') + totalDebt.toFixed(1) + 'h';

    let html = `
        <div class="sleep-section-header">SLEEP DEBT</div>
        <div class="sleep-debt-value">
            <div class="sleep-debt-number ${numberClass}">${debtStr}</div>
            <div class="sleep-debt-label">Last ${daysWithData.length} Days</div>
        </div>
        <div class="sleep-debt-track">
            <div class="sleep-debt-fill ${fillClass}" style="width: ${fillPercent}%;"></div>
            <div class="sleep-debt-center"></div>
        </div>
        <div class="sleep-debt-labels">
            <span>${minDebt}h</span>
            <span>0</span>
            <span>+${maxDebt}h</span>
        </div>
    `;

    if (totalDebt < -1) {
        html += `
            <div class="sleep-debt-recovery">
                <div class="sleep-debt-recovery-text">
                    At 30min extra/night: <strong class="negative">${recoveryDays} days</strong> to recover
                </div>
            </div>
        `;
    } else if (totalDebt >= 1) {
        html += `
            <div class="sleep-debt-recovery">
                <div class="sleep-debt-recovery-text">
                    <strong class="positive">Surplus</strong> - sleep is supporting recovery
                </div>
            </div>
        `;
    }

    container.innerHTML = html;
}

function renderSleepPanelStats() {
    const container = document.getElementById('sleep-panel-stats-grid');
    if (!container) return;

    const days = getSleepPanelDaysLog(sleepPanelStatsPeriod);
    const stats = calculatePeriodStats(days);

    container.innerHTML = `
        <div class="sleep-stat-item">
            <div class="sleep-stat-item-value">${stats.avgDuration ? stats.avgDuration.toFixed(1) + 'h' : '--'}</div>
            <div class="sleep-stat-item-label">Avg Duration</div>
        </div>
        <div class="sleep-stat-item">
            <div class="sleep-stat-item-value">${stats.avgBedtime ? formatSleepPanelTime(stats.avgBedtime.hour, stats.avgBedtime.minute) : '--'}</div>
            <div class="sleep-stat-item-label">Avg Bedtime</div>
        </div>
        <div class="sleep-stat-item">
            <div class="sleep-stat-item-value">${stats.avgWakeTime ? formatSleepPanelTime(stats.avgWakeTime.hour, stats.avgWakeTime.minute) : '--'}</div>
            <div class="sleep-stat-item-label">Avg Wake</div>
        </div>
        <div class="sleep-stat-item">
            <div class="sleep-stat-item-value">${stats.nightsLogged}</div>
            <div class="sleep-stat-item-label">Nights Logged</div>
        </div>
    `;
}

function renderSleepPanelHeatmap() {
    const container = document.getElementById('sleep-panel-heatmap-grid');
    const monthLabel = document.getElementById('sleep-panel-heatmap-month');
    if (!container) return;

    const monthData = getMonthLog(sleepPanelHeatmapYear, sleepPanelHeatmapMonth);
    const monthName = new Date(sleepPanelHeatmapYear, sleepPanelHeatmapMonth).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    monthLabel.textContent = monthName;

    const firstDayOfWeek = new Date(sleepPanelHeatmapYear, sleepPanelHeatmapMonth, 1).getDay();
    const today = new Date().toISOString().split('T')[0];

    let html = '';

    for (let i = 0; i < firstDayOfWeek; i++) {
        html += '<div class="sleep-heatmap-cell empty"></div>';
    }

    monthData.forEach(day => {
        const color = getSleepColor(day.duration);
        const isToday = day.date === today;
        const isFuture = new Date(day.date) > new Date();

        html += `
            <div class="sleep-heatmap-cell ${color} ${isToday ? 'today' : ''} ${isFuture ? 'future' : ''}"
                 data-date="${day.date}"
                 title="${day.duration ? day.duration.toFixed(1) + 'h' : 'No data'}">
                ${day.day}
            </div>
        `;
    });

    container.innerHTML = html;

    container.querySelectorAll('.sleep-heatmap-cell:not(.empty):not(.future)').forEach(cell => {
        cell.addEventListener('click', () => {
            openSleepTimelineModal(cell.dataset.date);
        });
    });
}

function updateSleepPanelButtonStates() {
    const lastEntry = sleepPanelLog[sleepPanelLog.length - 1];
    const pendingBedtime = lastEntry && lastEntry.bedtime && !lastEntry.wakeTime;

    const bedBtn = document.getElementById('sleep-btn-bed');
    const wakeBtn = document.getElementById('sleep-btn-wake');

    if (bedBtn && wakeBtn) {
        bedBtn.classList.toggle('disabled', pendingBedtime);
        wakeBtn.classList.toggle('disabled', !pendingBedtime);
    }
}

function renderSleepPanelAccount() {
    const container = document.getElementById('sleep-account-content');
    if (!container) return;

    if (typeof isSignedIn === 'function' && isSignedIn()) {
        const email = currentUser?.email || 'Signed in';
        container.innerHTML = `
            <div class="sleep-account-info">
                <span class="sleep-account-email">${email}</span>
                <span class="sleep-account-status">Syncing to cloud</span>
            </div>
            <button class="sleep-account-btn" id="sleep-signout-btn">Sign Out</button>
        `;
        document.getElementById('sleep-signout-btn')?.addEventListener('click', async () => {
            if (typeof signOut === 'function') {
                await signOut();
                renderSleepPanelAccount();
            }
        });
    } else {
        container.innerHTML = `
            <div class="sleep-account-info">
                <span class="sleep-account-status">Using local storage only</span>
            </div>
            <button class="sleep-account-btn" id="sleep-signin-btn">Sign In to Sync</button>
        `;
        document.getElementById('sleep-signin-btn')?.addEventListener('click', () => {
            if (typeof showAuthModal === 'function') {
                showAuthModal();
            }
        });
    }
}

function refreshSleepPanel() {
    renderSleepPanelScore();
    renderSleepPanelCountdown();
    renderSleepPanelMiniBars();
    renderSleepPanelDebt();
    renderSleepPanelStats();
    renderSleepPanelHeatmap();
    updateSleepPanelButtonStates();
    renderSleepPanelAccount();
}

// ═══════════════════════════════════════════════════════════════════════════════
// TIMELINE MODAL
// ═══════════════════════════════════════════════════════════════════════════════

const SLEEP_TIMELINE_START = 21;
const SLEEP_TIMELINE_END = 34;
const SLEEP_TIMELINE_SPAN = SLEEP_TIMELINE_END - SLEEP_TIMELINE_START;

let sleepTimelineDate = null;
let sleepTimelineBedHour = 22;
let sleepTimelineBedMin = 0;
let sleepTimelineWakeHour = 6;
let sleepTimelineWakeMin = 0;
let sleepTimelineIsDragging = null;

function sleepTimeToPercent(hour, min) {
    let totalHours = hour + min / 60;
    if (totalHours < SLEEP_TIMELINE_START) totalHours += 24;
    return ((totalHours - SLEEP_TIMELINE_START) / SLEEP_TIMELINE_SPAN) * 100;
}

function sleepPercentToTime(percent) {
    let totalHours = SLEEP_TIMELINE_START + (percent / 100) * SLEEP_TIMELINE_SPAN;
    const totalMinutes = Math.round(totalHours * 60 / 15) * 15;
    let hour = Math.floor(totalMinutes / 60);
    const min = totalMinutes % 60;
    if (hour >= 24) hour -= 24;
    return { hour, min };
}

function updateSleepTimelineDisplay() {
    const bedPercent = sleepTimeToPercent(sleepTimelineBedHour, sleepTimelineBedMin);
    const wakePercent = sleepTimeToPercent(sleepTimelineWakeHour, sleepTimelineWakeMin);

    const handleLeft = document.getElementById('sleep-handle-left');
    const handleRight = document.getElementById('sleep-handle-right');
    const range = document.getElementById('sleep-timeline-range');

    if (!handleLeft) return;

    handleLeft.style.left = `calc(${bedPercent}% - 14px)`;
    handleRight.style.left = `calc(${wakePercent}% - 14px)`;
    range.style.left = `${bedPercent}%`;
    range.style.right = `${100 - wakePercent}%`;

    document.getElementById('sleep-timeline-bed-display').textContent = formatSleepPanelTime(sleepTimelineBedHour, sleepTimelineBedMin);
    document.getElementById('sleep-timeline-wake-display').textContent = formatSleepPanelTime(sleepTimelineWakeHour, sleepTimelineWakeMin);

    let bedTotal = sleepTimelineBedHour + sleepTimelineBedMin / 60;
    let wakeTotal = sleepTimelineWakeHour + sleepTimelineWakeMin / 60;
    if (wakeTotal < bedTotal) wakeTotal += 24;
    const duration = wakeTotal - bedTotal;
    const hours = Math.floor(duration);
    const mins = Math.round((duration - hours) * 60);
    document.getElementById('sleep-timeline-duration').textContent = `${hours}h ${mins}m`;
}

function openSleepTimelineModal(dateStr) {
    sleepTimelineDate = dateStr;
    const date = new Date(dateStr + 'T12:00:00');
    const dayName = date.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
    document.getElementById('sleep-timeline-date').textContent = dayName;

    const existing = sleepPanelLog.find(e => e.date === dateStr);

    if (existing && existing.bedtime && existing.wakeTime) {
        const bed = new Date(existing.bedtime);
        const wake = new Date(existing.wakeTime);
        sleepTimelineBedHour = bed.getHours();
        sleepTimelineBedMin = bed.getMinutes();
        sleepTimelineWakeHour = wake.getHours();
        sleepTimelineWakeMin = wake.getMinutes();
        document.getElementById('sleep-timeline-delete').disabled = false;
    } else {
        sleepTimelineBedHour = 22;
        sleepTimelineBedMin = 0;
        sleepTimelineWakeHour = 6;
        sleepTimelineWakeMin = 0;
        document.getElementById('sleep-timeline-delete').disabled = true;
    }

    updateSleepTimelineDisplay();
    document.getElementById('sleep-timeline-overlay').classList.add('active');
}

function closeSleepTimelineModal() {
    document.getElementById('sleep-timeline-overlay').classList.remove('active');
}

function saveSleepTimelineEntry() {
    const bedDate = new Date(sleepTimelineDate + 'T00:00:00');
    bedDate.setHours(sleepTimelineBedHour, sleepTimelineBedMin, 0, 0);
    if (sleepTimelineBedHour >= 12) {
        bedDate.setDate(bedDate.getDate() - 1);
    }

    const wakeDate = new Date(sleepTimelineDate + 'T00:00:00');
    wakeDate.setHours(sleepTimelineWakeHour, sleepTimelineWakeMin, 0, 0);

    const duration = (wakeDate - bedDate) / 1000 / 60 / 60;

    const log = loadSleepLog();
    const existingIdx = log.findIndex(e => e.date === sleepTimelineDate);
    const entry = {
        date: sleepTimelineDate,
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
    closeSleepTimelineModal();
    refreshSleepPanel();
}

function deleteSleepTimelineEntry() {
    const log = loadSleepLog();
    const idx = log.findIndex(e => e.date === sleepTimelineDate);
    if (idx >= 0) {
        log.splice(idx, 1);
        saveSleepLog(log);
    }
    closeSleepTimelineModal();
    refreshSleepPanel();
}

function initSleepTimelineModal() {
    const overlay = document.getElementById('sleep-timeline-overlay');
    const track = document.getElementById('sleep-timeline-track');
    const handleLeft = document.getElementById('sleep-handle-left');
    const handleRight = document.getElementById('sleep-handle-right');

    if (!overlay || !track) return;

    document.getElementById('sleep-timeline-close').addEventListener('click', closeSleepTimelineModal);
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) closeSleepTimelineModal();
    });

    document.getElementById('sleep-timeline-save').addEventListener('click', saveSleepTimelineEntry);
    document.getElementById('sleep-timeline-delete').addEventListener('click', deleteSleepTimelineEntry);

    function getPercentFromEvent(e) {
        const rect = track.getBoundingClientRect();
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        let percent = ((clientX - rect.left) / rect.width) * 100;
        return Math.max(0, Math.min(100, percent));
    }

    function startDrag(handle) {
        return function(e) {
            e.preventDefault();
            sleepTimelineIsDragging = handle;
            document.body.style.cursor = 'grabbing';
        };
    }

    function onDrag(e) {
        if (!sleepTimelineIsDragging) return;
        e.preventDefault();

        const percent = getPercentFromEvent(e);
        const time = sleepPercentToTime(percent);

        if (sleepTimelineIsDragging === 'left') {
            const wakePercent = sleepTimeToPercent(sleepTimelineWakeHour, sleepTimelineWakeMin);
            if (percent < wakePercent - 5) {
                sleepTimelineBedHour = time.hour;
                sleepTimelineBedMin = time.min;
            }
        } else {
            const bedPercent = sleepTimeToPercent(sleepTimelineBedHour, sleepTimelineBedMin);
            if (percent > bedPercent + 5) {
                sleepTimelineWakeHour = time.hour;
                sleepTimelineWakeMin = time.min;
            }
        }

        updateSleepTimelineDisplay();
    }

    function endDrag() {
        sleepTimelineIsDragging = null;
        document.body.style.cursor = '';
    }

    handleLeft.addEventListener('mousedown', startDrag('left'));
    handleLeft.addEventListener('touchstart', startDrag('left'), { passive: false });
    handleRight.addEventListener('mousedown', startDrag('right'));
    handleRight.addEventListener('touchstart', startDrag('right'), { passive: false });
    document.addEventListener('mousemove', onDrag);
    document.addEventListener('mouseup', endDrag);
    document.addEventListener('touchmove', onDrag, { passive: false });
    document.addEventListener('touchend', endDrag);
}

// ═══════════════════════════════════════════════════════════════════════════════
// INITIALIZATION
// ═══════════════════════════════════════════════════════════════════════════════

async function initSleepPanel() {
    if (sleepPanelInitialized) return;

    // Load data
    await loadSleepPanelData();
    await loadSleepSettingsAsync();

    // Load settings into inputs
    const settings = loadSleepSettings();
    const wakeInput = document.getElementById('sleep-panel-wake-input');
    const hoursInput = document.getElementById('sleep-panel-hours-input');

    if (wakeInput) {
        wakeInput.value = `${settings.wakeHour.toString().padStart(2, '0')}:${settings.wakeMinute.toString().padStart(2, '0')}`;
    }
    if (hoursInput) {
        hoursInput.value = settings.targetSleepHours;
    }

    // Initialize timeline modal
    initSleepTimelineModal();

    // Initial render
    refreshSleepPanel();

    // Event listeners
    const bedBtn = document.getElementById('sleep-btn-bed');
    const wakeBtn = document.getElementById('sleep-btn-wake');

    if (bedBtn) {
        bedBtn.addEventListener('click', async function() {
            if (!this.classList.contains('disabled')) {
                const bedtime = await logBedtime();
                this.innerHTML = `Logged ${formatSleepPanelTime(bedtime.getHours(), bedtime.getMinutes())}`;
                setTimeout(() => {
                    this.innerHTML = '<span class="sleep-emoji">&#127769;</span> Going to bed';
                }, 2000);
                refreshSleepPanel();
            }
        });
    }

    if (wakeBtn) {
        wakeBtn.addEventListener('click', async function() {
            if (!this.classList.contains('disabled')) {
                const wakeTime = await logWakeUp();
                this.innerHTML = `Logged ${formatSleepPanelTime(wakeTime.getHours(), wakeTime.getMinutes())}`;
                setTimeout(() => {
                    this.innerHTML = '<span class="sleep-emoji">&#9728;&#65039;</span> Just woke up';
                }, 2000);
                refreshSleepPanel();
            }
        });
    }

    // Settings changes
    if (wakeInput) {
        wakeInput.addEventListener('change', () => {
            const [h, m] = wakeInput.value.split(':').map(Number);
            const settings = loadSleepSettings();
            settings.wakeHour = h;
            settings.wakeMinute = m;
            saveSleepSettings(settings);
            refreshSleepPanel();
        });
    }

    if (hoursInput) {
        hoursInput.addEventListener('change', () => {
            const settings = loadSleepSettings();
            settings.targetSleepHours = parseFloat(hoursInput.value) || 7.5;
            saveSleepSettings(settings);
            refreshSleepPanel();
        });
    }

    // Period toggle
    document.querySelectorAll('.sleep-period-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.sleep-period-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            sleepPanelStatsPeriod = parseInt(btn.dataset.period);
            renderSleepPanelStats();
        });
    });

    // Heatmap navigation
    const prevBtn = document.getElementById('sleep-panel-heatmap-prev');
    const nextBtn = document.getElementById('sleep-panel-heatmap-next');

    if (prevBtn) {
        prevBtn.addEventListener('click', () => {
            sleepPanelHeatmapMonth--;
            if (sleepPanelHeatmapMonth < 0) {
                sleepPanelHeatmapMonth = 11;
                sleepPanelHeatmapYear--;
            }
            renderSleepPanelHeatmap();
        });
    }

    if (nextBtn) {
        nextBtn.addEventListener('click', () => {
            sleepPanelHeatmapMonth++;
            if (sleepPanelHeatmapMonth > 11) {
                sleepPanelHeatmapMonth = 0;
                sleepPanelHeatmapYear++;
            }
            renderSleepPanelHeatmap();
        });
    }

    // Start countdown updates
    sleepPanelUpdateInterval = setInterval(renderSleepPanelCountdown, 1000);

    // Listen for user changes to reload data (fires after sign in/out)
    window.addEventListener('userChanged', async () => {
        // Force reload data from cloud
        await loadSleepPanelData();
        await loadSleepSettingsAsync();
        refreshSleepPanel();
    });

    sleepPanelInitialized = true;
}

// Called when sleep panel becomes active
async function onSleepPanelActivate() {
    if (!sleepPanelInitialized) {
        await initSleepPanel();
    } else {
        // Always reload data from cloud when switching to sleep tab
        await loadSleepPanelData();
        await loadSleepSettingsAsync();
        refreshSleepPanel();
    }
}

// Called when sleep panel is deactivated
function onSleepPanelDeactivate() {
    // Could pause interval here if needed
}
