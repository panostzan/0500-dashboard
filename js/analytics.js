// ═══════════════════════════════════════════════════════════════════════════════
// ANALYTICS - Life Analytics Page
// ═══════════════════════════════════════════════════════════════════════════════

let currentRange = 60; // default 60 days
const tooltip = { el: null };

// ─── SVG Helper ──────────────────────────────────────────────────────────────

function svgEl(tag, attrs) {
    const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
    if (attrs) Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v));
    return el;
}

// ─── Tooltip ─────────────────────────────────────────────────────────────────

function showTooltip(e, html) {
    if (!tooltip.el) tooltip.el = document.getElementById('analytics-tooltip');
    tooltip.el.innerHTML = html;
    tooltip.el.classList.add('visible');
    positionTooltip(e);
}

function positionTooltip(e) {
    if (!tooltip.el) return;
    const pad = 12;
    let x = e.clientX + pad;
    let y = e.clientY - pad - tooltip.el.offsetHeight;
    if (x + tooltip.el.offsetWidth > window.innerWidth) x = e.clientX - pad - tooltip.el.offsetWidth;
    if (y < 0) y = e.clientY + pad;
    tooltip.el.style.left = x + 'px';
    tooltip.el.style.top = y + 'px';
}

function hideTooltip() {
    if (tooltip.el) tooltip.el.classList.remove('visible');
}

// ─── Data Loading ────────────────────────────────────────────────────────────

function loadGoalHistory() {
    return DataService.loadDailyGoalHistory();
}

function loadBooks() {
    try {
        const raw = localStorage.getItem('0500_books');
        return raw ? JSON.parse(raw) : [];
    } catch { return []; }
}

function getFilteredSleepData(range) {
    const n = range === 0 ? 365 : range;
    return getLastNDaysLog(n);
}

function getFilteredGoalData(range, history) {
    if (range === 0) return history;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - range);
    const cutoffStr = localDateStr(cutoff);
    return history.filter(h => h.date >= cutoffStr);
}

// ─── Formatters ──────────────────────────────────────────────────────────────

function fmtHours(h) {
    if (h === null || h === undefined) return '--';
    const hrs = Math.floor(h);
    const mins = Math.round((h - hrs) * 60);
    return mins > 0 ? `${hrs}h ${mins}m` : `${hrs}h`;
}

function fmtDate(dateStr) {
    const d = new Date(dateStr + 'T12:00:00');
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function fmtDateShort(dateStr) {
    const d = new Date(dateStr + 'T12:00:00');
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }).replace(' ', '\u00a0');
}

function fmtTime(hour, minute) {
    const h = hour % 12 || 12;
    const ampm = hour < 12 ? 'AM' : 'PM';
    return `${h}:${String(minute).padStart(2, '0')} ${ampm}`;
}

function scoreClass(val) {
    if (val >= 75) return 'good';
    if (val >= 50) return 'ok';
    return 'poor';
}

// ─── Init ────────────────────────────────────────────────────────────────────

