// ═══════════════════════════════════════════════════════════════════════════════
// JARVIS — Personal intelligence assistant
// ═══════════════════════════════════════════════════════════════════════════════

const INSIGHTS_SHOWN_KEY = '0500_insights_shown';
const INSIGHTS_DEDUP_HOURS = 24;
const JARVIS_MEMORY_KEY = '0500_jarvis_memory';

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

// ─── Utility ───

function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

// ─── Memory System ───

function loadJarvisMemory() {
    try { return JSON.parse(localStorage.getItem(JARVIS_MEMORY_KEY) || '[]'); }
    catch { return []; }
}

function saveJarvisMemory(memories) {
    safeSetItem(JARVIS_MEMORY_KEY, JSON.stringify(memories));
}

function handleRemember(text) {
    if (!text.trim()) return "Remember what exactly?";
    const memories = loadJarvisMemory();
    memories.push({ text: text.trim(), timestamp: new Date().toISOString() });
    saveJarvisMemory(memories);
    return "Got it. I'll remember that.";
}

function handleForget(keyword) {
    if (!keyword.trim()) return "Forget what?";
    const memories = loadJarvisMemory();
    const kw = keyword.toLowerCase().trim();
    const before = memories.length;
    const filtered = memories.filter(m => !m.text.toLowerCase().includes(kw));
    if (filtered.length === before) return `Nothing in my memory about "${escapeHtml(keyword.trim())}".`;
    saveJarvisMemory(filtered);
    const count = before - filtered.length;
    return `Forgotten. Removed ${count} memor${count === 1 ? 'y' : 'ies'}.`;
}

function handleRecall() {
    const memories = loadJarvisMemory();
    if (memories.length === 0) return "Nothing stored yet. Tell me to remember something.";
    const recent = memories.slice(-10).reverse();
    const lines = recent.map(m => {
        const d = new Date(m.timestamp);
        const dateStr = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        return `• ${escapeHtml(m.text)} (${dateStr})`;
    });
    return lines.join('\n');
}

function searchMemory(query) {
    const memories = loadJarvisMemory();
    if (memories.length === 0) return null;
    const words = query.toLowerCase().split(/\s+/).filter(w => w.length > 2);
    if (words.length === 0) return null;
    const matches = memories.filter(m => {
        const txt = m.text.toLowerCase();
        return words.some(w => txt.includes(w));
    });
    if (matches.length === 0) return null;
    const lines = matches.slice(-5).reverse().map(m => {
        const d = new Date(m.timestamp);
        const dateStr = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        return `• ${escapeHtml(m.text)} (${dateStr})`;
    });
    return `Found in my memory:\n${lines.join('\n')}`;
}

// ─── Time-aware greeting ───

function getJarvisGreeting() {
    const h = new Date().getHours();
    const greetings = {
        lateNight: [
            "Burning the midnight oil again.",
            "We both know you should be asleep.",
            "I don't sleep, but you should.",
        ],
        earlyMorning: [
            "Up before the sun. Respect.",
            "Good morning. Coffee first, then world domination.",
            "Early bird gets the worm. You're the bird.",
        ],
        morning: [
            "Morning. What are we conquering today?",
            "Good morning. I've been thinking about your data.",
            "Rise and grind, or whatever the kids say.",
        ],
        afternoon: [
            "Afternoon check-in. How's the day going?",
            "Halfway through the day. Let's see where you're at.",
            "Quick afternoon pulse.",
        ],
        evening: [
            "Winding down? Here's your evening read.",
            "Evening. Let's review the day.",
            "Almost bedtime. How'd you do today?",
        ],
    };
    let pool;
    if (h < 5)       pool = greetings.lateNight;
    else if (h < 8)  pool = greetings.earlyMorning;
    else if (h < 12) pool = greetings.morning;
    else if (h < 17) pool = greetings.afternoon;
    else              pool = greetings.evening;
    return pool[Math.floor(Math.random() * pool.length)];
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
        text: `You're ${absDebt}h in sleep debt over the last 2 weeks. That's roughly ${recovery} good nights to break even. Maybe skip the late scroll tonight.`
    };
}

