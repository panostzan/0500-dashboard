// ═══════════════════════════════════════════════════════════════════════════════
// INSIGHTS - Command bar + proactive intelligence
// ═══════════════════════════════════════════════════════════════════════════════

const INSIGHTS_SHOWN_KEY = '0500_insights_shown';
const INSIGHTS_DEDUP_HOURS = 24;

// ─── Dedup Storage ───

function getInsightsShown() {
    try {
        return JSON.parse(localStorage.getItem(INSIGHTS_SHOWN_KEY) || '{}');
    } catch { return {}; }
}

function markInsightShown(id) {
    const shown = getInsightsShown();
    shown[id] = new Date().toISOString();
    safeSetItem(INSIGHTS_SHOWN_KEY, JSON.stringify(shown));
}

function wasShownRecently(id) {
    const shown = getInsightsShown();
    if (!shown[id]) return false;
    const hours = (Date.now() - new Date(shown[id]).getTime()) / (1000 * 60 * 60);
    return hours < INSIGHTS_DEDUP_HOURS;
}

// ─── Insight Generators ───
// Each returns { text, priority, id, category } or null

function insightSleepDebt(sleepLog, settings) {
    const log = getLastNDaysLog(14);
    const withData = log.filter(d => d.totalHours);
    if (withData.length < 3) return null;

    let debt = 0;
    withData.forEach(d => { debt += d.totalHours - settings.targetHours; });
    debt = Math.max(-10, Math.min(5, debt));

    if (debt >= -2) return null;
    const absDebt = Math.abs(debt).toFixed(1);
    const recovery = Math.ceil(Math.abs(debt) / 0.5);
    return {
        id: 'sleep-debt',
        category: 'SLEEP',
        priority: 8,
        text: `${absDebt}h sleep debt over 2 weeks. ~${recovery} recovery nights needed.`
    };
}

function insightSleepStreak() {
    const streak = calculateSleepStreak();
    if (streak.current < 3) return null;
    return {
        id: 'sleep-streak',
        category: 'SLEEP',
        priority: 6,
        text: `${streak.current}-day sleep streak. Longest ever: ${streak.longest} days.`
    };
}

function insightSleepConsistency() {
    const log = getLastNDaysLog(7);
    const daysWithBedtime = log.filter(d => d.bedtime);
    if (daysWithBedtime.length < 3) return null;

    const sd = calculateBedtimeConsistency(daysWithBedtime);
    if (sd === null || sd <= 60) return null;

    return {
        id: 'sleep-consistency',
        category: 'SLEEP',
        priority: 5,
        text: `Bedtime varied by ${Math.round(sd)} min this week. Consistency improves sleep quality.`
    };
}

function insightSleepTrend(settings) {
    const thisWeek = getLastNDaysLog(7);
    const lastWeek = getLastNDaysLog(14).slice(0, 7);

    const thisData = thisWeek.filter(d => d.hours);
    const lastData = lastWeek.filter(d => d.hours);
    if (thisData.length < 3 || lastData.length < 3) return null;

    const thisAvg = thisData.reduce((s, d) => s + d.hours, 0) / thisData.length;
    const lastAvg = lastData.reduce((s, d) => s + d.hours, 0) / lastData.length;
    const diff = thisAvg - lastAvg;

    if (Math.abs(diff) < 0.3) return null;

    const direction = diff > 0 ? 'up' : 'down';
    return {
        id: 'sleep-trend',
        category: 'SLEEP',
        priority: 5,
        text: `Sleep trending ${direction} — ${thisAvg.toFixed(1)}h avg vs ${lastAvg.toFixed(1)}h last week.`
    };
}

function insightSleepBestNight() {
    const log = getLastNDaysLog(7);
    const withData = log.filter(d => d.hours);
    if (withData.length < 3) return null;

    const best = withData.reduce((a, b) => a.hours > b.hours ? a : b);
    const lastEntry = withData[withData.length - 1];
    if (!lastEntry || lastEntry.date !== best.date) return null;

    return {
        id: 'sleep-best-night',
        category: 'SLEEP',
        priority: 4,
        text: `Last night was your best sleep this week — ${best.hours.toFixed(1)}h.`
    };
}

function insightGoalsHotStreak(goalHistory) {
    if (goalHistory.length < 3) return null;
    const recent = goalHistory.slice(-7);

    let streak = 0;
    for (let i = recent.length - 1; i >= 0; i--) {
        const pct = recent[i].total > 0 ? recent[i].completed / recent[i].total : 0;
        if (pct >= 0.8) streak++;
        else break;
    }
    if (streak < 3) return null;

    const avgPct = recent.slice(-streak).reduce((s, d) =>
        s + (d.total > 0 ? d.completed / d.total : 0), 0) / streak;

    return {
        id: 'goals-hot-streak',
        category: 'GOALS',
        priority: 7,
        text: `${streak}-day goal streak at ${Math.round(avgPct * 100)}% completion. Keep it up.`
    };
}