async function initAnalyticsPage() {
    // Load sleep data into cache
    await loadSleepLogAsync();
    await loadSleepSettingsAsync();

    // Wire range selector
    const selector = document.getElementById('range-selector');
    if (selector) {
        selector.addEventListener('click', e => {
            const btn = e.target.closest('.range-btn');
            if (!btn) return;
            selector.querySelectorAll('.range-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentRange = parseInt(btn.dataset.range, 10);
            renderAll();
        });
    }

    renderAll();

    // Smooth scroll for nav dots
    document.querySelectorAll('.nav-dot').forEach(dot => {
        dot.addEventListener('click', e => {
            e.preventDefault();
            const target = document.querySelector(dot.getAttribute('href'));
            if (target) target.scrollIntoView({ behavior: 'smooth', block: 'center' });
        });
    });

    // Click stat pills to scroll to relevant panel
    const statTargets = ['panel-sleep-trend', 'panel-sleep-score', 'panel-streaks', 'panel-sleep-trend', 'panel-goal-heatmap'];
    document.getElementById('stats-row')?.addEventListener('click', e => {
        const card = e.target.closest('.stat-card');
        if (!card) return;
        const idx = [...card.parentElement.children].indexOf(card);
        const panelId = statTargets[idx];
        if (panelId) {
            const panel = document.getElementById(panelId);
            if (panel) panel.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    });
}

// ─── Render All ──────────────────────────────────────────────────────────────

function renderAll() {
    const sleepData = getFilteredSleepData(currentRange);
    const goalHistory = loadGoalHistory();
    const filteredGoals = getFilteredGoalData(currentRange, goalHistory);
    const books = loadBooks();

    renderStatsRow(sleepData, filteredGoals);
    renderWeeklyComparison();
    renderMomentum();
    renderSleepTrend(sleepData);
    renderGoalHeatmap(filteredGoals);
    renderSleepScore(sleepData);
    renderBedtimeChart(sleepData);
    renderRecords();
    renderTrends(sleepData, filteredGoals);
    renderCorrelation(sleepData, filteredGoals);
    renderStreaks();
    renderBooksTimeline(books);
}

// ═══════════════════════════════════════════════════════════════════════════════
// STATS ROW
// ═══════════════════════════════════════════════════════════════════════════════

function renderStatsRow(sleepData, goalData) {
    const container = document.getElementById('stats-row');
    if (!container) return;

    const daysWithSleep = sleepData.filter(d => d.hours);
    const avgSleep = daysWithSleep.length > 0
        ? daysWithSleep.reduce((s, d) => s + d.hours, 0) / daysWithSleep.length
        : null;

    const score = daysWithSleep.length >= 3 ? calculateSleepScore(sleepData) : null;
    const streak = calculateSleepStreak();

    const totalGoalDays = goalData.length;
    const perfectDays = goalData.filter(d => d.total > 0 && d.completed === d.total).length;
    const goalRate = totalGoalDays > 0 ? Math.round((perfectDays / totalGoalDays) * 100) : null;

    const avgCompletion = totalGoalDays > 0
        ? Math.round(goalData.reduce((s, d) => s + (d.total > 0 ? d.completed / d.total : 0), 0) / totalGoalDays * 100)
        : null;

    // Sleep debt calculation (7-day)
    const last7 = getLastNDaysLog(7);
    const settings = loadSleepSettings();
    let debtHours = 0;
    last7.forEach(d => {
        if (d.totalHours !== null) {
            debtHours += (d.totalHours - settings.targetHours);
        }
    });
    const debtStr = debtHours >= 0 ? `+${debtHours.toFixed(1)}h` : `${debtHours.toFixed(1)}h`;
    const debtClass = debtHours >= 0 ? 'surplus' : 'deficit';

    container.innerHTML = `
        <div class="stat-card">
            <div class="stat-card-value">${avgSleep !== null ? avgSleep.toFixed(1) + 'h' : '--'}</div>
            <div class="stat-card-label">AVG SLEEP</div>
        </div>
        <div class="stat-card">
            <div class="stat-card-value accent">${score ? score.total : '--'}</div>
            <div class="stat-card-label">SLEEP SCORE</div>
        </div>
        <div class="stat-card">
            <div class="stat-card-value">${streak.current}</div>
            <div class="stat-card-label">DAY STREAK</div>
        </div>
        <div class="stat-card">
            <div class="stat-card-value ${debtClass}">${debtStr}</div>
            <div class="stat-card-label">SLEEP DEBT</div>
        </div>
        <div class="stat-card">
            <div class="stat-card-value">${avgCompletion !== null ? avgCompletion + '%' : '--'}</div>
            <div class="stat-card-label">GOAL RATE</div>
        </div>
    `;
}

// ═══════════════════════════════════════════════════════════════════════════════
// SLEEP DURATION TREND (SVG line chart)
// ═══════════════════════════════════════════════════════════════════════════════

function renderSleepTrend(sleepData) {
    const container = document.getElementById('chart-sleep-trend');
    const subtitle = document.getElementById('sleep-trend-subtitle');
    if (!container) return;

    const daysWithData = sleepData.filter(d => d.hours);
    if (daysWithData.length < 3) {
        container.innerHTML = '<div class="analytics-empty">Not enough sleep data yet</div>';
        if (subtitle) subtitle.textContent = '';
        return;
    }

    if (subtitle) subtitle.textContent = `${daysWithData.length} nights`;

    requestAnimationFrame(() => {
        const w = container.clientWidth || 500;
        const h = 200;
        const pad = { top: 20, right: 10, bottom: 30, left: 40 };
        const chartW = w - pad.left - pad.right;
        const chartH = h - pad.top - pad.bottom;

        const settings = loadSleepSettings();
        const target = settings.targetHours;

        // Determine y-axis range
        const hours = daysWithData.map(d => d.hours);
        const minH = Math.max(0, Math.floor(Math.min(...hours, target) - 1));
        const maxH = Math.ceil(Math.max(...hours, target) + 0.5);
        const yRange = maxH - minH;

        const toX = (i) => pad.left + (i / (daysWithData.length - 1)) * chartW;
        const toY = (val) => pad.top + chartH - ((val - minH) / yRange) * chartH;

        const svg = svgEl('svg', { class: 'analytics-svg', viewBox: `0 0 ${w} ${h}`, preserveAspectRatio: 'none' });
        svg.style.width = '100%';
        svg.style.height = h + 'px';

        // Gradient defs for line
        const defs = svgEl('defs');
        const grad = svgEl('linearGradient', { id: 'sleep-line-grad', x1: '0', y1: '0', x2: '1', y2: '0' });
        const stop1 = svgEl('stop', { offset: '0%', 'stop-color': 'var(--accent)', 'stop-opacity': '0.2' });
        const stop2 = svgEl('stop', { offset: '15%', 'stop-color': 'var(--accent)', 'stop-opacity': '1' });
        const stop3 = svgEl('stop', { offset: '85%', 'stop-color': 'var(--accent)', 'stop-opacity': '1' });
        const stop4 = svgEl('stop', { offset: '100%', 'stop-color': 'var(--accent)', 'stop-opacity': '0.2' });
        grad.appendChild(stop1); grad.appendChild(stop2); grad.appendChild(stop3); grad.appendChild(stop4);
        defs.appendChild(grad);
        svg.appendChild(defs);

        // Grid lines
        for (let v = minH; v <= maxH; v++) {
            svg.appendChild(svgEl('line', {
                x1: pad.left, y1: toY(v), x2: w - pad.right, y2: toY(v),
                class: 'chart-grid-line'
            }));
            svg.appendChild(svgEl('text', {
                x: pad.left - 6, y: toY(v) + 3, class: 'chart-label-y'
            }));
            svg.lastChild.textContent = v + 'h';
        }

        // Target line
        const targetY = toY(target);
        svg.appendChild(svgEl('line', {
            x1: pad.left, y1: targetY, x2: w - pad.right, y2: targetY,
            class: 'chart-target-line'
        }));

        // Build polyline points
        const points = daysWithData.map((d, i) => `${toX(i)},${toY(d.hours)}`).join(' ');

        // Area fill
        const areaPoints = `${toX(0)},${toY(minH)} ${points} ${toX(daysWithData.length - 1)},${toY(minH)}`;
        svg.appendChild(svgEl('polygon', { points: areaPoints, class: 'chart-area' }));

        // Line with gradient stroke
        svg.appendChild(svgEl('polyline', { points, class: 'chart-line', stroke: 'url(#sleep-line-grad)' }));

        // 7-day moving average
        if (daysWithData.length >= 7) {
            const maPoints = [];
            for (let i = 0; i < daysWithData.length; i++) {
                const windowStart = Math.max(0, i - 6);
                const window = daysWithData.slice(windowStart, i + 1);
                const avg = window.reduce((s, d) => s + d.hours, 0) / window.length;
                maPoints.push(`${toX(i)},${toY(avg)}`);
            }
            svg.appendChild(svgEl('polyline', {
                points: maPoints.join(' '),
                class: 'chart-ma-line'
            }));
        }

        // Dots + x-axis labels (sparse)
        const labelInterval = Math.max(1, Math.floor(daysWithData.length / 8));
        daysWithData.forEach((d, i) => {
            const cx = toX(i);
            const cy = toY(d.hours);

            const dot = svgEl('circle', { cx, cy, r: 3.5, class: 'chart-dot' });
            dot.addEventListener('mouseenter', e => showTooltip(e,
                `<div class="tooltip-label">${fmtDate(d.date)}</div><div class="tooltip-value">${fmtHours(d.hours)}</div>`
            ));
            dot.addEventListener('mousemove', positionTooltip);
            dot.addEventListener('mouseleave', hideTooltip);
            svg.appendChild(dot);

            // x-axis labels
            if (i % labelInterval === 0 || i === daysWithData.length - 1) {
                const label = svgEl('text', { x: cx, y: h - 4, class: 'chart-label', 'text-anchor': 'middle' });
                label.textContent = fmtDateShort(d.date);
                svg.appendChild(label);
            }
        });

        container.innerHTML = '';
        container.appendChild(svg);
    });
}

// ═══════════════════════════════════════════════════════════════════════════════
// GOAL COMPLETION HEATMAP (GitHub-style)
// ═══════════════════════════════════════════════════════════════════════════════

function renderGoalHeatmap(goalData) {
    const container = document.getElementById('chart-goal-heatmap');
    const subtitle = document.getElementById('goal-heatmap-subtitle');
    if (!container) return;

    if (goalData.length === 0) {
        container.innerHTML = '<div class="analytics-empty">No goal data yet</div>';
        if (subtitle) subtitle.textContent = '';
        return;
    }

    if (subtitle) subtitle.textContent = `${goalData.length} days tracked`;

    // Build a map of date → completion %
    const goalMap = {};
    goalData.forEach(d => {
        goalMap[d.date] = d.total > 0 ? d.completed / d.total : 0;
    });

    // Generate cells for the range — fill from oldest Sunday to today
    const today = new Date();
    const totalDays = currentRange === 0 ? Math.max(90, goalData.length + 7) : currentRange;
    const startDate = new Date(today);
    startDate.setDate(startDate.getDate() - totalDays);
    // Align to previous Sunday
    startDate.setDate(startDate.getDate() - startDate.getDay());

    const cells = [];
    const d = new Date(startDate);
    while (d <= today) {
        const dateStr = localDateStr(d);
        const pct = goalMap[dateStr];
        let level = 'empty';
        if (pct !== undefined) {
            if (pct === 0) level = 'level-0';
            else if (pct < 0.5) level = 'level-1';
            else if (pct < 0.75) level = 'level-2';
            else if (pct < 1) level = 'level-3';
            else level = 'level-4';
        }
        cells.push({ date: dateStr, level, pct });
        d.setDate(d.getDate() + 1);
    }

    const dayLabels = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

    let html = '<div class="heatmap-container"><div class="heatmap-day-labels">';
    dayLabels.forEach(l => {
        html += `<div class="heatmap-day-label">${l}</div>`;
    });
    html += '</div><div class="heatmap-wrapper">';

    // Month labels — one per first-Sunday-of-month column
    const weeks = Math.ceil(cells.length / 7);
    html += '<div class="heatmap-month-labels">';
    let lastMonth = -1;
    for (let w = 0; w < weeks; w++) {
        const cellIdx = w * 7; // first day of this column (Sunday)
        if (cellIdx < cells.length) {
            const cd = new Date(cells[cellIdx].date + 'T12:00:00');
            const m = cd.getMonth();
            if (m !== lastMonth) {
                html += `<span class="heatmap-month-label" style="grid-column: ${w + 1}">${cd.toLocaleDateString('en-US', { month: 'short' })}</span>`;
                lastMonth = m;
            }
        }
    }
    html += '</div>';

    html += '<div class="heatmap-grid">';

    cells.forEach(c => {
        const tooltipText = c.pct !== undefined ? Math.round(c.pct * 100) + '% completed' : 'No data';
        html += `<div class="heatmap-cell-sm ${c.level}" data-date="${c.date}" data-tip="${fmtDate(c.date)}: ${tooltipText}"></div>`;
    });

    html += '</div></div></div>';

    // Legend
    html += `
        <div class="heatmap-legend">
            <span>Less</span>
            <div class="heatmap-legend-cell level-0" style="background: var(--data-none)"></div>
            <div class="heatmap-legend-cell level-1" style="background: var(--data-ok-end); opacity: 0.7"></div>
            <div class="heatmap-legend-cell level-2" style="background: var(--data-ok-start)"></div>
            <div class="heatmap-legend-cell level-3" style="background: var(--data-good-end)"></div>
            <div class="heatmap-legend-cell level-4" style="background: var(--data-good-start)"></div>
            <span>More</span>
        </div>
    `;

    container.innerHTML = html;

    // Wire heatmap tooltips
    container.querySelectorAll('.heatmap-cell-sm[data-tip]').forEach(cell => {
        cell.addEventListener('mouseenter', e => showTooltip(e, e.target.dataset.tip));
        cell.addEventListener('mousemove', positionTooltip);
        cell.addEventListener('mouseleave', hideTooltip);
    });
}

// ═══════════════════════════════════════════════════════════════════════════════
// SLEEP SCORE BREAKDOWN (DOM bars)
// ═══════════════════════════════════════════════════════════════════════════════

function renderSleepScore(sleepData) {
    const container = document.getElementById('chart-sleep-score');
    if (!container) return;

    const daysWithData = sleepData.filter(d => d.hours);
    if (daysWithData.length < 3) {
        container.innerHTML = '<div class="analytics-empty">Not enough sleep data yet</div>';
        return;
    }

    const score = calculateSleepScore(sleepData);
    if (!score) {
        container.innerHTML = '<div class="analytics-empty">Not enough data to calculate score</div>';
        return;
    }

    const components = [
        { label: 'Regularity', value: score.regularity, weight: '30%' },
        { label: 'Duration', value: score.duration, weight: '25%' },
        { label: 'Sleep Debt', value: score.debt, weight: '20%' },
        { label: 'Timing', value: score.timing, weight: '15%' },
        { label: 'Streak', value: score.streak, weight: '10%' }
    ];

    let html = '<div class="score-display"><div class="score-big" data-target="' + score.total + '">0</div><div class="score-breakdown">';
    components.forEach(c => {
        const cls = scoreClass(c.value);
        html += `
            <div class="score-bar-row">
                <span class="score-bar-label">${c.label}</span>
                <div class="score-bar-track">
                    <div class="score-bar-fill ${cls}" data-width="${c.value}"></div>
                </div>
                <span class="score-bar-value">${c.value}</span>
            </div>
        `;
    });
    html += '</div></div>';

    container.innerHTML = html;

    // Animate: count up score number
    const scoreEl = container.querySelector('.score-big');
    if (scoreEl) {
        const target = score.total;
        const duration = 800;
        const start = performance.now();
        function tick(now) {
            const t = Math.min((now - start) / duration, 1);
            const ease = 1 - Math.pow(1 - t, 3);
            scoreEl.textContent = Math.round(ease * target);
            if (t < 1) requestAnimationFrame(tick);
        }
        requestAnimationFrame(tick);
    }

    // Animate: bar fills staggered
    requestAnimationFrame(() => {
        container.querySelectorAll('.score-bar-fill[data-width]').forEach((bar, i) => {
            setTimeout(() => {
                bar.style.width = bar.dataset.width + '%';
            }, 150 + i * 80);
        });
    });
}

// ═══════════════════════════════════════════════════════════════════════════════
// BEDTIME CONSISTENCY (SVG band chart)
// ═══════════════════════════════════════════════════════════════════════════════

function renderBedtimeChart(sleepData) {
    const container = document.getElementById('chart-bedtime');
    const subtitle = document.getElementById('bedtime-subtitle');
    if (!container) return;

    const daysWithTimes = sleepData.filter(d => d.bedtime && d.wakeTime);
    if (daysWithTimes.length < 3) {
        container.innerHTML = '<div class="analytics-empty">Not enough sleep data yet</div>';
        if (subtitle) subtitle.textContent = '';
        return;
    }

    const consistency = calculateBedtimeConsistency(daysWithTimes);
    if (subtitle) {
        subtitle.textContent = consistency !== null
            ? `\u00b1${Math.round(consistency)} min variability`
            : '';
    }

    requestAnimationFrame(() => {
        const w = container.clientWidth || 500;
        const h = 200;
        const pad = { top: 20, right: 10, bottom: 30, left: 50 };
        const chartW = w - pad.left - pad.right;
        const chartH = h - pad.top - pad.bottom;

        // Convert bedtime/wake to minutes-since-6PM for y-axis
        // 6 PM = 0, 10 PM = 240, midnight = 360, 5 AM = 660
        function toMin6pm(date) {
            let min = date.getHours() * 60 + date.getMinutes();
            min -= 1080; // 6 PM offset
            if (min < 0) min += 1440;
            return min;
        }

        const bedMins = daysWithTimes.map(d => toMin6pm(d.bedtime));
        const wakeMins = daysWithTimes.map(d => toMin6pm(d.wakeTime));

        const allMins = [...bedMins, ...wakeMins];
        const minY = Math.floor(Math.min(...allMins) / 60) * 60;
        const maxY = Math.ceil(Math.max(...allMins) / 60) * 60;
        const yRange = maxY - minY || 60;

        const toX = (i) => pad.left + (i + 0.5) * (chartW / daysWithTimes.length);
        const toYCoord = (mins) => pad.top + ((mins - minY) / yRange) * chartH;
        const barW = Math.max(4, Math.min(20, chartW / daysWithTimes.length - 2));

        const svg = svgEl('svg', { class: 'analytics-svg', viewBox: `0 0 ${w} ${h}` });
        svg.style.width = '100%';
        svg.style.height = h + 'px';

        // Y-axis labels (time labels)
        for (let m = minY; m <= maxY; m += 60) {
            const y = toYCoord(m);
            svg.appendChild(svgEl('line', { x1: pad.left, y1: y, x2: w - pad.right, y2: y, class: 'chart-grid-line' }));

            let actualMin = m + 1080; // Convert back to real minutes
            if (actualMin >= 1440) actualMin -= 1440;
            const hr = Math.floor(actualMin / 60);
            const label = svgEl('text', { x: pad.left - 6, y: y + 3, class: 'chart-label-y' });
            label.textContent = fmtTime(hr, 0);
            svg.appendChild(label);
        }

        // Target bedtime/wake lines
        const settings = loadSleepSettings();
        const wake = parseTime(settings.wakeTime);
        const targetWakeMin = toMin6pm(new Date(2000, 0, 1, wake.hour, wake.minute));
        const targetBedMin = targetWakeMin - (settings.targetHours * 60);
        if (targetBedMin >= minY && targetBedMin <= maxY) {
            svg.appendChild(svgEl('line', {
                x1: pad.left, y1: toYCoord(targetBedMin), x2: w - pad.right, y2: toYCoord(targetBedMin),
                class: 'bedtime-target-line'
            }));
            const bedLabel = svgEl('text', { x: w - pad.right + 4, y: toYCoord(targetBedMin) + 3, class: 'chart-label', 'text-anchor': 'start' });
            bedLabel.textContent = 'Bed';
            svg.appendChild(bedLabel);
        }
        if (targetWakeMin >= minY && targetWakeMin <= maxY) {
            svg.appendChild(svgEl('line', {
                x1: pad.left, y1: toYCoord(targetWakeMin), x2: w - pad.right, y2: toYCoord(targetWakeMin),
                class: 'bedtime-target-line'
            }));
            const wakeLabel = svgEl('text', { x: w - pad.right + 4, y: toYCoord(targetWakeMin) + 3, class: 'chart-label', 'text-anchor': 'start' });
            wakeLabel.textContent = 'Wake';
            svg.appendChild(wakeLabel);
        }

        // Bars
        const labelInterval = Math.max(1, Math.floor(daysWithTimes.length / 8));
        daysWithTimes.forEach((d, i) => {
            const x = toX(i) - barW / 2;
            const y1 = toYCoord(bedMins[i]);
            const y2 = toYCoord(wakeMins[i]);
            const barH = Math.abs(y2 - y1);

            const bar = svgEl('rect', {
                x, y: Math.min(y1, y2), width: barW, height: barH,
                class: 'bedtime-bar'
            });
            bar.addEventListener('mouseenter', e => {
                const bt = d.bedtime;
                const wt = d.wakeTime;
                showTooltip(e, `
                    <div class="tooltip-label">${fmtDate(d.date)}</div>
                    <div>Bed: <span class="tooltip-value">${fmtTime(bt.getHours(), bt.getMinutes())}</span></div>
                    <div>Wake: <span class="tooltip-value">${fmtTime(wt.getHours(), wt.getMinutes())}</span></div>
                    <div>Duration: <span class="tooltip-value">${fmtHours(d.hours)}</span></div>
                `);
            });
            bar.addEventListener('mousemove', positionTooltip);
            bar.addEventListener('mouseleave', hideTooltip);
            svg.appendChild(bar);

            // x-axis labels
            if (i % labelInterval === 0 || i === daysWithTimes.length - 1) {
                const label = svgEl('text', { x: toX(i), y: h - 4, class: 'chart-label', 'text-anchor': 'middle' });
                label.textContent = fmtDateShort(d.date);
                svg.appendChild(label);
            }
        });

        container.innerHTML = '';
        container.appendChild(svg);
    });
}

// ═══════════════════════════════════════════════════════════════════════════════
// SLEEP vs GOALS CORRELATION (dual-axis: bars + line)
// ═══════════════════════════════════════════════════════════════════════════════

function renderCorrelation(sleepData, goalData) {
    const container = document.getElementById('chart-correlation');
    const subtitle = document.getElementById('correlation-subtitle');
    if (!container) return;

    // Merge by date
    const goalMap = {};
    goalData.forEach(d => {
        if (d.total > 0) goalMap[d.date] = d.completed / d.total;
    });

    const merged = sleepData
        .filter(d => d.hours && goalMap[d.date] !== undefined)
        .map(d => ({ date: d.date, hours: d.hours, goalPct: goalMap[d.date] }));

    if (merged.length < 3) {
        container.innerHTML = '<div class="analytics-empty">Need both sleep and goal data on the same days</div>';
        if (subtitle) subtitle.textContent = '';
        return;
    }

    if (subtitle) subtitle.textContent = `${merged.length} days`;

    requestAnimationFrame(() => {
        const w = container.clientWidth || 500;
        const h = 200;
        const pad = { top: 20, right: 20, bottom: 30, left: 40 };
        const chartW = w - pad.left - pad.right;
        const chartH = h - pad.top - pad.bottom;

        // Scatter: x = sleep hours, y = goal %
        const hours = merged.map(d => d.hours);
        const minH = Math.max(0, Math.floor(Math.min(...hours) - 0.5));
        const maxH = Math.ceil(Math.max(...hours) + 0.5);

        const toX = (hrs) => pad.left + ((hrs - minH) / (maxH - minH)) * chartW;
        const toY = (pct) => pad.top + chartH - (pct * chartH);

        const svg = svgEl('svg', { class: 'analytics-svg', viewBox: `0 0 ${w} ${h}` });
        svg.style.width = '100%';
        svg.style.height = h + 'px';

        // Grid
        for (let pct = 0; pct <= 1; pct += 0.25) {
            const y = toY(pct);
            svg.appendChild(svgEl('line', { x1: pad.left, y1: y, x2: w - pad.right, y2: y, class: 'chart-grid-line' }));
            const label = svgEl('text', { x: pad.left - 6, y: y + 3, class: 'chart-label-y' });
            label.textContent = Math.round(pct * 100) + '%';
            svg.appendChild(label);
        }
        for (let v = minH; v <= maxH; v++) {
            const x = toX(v);
            svg.appendChild(svgEl('line', { x1: x, y1: pad.top, x2: x, y2: pad.top + chartH, class: 'chart-grid-line' }));
            const label = svgEl('text', { x, y: h - 4, class: 'chart-label', 'text-anchor': 'middle' });
            label.textContent = v + 'h';
            svg.appendChild(label);
        }

        // Axis labels
        const xAxisLabel = svgEl('text', { x: pad.left + chartW / 2, y: h - 1, class: 'chart-label', 'text-anchor': 'middle' });
        xAxisLabel.textContent = 'Sleep';
        svg.appendChild(xAxisLabel);

        // Scatter dots
        merged.forEach(d => {
            const cx = toX(d.hours);
            const cy = toY(d.goalPct);
            const dot = svgEl('circle', { cx, cy, r: 5, class: 'scatter-dot' });
            dot.addEventListener('mouseenter', e => showTooltip(e, `
                <div class="tooltip-label">${fmtDate(d.date)}</div>
                <div>Sleep: <span class="tooltip-value">${fmtHours(d.hours)}</span></div>
                <div>Goals: <span class="tooltip-value">${Math.round(d.goalPct * 100)}%</span></div>
            `));
            dot.addEventListener('mousemove', positionTooltip);
            dot.addEventListener('mouseleave', hideTooltip);
            svg.appendChild(dot);
        });

        container.innerHTML = '';
        container.appendChild(svg);
    });
}

// ═══════════════════════════════════════════════════════════════════════════════
// STREAKS & MILESTONES
// ═══════════════════════════════════════════════════════════════════════════════

function renderStreaks() {
    const container = document.getElementById('chart-streaks');
    if (!container) return;

    const streak = calculateSleepStreak();
    const goalHistory = loadGoalHistory();

    // Goal streak: consecutive days with 100% completion
    let goalStreak = 0;
    const today = new Date();
    const sortedGoals = [...goalHistory].sort((a, b) => b.date.localeCompare(a.date));
    for (const entry of sortedGoals) {
        const entryDate = new Date(entry.date + 'T12:00:00');
        const daysDiff = Math.floor((today - entryDate) / (1000 * 60 * 60 * 24));
        if (daysDiff > goalStreak + 1) break;
        if (entry.total > 0 && entry.completed === entry.total) {
            goalStreak++;
        } else {
            break;
        }
    }

    // Milestones: completed mid-term and one-year goals
    const milestones = [];
    try {
        const midterm = JSON.parse(localStorage.getItem('0500_midterm_completed') || '{}');
        Object.entries(midterm).forEach(([text, ts]) => {
            milestones.push({ text, date: new Date(ts), type: '3 Month' });
        });
    } catch {}
    try {
        const oneyear = JSON.parse(localStorage.getItem('0500_oneyear_completed') || '{}');
        Object.entries(oneyear).forEach(([text, ts]) => {
            milestones.push({ text, date: new Date(ts), type: '1 Year' });
        });
    } catch {}

    milestones.sort((a, b) => b.date - a.date);

    let html = `
        <div class="streaks-grid">
            <div class="streak-card">
                <div class="streak-value">${streak.current}</div>
                <div class="streak-label">Sleep Streak</div>
            </div>
            <div class="streak-card">
                <div class="streak-value">${streak.longest}</div>
                <div class="streak-label">Best Sleep Streak</div>
            </div>
            <div class="streak-card">
                <div class="streak-value">${goalStreak}</div>
                <div class="streak-label">Goal Streak</div>
            </div>
            <div class="streak-card">
                <div class="streak-value">${milestones.length}</div>
                <div class="streak-label">Goals Completed</div>
            </div>
        </div>
    `;

    if (milestones.length > 0) {
        html += '<div class="milestones-list">';
        milestones.slice(0, 8).forEach(m => {
            html += `
                <div class="milestone-item">
                    <div class="milestone-badge"></div>
                    <span>${m.text}</span>
                    <span class="milestone-date">${m.date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                </div>
            `;
        });
        html += '</div>';
    }

    container.innerHTML = html;
}

// ═══════════════════════════════════════════════════════════════════════════════
// WEEKLY COMPARISON
// ═══════════════════════════════════════════════════════════════════════════════

function renderWeeklyComparison() {
    const container = document.getElementById('chart-weekly');
    if (!container) return;

    const thisWeek = getLastNDaysLog(7);
    const lastWeek = getLastNDaysLog(14).slice(0, 7);
    const goalHistory = loadGoalHistory();

    const thisWithSleep = thisWeek.filter(d => d.hours);
    const lastWithSleep = lastWeek.filter(d => d.hours);

    if (thisWithSleep.length < 2 && lastWithSleep.length < 2) {
        container.innerHTML = '<div class="analytics-empty">Need more data for comparison</div>';
        return;
    }

    function weekAvgSleep(days) {
        const d = days.filter(x => x.hours);
        return d.length > 0 ? d.reduce((s, x) => s + x.hours, 0) / d.length : 0;
    }

    function weekGoalPct(days) {
        const dates = days.map(d => d.date);
        const matched = goalHistory.filter(g => dates.includes(g.date) && g.total > 0);
        return matched.length > 0 ? matched.reduce((s, g) => s + g.completed / g.total, 0) / matched.length : 0;
    }

    function weekConsistency(days) {
        const withBed = days.filter(d => d.bedtime);
        if (withBed.length < 2) return null;
        return calculateBedtimeConsistency(withBed);
    }

    const metrics = [
        {
            label: 'Avg Sleep',
            thisVal: weekAvgSleep(thisWeek),
            lastVal: weekAvgSleep(lastWeek),
            fmt: v => fmtHours(v),
            higherBetter: true
        },
        {
            label: 'Goals',
            thisVal: weekGoalPct(thisWeek),
            lastVal: weekGoalPct(lastWeek),
            fmt: v => Math.round(v * 100) + '%',
            higherBetter: true
        },
        {
            label: 'Consistency',
            thisVal: weekConsistency(thisWeek),
            lastVal: weekConsistency(lastWeek),
            fmt: v => v !== null ? '\u00b1' + Math.round(v) + 'm' : '--',
            higherBetter: false
        }
    ];

    let html = '<div class="weekly-grid">';
    metrics.forEach(m => {
        const thisNum = m.thisVal ?? 0;
        const lastNum = m.lastVal ?? 0;
        const maxVal = Math.max(thisNum, lastNum, 0.01);
        const thisPct = (thisNum / maxVal) * 100;
        const lastPct = (lastNum / maxVal) * 100;

        let trend = '';
        if (m.thisVal !== null && m.lastVal !== null) {
            const diff = thisNum - lastNum;
            const better = m.higherBetter ? diff > 0 : diff < 0;
            if (Math.abs(diff) > 0.01) {
                trend = better ? 'better' : 'worse';
            }
        }

        html += `
            <div class="weekly-metric">
                <span class="weekly-metric-label">${m.label}</span>
                <div class="weekly-bars">
                    <div class="weekly-bar-row">
                        <span class="weekly-bar-period">This</span>
                        <div class="score-bar-track">
                            <div class="score-bar-fill weekly-this ${trend}" data-width="${thisPct}"></div>
                        </div>
                        <span class="weekly-bar-val">${m.fmt(m.thisVal)}</span>
                    </div>
                    <div class="weekly-bar-row">
                        <span class="weekly-bar-period">Last</span>
                        <div class="score-bar-track">
                            <div class="score-bar-fill weekly-last" data-width="${lastPct}"></div>
                        </div>
                        <span class="weekly-bar-val">${m.fmt(m.lastVal)}</span>
                    </div>
                </div>
            </div>
        `;
    });
    html += '</div>';

    container.innerHTML = html;

    // Animate bars
    requestAnimationFrame(() => {
        container.querySelectorAll('.score-bar-fill[data-width]').forEach((bar, i) => {
            setTimeout(() => { bar.style.width = bar.dataset.width + '%'; }, 100 + i * 60);
        });
    });
}

// ═══════════════════════════════════════════════════════════════════════════════
// MOMENTUM TRACKER (always 7-day rolling, ignores range selector)
// ═══════════════════════════════════════════════════════════════════════════════

function computeMomentumScore() {
    const last7 = getLastNDaysLog(7);
    const prev7 = getLastNDaysLog(14).slice(0, 7);
    const goalHistory = loadGoalHistory();
    const today = new Date();

    // --- Sleep component (35%) ---
    const sleepDays7 = last7.filter(d => d.hours);
    let sleepScore = 50;
    if (sleepDays7.length >= 3) {
        const sc = calculateSleepScore(last7);
        if (sc) sleepScore = sc.total;
    }

    // --- Goals component (30%) ---
    const last7Dates = last7.map(d => d.date);
    const goalDays7 = goalHistory.filter(d => last7Dates.includes(d.date));
    let goalScore = 50;
    if (goalDays7.length > 0) {
        const avgPct = goalDays7.reduce((s, d) => s + (d.total > 0 ? d.completed / d.total : 0), 0) / goalDays7.length;
        goalScore = Math.round(avgPct * 100);
    }

    // --- Consistency component (20%) ---
    const daysWithBedtime = last7.filter(d => d.bedtime);
    let consistencyScore = 50;
    if (daysWithBedtime.length >= 3) {
        const stddev = calculateBedtimeConsistency(daysWithBedtime);
        if (stddev !== null) {
            // Low stddev = high score. 0 min = 100, 60 min = 0
            consistencyScore = Math.max(0, Math.min(100, Math.round(100 - (stddev / 60) * 100)));
        }
    }

    // --- Streak component (15%) ---
    const streak = calculateSleepStreak();
    const streakScore = Math.min(100, 30 + streak.current * 10);

    // Weighted total
    const score = Math.round(
        sleepScore * 0.35 +
        goalScore * 0.30 +
        consistencyScore * 0.20 +
        streakScore * 0.15
    );

    // Direction: compare current 7d vs previous 7d
    let prevScore = score; // fallback
    const prevSleepDays = prev7.filter(d => d.hours);
    if (prevSleepDays.length >= 3) {
        const prevSc = calculateSleepScore(prev7);
        const prevSleep = prevSc ? prevSc.total : 50;

        const prev7Dates = prev7.map(d => d.date);
        const prevGoalDays = goalHistory.filter(d => prev7Dates.includes(d.date));
        const prevGoal = prevGoalDays.length > 0
            ? Math.round(prevGoalDays.reduce((s, d) => s + (d.total > 0 ? d.completed / d.total : 0), 0) / prevGoalDays.length * 100)
            : 50;

        const prevBedtimeDays = prev7.filter(d => d.bedtime);
        let prevConsistency = 50;
        if (prevBedtimeDays.length >= 3) {
            const pStd = calculateBedtimeConsistency(prevBedtimeDays);
            if (pStd !== null) prevConsistency = Math.max(0, Math.min(100, Math.round(100 - (pStd / 60) * 100)));
        }

        prevScore = Math.round(
            prevSleep * 0.35 +
            prevGoal * 0.30 +
            prevConsistency * 0.20 +
            streakScore * 0.15  // streak is inherently current
        );
    }

    const delta = score - prevScore;
    let direction = 'cruising';
    if (delta > 5) direction = 'accelerating';
    else if (delta < -5) direction = 'slipping';

    // Build human-readable context for each component
    const avgSleep7 = sleepDays7.length > 0
        ? (sleepDays7.reduce((s, d) => s + d.hours, 0) / sleepDays7.length)
        : 0;
    const settings = loadSleepSettings();
    const bedtimeStddev = daysWithBedtime.length >= 3
        ? calculateBedtimeConsistency(daysWithBedtime)
        : null;

    const sleepCtx = sleepDays7.length >= 3
        ? `avg ${avgSleep7.toFixed(1)}h / ${settings.targetHours}h target`
        : 'not enough data';
    const goalCtx = goalDays7.length > 0
        ? `${Math.round(goalDays7.reduce((s, d) => s + (d.total > 0 ? d.completed / d.total : 0), 0) / goalDays7.length * 100)}% daily avg`
        : 'no goal data';
    const consistCtx = bedtimeStddev !== null
        ? `\u00b1${Math.round(bedtimeStddev)} min variability`
        : 'not enough data';
    const streakCtx = `${streak.current} day${streak.current !== 1 ? 's' : ''} current`;

    const components = [
        { label: 'Sleep', value: sleepScore, weight: '35%', context: sleepCtx },
        { label: 'Goals', value: goalScore, weight: '30%', context: goalCtx },
        { label: 'Bedtime', value: consistencyScore, weight: '20%', context: consistCtx },
        { label: 'Streak', value: streakScore, weight: '15%', context: streakCtx }
    ];

    // Find biggest drag
    const sorted = [...components].sort((a, b) => a.value - b.value);
    const drag = sorted[0];

    return {
        score,
        direction,
        delta,
        components,
        drag
    };
}

function renderMomentum() {
    const container = document.getElementById('chart-momentum');
    if (!container) return;

    const allSleep = getLastNDaysLog(7).filter(d => d.hours);
    if (allSleep.length < 3) {
        container.innerHTML = '<div class="analytics-empty">Not enough data yet (need 3+ nights)</div>';
        return;
    }

    const m = computeMomentumScore();
    const dirIcons = { accelerating: '\u2191', slipping: '\u2193', cruising: '\u2192' };
    const dirLabels = { accelerating: 'Accelerating', slipping: 'Slipping', cruising: 'Cruising' };
    const deltaStr = m.delta >= 0 ? `+${m.delta}` : `${m.delta}`;

    // SVG arc — thicker, Apple Watch ring style
    const arcR = 85;
    const cx = 110, cy = 95;
    const startAngle = Math.PI;
    const endAngle = 0;
    const scoreAngle = startAngle + ((endAngle - startAngle) * (m.score / 100));

    function polarToCart(angle, r) {
        return { x: cx + r * Math.cos(angle), y: cy - r * Math.sin(angle) };
    }

    const arcStart = polarToCart(startAngle, arcR);
    const arcEnd = polarToCart(endAngle, arcR);
    const arcPath = `M ${arcStart.x} ${arcStart.y} A ${arcR} ${arcR} 0 0 1 ${arcEnd.x} ${arcEnd.y}`;

    const dotPos = polarToCart(scoreAngle, arcR);
    const scorePt = polarToCart(scoreAngle, arcR);
    const largeArc = m.score > 50 ? 1 : 0;
    const filledPath = `M ${arcStart.x} ${arcStart.y} A ${arcR} ${arcR} 0 ${largeArc} 1 ${scorePt.x} ${scorePt.y}`;

    // Compute arc length for animation
    const totalArcLen = Math.PI * arcR; // semicircle
    const filledLen = totalArcLen * (m.score / 100);

    const svgStr = `
        <svg viewBox="0 0 220 110" class="momentum-arc">
            <defs>
                <linearGradient id="momentum-grad" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stop-color="var(--data-poor-start)" />
                    <stop offset="40%" stop-color="var(--data-ok-start)" />
                    <stop offset="100%" stop-color="var(--data-good-start)" />
                </linearGradient>
            </defs>
            <path d="${arcPath}" fill="none" stroke="rgba(255,255,255,0.04)" stroke-width="16" stroke-linecap="round" />
            <path d="${filledPath}" fill="none" stroke="url(#momentum-grad)" stroke-width="16" stroke-linecap="round"
                  style="stroke-dasharray: ${filledLen} ${totalArcLen}; stroke-dashoffset: ${filledLen}; animation: arcDraw 1.2s cubic-bezier(0.25, 0.46, 0.45, 0.94) forwards;" />
            <circle cx="${dotPos.x}" cy="${dotPos.y}" r="8" fill="var(--text-primary)" opacity="0"
                    style="animation: dotAppear 0.3s ease 1s forwards;" />
            <circle cx="${dotPos.x}" cy="${dotPos.y}" r="4" fill="var(--bg-base)" opacity="0"
                    style="animation: dotAppear 0.3s ease 1s forwards;" />
        </svg>
        <style>
            @keyframes arcDraw { to { stroke-dashoffset: 0; } }
            @keyframes dotAppear { to { opacity: 1; } }
        </style>
    `;

    // Component bars with per-component Apple Health colors
    const compColors = ['sleep-color', 'goals-color', 'bedtime-color', 'streak-color'];
    let barsHtml = '';
    m.components.forEach((c, i) => {
        barsHtml += `
            <div class="momentum-comp-row">
                <div class="momentum-comp-left">
                    <span class="momentum-comp-label">${c.label} <span class="momentum-comp-weight">${c.weight}</span></span>
                    <span class="momentum-comp-ctx">${c.context}</span>
                </div>
                <div class="momentum-comp-bar">
                    <div class="score-bar-track">
                        <div class="score-bar-fill ${compColors[i]}" data-width="${c.value}"></div>
                    </div>
                    <span class="score-bar-value">${c.value}</span>
                </div>
            </div>
        `;
    });

    // Drag explanation
    const dragHtml = m.drag.value < 60
        ? `<div class="momentum-drag"><span class="momentum-drag-label">Biggest drag:</span> ${m.drag.label} at ${m.drag.value} \u2014 ${m.drag.context}</div>`
        : '';

    container.innerHTML = `
        <div class="momentum-layout">
            <div class="momentum-gauge">
                ${svgStr}
                <div class="momentum-score-label" data-target="${m.score}">0</div>
                <div class="momentum-direction ${m.direction}">
                    <span class="momentum-dir-icon">${dirIcons[m.direction]}</span>
                    ${dirLabels[m.direction]}
                    <span class="momentum-delta">${deltaStr} from last week</span>
                </div>
            </div>
            <div class="momentum-bars">
                ${barsHtml}
                ${dragHtml}
            </div>
        </div>
    `;

    // Animate: count up score number
    const scoreEl = container.querySelector('.momentum-score-label');
    if (scoreEl) {
        const target = m.score;
        const duration = 1000;
        const start = performance.now();
        function tick(now) {
            const t = Math.min((now - start) / duration, 1);
            const ease = 1 - Math.pow(1 - t, 3); // ease-out cubic
            scoreEl.textContent = Math.round(ease * target);
            if (t < 1) requestAnimationFrame(tick);
        }
        requestAnimationFrame(tick);
    }

    // Animate: bar fills staggered
    requestAnimationFrame(() => {
        container.querySelectorAll('.score-bar-fill[data-width]').forEach((bar, i) => {
            setTimeout(() => {
                bar.style.width = bar.dataset.width + '%';
            }, 200 + i * 100);
        });
    });
}

// ═══════════════════════════════════════════════════════════════════════════════
// PERSONAL RECORDS (always all data, ignores range selector)
// ═══════════════════════════════════════════════════════════════════════════════

function computePersonalRecords() {
    const allSleep = loadSleepLog().filter(e => e.hours);
    const goalHistory = loadGoalHistory();
    const streak = calculateSleepStreak();
    const records = [];

    if (allSleep.length === 0) return records;

    // 1. Longest Sleep Streak
    records.push({
        label: 'Longest Sleep Streak',
        desc: 'Consecutive days hitting your sleep target',
        value: streak.longest,
        formattedValue: `${streak.longest} days`,
        current: `Now: ${streak.current}`,
        date: null,
        approaching: streak.longest > 0 && streak.current >= streak.longest * 0.9
    });

    // 2. Best Sleep Score (sliding 7-day window)
    if (allSleep.length >= 7) {
        const sorted = [...allSleep].sort((a, b) => a.date.localeCompare(b.date));
        let bestScore = 0, bestScoreDate = null;

        for (let i = 0; i <= sorted.length - 7; i++) {
            const window = sorted.slice(i, i + 7);
            const dayLog = window.map(e => ({
                date: e.date,
                hours: e.hours,
                totalHours: e.hours,
                bedtime: e.bedtime ? new Date(e.bedtime) : null,
                wakeTime: e.wakeTime ? new Date(e.wakeTime) : null
            }));
            const sc = calculateSleepScore(dayLog);
            if (sc && sc.total > bestScore) {
                bestScore = sc.total;
                bestScoreDate = window[6].date;
            }
        }

        // Current score
        const last7 = getLastNDaysLog(7);
        const currentSc = calculateSleepScore(last7);
        const currentScore = currentSc ? currentSc.total : 0;

        if (bestScore > 0) {
            records.push({
                label: 'Best Sleep Score',
                desc: 'Highest 7-day sleep quality score',
                value: bestScore,
                formattedValue: `${bestScore}/100`,
                current: `Now: ${currentScore}`,
                date: bestScoreDate,
                approaching: bestScore > 0 && currentScore >= bestScore * 0.9
            });
        }
    }

    // 3. Best Single Night
    let bestNight = 0, bestNightDate = null;
    allSleep.forEach(e => {
        if (e.hours > bestNight) { bestNight = e.hours; bestNightDate = e.date; }
    });
    const last7Sleep = getLastNDaysLog(7).filter(d => d.hours);
    const last7Best = last7Sleep.length > 0 ? Math.max(...last7Sleep.map(d => d.hours)) : 0;

    records.push({
        label: 'Best Single Night',
        desc: 'Longest single night of sleep',
        value: bestNight,
        formattedValue: fmtHours(bestNight),
        current: last7Best > 0 ? `This week: ${fmtHours(last7Best)}` : null,
        date: bestNightDate,
        approaching: bestNight > 0 && last7Best >= bestNight * 0.9
    });

    // 4. Most Consistent Week (lowest bedtime stddev)
    if (allSleep.length >= 7) {
        const sorted = [...allSleep].sort((a, b) => a.date.localeCompare(b.date));
        let bestStddev = Infinity, bestStddevDate = null;

        for (let i = 0; i <= sorted.length - 7; i++) {
            const window = sorted.slice(i, i + 7);
            const withBedtime = window.filter(e => e.bedtime).map(e => ({
                bedtime: new Date(e.bedtime)
            }));
            if (withBedtime.length >= 3) {
                const stddev = calculateBedtimeConsistency(withBedtime);
                if (stddev !== null && stddev < bestStddev) {
                    bestStddev = stddev;
                    bestStddevDate = window[6].date;
                }
            }
        }

        const currentWithBedtime = getLastNDaysLog(7).filter(d => d.bedtime);
        const currentStddev = currentWithBedtime.length >= 3
            ? calculateBedtimeConsistency(currentWithBedtime)
            : null;

        if (bestStddev < Infinity) {
            records.push({
                label: 'Most Consistent Week',
                desc: 'Lowest bedtime variability in a 7-day window',
                value: bestStddev,
                formattedValue: `\u00b1${Math.round(bestStddev)} min`,
                current: currentStddev !== null ? `Now: \u00b1${Math.round(currentStddev)} min` : null,
                date: bestStddevDate,
                approaching: currentStddev !== null && currentStddev <= bestStddev * 1.1
            });
        }
    }

    // 5. Longest Goal Streak (consecutive 100% days)
    if (goalHistory.length > 0) {
        const sortedGoals = [...goalHistory].sort((a, b) => a.date.localeCompare(b.date));
        let maxGoalStreak = 0, tempGoalStreak = 0, lastGoalDate = null;

        sortedGoals.forEach(d => {
            if (d.total > 0 && d.completed === d.total) {
                if (lastGoalDate) {
                    const prev = new Date(lastGoalDate + 'T12:00:00');
                    const curr = new Date(d.date + 'T12:00:00');
                    const diff = Math.round((curr - prev) / (1000 * 60 * 60 * 24));
                    tempGoalStreak = diff === 1 ? tempGoalStreak + 1 : 1;
                } else {
                    tempGoalStreak = 1;
                }
                lastGoalDate = d.date;
            } else {
                tempGoalStreak = 0;
                lastGoalDate = d.date;
            }
            if (tempGoalStreak > maxGoalStreak) maxGoalStreak = tempGoalStreak;
        });

        // Current goal streak
        let currentGoalStreak = 0;
        const today = localDateStr(new Date());
        const descGoals = [...goalHistory].sort((a, b) => b.date.localeCompare(a.date));
        for (const entry of descGoals) {
            if (entry.total > 0 && entry.completed === entry.total) {
                currentGoalStreak++;
            } else {
                break;
            }
        }

        records.push({
            label: 'Longest Goal Streak',
            desc: 'Consecutive days completing 100% of goals',
            value: maxGoalStreak,
            formattedValue: `${maxGoalStreak} days`,
            current: `Now: ${currentGoalStreak}`,
            date: null,
            approaching: maxGoalStreak > 0 && currentGoalStreak >= maxGoalStreak * 0.9
        });
    }

    // 6. Best Goal Week (sliding 7-day window, max avg %)
    if (goalHistory.length >= 7) {
        const sortedGoals = [...goalHistory].sort((a, b) => a.date.localeCompare(b.date));
        let bestGoalAvg = 0, bestGoalDate = null;

        for (let i = 0; i <= sortedGoals.length - 7; i++) {
            const window = sortedGoals.slice(i, i + 7);
            const avg = window.reduce((s, d) => s + (d.total > 0 ? d.completed / d.total : 0), 0) / 7;
            if (avg > bestGoalAvg) {
                bestGoalAvg = avg;
                bestGoalDate = window[6].date;
            }
        }

        // Current week avg
        const last7Dates = getLastNDaysLog(7).map(d => d.date);
        const currentGoalDays = goalHistory.filter(d => last7Dates.includes(d.date));
        const currentAvg = currentGoalDays.length > 0
            ? currentGoalDays.reduce((s, d) => s + (d.total > 0 ? d.completed / d.total : 0), 0) / currentGoalDays.length
            : 0;

        if (bestGoalAvg > 0) {
            records.push({
                label: 'Best Goal Week',
                desc: 'Highest 7-day average goal completion',
                value: bestGoalAvg,
                formattedValue: `${Math.round(bestGoalAvg * 100)}%`,
                current: currentGoalDays.length > 0 ? `This week: ${Math.round(currentAvg * 100)}%` : null,
                date: bestGoalDate,
                approaching: bestGoalAvg > 0 && currentAvg >= bestGoalAvg * 0.9
            });
        }
    }

    return records;
}

function renderRecords() {
    const container = document.getElementById('chart-records');
    if (!container) return;

    const allSleep = loadSleepLog().filter(e => e.hours);
    if (allSleep.length < 3) {
        container.innerHTML = '<div class="analytics-empty">Not enough data yet</div>';
        return;
    }

    const records = computePersonalRecords();
    if (records.length === 0) {
        container.innerHTML = '<div class="analytics-empty">Not enough data yet</div>';
        return;
    }

    let html = '<div class="records-list">';
    records.forEach(r => {
        const dateStr = r.date ? fmtDate(r.date) : '';
        const metaLine = [dateStr, r.current].filter(Boolean).join(' \u00b7 ');
        html += `
            <div class="record-row">
                <div class="record-info">
                    <span class="record-label">${r.label}</span>
                    <span class="record-desc">${r.desc || ''}</span>
                    ${metaLine ? `<span class="record-meta">${metaLine}</span>` : ''}
                </div>
                <div class="record-right">
                    <span class="record-value">${r.formattedValue}</span>
                    ${r.approaching ? '<span class="record-badge">CLOSE</span>' : ''}
                </div>
            </div>
        `;
    });
    html += '</div>';

    container.innerHTML = html;
}

// ═══════════════════════════════════════════════════════════════════════════════
// TREND INTELLIGENCE (respects range selector)
// ═══════════════════════════════════════════════════════════════════════════════

function computeTrendInsights(sleepData, goalData) {
    const insights = [];
    const daysWithSleep = sleepData.filter(d => d.hours);

    // 1. Weekend vs weekday sleep (need 7+ days)
    if (daysWithSleep.length >= 7) {
        const weekday = daysWithSleep.filter(d => {
            const day = new Date(d.date + 'T12:00:00').getDay();
            return day >= 1 && day <= 5;
        });
        const weekend = daysWithSleep.filter(d => {
            const day = new Date(d.date + 'T12:00:00').getDay();
            return day === 0 || day === 6;
        });

        if (weekday.length >= 3 && weekend.length >= 2) {
            const wdAvg = weekday.reduce((s, d) => s + d.hours, 0) / weekday.length;
            const weAvg = weekend.reduce((s, d) => s + d.hours, 0) / weekend.length;
            const diff = weAvg - wdAvg;
            if (Math.abs(diff) >= 0.3) {
                const more = diff > 0 ? 'more' : 'less';
                insights.push({
                    text: `You sleep ${Math.abs(diff).toFixed(1)}h ${more} on weekends`,
                    type: diff > 0 ? 'neutral' : 'negative'
                });
            }
        }
    }

    // 2. Sleep-goal correlation (need 5+ days with both)
    if (daysWithSleep.length >= 5 && goalData.length >= 5) {
        const goalMap = {};
        goalData.forEach(d => {
            if (d.total > 0) goalMap[d.date] = d.completed / d.total;
        });

        const good = [], bad = [];
        daysWithSleep.forEach(d => {
            if (goalMap[d.date] !== undefined) {
                if (d.hours >= 7) good.push(goalMap[d.date]);
                else bad.push(goalMap[d.date]);
            }
        });

        if (good.length >= 3 && bad.length >= 2) {
            const goodAvg = good.reduce((s, v) => s + v, 0) / good.length;
            const badAvg = bad.reduce((s, v) => s + v, 0) / bad.length;
            const diff = goodAvg - badAvg;
            if (diff > 0.05) {
                insights.push({
                    text: `${Math.round(diff * 100)}% more goals completed after 7+ hours of sleep`,
                    type: 'positive'
                });
            }
        }
    }

    // 3. Best day of week (need 14+ goal days)
    if (goalData.length >= 14) {
        const dayBuckets = Array.from({ length: 7 }, () => []);
        goalData.forEach(d => {
            if (d.total > 0) {
                const day = new Date(d.date + 'T12:00:00').getDay();
                dayBuckets[day].push(d.completed / d.total);
            }
        });

        let bestDay = -1, bestAvg = 0;
        const dayNames = ['Sundays', 'Mondays', 'Tuesdays', 'Wednesdays', 'Thursdays', 'Fridays', 'Saturdays'];
        dayBuckets.forEach((bucket, i) => {
            if (bucket.length >= 2) {
                const avg = bucket.reduce((s, v) => s + v, 0) / bucket.length;
                if (avg > bestAvg) { bestAvg = avg; bestDay = i; }
            }
        });

        if (bestDay >= 0 && bestAvg > 0.5) {
            insights.push({
                text: `${dayNames[bestDay]} are your best day (${Math.round(bestAvg * 100)}% avg)`,
                type: 'positive'
            });
        }
    }

    // 4. Bedtime drift (need 10+ bedtimes)
    const daysWithBedtime = daysWithSleep.filter(d => d.bedtime);
    if (daysWithBedtime.length >= 10) {
        // Compare first half avg vs second half avg bedtime
        const half = Math.floor(daysWithBedtime.length / 2);
        const firstHalf = daysWithBedtime.slice(0, half);
        const secondHalf = daysWithBedtime.slice(half);

        function avgBedtimeMin(days) {
            const mins = days.map(d => {
                const bt = d.bedtime;
                let m = bt.getHours() * 60 + bt.getMinutes();
                if (m > 720) m -= 1440;
                return m;
            });
            return mins.reduce((s, v) => s + v, 0) / mins.length;
        }

        const firstAvg = avgBedtimeMin(firstHalf);
        const secondAvg = avgBedtimeMin(secondHalf);
        const drift = secondAvg - firstAvg;

        if (Math.abs(drift) >= 15) {
            const direction = drift > 0 ? 'later' : 'earlier';
            insights.push({
                text: `Bedtimes drifting ${direction} \u2014 ~${Math.abs(Math.round(drift))} min over ${daysWithBedtime.length} days`,
                type: drift > 0 ? 'negative' : 'positive'
            });
        }
    }

    // 5. Recovery pattern (need 14+ days with 2+ bad nights)
    if (daysWithSleep.length >= 14) {
        const badNights = [];
        daysWithSleep.forEach((d, i) => {
            if (d.hours < 6) badNights.push(i);
        });

        if (badNights.length >= 2) {
            let totalRecovery = 0, recoveryCount = 0;
            badNights.forEach(idx => {
                // Look for next night with 7+ hours
                for (let j = idx + 1; j < daysWithSleep.length && j <= idx + 5; j++) {
                    if (daysWithSleep[j].hours >= 7) {
                        totalRecovery += (j - idx);
                        recoveryCount++;
                        break;
                    }
                }
            });

            if (recoveryCount >= 2) {
                const avgRecovery = (totalRecovery / recoveryCount).toFixed(1);
                insights.push({
                    text: `After <6h nights, you recover in ~${avgRecovery} days`,
                    type: 'neutral'
                });
            }
        }
    }

    return insights;
}

function renderTrends(sleepData, goalData) {
    const container = document.getElementById('chart-trends');
    if (!container) return;

    const daysWithSleep = sleepData.filter(d => d.hours);
    if (daysWithSleep.length < 7) {
        container.innerHTML = '<div class="analytics-empty">Need 7+ days of data for trends</div>';
        return;
    }

    const insights = computeTrendInsights(sleepData, goalData);
    if (insights.length === 0) {
        container.innerHTML = '<div class="analytics-empty">Not enough data to detect patterns yet</div>';
        return;
    }

    const typeIcons = { positive: '\u25b2', negative: '\u25bc', neutral: '\u25c6' };

    let html = '<div class="trends-list">';
    insights.forEach(ins => {
        html += `
            <div class="trend-row">
                <span class="trend-icon ${ins.type}">${typeIcons[ins.type]}</span>
                <span class="trend-text">${ins.text}</span>
            </div>
        `;
    });
    html += '</div>';

    container.innerHTML = html;
}

// ═══════════════════════════════════════════════════════════════════════════════
// BOOKS TIMELINE
// ═══════════════════════════════════════════════════════════════════════════════

function renderBooksTimeline(books) {
    const panel = document.getElementById('panel-books');
    const container = document.getElementById('chart-books');
    const subtitle = document.getElementById('books-subtitle');
    if (!container || !panel) return;

    const booksWithDate = books.filter(b => b.dateFinished);
    if (booksWithDate.length === 0) {
        panel.style.display = 'none';
        return;
    }

    panel.style.display = '';
    booksWithDate.sort((a, b) => a.dateFinished.localeCompare(b.dateFinished));

    if (subtitle) subtitle.textContent = `${booksWithDate.length} book${booksWithDate.length !== 1 ? 's' : ''} finished`;

    let html = '<div class="books-timeline" style="position: relative">';

    booksWithDate.forEach(b => {
        const ratingStr = b.rating ? `${b.rating}/10` : '';
        html += `
            <div class="books-timeline-item" title="${(b.title || '').replace(/"/g, '&quot;')}${b.author ? ' by ' + b.author.replace(/"/g, '&quot;') : ''}${ratingStr ? ' (' + ratingStr + ')' : ''}">
                <div class="books-timeline-title">${b.title || 'Untitled'}</div>
                <div class="books-timeline-dot"></div>
                <div class="books-timeline-date">${fmtDate(b.dateFinished)}</div>
            </div>
        `;
    });

    html += '</div>';
    container.innerHTML = html;
}