function insightSleepStreak() {
    const streak = calculateSleepStreak();
    if (streak.current < 3) return null;
    const atRecord = streak.current >= streak.longest;
    return {
        id: 'sleep-streak',
        category: 'SLEEP',
        priority: 6,
        text: atRecord
            ? `${streak.current}-day sleep streak — that's a new personal best. Don't blow it tonight.`
            : `${streak.current}-day sleep streak going. Record is ${streak.longest}. You know what to do.`
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
        text: `Your bedtime's been all over the place — ${Math.round(sd)} min variance this week. Pick a time and stick to it, your body will thank you.`
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

    const comment = diff > 0
        ? `Nice — up from ${lastAvg.toFixed(1)}h last week. Keep that going.`
        : `Down from ${lastAvg.toFixed(1)}h last week. Something eating into your nights?`;
    return {
        id: 'sleep-trend',
        category: 'SLEEP',
        priority: 5,
        text: `Sleep averaging ${thisAvg.toFixed(1)}h this week. ${comment}`
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
        text: `Last night was your best sleep all week — ${best.hours.toFixed(1)}h. Whatever you did yesterday, do it again.`
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
        text: `${streak} days straight crushing goals at ${Math.round(avgPct * 100)}%. You're locked in right now.`
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
        text: `Goals have been slipping — ${Math.round(avgPct * 100)}% for ${streak} days now. Either the goals are too ambitious or you're coasting. Be honest with yourself.`
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
        text: `"${recentGoal.text}" — ${label} done. That's a big one. You should feel good about that.`
    };
}

function insightGoalsUnfinished(goals) {
    const hour = new Date().getHours();
    if (hour < 12) return null;

    const daily = goals.daily || [];
    const unchecked = daily.filter(g => !g.checked).length;
    const total = daily.length;
    if (unchecked <= 5 || total === 0) return null;

    const pct = Math.round(((total - unchecked) / total) * 100);
    return {
        id: 'goals-unfinished',
        category: 'GOALS',
        priority: 4,
        text: `${unchecked} of ${total} goals still unchecked (${pct}% done). Day's not over — but it's getting there.`
    };
}

function insightGoalsYesterdayMissed() {
    const history = DataService.loadDailyGoalHistory();
    if (history.length === 0) return null;

    const yesterday = history[history.length - 1];
    if (!yesterday || !yesterday.goals) return null;

    const missed = yesterday.goals.filter(g => !g.done);
    if (missed.length === 0) return null;

    const missedNames = missed.slice(0, 3).map(g => g.text).join(', ');
    const extra = missed.length > 3 ? ` +${missed.length - 3} more` : '';
    return {
        id: 'goals-yesterday-missed',
        category: 'GOALS',
        priority: 5,
        text: `Left on the table yesterday: ${missedNames}${extra}. Still worth doing or should we let those go?`
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

    return {
        id: 'cross-sleep-goals',
        category: 'CROSS',
        priority: 7,
        text: `Here's a fun stat — you crush ${Math.round(diff * 100)}% more goals on nights you sleep ${Math.round(settings.targetHours)}h+. Sleep literally makes you better at everything.`
    };
}

function insightScheduleEmpty(schedule) {
    const hasContent = schedule.some(e => (e.activity || '').trim().length > 0);
    if (hasContent) return null;

    return {
        id: 'schedule-empty',
        category: 'SCHEDULE',
        priority: 3,
        text: 'No schedule yet. Winging it today or just haven\'t gotten to it?'
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
        text: `Haven't seen a sleep log in ${days} days. I can't help if you don't give me data.`
    };
}

// ─── People Insights ───

function insightPeopleStale() {
    try {
        const people = JSON.parse(localStorage.getItem('0500_people') || '[]');
        if (people.length === 0) return null;

        const stale = people.filter(p => {
            if (!p.lastContact || !p.name) return false;
            const days = Math.floor((Date.now() - new Date(p.lastContact).getTime()) / (1000 * 60 * 60 * 24));
            return days > 30;
        });

        if (stale.length === 0) return null;

        // Sort by stalest first
        stale.sort((a, b) => new Date(a.lastContact) - new Date(b.lastContact));
        const top = stale.slice(0, 3).map(p => p.name).join(', ');
        const extra = stale.length > 3 ? ` and ${stale.length - 3} others` : '';

        return {
            id: 'people-stale',
            category: 'NETWORK',
            priority: 5,
            text: `${top}${extra} — it's been a while. A quick text goes a long way.`
        };
    } catch { return null; }
}

function insightPeopleRecent() {
    try {
        const people = JSON.parse(localStorage.getItem('0500_people') || '[]');
        if (people.length === 0) return null;

        const thisWeek = people.filter(p => {
            if (!p.lastContact) return false;
            const days = Math.floor((Date.now() - new Date(p.lastContact).getTime()) / (1000 * 60 * 60 * 24));
            return days <= 7;
        });

        if (thisWeek.length < 2) return null;

        return {
            id: 'people-active',
            category: 'NETWORK',
            priority: 3,
            text: `${thisWeek.length} people talked to this week. You're being social — keep it up.`
        };
    } catch { return null; }
}

function insightPeopleNoNotes() {
    try {
        const people = JSON.parse(localStorage.getItem('0500_people') || '[]');
        const noNotes = people.filter(p => p.name && (!p.notes || !p.notes.trim()));
        if (noNotes.length < 3) return null;

        return {
            id: 'people-no-notes',
            category: 'NETWORK',
            priority: 2,
            text: `${noNotes.length} people with no notes. You'll forget what you talked about — future you will be annoyed.`
        };
    } catch { return null; }
}

// ─── Books Insights ───

function insightBooksReadingPace() {
    try {
        const books = JSON.parse(localStorage.getItem('0500_books') || '[]');
        const read = books.filter(b => (b.status || '').toLowerCase() === 'read' && b.date);

        if (read.length < 3) return null;

        // Books read in last 90 days
        const now = Date.now();
        const recent = read.filter(b => {
            const d = new Date(b.date);
            return !isNaN(d.getTime()) && (now - d.getTime()) < 90 * 24 * 60 * 60 * 1000;
        });

        if (recent.length === 0) return null;

        const pace = (recent.length / 3).toFixed(1);
        const projected = Math.round(recent.length * 4);

        return {
            id: 'books-pace',
            category: 'BOOKS',
            priority: 3,
            text: `${pace} books/month lately. At this pace that's ~${projected} this year. Not bad at all.`
        };
    } catch { return null; }
}

function insightBooksCurrently() {
    try {
        const books = JSON.parse(localStorage.getItem('0500_books') || '[]');
        const reading = books.filter(b => (b.status || '').toLowerCase() === 'reading');
        const wantToRead = books.filter(b => (b.status || '').toLowerCase() === 'want to read');

        if (reading.length === 0 && wantToRead.length === 0) return null;

        let text = '';
        if (reading.length > 0) {
            text = `You're in the middle of ${reading.map(b => b.title).join(', ')}.`;
            if (wantToRead.length > 0) text += ` ${wantToRead.length} more waiting in the queue.`;
        } else {
            text = `${wantToRead.length} book${wantToRead.length > 1 ? 's' : ''} on your list gathering dust. Pick one up.`;
        }

        return {
            id: 'books-current',
            category: 'BOOKS',
            priority: 2,
            text
        };
    } catch { return null; }
}

function insightBooksTopRated() {
    try {
        const books = JSON.parse(localStorage.getItem('0500_books') || '[]');
        const rated = books.filter(b => b.rating && (b.status || '').toLowerCase() === 'read');
        if (rated.length < 5) return null;

        const avg = rated.reduce((s, b) => s + Number(b.rating), 0) / rated.length;
        const tens = rated.filter(b => Number(b.rating) === 10);

        if (tens.length === 0) return null;

        return {
            id: 'books-top',
            category: 'BOOKS',
            priority: 2,
            text: `${tens.length} perfect 10s out of ${rated.length} rated. You've got taste — average score ${avg.toFixed(1)}/10.`
        };
    } catch { return null; }
}

// ─── Day-of-Week Pattern Insights ───

function insightSleepBestWorstDay() {
    const log = getLastNDaysLog(28);
    const dayNames = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
    const byDay = {};
    log.forEach(d => {
        if (!d.hours) return;
        const day = new Date(d.date).getDay();
        if (!byDay[day]) byDay[day] = [];
        byDay[day].push(d.hours);
    });
    const avgs = Object.entries(byDay).map(([day, hrs]) => ({
        day: dayNames[day],
        avg: hrs.reduce((a, b) => a + b, 0) / hrs.length,
        count: hrs.length
    }));
    if (avgs.length < 3) return null;
    avgs.sort((a, b) => b.avg - a.avg);
    const best = avgs[0];
    const worst = avgs[avgs.length - 1];
    if (best.avg - worst.avg < 0.3) return null;
    return {
        id: 'sleep-best-worst-day',
        category: 'SLEEP',
        priority: 4,
        text: `Best sleep day: ${best.day} (${best.avg.toFixed(1)}h). Worst: ${worst.day} (${worst.avg.toFixed(1)}h).`
    };
}

function insightGoalsDayPattern() {
    const history = DataService.loadDailyGoalHistory();
    if (history.length < 14) return null;
    const dayNames = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
    const byDay = {};
    history.slice(-28).forEach(d => {
        if (!d.date || !d.total) return;
        const day = new Date(d.date).getDay();
        if (!byDay[day]) byDay[day] = { completed: 0, total: 0 };
        byDay[day].completed += d.completed || 0;
        byDay[day].total += d.total;
    });
    const rates = Object.entries(byDay)
        .filter(([, v]) => v.total >= 2)
        .map(([day, v]) => ({ day: dayNames[day], rate: v.completed / v.total }));
    if (rates.length < 3) return null;
    rates.sort((a, b) => b.rate - a.rate);
    const best = rates[0];
    const worst = rates[rates.length - 1];
    if (best.rate - worst.rate < 0.15) return null;
    return {
        id: 'goals-day-pattern',
        category: 'GOALS',
        priority: 4,
        text: `You crush it on ${best.day} (${Math.round(best.rate * 100)}%). ${worst.day}? ${Math.round(worst.rate * 100)}%.`
    };
}

function insightSleepWeekendVsWeekday() {
    const log = getLastNDaysLog(28);
    const weekend = [];
    const weekday = [];
    log.forEach(d => {
        if (!d.hours) return;
        const day = new Date(d.date).getDay();
        if (day === 0 || day === 6) weekend.push(d.hours);
        else weekday.push(d.hours);
    });
    if (weekend.length < 3 || weekday.length < 5) return null;
    const wkndAvg = weekend.reduce((a, b) => a + b, 0) / weekend.length;
    const wkdayAvg = weekday.reduce((a, b) => a + b, 0) / weekday.length;
    const diff = wkndAvg - wkdayAvg;
    if (Math.abs(diff) < 0.3) return null;
    const more = diff > 0 ? 'more' : 'less';
    return {
        id: 'sleep-weekend-weekday',
        category: 'SLEEP',
        priority: 3,
        text: `You sleep ${Math.abs(diff).toFixed(1)}h ${more} on weekends (${wkndAvg.toFixed(1)}h vs ${wkdayAvg.toFixed(1)}h weekday).`
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
        // Sleep
        insightSleepDebt(sleepLog, settings),
        insightSleepStreak(),
        insightSleepConsistency(),
        insightSleepTrend(settings),
        insightSleepBestNight(),
        insightSleepNoLog(),
        // Goals
        insightGoalsHotStreak(goalHistory),
        insightGoalsSlipping(goalHistory),
        insightGoalsMilestone(goals),
        insightGoalsUnfinished(goals),
        insightGoalsYesterdayMissed(),
        // Cross
        insightCrossSleepGoals(goalHistory, settings),
        // Schedule
        insightScheduleEmpty(schedule),
        // People
        insightPeopleStale(),
        insightPeopleRecent(),
        insightPeopleNoNotes(),
        // Books
        insightBooksReadingPace(),
        insightBooksCurrently(),
        insightBooksTopRated(),
        // Day-of-week patterns
        insightSleepBestWorstDay(),
        insightGoalsDayPattern(),
        insightSleepWeekendVsWeekday()
    ].filter(Boolean);

    candidates.sort((a, b) => b.priority - a.priority);
    return candidates;
}

// ─── NL Query Router (Tier 1) ───

async function routeQuery(query) {
    const q = query.toLowerCase().trim();
    if (!q) return null;

    // Memory commands (highest priority)
    const rememberMatch = q.match(/^remember\s+(.+)/i);
    if (rememberMatch) return { text: handleRemember(rememberMatch[1]), category: 'MEMORY' };

    if (/^(what do you remember|what.*you.*stored|show.*memor|my memories)/.test(q))
        return { text: handleRecall(), category: 'MEMORY' };

    const forgetMatch = q.match(/^forget\s+(?:about\s+)?(.+)/i);
    if (forgetMatch) return { text: handleForget(forgetMatch[1]), category: 'MEMORY' };

    // People queries
    const people = (() => {
        try { return JSON.parse(localStorage.getItem('0500_people') || '[]'); }
        catch { return []; }
    })();

    if (/who.*(meet|met|talk|spoke|seen|contact).*(?:this|last)\s*week/.test(q) && people.length) {
        const daysBack = /last\s*week/.test(q) ? 14 : 7;
        const cutoff = Date.now() - daysBack * 24 * 60 * 60 * 1000;
        const start = /last\s*week/.test(q) ? cutoff : Date.now() - 7 * 24 * 60 * 60 * 1000;
        const met = people.filter(p => {
            if (!p.lastContact) return false;
            const t = new Date(p.lastContact).getTime();
            return t >= start && t <= Date.now();
        });
        if (met.length === 0) return { text: `No contacts logged ${/last/.test(q) ? 'last' : 'this'} week.`, category: 'NETWORK' };
        const names = met.map(p => p.name).join(', ');
        return { text: `${met.length} people: ${names}`, category: 'NETWORK' };
    }

    if (/when.*(last|did).*(talk|spoke|met|contact|see)\s+(?:to\s+|with\s+)?(\w+)/i.test(q) && people.length) {
        const nameMatch = q.match(/(?:talk|spoke|met|contact|see)\s+(?:to\s+|with\s+)?(\w+)/i);
        if (nameMatch) {
            const name = nameMatch[1].toLowerCase();
            const person = people.find(p => p.name && p.name.toLowerCase().includes(name));
            if (person && person.lastContact) {
                const days = Math.floor((Date.now() - new Date(person.lastContact).getTime()) / (1000 * 60 * 60 * 24));
                const dateStr = new Date(person.lastContact).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                return { text: `Last contact with ${escapeHtml(person.name)}: ${dateStr} (${days} day${days !== 1 ? 's' : ''} ago).`, category: 'NETWORK' };
            }
            return { text: `No one named "${escapeHtml(nameMatch[1])}" in your contacts.`, category: 'NETWORK' };
        }
    }

    if (/who.*(haven.t|have not|havent).*(talk|contact|reach)/.test(q) && people.length) {
        const stale = people.filter(p => p.name && p.lastContact)
            .sort((a, b) => new Date(a.lastContact) - new Date(b.lastContact))
            .slice(0, 5);
        if (stale.length === 0) return { text: 'No contact history to check.', category: 'NETWORK' };
        const lines = stale.map(p => {
            const days = Math.floor((Date.now() - new Date(p.lastContact).getTime()) / (1000 * 60 * 60 * 24));
            return `• ${escapeHtml(p.name)} — ${days} days`;
        });
        return { text: `Longest gaps:\n${lines.join('\n')}`, category: 'NETWORK' };
    }

    // Sleep queries
    if (/how.*(sleep|slept).*(on\s+)?(monday|tuesday|wednesday|thursday|friday|saturday|sunday|mon|tue|wed|thu|fri|sat|sun)/i.test(q)) {
        const dayMatch = q.match(/(monday|tuesday|wednesday|thursday|friday|saturday|sunday|mon|tue|wed|thu|fri|sat|sun)/i);
        if (dayMatch) {
            const dayNames = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];
            const short = ['sun','mon','tue','wed','thu','fri','sat'];
            const input = dayMatch[1].toLowerCase();
            const dayIdx = dayNames.findIndex(d => d.startsWith(input)) !== -1
                ? dayNames.findIndex(d => d.startsWith(input))
                : short.indexOf(input);
            if (dayIdx >= 0) {
                const log = getLastNDaysLog(90);
                const dayLog = log.filter(d => {
                    const dt = new Date(d.date);
                    return dt.getDay() === dayIdx && d.hours;
                });
                if (dayLog.length === 0) return { text: `No sleep data for ${dayNames[dayIdx]}s yet.`, category: 'SLEEP' };
                const avg = dayLog.reduce((s, d) => s + d.hours, 0) / dayLog.length;
                const best = Math.max(...dayLog.map(d => d.hours));
                const worst = Math.min(...dayLog.map(d => d.hours));
                return {
                    text: `${dayNames[dayIdx].charAt(0).toUpperCase() + dayNames[dayIdx].slice(1)} sleep (${dayLog.length} entries):\nAvg: ${avg.toFixed(1)}h | Best: ${best.toFixed(1)}h | Worst: ${worst.toFixed(1)}h`,
                    category: 'SLEEP'
                };
            }
        }
    }

    if (/(?:what|which).*(best|worst)\s*sleep\s*day/.test(q)) {
        const log = getLastNDaysLog(90);
        const dayNames = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
        const byDay = {};
        log.forEach(d => {
            if (!d.hours) return;
            const day = new Date(d.date).getDay();
            if (!byDay[day]) byDay[day] = [];
            byDay[day].push(d.hours);
        });
        const avgs = Object.entries(byDay).map(([day, hrs]) => ({
            day: dayNames[day], avg: hrs.reduce((a, b) => a + b, 0) / hrs.length
        }));
        if (avgs.length < 2) return { text: 'Not enough sleep data across different days yet.', category: 'SLEEP' };
        avgs.sort((a, b) => b.avg - a.avg);
        return {
            text: `Best: ${avgs[0].day} (${avgs[0].avg.toFixed(1)}h). Worst: ${avgs[avgs.length - 1].day} (${avgs[avgs.length - 1].avg.toFixed(1)}h).`,
            category: 'SLEEP'
        };
    }

    if (/sleep\s*score/.test(q)) {
        const log = getLastNDaysLog(7);
        const withData = log.filter(d => d.hours);
        if (withData.length < 3) return { text: "Need at least 3 nights of data for a score.", category: 'SLEEP' };
        const score = calculateSleepScore(withData);
        let comment = score >= 85 ? "Elite." : score >= 70 ? "Solid." : score >= 50 ? "Room for improvement." : "We need to talk.";
        return { text: `Sleep score: ${score}/100. ${comment}`, category: 'SLEEP' };
    }

    // Books queries
    const books = (() => {
        try { return JSON.parse(localStorage.getItem('0500_books') || '[]'); }
        catch { return []; }
    })();

    if (/how many books/.test(q) && books.length > 0) {
        const read = books.filter(b => (b.status || '').toLowerCase() === 'read').length;
        const reading = books.filter(b => (b.status || '').toLowerCase() === 'reading').length;
        const want = books.filter(b => (b.status || '').toLowerCase() === 'want to read').length;
        const parts = [];
        if (read) parts.push(`${read} read`);
        if (reading) parts.push(`${reading} reading`);
        if (want) parts.push(`${want} queued`);
        return { text: `${books.length} total. ${parts.join(', ')}.`, category: 'BOOKS' };
    }

    if (/(?:what|which).*(rat(?:ed?|ing)).*(above|over|higher)\s*(\d+)/.test(q) && books.length > 0) {
        const threshMatch = q.match(/(above|over|higher)\s*(\d+)/);
        const thresh = threshMatch ? parseInt(threshMatch[2]) : 8;
        const top = books.filter(b => b.rating && Number(b.rating) > thresh && (b.status || '').toLowerCase() === 'read');
        if (top.length === 0) return { text: `No books rated above ${thresh}.`, category: 'BOOKS' };
        const titles = top.slice(0, 5).map(b => `• ${escapeHtml(b.title)} (${b.rating}/10)`);
        const extra = top.length > 5 ? `\n+${top.length - 5} more` : '';
        return { text: titles.join('\n') + extra, category: 'BOOKS' };
    }

    if (/best books|top.*(rated|books)|favorite books/.test(q) && books.length > 0) {
        const rated = books.filter(b => b.rating && (b.status || '').toLowerCase() === 'read')
            .sort((a, b) => Number(b.rating) - Number(a.rating));
        if (rated.length === 0) return { text: "No rated books yet.", category: 'BOOKS' };
        const top = rated.slice(0, 5).map(b => `• ${escapeHtml(b.title)} (${b.rating}/10)`);
        return { text: `Top rated:\n${top.join('\n')}`, category: 'BOOKS' };
    }

    // Goals queries
    if (/what are my goals|my goals|current goals|list.*goals/.test(q)) {
        const goals = await DataService.loadGoals();
        const daily = (goals.daily || []).filter(g => !g.checked);
        if (daily.length === 0) return { text: "All daily goals checked off. Nice.", category: 'GOALS' };
        const list = daily.slice(0, 8).map(g => `• ${escapeHtml(g.text)}`);
        const extra = daily.length > 8 ? `\n+${daily.length - 8} more` : '';
        return { text: `Unchecked daily goals:\n${list.join('\n')}${extra}`, category: 'GOALS' };
    }

    if (/goal.*completion.*rate|completion.*rate/.test(q)) {
        const history = DataService.loadDailyGoalHistory();
        if (history.length < 3) return { text: "Need more days of history to compute a rate.", category: 'GOALS' };
        const recent = history.slice(-30);
        const totalCompleted = recent.reduce((s, d) => s + (d.completed || 0), 0);
        const totalGoals = recent.reduce((s, d) => s + (d.total || 0), 0);
        if (totalGoals === 0) return { text: "No goal data in history.", category: 'GOALS' };
        const pct = Math.round((totalCompleted / totalGoals) * 100);
        return { text: `${pct}% completion rate over the last ${recent.length} days (${totalCompleted}/${totalGoals}).`, category: 'GOALS' };
    }

    // Schedule queries
    if (/what.*(on|is).*schedule|my schedule|today.*plan|what.*today/.test(q)) {
        try {
            const schedule = JSON.parse(localStorage.getItem('0500_schedule_entries') || '[]');
            const filled = schedule.filter(e => (e.activity || '').trim());
            if (filled.length === 0) return { text: "Nothing on the schedule. Open day — use it wisely.", category: 'SCHEDULE' };
            const lines = filled.slice(0, 8).map(e => `• ${e.time} — ${escapeHtml(e.activity)}`);
            const extra = filled.length > 8 ? `\n+${filled.length - 8} more` : '';
            return { text: `Today's plan:\n${lines.join('\n')}${extra}`, category: 'SCHEDULE' };
        } catch { return { text: "Couldn't read schedule data.", category: 'SCHEDULE' }; }
    }

    // Last night sleep
    if (/last night|how.*sleep.*last|yesterday.*sleep|sleep.*yesterday|sleep.*last night/.test(q)) {
        const log = getLastNDaysLog(3);
        const withData = log.filter(d => d.hours);
        if (withData.length === 0) return { text: "No recent sleep data.", category: 'SLEEP' };
        const last = withData[withData.length - 1];
        const dayName = new Date(last.date).toLocaleDateString('en-US', { weekday: 'long' });
        let verdict = last.hours >= 8 ? 'Solid night.' : last.hours >= 7 ? 'Decent.' : last.hours >= 6 ? 'Could be better.' : 'Rough one.';
        let parts = [`${last.hours.toFixed(1)}h on ${dayName}. ${verdict}`];
        if (last.bedtime) {
            const bt = new Date(last.bedtime);
            parts.push(`Bed: ${bt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`);
        }
        if (last.wakeTime) {
            const wt = new Date(last.wakeTime);
            parts.push(`Up: ${wt.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`);
        }
        return { text: parts.join('\n'), category: 'SLEEP' };
    }

    // Comparative: this week vs last week
    if (/compare|this week.*vs|this week.*last|vs last week|week.*over.*week/.test(q)) {
        const parts = [];
        // Sleep comparison
        const thisWeekSleep = getLastNDaysLog(7).filter(d => d.hours);
        const lastWeekSleep = getLastNDaysLog(14).slice(0, 7).filter(d => d.hours);
        if (thisWeekSleep.length >= 2 && lastWeekSleep.length >= 2) {
            const thisAvg = thisWeekSleep.reduce((s, d) => s + d.hours, 0) / thisWeekSleep.length;
            const lastAvg = lastWeekSleep.reduce((s, d) => s + d.hours, 0) / lastWeekSleep.length;
            const diff = thisAvg - lastAvg;
            const arrow = diff > 0.2 ? '+' : diff < -0.2 ? '' : '';
            const sign = diff >= 0 ? '+' : '';
            parts.push(`Sleep: ${thisAvg.toFixed(1)}h (${sign}${diff.toFixed(1)}h) ${arrow}`);
        }
        // Goals comparison
        const history = DataService.loadDailyGoalHistory();
        if (history.length >= 7) {
            const thisWeekGoals = history.slice(-7);
            const lastWeekGoals = history.slice(-14, -7);
            if (lastWeekGoals.length >= 3) {
                const thisRate = thisWeekGoals.reduce((s, d) => s + (d.total > 0 ? d.completed / d.total : 0), 0) / thisWeekGoals.length;
                const lastRate = lastWeekGoals.reduce((s, d) => s + (d.total > 0 ? d.completed / d.total : 0), 0) / lastWeekGoals.length;
                const diff = Math.round((thisRate - lastRate) * 100);
                const sign = diff >= 0 ? '+' : '';
                parts.push(`Goals: ${Math.round(thisRate * 100)}% (${sign}${diff}pp)`);
            }
        }
        // People comparison
        if (people.length > 0) {
            const thisWeekPeople = people.filter(p => p.lastContact && (Date.now() - new Date(p.lastContact).getTime()) < 7 * 24 * 60 * 60 * 1000).length;
            const lastWeekPeople = people.filter(p => {
                if (!p.lastContact) return false;
                const d = Date.now() - new Date(p.lastContact).getTime();
                return d >= 7 * 24 * 60 * 60 * 1000 && d < 14 * 24 * 60 * 60 * 1000;
            }).length;
            parts.push(`Connections: ${thisWeekPeople} (was ${lastWeekPeople})`);
        }
        if (parts.length === 0) return { text: 'Need at least 2 weeks of data to compare.', category: 'CROSS' };
        return { text: `This week vs last:\n${parts.join('\n')}`, category: 'CROSS' };
    }

    // Help / capabilities
    if (/what can (i|you)|help|capabilities|commands|what.*ask|what.*do you.*know/.test(q)) {
        return {
            text: `Try asking me:\n• "how did I sleep on fridays?"\n• "who did I meet this week?"\n• "how many books have I read?"\n• "goal completion rate"\n• "compare this week vs last"\n• "what's on my schedule?"\n• "remember [anything]"\n• "what do you remember?"\n• "forget about [keyword]"`,
            category: 'JARVIS'
        };
    }

    if (/how am i doing|how.*i.*doing|overall|status report|give.*rundown/.test(q)) {
        const parts = [];
        // Sleep with trend
        const sleepLog = getLastNDaysLog(7);
        const sleepData = sleepLog.filter(d => d.hours);
        if (sleepData.length > 0) {
            const avg = sleepData.reduce((s, d) => s + d.hours, 0) / sleepData.length;
            const lastWeekData = getLastNDaysLog(14).slice(0, 7).filter(d => d.hours);
            let trend = '';
            if (lastWeekData.length >= 2) {
                const lastAvg = lastWeekData.reduce((s, d) => s + d.hours, 0) / lastWeekData.length;
                const diff = avg - lastAvg;
                if (diff > 0.3) trend = ' (trending up)';
                else if (diff < -0.3) trend = ' (trending down)';
                else trend = ' (steady)';
            }
            parts.push(`Sleep: ${avg.toFixed(1)}h avg${trend}`);
        }
        // Goals with trend
        const history = DataService.loadDailyGoalHistory();
        if (history.length > 0) {
            const recent = history.slice(-7);
            const totalC = recent.reduce((s, d) => s + (d.completed || 0), 0);
            const totalG = recent.reduce((s, d) => s + (d.total || 0), 0);
            if (totalG > 0) {
                const pct = Math.round((totalC / totalG) * 100);
                let grade = pct >= 90 ? 'Elite' : pct >= 75 ? 'Strong' : pct >= 50 ? 'Mixed' : 'Needs work';
                parts.push(`Goals: ${pct}% — ${grade}`);
            }
        }
        // Books
        if (books.length > 0) {
            const reading = books.filter(b => (b.status || '').toLowerCase() === 'reading');
            const readCount = books.filter(b => (b.status || '').toLowerCase() === 'read').length;
            if (reading.length > 0) parts.push(`Reading: ${reading.map(b => b.title).join(', ')}`);
            else if (readCount > 0) parts.push(`Books: ${readCount} read, nothing in progress`);
        }
        // People
        if (people.length > 0) {
            const recentContacts = people.filter(p => {
                if (!p.lastContact) return false;
                return (Date.now() - new Date(p.lastContact).getTime()) < 7 * 24 * 60 * 60 * 1000;
            });
            const staleCount = people.filter(p => {
                if (!p.lastContact) return false;
                return (Date.now() - new Date(p.lastContact).getTime()) > 30 * 24 * 60 * 60 * 1000;
            }).length;
            let peopleLine = `Connections: ${recentContacts.length} this week`;
            if (staleCount > 0) peopleLine += `, ${staleCount} going stale`;
            parts.push(peopleLine);
        }
        // Memory count
        const memCount = loadJarvisMemory().length;
        if (memCount > 0) parts.push(`Memory: ${memCount} item${memCount !== 1 ? 's' : ''} stored`);
        if (parts.length === 0) return { text: "Not enough data for a summary yet. Use the app for a few days.", category: 'CROSS' };
        return { text: parts.join('\n'), category: 'CROSS' };
    }

    // Memory search (passive fallback)
    const memResult = searchMemory(q);
    if (memResult) return { text: memResult, category: 'MEMORY' };

    return null;
}

// ─── Query Parsing (Tier 2 — category filter fallback) ───

function parseQuery(raw) {
    const q = raw.toLowerCase().trim();
    if (!q) return { filter: null, limit: 4 };

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
        return { filter: ids => ids.filter(i => i.category === 'SLEEP'), limit: 4 };
    if (/goal|habit|task|progress|completion|yesterday/.test(q))
        return { filter: ids => ids.filter(i => i.category === 'GOALS'), limit: 4 };
    if (/schedule|plan|calendar|today/.test(q))
        return { filter: ids => ids.filter(i => i.category === 'SCHEDULE'), limit: 2 };
    if (/correlat|cross|connect|relation/.test(q))
        return { filter: ids => ids.filter(i => i.category === 'CROSS'), limit: 2 };
    if (/people|contact|network|reach|stale|fading/.test(q))
        return { filter: ids => ids.filter(i => i.category === 'NETWORK'), limit: 4 };
    if (/book|read|reading|library/.test(q))
        return { filter: ids => ids.filter(i => i.category === 'BOOKS'), limit: 4 };

    // Summary queries — show everything
    if (/how.*doing|status|summary|overview|everything|all|insight|brief|report|debrief/.test(q))
        return { filter: null, limit: 6 };

    // Fallback — show all
    return { filter: null, limit: 4 };
}

// ─── Category Color Map ───

const CATEGORY_COLORS = {
    SLEEP: 'var(--blue, #8cc8ff)',
    GOALS: 'var(--check-green, #7dd4a0)',
    CROSS: 'var(--hud-gold, #ffc878)',
    SCHEDULE: 'var(--accent, #ffb090)',
    NETWORK: 'var(--warm-purple, #c87090)',
    BOOKS: 'var(--hud-orange, #ff9070)',
    MEMORY: 'var(--accent, #ffb090)',
};

// ─── Follow-up Suggestions ───

function getFollowUps(category, query) {
    const q = (query || '').toLowerCase();
    const map = {
        SLEEP: ['sleep score', 'best sleep day', 'sleep debt'],
        GOALS: ['goal completion rate', 'how am I doing', 'what are my goals'],
        NETWORK: ["who haven't I talked to", 'who did I meet this week'],
        BOOKS: ['best books', 'how many books'],
        CROSS: ['sleep score', 'goal completion rate', 'this week vs last week'],
        MEMORY: ['what do you remember', 'how am I doing'],
        SCHEDULE: ["what's on my schedule", 'how am I doing'],
    };
    const pool = map[category] || map.CROSS;
    return pool.filter(s => s.toLowerCase() !== q).slice(0, 2);
}

function renderFollowUps(body, suggestions) {
    if (!suggestions || suggestions.length === 0) return;
    const row = document.createElement('div');
    row.className = 'intel-followups';
    suggestions.forEach(s => {
        const chip = document.createElement('button');
        chip.className = 'intel-followup-chip';
        chip.textContent = s;
        chip.addEventListener('click', () => {
            const input = document.getElementById('intel-input');
            if (input) input.value = s;
            triggerInsights(s);
        });
        row.appendChild(chip);
    });
    body.appendChild(row);
}

// ─── Typewriter ───

let typewriterAbort = null;

function typewriterRender(body, insight, query) {
    return new Promise(resolve => {
        if (typewriterAbort) typewriterAbort();

        body.innerHTML = '';
        const item = document.createElement('div');
        item.className = 'intel-item intel-item-direct';
        const color = CATEGORY_COLORS[insight.category] || 'var(--accent)';
        item.style.borderLeftColor = color;

        const catEl = document.createElement('div');
        catEl.className = 'intel-item-category';
        catEl.style.color = color;
        catEl.textContent = insight.category;

        const textEl = document.createElement('div');
        textEl.className = 'intel-item-text';

        item.appendChild(catEl);
        item.appendChild(textEl);
        body.appendChild(item);

        // Expand \n → <br> while typing
        const rawText = insight.text;
        let i = 0;
        let cancelled = false;
        const speed = Math.max(8, Math.min(18, 600 / rawText.length));

        typewriterAbort = () => { cancelled = true; };

        function tick() {
            if (cancelled) {
                textEl.innerHTML = rawText.replace(/\n/g, '<br>');
                finalize();
                return;
            }
            if (i < rawText.length) {
                if (rawText[i] === '\n') {
                    textEl.appendChild(document.createElement('br'));
                } else {
                    textEl.appendChild(document.createTextNode(rawText[i]));
                }
                i++;
                setTimeout(tick, speed);
            } else {
                finalize();
            }
        }

        function finalize() {
            typewriterAbort = null;
            if (insight.id) markInsightShown(insight.id);
            const followUps = getFollowUps(insight.category, query);
            renderFollowUps(body, followUps);
            resolve();
        }

        tick();
    });
}

// ─── Rendering ───

function renderIntelBody(insights, emptyMsg) {
    const body = document.getElementById('intel-body');
    if (!body) return;

    // Cancel any running typewriter
    if (typewriterAbort) { typewriterAbort(); typewriterAbort = null; }
    body.innerHTML = '';

    if (insights.length === 0) {
        body.innerHTML = `<div class="intel-empty">${emptyMsg || 'Nothing interesting to say right now. Check back later.'}</div>`;
        return;
    }

    insights.forEach((insight, i) => {
        const item = document.createElement('div');
        item.className = 'intel-item';
        item.style.animationDelay = `${i * 80}ms`;
        const color = CATEGORY_COLORS[insight.category] || 'var(--accent)';
        item.style.borderLeftColor = color;
        const textHtml = insight.text.replace(/\n/g, '<br>');
        item.innerHTML = `
            <div class="intel-item-category" style="color:${color}">${escapeHtml(insight.category)}</div>
            <div class="intel-item-text">${textHtml}</div>
        `;
        body.appendChild(item);
        if (insight.id) markInsightShown(insight.id);
    });
}

async function triggerInsights(query) {
    const body = document.getElementById('intel-body');
    if (!body) return;

    // Cancel any running typewriter immediately
    if (typewriterAbort) { typewriterAbort(); typewriterAbort = null; }
    body.innerHTML = '<div class="intel-empty">scanning...</div>';

    try {
        // Tier 1: NL query router
        if (query && query.trim()) {
            const direct = await routeQuery(query);
            if (direct) {
                await typewriterRender(body, direct, query);
                return;
            }
        }

        // Tier 2: insight generation + category filter fallback
        const all = await generateInsights();
        const parsed = parseQuery(query || '');

        let results = parsed.filter ? parsed.filter(all) : all;
        results = results.slice(0, parsed.limit);

        let emptyMsg = 'Nothing interesting to say right now. Check back later.';
        if (query) {
            const q = query.toLowerCase();
            if (/sleep/.test(q)) emptyMsg = 'Not enough sleep data to work with. Log a few nights and I\'ll have something.';
            else if (/goal/.test(q)) emptyMsg = 'Need a few more days of goal data before I can spot patterns.';
            else if (/schedule/.test(q)) emptyMsg = 'Schedule looks fine. Nothing to call out.';
            else if (/people|contact|network/.test(q)) emptyMsg = 'No contacts to analyze yet. Add some people first.';
            else if (/book|read/.test(q)) emptyMsg = 'Nothing on the books front yet. Mark some as read and I\'ll talk.';
        }

        renderIntelBody(results, emptyMsg);
    } catch (e) {
        console.warn('[Jarvis] Failed:', e);
        body.innerHTML = '<div class="intel-empty">Something broke on my end. Try again.</div>';
    }
}

// ─── Rotating Placeholder ───

const JARVIS_PLACEHOLDERS = [
    'ask me anything...',
    'how did I sleep on fridays?',
    'who did I meet this week?',
    'how many books have I read?',
    'remember buy groceries',
    'what are my goals?',
    'how am I doing?',
    'best sleep day?',
    'goal completion rate',
    'compare this week vs last week',
    "what's on my schedule?",
    'what can I do?',
    'last night sleep',
    'best books?',
    "who haven't I talked to?",
];

let placeholderInterval = null;
let placeholderIndex = 0;

function startPlaceholderRotation(input) {
    if (placeholderInterval) clearInterval(placeholderInterval);
    placeholderIndex = Math.floor(Math.random() * JARVIS_PLACEHOLDERS.length);
    input.placeholder = JARVIS_PLACEHOLDERS[placeholderIndex];
    placeholderInterval = setInterval(() => {
        if (document.activeElement === input) return; // Don't rotate while focused
        placeholderIndex = (placeholderIndex + 1) % JARVIS_PLACEHOLDERS.length;
        input.classList.add('placeholder-fade');
        setTimeout(() => {
            input.placeholder = JARVIS_PLACEHOLDERS[placeholderIndex];
            input.classList.remove('placeholder-fade');
        }, 200);
    }, 4000);
}

// ─── Init ───

function initInsights() {
    const chip = document.getElementById('chip-intel');
    const card = document.getElementById('intel-card');
    const input = document.getElementById('intel-input');
    const refreshBtn = document.getElementById('intel-refresh');
    const greetingEl = document.getElementById('intel-greeting');
    if (!chip || !card) return;

    // Set time-aware greeting
    if (greetingEl) greetingEl.textContent = getJarvisGreeting();

    // Start rotating placeholder hints
    if (input) startPlaceholderRotation(input);

    // Toggle card
    chip.addEventListener('click', () => {
        const isOpen = card.classList.toggle('open');
        chip.classList.toggle('active', isOpen);

        // Refresh greeting each open
        if (isOpen) {
            if (greetingEl) greetingEl.textContent = getJarvisGreeting();
            if (!document.getElementById('intel-body').children.length) {
                triggerInsights('');
            }
            // Focus input
            if (input) setTimeout(() => input.focus(), 100);
        }
    });

    // Refresh button
    if (refreshBtn) {
        refreshBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (greetingEl) greetingEl.textContent = getJarvisGreeting();
            triggerInsights(input ? input.value : '');
        });
    }

    // Input — filter on Enter, clear after submit
    if (input) {
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                const q = input.value;
                triggerInsights(q);
                // Clear input after submit (unless it's a memory command)
                if (!/^remember\s/i.test(q)) {
                    input.value = '';
                }
            }
        });
    }
}