function insightGoalsSlipping(goalHistory) {
    if (goalHistory.length < 3) return null;
    const recent = goalHistory.slice(-7);

    let streak = 0;
    for (let i = recent.length - 1; i >= 0; i--) {
        const pct = recent[i].total > 0 ? recent[i].completed / recent[i].total : 0;
        if (pct < 0.4) streak++;
        else break;
    }
    if (streak < 3) return null;

    const avgPct = recent.slice(-streak).reduce((s, d) =>
        s + (d.total > 0 ? d.completed / d.total : 0), 0) / streak;

    return {
        id: 'goals-slipping',
        category: 'GOALS',
        priority: 6,
        text: `Daily goals dropped to ${Math.round(avgPct * 100)}% this week. Consider trimming the list.`
    };
}

function insightGoalsMilestone(goals) {
    const timestamps = JSON.parse(localStorage.getItem('0500_midterm_completed') || '{}');
    const oneYearTs = JSON.parse(localStorage.getItem('0500_oneyear_completed') || '{}');
    const all = { ...timestamps, ...oneYearTs };

    const now = Date.now();
    let recentGoal = null;
    let recentTime = 0;

    for (const [id, ts] of Object.entries(all)) {
        const t = new Date(ts).getTime();
        if (now - t < 72 * 60 * 60 * 1000 && t > recentTime) {
            recentTime = t;
            for (const cat of ['midTerm', 'oneYear']) {
                const g = (goals[cat] || []).find(g => String(g.id) === String(id));
                if (g) { recentGoal = { text: g.text, cat }; break; }
            }
        }
    }
    if (!recentGoal) return null;

    const label = recentGoal.cat === 'oneYear' ? '1-year milestone' : 'mid-term goal';
    return {
        id: 'goals-milestone',
        category: 'GOALS',
        priority: 9,
        text: `You completed "${recentGoal.text}" — ${label}.`
    };
}

function insightGoalsUnfinished(goals) {
    const hour = new Date().getHours();
    if (hour < 12) return null;

    const daily = goals.daily || [];
    const unchecked = daily.filter(g => !g.checked).length;
    if (unchecked <= 5) return null;

    return {
        id: 'goals-unfinished',
        category: 'GOALS',
        priority: 4,
        text: `${unchecked} daily goals still open. Focus on the top 3?`
    };
}

function insightCrossSleepGoals(goalHistory, settings) {
    if (goalHistory.length < 7) return null;

    const sleepLog = loadSleepLog();
    const sleepByDate = {};
    sleepLog.forEach(e => { sleepByDate[e.date] = e.hours; });

    let goodSleepCompletion = [];
    let poorSleepCompletion = [];

    goalHistory.forEach(day => {
        const hours = sleepByDate[day.date];
        if (!hours || day.total === 0) return;
        const pct = day.completed / day.total;
        if (hours >= settings.targetHours) goodSleepCompletion.push(pct);
        else poorSleepCompletion.push(pct);
    });

    if (goodSleepCompletion.length < 3 || poorSleepCompletion.length < 3) return null;

    const goodAvg = goodSleepCompletion.reduce((a, b) => a + b, 0) / goodSleepCompletion.length;
    const poorAvg = poorSleepCompletion.reduce((a, b) => a + b, 0) / poorSleepCompletion.length;
    const diff = goodAvg - poorAvg;

    if (diff < 0.15) return null;

    const targetH = Math.round(settings.targetHours);
    return {
        id: 'cross-sleep-goals',
        category: 'CROSS',
        priority: 7,
        text: `On ${targetH}h+ sleep nights, you complete ${Math.round(diff * 100)}% more goals.`
    };
}

function insightScheduleEmpty(schedule) {
    const hasContent = schedule.some(e => (e.activity || '').trim().length > 0);
    if (hasContent) return null;

    return {
        id: 'schedule-empty',
        category: 'SCHEDULE',
        priority: 3,
        text: 'No schedule today. Unstructured day or forgot to plan?'
    };
}

function insightSleepNoLog() {
    const log = loadSleepLog();
    if (log.length === 0) return null;

    const sorted = [...log].sort((a, b) => new Date(b.date) - new Date(a.date));
    const latest = new Date(sorted[0].date);
    const days = Math.floor((Date.now() - latest.getTime()) / (1000 * 60 * 60 * 24));

    if (days < 2) return null;

    return {
        id: 'sleep-no-log',
        category: 'SLEEP',
        priority: 4,
        text: `No sleep logged in ${days} days. Quick log keeps your data accurate.`
    };
}

// ─── Engine ───

