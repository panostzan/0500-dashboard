// ═══════════════════════════════════════════════════════════════════════════════
// SLEEP - Sleep Dashboard (DataService: Supabase + localStorage fallback)
//
// Settings shape: { wakeTime: "05:00", targetHours: 7.5 }  (matches DataService)
// Log entry shape: { date, bedtime, wakeTime, hours }       (matches DataService)
// ═══════════════════════════════════════════════════════════════════════════════

let sleepSettingsCache = null;
let sleepLogCache = null;

const SLEEP_DEFAULTS = { wakeTime: '05:00', targetHours: 7.5 };

// Local "YYYY-MM-DD" (avoids UTC shift from toISOString)
function localDateStr(d) {
    const y = d.getFullYear(), m = d.getMonth() + 1, day = d.getDate();
    return `${y}-${m.toString().padStart(2,'0')}-${day.toString().padStart(2,'0')}`;
}

// Parse "HH:MM" → { hour, minute }
function parseTime(str) {
    const [h, m] = (str || '05:00').split(':').map(Number);
    return { hour: h, minute: m };
}

// { hour, minute } → "HH:MM"
function toTimeStr(hour, minute) {
    return `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
}

// ═══════════════════════════════════════════════════════════════════════════════
// DATA — reads from cache (sync), writes through DataService (async)
// ═══════════════════════════════════════════════════════════════════════════════

function loadSleepSettings() {
    return { ...SLEEP_DEFAULTS, ...sleepSettingsCache };
}

function loadSleepLog() {
    return sleepLogCache || [];
}

async function loadSleepSettingsAsync() {
    if (sleepSettingsCache) return { ...SLEEP_DEFAULTS, ...sleepSettingsCache };
    const s = await DataService.loadSleepSettings();
    // Handle old localStorage format {wakeHour, wakeMinute, targetSleepHours}
    if (s.wakeHour !== undefined) {
        sleepSettingsCache = { wakeTime: toTimeStr(s.wakeHour, s.wakeMinute || 0), targetHours: s.targetSleepHours || 7.5 };
    } else {
        sleepSettingsCache = { wakeTime: s.wakeTime || '05:00', targetHours: s.targetHours || 7.5 };
    }
    return { ...SLEEP_DEFAULTS, ...sleepSettingsCache };
}

async function saveSleepSettings(settings) {
    sleepSettingsCache = settings;
    await DataService.saveSleepSettings(settings);
}

async function loadSleepLogAsync() {
    if (sleepLogCache) return sleepLogCache;
    const log = await DataService.loadSleepLog();
    // Normalize: old localStorage entries may use "duration" instead of "hours"
    sleepLogCache = log.map(e => e.hours !== undefined ? e : { ...e, hours: e.duration ?? null });
    return sleepLogCache;
}

async function saveSleepLog(log) {
    sleepLogCache = log;
    await DataService.saveSleepLog(log);
}


// ═══════════════════════════════════════════════════════════════════════════════
// LOGGING FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

async function logBedtime() {
    const now = new Date();
    // Add 20 minutes for fall asleep buffer
    const bedtime = new Date(now.getTime() + 20 * 60 * 1000);

    const log = loadSleepLog();

    // Check if there's an incomplete entry (bedtime without wake)
    const lastEntry = log[log.length - 1];
    if (lastEntry && !lastEntry.wakeTime) {
        lastEntry.bedtime = bedtime.toISOString();
    } else {
        log.push({
            date: localDateStr(bedtime),
            bedtime: bedtime.toISOString(),
            wakeTime: null,
            hours: null
        });
    }

    await saveSleepLog(log);

    if (typeof updateSleepDashboard === 'function') updateSleepDashboard();
    if (typeof updateSleepTrackingStatus === 'function') updateSleepTrackingStatus();

    return bedtime;
}

async function logWakeUp() {
    const now = new Date(Date.now() - 10 * 60 * 1000);
    const log = loadSleepLog();
    const lastEntry = log[log.length - 1];

    if (lastEntry && lastEntry.bedtime && !lastEntry.wakeTime) {
        lastEntry.wakeTime = now.toISOString();
        lastEntry.hours = (now - new Date(lastEntry.bedtime)) / 3600000;
        await saveSleepLog(log);
    } else {
        const settings = loadSleepSettings();
        const wake = parseTime(settings.wakeTime);
        let estimatedBedtime = new Date(now);
        estimatedBedtime.setHours(wake.hour - settings.targetHours);

        log.push({
            date: localDateStr(now),
            bedtime: estimatedBedtime.toISOString(),
            wakeTime: now.toISOString(),
            hours: settings.targetHours
        });
        await saveSleepLog(log);
    }

    if (typeof updateSleepDashboard === 'function') updateSleepDashboard();
    if (typeof updateSleepTrackingStatus === 'function') updateSleepTrackingStatus();

    return now;
}

// ═══════════════════════════════════════════════════════════════════════════════
// CALCULATIONS
// ═══════════════════════════════════════════════════════════════════════════════

function getMonthLog(year, month) {
    const log = loadSleepLog();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const result = [];

    for (let day = 1; day <= daysInMonth; day++) {
        const date = new Date(year, month, day);
        const dateStr = localDateStr(date);
        const entry = log.find(e => e.date === dateStr && e.hours);

        result.push({
            date: dateStr,
            day: day,
            dayOfWeek: date.getDay(),
            hours: entry ? entry.hours : null,
            bedtime: entry ? new Date(entry.bedtime) : null,
            wakeTime: entry ? new Date(entry.wakeTime) : null
        });
    }

    return result;
}

function calculateBedtimeConsistency(days) {
    const bedtimes = days
        .filter(d => d.bedtime)
        .map(d => {
            const bt = new Date(d.bedtime);
            let minutes = bt.getHours() * 60 + bt.getMinutes();
            // Normalize to handle overnight (e.g., 23:00 = -60, 01:00 = 60)
            if (minutes > 720) minutes -= 1440; // After noon, count as negative
            return minutes;
        });

    if (bedtimes.length < 2) return null;

    const mean = bedtimes.reduce((a, b) => a + b, 0) / bedtimes.length;
    const variance = bedtimes.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / bedtimes.length;
    return Math.sqrt(variance); // Standard deviation in minutes
}

function calculateWakeTimeConsistency(days) {
    const wakeTimes = days
        .filter(d => d.wakeTime)
        .map(d => {
            const wt = new Date(d.wakeTime);
            return wt.getHours() * 60 + wt.getMinutes();
        });

    if (wakeTimes.length < 2) return null;

    const mean = wakeTimes.reduce((a, b) => a + b, 0) / wakeTimes.length;
    const variance = wakeTimes.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / wakeTimes.length;
    return Math.sqrt(variance); // Standard deviation in minutes
}

function calculateSleepScore(days) {
    const settings = loadSleepSettings();
    const daysWithData = days.filter(d => d.hours);

    if (daysWithData.length === 0) return null;

    // --- 1. Regularity (30%) — Sleep Window Overlap ---
    // Normalize bedtime/wake to "minutes since 6 PM" so consecutive nights
    // are compared on the same scale (absolute timestamps never overlap).
    function toMinSince6pm(dt) {
        let min = dt.getHours() * 60 + dt.getMinutes();
        // 6 PM = 1080. Shift so 6 PM = 0, midnight = 360, 6 AM = 720, noon = 1080
        min -= 1080;
        if (min < 0) min += 1440;
        return min;
    }

    let regularityScore = 100;
    const daysWithBothTimes = daysWithData.filter(d => d.bedtime && d.wakeTime);
    if (daysWithBothTimes.length >= 2) {
        let totalOverlapPct = 0;
        let pairs = 0;
        for (let i = 1; i < daysWithBothTimes.length; i++) {
            const bedA = toMinSince6pm(daysWithBothTimes[i - 1].bedtime);
            const wakeA = toMinSince6pm(daysWithBothTimes[i - 1].wakeTime);
            const bedB = toMinSince6pm(daysWithBothTimes[i].bedtime);
            const wakeB = toMinSince6pm(daysWithBothTimes[i].wakeTime);

            const overlapStart = Math.max(bedA, bedB);
            const overlapEnd = Math.min(wakeA, wakeB);
            const overlap = Math.max(0, overlapEnd - overlapStart);

            const unionStart = Math.min(bedA, bedB);
            const unionEnd = Math.max(wakeA, wakeB);
            const union = unionEnd - unionStart;

            if (union > 0) {
                totalOverlapPct += (overlap / union) * 100;
                pairs++;
            }
        }
        regularityScore = pairs > 0 ? Math.round(totalOverlapPct / pairs) : 100;
    }

    // --- 2. Duration (25%) — Asymmetric penalty ---
    const avgDuration = daysWithData.reduce((sum, d) => sum + d.hours, 0) / daysWithData.length;
    const durationDiff = avgDuration - settings.targetHours;
    let durationScore;
    if (durationDiff < 0) {
        // Under target: -30 pts/hr
        durationScore = Math.max(0, 100 - (Math.abs(durationDiff) * 30));
    } else {
        // Over target: -15 pts/hr
        durationScore = Math.max(0, 100 - (durationDiff * 15));
    }

    // --- 3. Sleep Debt (20%) — 7-day rolling deficit ---
    const last7 = daysWithData.slice(-7);
    let debt = 0;
    for (const d of last7) {
        const diff = d.hours - settings.targetHours;
        if (diff < 0) debt += diff; // Only accumulate deficits, not surpluses
    }
    const debtScore = Math.max(0, Math.round(100 + (debt * 14.3)));

    // --- 4. Timing (15%) — Average bedtime vs target ---
    let timingScore = 100;
    const daysWithBedtime = daysWithData.filter(d => d.bedtime);
    if (daysWithBedtime.length > 0) {
        // Target bedtime = wake target - target hours (in minutes from midnight)
        const wake = parseTime(settings.wakeTime);
        const wakeTargetMin = wake.hour * 60 + wake.minute;
        const targetBedMin = wakeTargetMin - (settings.targetHours * 60);
        // targetBedMin may be negative (before midnight), that's fine for diff calculation

        // Average actual bedtime in minutes from midnight (handle overnight)
        let totalBedMin = 0;
        for (const d of daysWithBedtime) {
            const bt = d.bedtime;
            let bedMin = bt.getHours() * 60 + bt.getMinutes();
            // If bedtime is after noon, treat as same-day evening (negative offset from midnight)
            // If before noon, treat as past-midnight
            if (bedMin >= 720) bedMin -= 1440; // e.g., 22:00 → -120 (2h before midnight)
            totalBedMin += bedMin;
        }
        const avgBedMin = totalBedMin / daysWithBedtime.length;

        // Diff in minutes (positive = late, negative = early)
        const diffMin = avgBedMin - targetBedMin;

        if (diffMin <= 0) {
            // Early: -3.3 pts per 30 min
            timingScore = Math.max(0, Math.round(100 - (Math.abs(diffMin) / 30) * 3.3));
        } else {
            // Late: -20 pts per 30 min
            timingScore = Math.max(0, Math.round(100 - (diffMin / 30) * 20));
        }
    }

    // --- 5. Streak (10%) — Uses existing calculateSleepStreak() ---
    const streak = calculateSleepStreak();
    const streakScore = Math.min(100, 30 + (streak.current * 10));

    // --- Final weighted score ---
    const totalScore = (regularityScore * 0.30) +
                       (durationScore * 0.25) +
                       (debtScore * 0.20) +
                       (timingScore * 0.15) +
                       (streakScore * 0.10);

    return {
        total: Math.round(totalScore),
        regularity: Math.round(regularityScore),
        duration: Math.round(durationScore),
        debt: Math.round(debtScore),
        timing: Math.round(timingScore),
        streak: Math.round(streakScore)
    };
}

function calculateSleepStreak() {
    const settings = loadSleepSettings();
    const log = loadSleepLog().filter(e => e.hours);
    const tolerance = 0.5; // ±30 minutes

    if (log.length === 0) return { current: 0, longest: 0 };

    // Sort by date descending
    const sorted = [...log].sort((a, b) => new Date(b.date) - new Date(a.date));

    let currentStreak = 0;
    let longestStreak = 0;
    let tempStreak = 0;
    let lastDate = null;

    // Calculate current streak (consecutive days from today/yesterday)
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (let i = 0; i < sorted.length; i++) {
        const entryDate = new Date(sorted[i].date);
        entryDate.setHours(0, 0, 0, 0);
        const meetsGoal = Math.abs(sorted[i].hours - settings.targetHours) <= tolerance;

        if (i === 0) {
            const daysDiff = Math.floor((today - entryDate) / (1000 * 60 * 60 * 24));
            if (daysDiff <= 1 && meetsGoal) {
                currentStreak = 1;
                lastDate = entryDate;
            }
        } else if (lastDate && meetsGoal) {
            const daysDiff = Math.floor((lastDate - entryDate) / (1000 * 60 * 60 * 24));
            if (daysDiff === 1) {
                currentStreak++;
                lastDate = entryDate;
            } else {
                break;
            }
        } else {
            break;
        }
    }

    // Calculate longest streak
    tempStreak = 0;
    lastDate = null;

    for (const entry of sorted) {
        const entryDate = new Date(entry.date);
        const meetsGoal = Math.abs(entry.hours - settings.targetHours) <= tolerance;

        if (!meetsGoal) {
            longestStreak = Math.max(longestStreak, tempStreak);
            tempStreak = 0;
            lastDate = null;
            continue;
        }

        if (lastDate === null) {
            tempStreak = 1;
            lastDate = entryDate;
        } else {
            const daysDiff = Math.floor((lastDate - entryDate) / (1000 * 60 * 60 * 24));
            if (daysDiff === 1) {
                tempStreak++;
                lastDate = entryDate;
            } else {
                longestStreak = Math.max(longestStreak, tempStreak);
                tempStreak = 1;
                lastDate = entryDate;
            }
        }
    }
    longestStreak = Math.max(longestStreak, tempStreak);

    return { current: currentStreak, longest: longestStreak };
}

function calculateCumulativeSleepDebt(days = 14) {
    const settings = loadSleepSettings();
    const log = getLastNDaysLog(days);

    let totalDebt = 0;
    const daysWithData = log.filter(d => d.hours);

    daysWithData.forEach(day => {
        totalDebt += day.hours - settings.targetHours;
    });

    // Cap debt at reasonable limits
    totalDebt = Math.max(-10, Math.min(5, totalDebt));

    // Days to recover (if in debt, assume 30 min extra sleep per day)
    const daysToRecover = totalDebt < 0 ? Math.ceil(Math.abs(totalDebt) / 0.5) : 0;

    return {
        total: totalDebt,
        daysToRecover: daysToRecover,
        daysAnalyzed: daysWithData.length
    };
}

function calculatePeriodStats(days) {
    const settings = loadSleepSettings();
    const daysWithData = days.filter(d => d.hours);

    if (daysWithData.length === 0) {
        return {
            avgDuration: null,
            avgBedtime: null,
            avgWakeTime: null,
            bestNight: null,
            worstNight: null,
            nightsLogged: 0
        };
    }

    // Average duration
    const avgDuration = daysWithData.reduce((sum, d) => sum + d.hours, 0) / daysWithData.length;

    // Average bedtime
    const bedtimeMinutes = daysWithData
        .filter(d => d.bedtime)
        .map(d => {
            const bt = new Date(d.bedtime);
            let mins = bt.getHours() * 60 + bt.getMinutes();
            if (mins > 720) mins -= 1440;
            return mins;
        });
    const avgBedtimeMins = bedtimeMinutes.length > 0
        ? bedtimeMinutes.reduce((a, b) => a + b, 0) / bedtimeMinutes.length
        : null;

    // Average wake time
    const wakeMinutes = daysWithData
        .filter(d => d.wakeTime)
        .map(d => {
            const wt = new Date(d.wakeTime);
            return wt.getHours() * 60 + wt.getMinutes();
        });
    const avgWakeMins = wakeMinutes.length > 0
        ? wakeMinutes.reduce((a, b) => a + b, 0) / wakeMinutes.length
        : null;

    // Best and worst nights
    const sorted = [...daysWithData].sort((a, b) => b.hours - a.hours);
    const bestNight = sorted[0];
    const worstNight = sorted[sorted.length - 1];

    return {
        avgDuration,
        avgBedtime: avgBedtimeMins !== null ? minutesToTime(avgBedtimeMins < 0 ? avgBedtimeMins + 1440 : avgBedtimeMins) : null,
        avgWakeTime: avgWakeMins !== null ? minutesToTime(avgWakeMins) : null,
        bestNight,
        worstNight,
        nightsLogged: daysWithData.length
    };
}

function minutesToTime(minutes) {
    let mins = Math.round(minutes);
    if (mins < 0) mins += 1440;
    if (mins >= 1440) mins -= 1440;
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return { hour: h, minute: m };
}

function calculateTrend(values) {
    if (values.length < 2) return 'neutral';

    const recent = values.slice(-3);
    const earlier = values.slice(-6, -3);

    if (recent.length === 0 || earlier.length === 0) return 'neutral';

    const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
    const earlierAvg = earlier.reduce((a, b) => a + b, 0) / earlier.length;

    const diff = recentAvg - earlierAvg;

    if (diff > 0.25) return 'up';
    if (diff < -0.25) return 'down';
    return 'neutral';
}

function generateSleepInsights() {
    const log = loadSleepLog().filter(e => e.hours);
    const settings = loadSleepSettings();
    const insights = [];

    if (log.length < 3) {
        insights.push({
            type: 'info',
            text: 'Log a few more nights to see personalized insights.'
        });
        return insights;
    }

    // Streak insight
    const streak = calculateSleepStreak();
    if (streak.current >= 3) {
        insights.push({
            type: 'success',
            text: `${streak.current}-day streak! Keep it up.`
        });
    } else if (streak.current === 0 && streak.longest >= 3) {
        insights.push({
            type: 'warning',
            text: `Streak broken. Your record is ${streak.longest} days.`
        });
    }

    // Sleep debt insight
    const debt = calculateCumulativeSleepDebt(7);
    if (debt.total < -2) {
        insights.push({
            type: 'warning',
            text: `${Math.abs(debt.total).toFixed(1)}h sleep debt. Try sleeping 30min earlier.`
        });
    } else if (debt.total > 1) {
        insights.push({
            type: 'success',
            text: `${debt.total.toFixed(1)}h sleep surplus this week!`
        });
    }

    // Weekend vs weekday pattern
    const last14 = getLastNDaysLog(14).filter(d => d.hours);
    const weekdays = last14.filter(d => {
        const dow = new Date(d.date).getDay();
        return dow >= 1 && dow <= 5;
    });
    const weekends = last14.filter(d => {
        const dow = new Date(d.date).getDay();
        return dow === 0 || dow === 6;
    });

    if (weekdays.length >= 3 && weekends.length >= 2) {
        const weekdayAvg = weekdays.reduce((s, d) => s + d.hours, 0) / weekdays.length;
        const weekendAvg = weekends.reduce((s, d) => s + d.hours, 0) / weekends.length;

        if (weekendAvg - weekdayAvg > 1) {
            insights.push({
                type: 'info',
                text: `Sleeping ${(weekendAvg - weekdayAvg).toFixed(1)}h more on weekends.`
            });
        }
    }

    // Bedtime consistency
    const bedtimeStd = calculateBedtimeConsistency(last14);
    if (bedtimeStd !== null && bedtimeStd > 60) {
        insights.push({
            type: 'warning',
            text: 'Bedtime varies by over an hour. Try a consistent schedule.'
        });
    } else if (bedtimeStd !== null && bedtimeStd < 30) {
        insights.push({
            type: 'success',
            text: 'Great bedtime consistency!'
        });
    }

    // Score insight
    const score = calculateSleepScore(last14);
    if (score && score.total >= 85) {
        insights.push({
            type: 'success',
            text: 'Excellent sleep score! You\'re optimizing well.'
        });
    } else if (score && score.total < 50) {
        insights.push({
            type: 'warning',
            text: 'Sleep score needs work. Focus on consistency.'
        });
    }

    return insights.slice(0, 3); // Max 3 insights
}

// ═══════════════════════════════════════════════════════════════════════════════
// DYNAMIC INSIGHTS ENGINE (WHOOP-inspired)
// ═══════════════════════════════════════════════════════════════════════════════

function generateDynamicInsights() {
    const log = loadSleepLog().filter(e => e.hours);
    const settings = loadSleepSettings();

    if (log.length === 0) {
        return [{
            id: 'keep-logging', category: 'Health', title: 'Start Tracking',
            body: 'Log your first night of sleep to unlock personalized insights.',
            type: 'neutral', priority: 100
        }];
    }

    if (log.length < 3) {
        return [{
            id: 'keep-logging', category: 'Health', title: 'Keep Logging',
            body: `${log.length} night${log.length > 1 ? 's' : ''} logged. Need at least 3 for insights.`,
            type: 'neutral', priority: 100
        }];
    }

    // Precompute metrics
    const last7 = getLastNDaysLog(7);
    const last14 = getLastNDaysLog(14);
    const last7data = last7.filter(d => d.hours);
    const last14data = last14.filter(d => d.hours);

    const avgDuration7 = last7data.length > 0
        ? last7data.reduce((s, d) => s + d.hours, 0) / last7data.length : null;

    const streak = calculateSleepStreak();
    const debtObj = calculateCumulativeSleepDebt(14);
    const cumulativeDebt = debtObj.total;

    const bedtimeStdDev = calculateBedtimeConsistency(last14data);
    const wakeStdDev = calculateWakeTimeConsistency(last14data);

    // Weekday/weekend averages
    const weekdays14 = last14data.filter(d => { const dow = new Date(d.date).getDay(); return dow >= 1 && dow <= 5; });
    const weekends14 = last14data.filter(d => { const dow = new Date(d.date).getDay(); return dow === 0 || dow === 6; });
    const weekdayAvg = weekdays14.length > 0 ? weekdays14.reduce((s, d) => s + d.hours, 0) / weekdays14.length : null;
    const weekendAvg = weekends14.length > 0 ? weekends14.reduce((s, d) => s + d.hours, 0) / weekends14.length : null;

    // Duration trend
    const durationValues = last14data.map(d => d.hours);
    const durationTrend = calculateTrend(durationValues);

    // Bedtime shift (compare recent 3 bedtimes to earlier 3)
    const bedtimeMinutes = last14data.filter(d => d.bedtime).map(d => {
        let mins = d.bedtime.getHours() * 60 + d.bedtime.getMinutes();
        if (mins > 720) mins -= 1440;
        return mins;
    });
    let bedtimeShift = 0;
    if (bedtimeMinutes.length >= 6) {
        const recent3 = bedtimeMinutes.slice(-3);
        const earlier3 = bedtimeMinutes.slice(-6, -3);
        const recentAvg = recent3.reduce((a, b) => a + b, 0) / 3;
        const earlierAvg = earlier3.reduce((a, b) => a + b, 0) / 3;
        bedtimeShift = recentAvg - earlierAvg;
    }

    // Consecutive nights under 6h
    const sortedDesc = [...log].sort((a, b) => new Date(b.date) - new Date(a.date));
    let consecutiveUnder6 = 0;
    for (const e of sortedDesc) {
        if (e.hours < 6) consecutiveUnder6++;
        else break;
    }

    // Day-of-week averages (need 14+ days)
    const dowTotals = Array(7).fill(0);
    const dowCounts = Array(7).fill(0);
    last14data.forEach(d => {
        const dow = new Date(d.date).getDay();
        dowTotals[dow] += d.hours;
        dowCounts[dow]++;
    });
    const dowAvgs = dowTotals.map((t, i) => dowCounts[i] > 0 ? t / dowCounts[i] : null);

    // Target hit ratio (last 14 nights)
    const tolerance = 0.5;
    const hitsIn14 = last14data.filter(d => d.hours >= settings.targetHours - tolerance).length;
    const targetRatio = last14data.length > 0 ? hitsIn14 / last14data.length : 0;

    const totalDays = log.length;

    const metrics = {
        avgDuration7, streak, cumulativeDebt, bedtimeStdDev, wakeStdDev,
        weekdayAvg, weekendAvg, durationTrend, bedtimeShift,
        consecutiveUnder6, dowAvgs, targetRatio, totalDays, settings, last7data, last14data
    };

    // Run all generators
    const generators = [
        insightBedtimeInconsistent, insightBedtimeConsistent,
        insightWakeInconsistent, insightWeekendOversleep, insightWeekendConsistent,
        insightDurationUp, insightDurationDown, insightBedtimeShiftingLater,
        insightBestWorstDay, insightTargetHitRatio,
        insightDebtCritical, insightDebtModerate, insightDebtSurplus,
        insightStreakActive, insightStreakRecord, insightStreakBroken,
        insightHealthCritical, insightHealthWarning, insightConsecutiveUnder6,
        insightGoodHealth
    ];

    const allInsights = [];
    for (const gen of generators) {
        const result = gen(metrics);
        if (result) allInsights.push(result);
    }

    // Sort by typeWeight + priority
    const typeWeight = { critical: 40, warning: 20, neutral: 0, positive: -10 };
    allInsights.sort((a, b) => {
        const wa = (typeWeight[a.type] || 0) + a.priority;
        const wb = (typeWeight[b.type] || 0) + b.priority;
        return wb - wa;
    });

    // Take top 4 ensuring at least 1 positive
    const top4 = allInsights.slice(0, 4);
    if (!top4.some(i => i.type === 'positive')) {
        const firstPositive = allInsights.find(i => i.type === 'positive' && !top4.includes(i));
        if (firstPositive) {
            top4[3] = firstPositive;
        }
    }

    return top4;
}

// --- 20 Insight Generators ---

function insightBedtimeInconsistent(m) {
    if (m.totalDays < 7 || m.bedtimeStdDev === null || m.bedtimeStdDev <= 60) return null;
    return {
        id: 'bedtime-inconsistent', category: 'Consistency', type: 'warning', priority: 70,
        title: 'Irregular Bedtime',
        body: `Your bedtime varies by ±${Math.round(m.bedtimeStdDev)} min. A consistent window strengthens your circadian rhythm.`
    };
}

function insightBedtimeConsistent(m) {
    if (m.totalDays < 7 || m.bedtimeStdDev === null || m.bedtimeStdDev > 30) return null;
    return {
        id: 'bedtime-consistent', category: 'Consistency', type: 'positive', priority: 30,
        title: 'Solid Bedtime Routine',
        body: `Only ±${Math.round(m.bedtimeStdDev)} min bedtime variance. Your circadian clock is well-calibrated.`
    };
}

function insightWakeInconsistent(m) {
    if (m.totalDays < 7 || m.wakeStdDev === null || m.wakeStdDev <= 45) return null;
    return {
        id: 'wake-inconsistent', category: 'Consistency', type: 'warning', priority: 65,
        title: 'Unstable Wake Time',
        body: `Wake time swings ±${Math.round(m.wakeStdDev)} min. Anchoring your alarm helps more than fixing bedtime.`
    };
}

function insightWeekendOversleep(m) {
    if (m.totalDays < 7 || m.weekdayAvg === null || m.weekendAvg === null) return null;
    const diff = m.weekendAvg - m.weekdayAvg;
    if (diff <= 1) return null;
    return {
        id: 'weekend-oversleep', category: 'Consistency', type: 'warning', priority: 60,
        title: 'Weekend Sleep Gap',
        body: `You sleep ${diff.toFixed(1)}h more on weekends \u2014 a sign of weekday under-recovery.`
    };
}

function insightWeekendConsistent(m) {
    if (m.totalDays < 7 || m.weekdayAvg === null || m.weekendAvg === null) return null;
    if (Math.abs(m.weekendAvg - m.weekdayAvg) > 0.5) return null;
    return {
        id: 'weekend-consistent', category: 'Consistency', type: 'positive', priority: 20,
        title: 'Even Weekly Rhythm',
        body: 'Weekday and weekend sleep within 30 min. No social jet lag detected.'
    };
}

function insightDurationUp(m) {
    if (m.totalDays < 7 || m.durationTrend !== 'up') return null;
    return {
        id: 'duration-up', category: 'Trends', type: 'positive', priority: 40,
        title: 'Duration Trending Up',
        body: 'Your recent nights are longer than earlier this period. Recovery is improving.'
    };
}

function insightDurationDown(m) {
    if (m.totalDays < 7 || m.durationTrend !== 'down') return null;
    return {
        id: 'duration-down', category: 'Trends', type: 'warning', priority: 75,
        title: 'Sleep Is Shrinking',
        body: 'Duration is trending down. Consider protecting your wind-down time.'
    };
}

function insightBedtimeShiftingLater(m) {
    if (m.totalDays < 7 || Math.abs(m.bedtimeShift) < 30) return null;
    if (m.bedtimeShift <= 0) return null;
    return {
        id: 'bedtime-shifting', category: 'Trends', type: 'warning', priority: 55,
        title: 'Bedtime Creeping Later',
        body: `Bedtime shifted ~${Math.round(m.bedtimeShift)} min later recently. This often snowballs.`
    };
}

function insightBestWorstDay(m) {
    if (m.totalDays < 14) return null;
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const valid = m.dowAvgs.map((avg, i) => avg !== null ? { avg, day: dayNames[i] } : null).filter(Boolean);
    if (valid.length < 4) return null;
    valid.sort((a, b) => b.avg - a.avg);
    const best = valid[0];
    const worst = valid[valid.length - 1];
    if (best.avg - worst.avg < 0.5) return null;
    return {
        id: 'best-worst-day', category: 'Patterns', type: 'neutral', priority: 25,
        title: 'Day-of-Week Pattern',
        body: `Best sleep: ${best.day} (${best.avg.toFixed(1)}h). Worst: ${worst.day} (${worst.avg.toFixed(1)}h).`
    };
}

function insightTargetHitRatio(m) {
    if (m.totalDays < 7) return null;
    const pct = Math.round(m.targetRatio * 100);
    if (pct >= 80) {
        return {
            id: 'target-ratio', category: 'Patterns', type: 'positive', priority: 35,
            title: 'Hitting Your Target',
            body: `${pct}% of recent nights met your ${m.settings.targetHours}h goal. Consistency pays off.`
        };
    }
    if (pct < 50) {
        return {
            id: 'target-ratio', category: 'Patterns', type: 'warning', priority: 35,
            title: 'Below Target',
            body: `Only ${pct}% of recent nights reached ${m.settings.targetHours}h. Small adjustments compound.`
        };
    }
    return null;
}

function insightDebtCritical(m) {
    if (m.cumulativeDebt >= -5) return null;
    return {
        id: 'debt-critical', category: 'Debt', type: 'critical', priority: 90,
        title: 'Heavy Sleep Debt',
        body: `${Math.abs(m.cumulativeDebt).toFixed(1)}h in the red over 14 days. This compounds \u2014 prioritize recovery nights.`
    };
}

function insightDebtModerate(m) {
    if (m.cumulativeDebt < -5 || m.cumulativeDebt >= -2) return null;
    return {
        id: 'debt-moderate', category: 'Debt', type: 'warning', priority: 65,
        title: 'Building Sleep Debt',
        body: `${Math.abs(m.cumulativeDebt).toFixed(1)}h debt. Not critical yet, but trend is worth watching.`
    };
}

function insightDebtSurplus(m) {
    if (m.cumulativeDebt <= 1) return null;
    return {
        id: 'debt-surplus', category: 'Debt', type: 'positive', priority: 25,
        title: 'Sleep Surplus',
        body: `+${m.cumulativeDebt.toFixed(1)}h banked over 14 days. Your recovery buffer is healthy.`
    };
}

function insightStreakActive(m) {
    if (m.streak.current < 3) return null;
    const priority = Math.min(60, 45 + m.streak.current * 2);
    const labels = { 3: 'Good', 5: 'Strong', 7: 'Incredible', 10: 'Elite' };
    const tier = m.streak.current >= 10 ? 'Elite' : m.streak.current >= 7 ? 'Incredible' : m.streak.current >= 5 ? 'Strong' : 'Good';
    return {
        id: 'streak-active', category: 'Achievements', type: 'positive', priority,
        title: `${m.streak.current}-Day Streak`,
        body: `${tier}. ${m.streak.current} consecutive nights near target. Momentum is everything.`
    };
}

function insightStreakRecord(m) {
    if (m.streak.current < 3 || m.streak.current < m.streak.longest) return null;
    if (m.streak.current === m.streak.longest && m.streak.longest >= 3) {
        return {
            id: 'streak-record', category: 'Achievements', type: 'positive', priority: 55,
            title: 'New Personal Best',
            body: `${m.streak.current}-day streak is your all-time record. Keep extending it.`
        };
    }
    return null;
}

function insightStreakBroken(m) {
    if (m.streak.current > 0 || m.streak.longest < 5) return null;
    return {
        id: 'streak-broken', category: 'Achievements', type: 'warning', priority: 50,
        title: 'Streak Lost',
        body: `Your ${m.streak.longest}-day record streak ended. One good night starts a new one.`
    };
}

function insightHealthCritical(m) {
    if (m.avgDuration7 === null || m.avgDuration7 >= 5.5) return null;
    return {
        id: 'health-critical', category: 'Health', type: 'critical', priority: 95,
        title: 'Severe Sleep Deficit',
        body: `Averaging ${m.avgDuration7.toFixed(1)}h this week. Below 5.5h impairs hormones, immunity, and cognitive function.`
    };
}

function insightHealthWarning(m) {
    if (m.avgDuration7 === null || m.avgDuration7 < 5.5 || m.avgDuration7 >= 6.5) return null;
    return {
        id: 'health-warning', category: 'Health', type: 'warning', priority: 80,
        title: 'Under-Recovered',
        body: `${m.avgDuration7.toFixed(1)}h average this week. Below 7h reduces memory consolidation and growth hormone release.`
    };
}

function insightConsecutiveUnder6(m) {
    if (m.consecutiveUnder6 < 3) return null;
    const isCritical = m.consecutiveUnder6 >= 5;
    return {
        id: 'consecutive-under6', category: 'Health',
        type: isCritical ? 'critical' : 'warning',
        priority: isCritical ? 88 : 72,
        title: `${m.consecutiveUnder6} Short Nights`,
        body: `${m.consecutiveUnder6} consecutive nights under 6h. Cognitive impairment accumulates with each night.`
    };
}

function insightGoodHealth(m) {
    if (m.avgDuration7 === null || m.avgDuration7 < 7) return null;
    if (m.bedtimeStdDev !== null && m.bedtimeStdDev > 45) return null;
    return {
        id: 'good-health', category: 'Health', type: 'positive', priority: 15,
        title: 'Optimized Recovery',
        body: 'Averaging 7h+ with consistent timing. Hormone balance, immunity, and cognition are well-supported.'
    };
}

function getLastNDaysLog(n = 7) {
    const log = loadSleepLog();
    const now = new Date();
    const result = [];

    for (let i = n - 1; i >= 0; i--) {
        const date = new Date(now);
        date.setDate(date.getDate() - i);
        const dateStr = localDateStr(date);

        const entry = log.find(e => e.date === dateStr && e.hours);
        result.push({
            date: dateStr,
            dayName: date.toLocaleDateString('en-US', { weekday: 'short' }),
            hours: entry ? entry.hours : null,
            bedtime: entry ? new Date(entry.bedtime) : null,
            wakeTime: entry ? new Date(entry.wakeTime) : null
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
        totalTarget += settings.targetHours;
        if (day.hours) {
            totalActual += day.hours;
        }
    });

    // Only count days that have data
    const daysWithData = log.filter(d => d.hours).length;
    if (daysWithData === 0) return 0;

    // Adjust target to only count days with data
    const adjustedTarget = daysWithData * settings.targetHours;

    return totalActual - adjustedTarget;
}

function calculateWeeklyAverage() {
    const log = getLastNDaysLog(7);
    const daysWithData = log.filter(d => d.hours);

    if (daysWithData.length === 0) return null;

    const total = daysWithData.reduce((sum, d) => sum + d.hours, 0);
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

// Ideal bedtime window: computed bedtime ± 30 minutes
function getIdealBedtimeWindow(settings) {
    const bt = calculateBedtime(settings);
    const center = bt.hour * 60 + bt.minute;
    let startMin = center - 30;
    let endMin = center + 30;
    if (startMin < 0) startMin += 1440;
    if (endMin >= 1440) endMin -= 1440;
    return {
        startH: Math.floor(startMin / 60), startM: startMin % 60,
        endH: Math.floor(endMin / 60), endM: endMin % 60
    };
}

function isBedtimeInIdealZone(bedtime, settings) {
    if (!bedtime) return null;

    const { startH, startM, endH, endM } = getIdealBedtimeWindow(settings);
    const bedMinutes = bedtime.getHours() * 60 + bedtime.getMinutes();

    let startMinutes = startH * 60 + startM;
    let endMinutes = endH * 60 + endM;

    if (endMinutes < startMinutes) {
        endMinutes += 1440;
        if (bedMinutes < startMinutes) {
            return (bedMinutes + 1440) <= endMinutes;
        }
    }

    return bedMinutes >= startMinutes && bedMinutes <= endMinutes;
}

// ═══════════════════════════════════════════════════════════════════════════════
// SLEEP ARCHITECTURE — Estimated stage breakdown
// Based on polysomnography population averages, adjusted for duration/timing/consistency
// ═══════════════════════════════════════════════════════════════════════════════

function estimateSleepArchitecture() {
    const log = loadSleepLog().filter(e => e.hours);
    if (log.length === 0) return null;

    // Use most recent completed entry
    const sorted = [...log].sort((a, b) => new Date(b.date) - new Date(a.date));
    const latest = sorted[0];
    if (!latest.hours || !latest.bedtime) return null;

    const totalHours = latest.hours;

    // Base percentages (polysomnography averages for healthy adults)
    let deep = 17.5;
    let rem = 22.5;
    let light = 52.5;
    let awake = 7.5;

    // 1. Duration adjustments
    // Short sleep cuts REM first (REM concentrates in later cycles)
    if (totalHours < 7) {
        const deficit = 7 - totalHours;
        rem -= deficit * 3;
    }
    // Very short sleep also cuts deep
    if (totalHours < 6) {
        const deficit = 6 - totalHours;
        deep -= deficit * 2.5;
    }
    // Long sleep adds more REM/light, proportionally less deep
    if (totalHours > 8.5) {
        const excess = totalHours - 8.5;
        rem += excess * 1.5;
        light += excess * 1;
        deep -= excess * 1;
    }

    // 2. Timing adjustments (late bedtime reduces deep sleep)
    const bedtime = new Date(latest.bedtime);
    let bedHour = bedtime.getHours() + bedtime.getMinutes() / 60;
    if (bedHour < 18) bedHour += 24; // After midnight

    if (bedHour >= 24) {
        const lateHours = Math.min(bedHour - 24, 3);
        deep -= lateHours * 2;
    } else if (bedHour < 22) {
        deep += 1;
    }

    // 3. Consistency adjustments (irregular schedule reduces deep)
    const last14 = getLastNDaysLog(14).filter(d => d.hours);
    const bedtimeStd = calculateBedtimeConsistency(last14);
    if (bedtimeStd !== null && bedtimeStd > 60) {
        const penalty = Math.min((bedtimeStd - 60) / 60, 1) * 3;
        deep -= penalty;
    }

    // Clamp individual stages
    deep = Math.max(5, Math.min(25, deep));
    rem = Math.max(10, Math.min(30, rem));
    awake = Math.max(3, Math.min(15, awake));
    light = 100 - deep - rem - awake;
    light = Math.max(35, light);

    // Normalize to 100%
    const sum = deep + rem + light + awake;
    deep = (deep / sum) * 100;
    rem = (rem / sum) * 100;
    light = (light / sum) * 100;
    awake = (awake / sum) * 100;

    // Convert to hours
    const deepH = (deep / 100) * totalHours;
    const remH = (rem / 100) * totalHours;
    const lightH = (light / 100) * totalHours;
    const awakeH = (awake / 100) * totalHours;

    // Ideal percentages (for goal lines)
    const idealDeep = 17.5;
    const idealRem = 22.5;
    const idealLight = 52.5;
    const idealAwake = 7.5;

    function getStatus(actual, ideal, tolerance) {
        if (actual < ideal - tolerance) return 'low';
        if (actual > ideal + tolerance) return 'high';
        return 'in-range';
    }

    return {
        date: latest.date,
        totalHours,
        bedtime: latest.bedtime,
        stages: {
            deep:  { percent: deep,  hours: deepH,  ideal: idealDeep,  status: getStatus(deep, idealDeep, 5) },
            rem:   { percent: rem,   hours: remH,   ideal: idealRem,   status: getStatus(rem, idealRem, 5) },
            light: { percent: light, hours: lightH, ideal: idealLight, status: getStatus(light, idealLight, 8) },
            awake: { percent: awake, hours: awakeH, ideal: idealAwake, status: getStatus(awake, idealAwake, 4) }
        },
        cycles: Math.round(totalHours / 1.5)
    };
}

// ═══════════════════════════════════════════════════════════════════════════════
// TIME CALCULATIONS (for countdown)
// ═══════════════════════════════════════════════════════════════════════════════

function calculateBedtime(settings) {
    const wake = parseTime(settings.wakeTime);

    const wakeMinutes = wake.hour * 60 + wake.minute;
    const sleepMinutes = settings.targetHours * 60;
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
    const wake = parseTime(settings.wakeTime);
    const now = new Date();

    let bedtimeDate = new Date();
    bedtimeDate.setHours(bedtime.hour, bedtime.minute, 0, 0);

    if (bedtime.hour > wake.hour || (bedtime.hour === wake.hour && bedtime.minute > wake.minute)) {
        if (now.getHours() < wake.hour || (now.getHours() === wake.hour && now.getMinutes() < wake.minute)) {
            bedtimeDate.setDate(bedtimeDate.getDate() - 1);
        }
    } else {
        const wakeDate = new Date();
        wakeDate.setHours(wake.hour, wake.minute, 0, 0);
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
    const wake = parseTime(settings.wakeTime);

    let wakeDate = new Date();
    wakeDate.setHours(wake.hour, wake.minute, 0, 0);

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
    const wake = parseTime(settings.wakeTime);

    let wakeDate = new Date();
    wakeDate.setHours(wake.hour, wake.minute, 0, 0);

    let bedtimeDate = new Date();
    bedtimeDate.setHours(bedtime.hour, bedtime.minute, 0, 0);

    if (bedtime.hour < wake.hour) {
        if (now.getHours() >= wake.hour) {
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

// Current month for heatmap navigation
let heatmapYear = new Date().getFullYear();
let heatmapMonth = new Date().getMonth();

// Current stats period (7 or 30)
let statsPeriod = 7;

function renderSleepScore() {
    const container = document.getElementById('sleep-score-section');
    if (!container) return;

    const last14 = getLastNDaysLog(14);
    const score = calculateSleepScore(last14);

    if (!score) {
        container.innerHTML = `
            <div class="score-gauge">
                <svg class="score-ring" viewBox="0 0 120 120">
                    <circle class="score-ring-bg" cx="60" cy="60" r="52" />
                    <circle class="score-ring-fill" cx="60" cy="60" r="52" stroke-dasharray="0 327" />
                </svg>
                <div class="score-value">--</div>
                <div class="score-label">SLEEP SCORE</div>
            </div>
            <div class="score-breakdown">
                <div class="score-factor"><span class="factor-label">Regularity</span><div class="factor-bar"><div class="factor-fill" style="width: 0%"></div></div><span class="factor-value">--</span></div>
                <div class="score-factor"><span class="factor-label">Duration</span><div class="factor-bar"><div class="factor-fill" style="width: 0%"></div></div><span class="factor-value">--</span></div>
                <div class="score-factor"><span class="factor-label">Sleep Debt</span><div class="factor-bar"><div class="factor-fill" style="width: 0%"></div></div><span class="factor-value">--</span></div>
                <div class="score-factor"><span class="factor-label">Timing</span><div class="factor-bar"><div class="factor-fill" style="width: 0%"></div></div><span class="factor-value">--</span></div>
                <div class="score-factor"><span class="factor-label">Streak</span><div class="factor-bar"><div class="factor-fill" style="width: 0%"></div></div><span class="factor-value">--</span></div>
            </div>
        `;
        return;
    }

    // Determine color class
    let colorClass = 'score-poor';
    if (score.total >= 85) colorClass = 'score-ideal';
    else if (score.total >= 70) colorClass = 'score-good';
    else if (score.total >= 50) colorClass = 'score-ok';

    // Calculate stroke dasharray (circumference = 2 * pi * r = 2 * 3.14159 * 52 ≈ 327)
    const circumference = 327;
    const dashArray = (score.total / 100) * circumference;

    container.innerHTML = `
        <div class="score-gauge ${colorClass}">
            <svg class="score-ring" viewBox="0 0 120 120">
                <circle class="score-ring-bg" cx="60" cy="60" r="52" />
                <circle class="score-ring-fill" cx="60" cy="60" r="52"
                    stroke-dasharray="${dashArray} ${circumference}" />
            </svg>
            <div class="score-value">${score.total}</div>
            <div class="score-label">SLEEP SCORE</div>
        </div>
        <div class="score-breakdown">
            <div class="score-factor">
                <span class="factor-label">Regularity</span>
                <div class="factor-bar"><div class="factor-fill" style="width: ${score.regularity}%"></div></div>
                <span class="factor-value">${score.regularity}</span>
            </div>
            <div class="score-factor">
                <span class="factor-label">Duration</span>
                <div class="factor-bar"><div class="factor-fill" style="width: ${score.duration}%"></div></div>
                <span class="factor-value">${score.duration}</span>
            </div>
            <div class="score-factor">
                <span class="factor-label">Sleep Debt</span>
                <div class="factor-bar"><div class="factor-fill" style="width: ${score.debt}%"></div></div>
                <span class="factor-value">${score.debt}</span>
            </div>
            <div class="score-factor">
                <span class="factor-label">Timing</span>
                <div class="factor-bar"><div class="factor-fill" style="width: ${score.timing}%"></div></div>
                <span class="factor-value">${score.timing}</span>
            </div>
            <div class="score-factor">
                <span class="factor-label">Streak</span>
                <div class="factor-bar"><div class="factor-fill" style="width: ${score.streak}%"></div></div>
                <span class="factor-value">${score.streak}</span>
            </div>
        </div>
    `;
}

function renderSleepStreak() {
    const container = document.getElementById('sleep-streak-section');
    if (!container) return;

    const streak = calculateSleepStreak();

    container.innerHTML = `
        <div class="streak-current">
            <span class="streak-flame ${streak.current > 0 ? 'active' : ''}">🔥</span>
            <span class="streak-count">${streak.current}</span>
            <span class="streak-label">DAY STREAK</span>
        </div>
        <div class="streak-record">
            <span class="streak-record-label">RECORD</span>
            <span class="streak-record-value">${streak.longest}</span>
        </div>
    `;
}

function renderMonthlyHeatmap() {
    const container = document.getElementById('sleep-heatmap');
    if (!container) return;

    const monthData = getMonthLog(heatmapYear, heatmapMonth);
    const monthName = new Date(heatmapYear, heatmapMonth).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });

    // Get first day of month offset
    const firstDayOfWeek = new Date(heatmapYear, heatmapMonth, 1).getDay();

    let html = `
        <div class="heatmap-header">
            <button class="heatmap-nav" id="heatmap-prev">&lt;</button>
            <span class="heatmap-month">${monthName}</span>
            <button class="heatmap-nav" id="heatmap-next">&gt;</button>
        </div>
        <div class="heatmap-weekdays">
            <span>S</span><span>M</span><span>T</span><span>W</span><span>T</span><span>F</span><span>S</span>
        </div>
        <div class="heatmap-grid">
    `;

    // Add empty cells for offset
    for (let i = 0; i < firstDayOfWeek; i++) {
        html += '<div class="heatmap-cell empty"></div>';
    }

    // Add day cells
    monthData.forEach(day => {
        const color = getSleepColor(day.hours);
        const today = new Date();
        const isToday = day.date === localDateStr(today);
        const isFuture = new Date(day.date) > today;

        let tooltip = day.hours
            ? `${day.hours.toFixed(1)}h`
            : (isFuture ? '' : 'No data');

        html += `
            <div class="heatmap-cell heatmap-${color} ${isToday ? 'today' : ''} ${isFuture ? 'future' : ''}"
                 data-date="${day.date}"
                 data-duration="${day.hours || ''}"
                 title="${day.day}: ${tooltip}">
                <span class="heatmap-day">${day.day}</span>
            </div>
        `;
    });

    html += '</div>';
    container.innerHTML = html;

    // Add navigation event listeners
    document.getElementById('heatmap-prev')?.addEventListener('click', () => {
        heatmapMonth--;
        if (heatmapMonth < 0) {
            heatmapMonth = 11;
            heatmapYear--;
        }
        renderMonthlyHeatmap();
    });

    document.getElementById('heatmap-next')?.addEventListener('click', () => {
        heatmapMonth++;
        if (heatmapMonth > 11) {
            heatmapMonth = 0;
            heatmapYear++;
        }
        renderMonthlyHeatmap();
    });
}

function renderEnhancedStats() {
    const container = document.getElementById('sleep-enhanced-stats');
    if (!container) return;

    const days = getLastNDaysLog(statsPeriod);
    const stats = calculatePeriodStats(days);

    // Calculate trend for duration
    const durations = days.filter(d => d.hours).map(d => d.hours);
    const trend = calculateTrend(durations);
    const trendArrow = trend === 'up' ? '↑' : trend === 'down' ? '↓' : '→';
    const trendClass = trend === 'up' ? 'trend-up' : trend === 'down' ? 'trend-down' : 'trend-neutral';

    const formatDate = (d) => {
        if (!d) return '--';
        const date = new Date(d.date);
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    };

    container.innerHTML = `
        <div class="stats-period-toggle">
            <button class="period-btn ${statsPeriod === 7 ? 'active' : ''}" data-period="7">7 Days</button>
            <button class="period-btn ${statsPeriod === 30 ? 'active' : ''}" data-period="30">30 Days</button>
        </div>
        <div class="stats-grid">
            <div class="stat-card">
                <span class="stat-card-value">${stats.avgDuration ? stats.avgDuration.toFixed(1) + 'h' : '--'}</span>
                <span class="stat-card-label">AVG DURATION</span>
                <span class="stat-trend ${trendClass}">${trendArrow}</span>
                <canvas class="sparkline" id="sparkline-duration" width="60" height="20"></canvas>
            </div>
            <div class="stat-card">
                <span class="stat-card-value">${stats.avgBedtime ? formatTime12Hour(stats.avgBedtime.hour, stats.avgBedtime.minute) : '--'}</span>
                <span class="stat-card-label">AVG BEDTIME</span>
            </div>
            <div class="stat-card">
                <span class="stat-card-value">${stats.avgWakeTime ? formatTime12Hour(stats.avgWakeTime.hour, stats.avgWakeTime.minute) : '--'}</span>
                <span class="stat-card-label">AVG WAKE</span>
            </div>
            <div class="stat-card">
                <span class="stat-card-value">${stats.bestNight ? stats.bestNight.hours.toFixed(1) + 'h' : '--'}</span>
                <span class="stat-card-label">BEST NIGHT</span>
                <span class="stat-card-date">${formatDate(stats.bestNight)}</span>
            </div>
            <div class="stat-card">
                <span class="stat-card-value">${stats.worstNight ? stats.worstNight.hours.toFixed(1) + 'h' : '--'}</span>
                <span class="stat-card-label">WORST NIGHT</span>
                <span class="stat-card-date">${formatDate(stats.worstNight)}</span>
            </div>
            <div class="stat-card">
                <span class="stat-card-value">${stats.nightsLogged}</span>
                <span class="stat-card-label">NIGHTS LOGGED</span>
            </div>
        </div>
    `;

    // Period toggle event listeners
    container.querySelectorAll('.period-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            statsPeriod = parseInt(btn.dataset.period);
            renderEnhancedStats();
        });
    });

}

function renderSleepDebtEnhanced() {
    const container = document.getElementById('sleep-debt-enhanced');
    if (!container) return;

    const debt = calculateCumulativeSleepDebt(14);

    // Map debt to meter position: -10 to +5 range, centered at 0
    // -10h = 0%, 0h = 66.7%, +5h = 100%
    const minDebt = -10;
    const maxDebt = 5;
    const range = maxDebt - minDebt; // 15
    const position = ((debt.total - minDebt) / range) * 100;

    const isInDebt = debt.total < 0;
    const colorClass = debt.total < -3 ? 'debt-severe' : debt.total < 0 ? 'debt-mild' : 'debt-positive';

    container.innerHTML = `
        <div class="debt-meter-section">
            <div class="debt-meter">
                <div class="debt-meter-scale">
                    <span class="debt-scale-label left">-10h</span>
                    <span class="debt-scale-label center">0</span>
                    <span class="debt-scale-label right">+5h</span>
                </div>
                <div class="debt-meter-track">
                    <div class="debt-meter-marker ${colorClass}" style="left: ${position}%"></div>
                    <div class="debt-meter-zero"></div>
                </div>
            </div>
            <div class="debt-summary">
                <div class="debt-total ${colorClass}">
                    ${debt.total >= 0 ? '+' : ''}${debt.total.toFixed(1)}h
                </div>
                ${isInDebt ? `<div class="debt-recovery">${debt.daysToRecover} days to recover</div>` : '<div class="debt-recovery">Well rested!</div>'}
            </div>
        </div>
    `;
}

function renderSleepInsights() {
    const container = document.getElementById('sleep-insights');
    if (!container) return;

    const insights = generateSleepInsights();

    if (insights.length === 0) {
        container.innerHTML = '<div class="insight-empty">Track more sleep to see insights</div>';
        return;
    }

    let html = '';
    insights.forEach(insight => {
        const icon = insight.type === 'success' ? '✓' : insight.type === 'warning' ? '!' : 'i';
        html += `
            <div class="insight-item insight-${insight.type}">
                <span class="insight-icon">${icon}</span>
                <span class="insight-text">${insight.text}</span>
            </div>
        `;
    });

    container.innerHTML = html;
}

function renderWeeklyChart() {
    const container = document.getElementById('weekly-chart');
    if (!container) return;

    const settings = loadSleepSettings();
    const weekData = getLastNDaysLog(7);
    const maxHours = 10;

    let html = '<div class="weekly-bars">';

    weekData.forEach(day => {
        const height = day.hours ? (day.hours / maxHours) * 100 : 0;
        const color = getSleepColor(day.hours);

        html += `
            <div class="weekly-bar-container">
                <div class="weekly-bar color-${color}" style="height: ${height}%">
                    ${day.hours ? `<span class="bar-value">${day.hours.toFixed(1)}</span>` : ''}
                </div>
                <span class="bar-label">${day.dayName}</span>
            </div>
        `;
    });

    html += '</div>';

    // Target line
    const targetHeight = (settings.targetHours / maxHours) * 100;
    html += `<div class="target-line" style="bottom: ${targetHeight}%"><span>${settings.targetHours}h goal</span></div>`;

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
    const { startH, startM, endH, endM } = getIdealBedtimeWindow(settings);

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
    renderSleepScore();
    renderSleepStreak();
    renderMonthlyHeatmap();
    renderEnhancedStats();
    renderSleepDebtEnhanced();
    renderSleepInsights();
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
        const wake = parseTime(settings.wakeTime);
        wakeDisplayEl.textContent = formatTime12Hour(wake.hour, wake.minute);
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

}

// ═══════════════════════════════════════════════════════════════════════════════
// INITIALIZATION
// ═══════════════════════════════════════════════════════════════════════════════

function initSleepCard() {
    const chip = document.getElementById('chip-rest');

    // Navigate to sleep page on chip click
    chip.addEventListener('click', () => {
        window.location.href = 'sleep.html';
    });

    // Initial update
    updateSleepDisplay();

    // Update chip countdown every second (pause when tab hidden to save CPU)
    let sleepDisplayInterval = setInterval(updateSleepDisplay, 1000);
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
            clearInterval(sleepDisplayInterval);
            sleepDisplayInterval = null;
        } else if (!sleepDisplayInterval) {
            updateSleepDisplay();
            sleepDisplayInterval = setInterval(updateSleepDisplay, 1000);
        }
    });
}