async function generateInsights() {
    const sleepLog = await DataService.loadSleepLog();
    const goals = await DataService.loadGoals();
    const goalHistory = DataService.loadDailyGoalHistory();
    const settings = await DataService.loadSleepSettings();
    const schedule = await DataService.loadSchedule();

    // Hydrate sleep caches so sync helpers work
    if (typeof sleepLogCache !== 'undefined' && !sleepLogCache) {
        sleepLogCache = sleepLog;
    }
    if (typeof sleepSettingsCache !== 'undefined' && !sleepSettingsCache) {
        sleepSettingsCache = settings;
    }

    const candidates = [
        insightSleepDebt(sleepLog, settings),
        insightSleepStreak(),
        insightSleepConsistency(),
        insightSleepTrend(settings),
        insightSleepBestNight(),
        insightGoalsHotStreak(goalHistory),
        insightGoalsSlipping(goalHistory),
        insightGoalsMilestone(goals),
        insightGoalsUnfinished(goals),
        insightCrossSleepGoals(goalHistory, settings),
        insightScheduleEmpty(schedule),
        insightSleepNoLog()
    ].filter(Boolean);

    // Sort by priority descending, no dedup filtering for on-demand
    candidates.sort((a, b) => b.priority - a.priority);
    return candidates;
}

// ─── Query Parsing ───

function parseQuery(raw) {
    const q = raw.toLowerCase().trim();
    if (!q) return { filter: null, limit: 3 };

    // Sleep-specific queries
    if (/sleep\s*debt|deficit|recovery/.test(q))
        return { filter: ids => ids.filter(i => i.id === 'sleep-debt'), limit: 1 };
    if (/streak/.test(q))
        return { filter: ids => ids.filter(i => i.id.includes('streak')), limit: 2 };
    if (/consisten|bedtime|routine/.test(q))
        return { filter: ids => ids.filter(i => i.id === 'sleep-consistency'), limit: 1 };
    if (/trend|week|average/.test(q))
        return { filter: ids => ids.filter(i => i.id === 'sleep-trend'), limit: 1 };
    if (/best.*night|last.*night/.test(q))
        return { filter: ids => ids.filter(i => i.id === 'sleep-best-night'), limit: 1 };

    // Category queries
    if (/sleep|rest|tired|energy/.test(q))
        return { filter: ids => ids.filter(i => i.category === 'SLEEP'), limit: 3 };
    if (/goal|habit|task|progress|completion/.test(q))
        return { filter: ids => ids.filter(i => i.category === 'GOALS'), limit: 3 };
    if (/schedule|plan|calendar|today/.test(q))
        return { filter: ids => ids.filter(i => i.category === 'SCHEDULE'), limit: 2 };
    if (/correlat|cross|connect|relation/.test(q))
        return { filter: ids => ids.filter(i => i.category === 'CROSS'), limit: 2 };

    // Summary queries — show everything
    if (/how.*doing|status|summary|overview|everything|all|insight|brief/.test(q))
        return { filter: null, limit: 4 };

    // Fallback — show all
    return { filter: null, limit: 3 };
}

// ─── Rendering ───

function renderIntelBody(insights, emptyMsg) {
    const body = document.getElementById('intel-body');
    if (!body) return;

    body.innerHTML = '';

    if (insights.length === 0) {
        body.innerHTML = `<div class="intel-empty">${emptyMsg || 'No insights right now. Keep logging data.'}</div>`;
        return;
    }

    insights.forEach((insight, i) => {
        const item = document.createElement('div');
        item.className = 'intel-item';
        item.style.animationDelay = `${i * 100}ms`;
        item.innerHTML = `
            <div class="intel-item-category">${insight.category}</div>
            <div class="intel-item-text">${insight.text}</div>
        `;
        body.appendChild(item);
        markInsightShown(insight.id);
    });
}

async function triggerInsights(query) {
    const body = document.getElementById('intel-body');
    if (!body) return;

    body.innerHTML = '<div class="intel-empty">thinking...</div>';

    try {
        const all = await generateInsights();
        const parsed = parseQuery(query || '');

        let results = parsed.filter ? parsed.filter(all) : all;
        results = results.slice(0, parsed.limit);

        let emptyMsg = 'No insights right now. Keep logging data.';
        if (query) {
            const q = query.toLowerCase();
            if (/sleep/.test(q)) emptyMsg = 'No sleep insights yet. Log a few nights first.';
            else if (/goal/.test(q)) emptyMsg = 'No goal insights yet. Complete a few daily goals first.';
            else if (/schedule/.test(q)) emptyMsg = 'Schedule looks fine. Nothing to flag.';
        }

        renderIntelBody(results, emptyMsg);
    } catch (e) {
        console.warn('[Insights] Failed:', e);
        body.innerHTML = '';
    }
}

// ─── Init ───

function initInsights() {
    const chip = document.getElementById('chip-intel');
    const card = document.getElementById('intel-card');
    const input = document.getElementById('intel-input');
    const refreshBtn = document.getElementById('intel-refresh');
    if (!chip || !card) return;

    // Toggle card
    chip.addEventListener('click', () => {
        const isOpen = card.classList.toggle('open');
        chip.classList.toggle('active', isOpen);

        // Load insights on first open
        if (isOpen && !document.getElementById('intel-body').children.length) {
            triggerInsights('');
        }
    });

    // Refresh button
    if (refreshBtn) {
        refreshBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            triggerInsights(input ? input.value : '');
        });
    }

    // Input — filter on Enter
    if (input) {
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                triggerInsights(input.value);
            }
        });
    }
}
