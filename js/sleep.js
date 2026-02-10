// ═══════════════════════════════════════════════════════════════════════════════
// SLEEP - Comprehensive Sleep Dashboard with cloud sync
// ═══════════════════════════════════════════════════════════════════════════════

const SLEEP_STORAGE_KEY = '0500_sleep_settings';
const SLEEP_LOG_KEY = '0500_sleep_log';

// Cache for sync data
let sleepSettingsCache = null;
let sleepLogCache = null;

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
// DATA STORAGE - Uses DataService for cloud sync when signed in
// ═══════════════════════════════════════════════════════════════════════════════

function loadSleepSettings() {
    // Use cache if available (for sync operations)
    if (sleepSettingsCache) {
        return { ...SLEEP_DEFAULTS, ...sleepSettingsCache };
    }

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

async function loadSleepSettingsAsync() {
    if (typeof DataService !== 'undefined' && isSignedIn()) {
        const cloudSettings = await DataService.loadSleepSettings();
        sleepSettingsCache = {
            wakeHour: parseInt(cloudSettings.wakeTime.split(':')[0]),
            wakeMinute: parseInt(cloudSettings.wakeTime.split(':')[1]),
            targetSleepHours: cloudSettings.targetHours,
            idealBedtimeStart: '21:30',
            idealBedtimeEnd: '22:30'
        };
        return { ...SLEEP_DEFAULTS, ...sleepSettingsCache };
    }
    return loadSleepSettings();
}

function saveSleepSettings(settings) {
    sleepSettingsCache = settings;
    safeSetItem(SLEEP_STORAGE_KEY, JSON.stringify(settings));

    // Async save to cloud
    if (typeof DataService !== 'undefined' && isSignedIn()) {
        const wakeTime = `${settings.wakeHour.toString().padStart(2, '0')}:${settings.wakeMinute.toString().padStart(2, '0')}`;
        DataService.saveSleepSettings({
            wakeTime,
            targetHours: settings.targetSleepHours
        });
    }
}

function loadSleepLog() {
    if (sleepLogCache) {
        return sleepLogCache;
    }
    const saved = localStorage.getItem(SLEEP_LOG_KEY);
    if (saved) {
        return JSON.parse(saved);
    }
    return [];
}

async function loadSleepLogAsync() {
    if (typeof DataService !== 'undefined' && isSignedIn()) {
        const cloudLog = await DataService.loadSleepLog();
        sleepLogCache = cloudLog.map(e => ({
            date: e.date,
            bedtime: e.bedtime,
            wakeTime: e.wakeTime,
            duration: e.hours
        }));
        return sleepLogCache;
    }
    return loadSleepLog();
}

function saveSleepLog(log) {
    sleepLogCache = log;
    safeSetItem(SLEEP_LOG_KEY, JSON.stringify(log));

    // Async save to cloud
    if (typeof DataService !== 'undefined' && isSignedIn()) {
        DataService.saveSleepLog(log.map(e => ({
            date: e.date,
            bedtime: e.bedtime,
            wakeTime: e.wakeTime,
            hours: e.duration
        })));
    }
}

// Clear cache when user changes
if (typeof window !== 'undefined') {
    window.addEventListener('userChanged', async () => {
        sleepSettingsCache = null;
        sleepLogCache = null;
        await loadSleepSettingsAsync();
        await loadSleepLogAsync();
        updateSleepDisplay();
        updateSleepDashboard();
    });
}

// ═══════════════════════════════════════════════════════════════════════════════
// LOGGING FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

async function logBedtime() {
    const now = new Date();
    // Add 20 minutes for fall asleep buffer
    const bedtime = new Date(now.getTime() + 20 * 60 * 1000);

    const log = await loadSleepLogAsync();

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

async function logWakeUp() {
    // Subtract 10 minutes (user typically presses ~10 min after waking)
    const now = new Date(Date.now() - 10 * 60 * 1000);
    const log = await loadSleepLogAsync();

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

function getMonthLog(year, month) {
    const log = loadSleepLog();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const result = [];

    for (let day = 1; day <= daysInMonth; day++) {
        const date = new Date(year, month, day);
        const dateStr = date.toISOString().split('T')[0];
        const entry = log.find(e => e.date === dateStr && e.duration);

        result.push({
            date: dateStr,
            day: day,
            dayOfWeek: date.getDay(),
            duration: entry ? entry.duration : null,
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
    const daysWithData = days.filter(d => d.duration);

    if (daysWithData.length === 0) return null;

    // Duration accuracy (40%) - how close to target
    const avgDuration = daysWithData.reduce((sum, d) => sum + d.duration, 0) / daysWithData.length;
    const durationDiff = Math.abs(avgDuration - settings.targetSleepHours);
    const durationScore = Math.max(0, 100 - (durationDiff * 20)); // -20 points per hour off target

    // Bedtime consistency (30%) - lower std dev = better
    const bedtimeStd = calculateBedtimeConsistency(daysWithData);
    let bedtimeScore = 100;
    if (bedtimeStd !== null) {
        // 0 min std = 100, 60 min std = 50, 120 min std = 0
        bedtimeScore = Math.max(0, 100 - (bedtimeStd * 0.83));
    }

    // Wake time consistency (30%) - lower std dev = better
    const wakeStd = calculateWakeTimeConsistency(daysWithData);
    let wakeScore = 100;
    if (wakeStd !== null) {
        wakeScore = Math.max(0, 100 - (wakeStd * 0.83));
    }

    // Weighted average
    const totalScore = (durationScore * 0.4) + (bedtimeScore * 0.3) + (wakeScore * 0.3);

    return {
        total: Math.round(totalScore),
        duration: Math.round(durationScore),
        bedtime: Math.round(bedtimeScore),
        wake: Math.round(wakeScore)
    };
}

function calculateSleepStreak() {
    const settings = loadSleepSettings();
    const log = loadSleepLog().filter(e => e.duration);
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
        const meetsGoal = Math.abs(sorted[i].duration - settings.targetSleepHours) <= tolerance;

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
        const meetsGoal = Math.abs(entry.duration - settings.targetSleepHours) <= tolerance;

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
    const daysWithData = log.filter(d => d.duration);

    daysWithData.forEach(day => {
        totalDebt += day.duration - settings.targetSleepHours;
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
    const daysWithData = days.filter(d => d.duration);

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
    const avgDuration = daysWithData.reduce((sum, d) => sum + d.duration, 0) / daysWithData.length;

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
    const sorted = [...daysWithData].sort((a, b) => b.duration - a.duration);
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
    const log = loadSleepLog().filter(e => e.duration);
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
    const last14 = getLastNDaysLog(14).filter(d => d.duration);
    const weekdays = last14.filter(d => {
        const dow = new Date(d.date).getDay();
        return dow >= 1 && dow <= 5;
    });
    const weekends = last14.filter(d => {
        const dow = new Date(d.date).getDay();
        return dow === 0 || dow === 6;
    });

    if (weekdays.length >= 3 && weekends.length >= 2) {
        const weekdayAvg = weekdays.reduce((s, d) => s + d.duration, 0) / weekdays.length;
        const weekendAvg = weekends.reduce((s, d) => s + d.duration, 0) / weekends.length;

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
                <div class="score-factor"><span class="factor-label">Duration</span><div class="factor-bar"><div class="factor-fill" style="width: 0%"></div></div><span class="factor-value">--</span></div>
                <div class="score-factor"><span class="factor-label">Bedtime</span><div class="factor-bar"><div class="factor-fill" style="width: 0%"></div></div><span class="factor-value">--</span></div>
                <div class="score-factor"><span class="factor-label">Wake</span><div class="factor-bar"><div class="factor-fill" style="width: 0%"></div></div><span class="factor-value">--</span></div>
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
                <span class="factor-label">Duration</span>
                <div class="factor-bar"><div class="factor-fill" style="width: ${score.duration}%"></div></div>
                <span class="factor-value">${score.duration}</span>
            </div>
            <div class="score-factor">
                <span class="factor-label">Bedtime</span>
                <div class="factor-bar"><div class="factor-fill" style="width: ${score.bedtime}%"></div></div>
                <span class="factor-value">${score.bedtime}</span>
            </div>
            <div class="score-factor">
                <span class="factor-label">Wake</span>
                <div class="factor-bar"><div class="factor-fill" style="width: ${score.wake}%"></div></div>
                <span class="factor-value">${score.wake}</span>
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
        const color = getSleepColor(day.duration);
        const today = new Date();
        const isToday = day.date === today.toISOString().split('T')[0];
        const isFuture = new Date(day.date) > today;

        let tooltip = day.duration
            ? `${day.duration.toFixed(1)}h`
            : (isFuture ? '' : 'No data');

        html += `
            <div class="heatmap-cell heatmap-${color} ${isToday ? 'today' : ''} ${isFuture ? 'future' : ''}"
                 data-date="${day.date}"
                 data-duration="${day.duration || ''}"
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
    const durations = days.filter(d => d.duration).map(d => d.duration);
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
                <span class="stat-card-value">${stats.bestNight ? stats.bestNight.duration.toFixed(1) + 'h' : '--'}</span>
                <span class="stat-card-label">BEST NIGHT</span>
                <span class="stat-card-date">${formatDate(stats.bestNight)}</span>
            </div>
            <div class="stat-card">
                <span class="stat-card-value">${stats.worstNight ? stats.worstNight.duration.toFixed(1) + 'h' : '--'}</span>
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

    // Render sparkline
    renderSparkline('sparkline-duration', durations);
}

function renderSparkline(canvasId, values) {
    const canvas = document.getElementById(canvasId);
    if (!canvas || values.length < 2) return;

    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;

    ctx.clearRect(0, 0, width, height);

    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min || 1;

    const padding = 2;
    const graphWidth = width - padding * 2;
    const graphHeight = height - padding * 2;

    ctx.beginPath();
    ctx.strokeStyle = 'rgba(212, 145, 92, 0.8)';
    ctx.lineWidth = 1.5;

    values.forEach((val, i) => {
        const x = padding + (i / (values.length - 1)) * graphWidth;
        const y = padding + graphHeight - ((val - min) / range) * graphHeight;

        if (i === 0) {
            ctx.moveTo(x, y);
        } else {
            ctx.lineTo(x, y);
        }
    });

    ctx.stroke();

    // Draw end point
    const lastX = padding + graphWidth;
    const lastY = padding + graphHeight - ((values[values.length - 1] - min) / range) * graphHeight;
    ctx.beginPath();
    ctx.arc(lastX, lastY, 2, 0, Math.PI * 2);
    ctx.fillStyle = '#d4915c';
    ctx.fill();
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
// DATA EXPORT / IMPORT
// ═══════════════════════════════════════════════════════════════════════════════

function exportSleepData() {
    const settings = loadSleepSettings();
    const log = loadSleepLog();

    const exportData = {
        version: '1.0',
        exportedAt: new Date().toISOString(),
        settings,
        log
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `0500-sleep-data-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    // Show feedback
    const exportBtn = document.getElementById('btn-export-sleep');
    if (exportBtn) {
        const originalText = exportBtn.innerHTML;
        exportBtn.innerHTML = '<span class="btn-icon">✓</span> Exported!';
        setTimeout(() => {
            exportBtn.innerHTML = originalText;
        }, 2000);
    }
}

function importSleepData() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';

    input.onchange = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const data = JSON.parse(event.target.result);

                // Validate data structure
                if (!data.settings || !data.log) {
                    alert('Invalid sleep data file');
                    return;
                }

                // Confirm import
                const logCount = data.log.length;
                if (confirm(`Import ${logCount} sleep records? This will replace your current data.`)) {
                    saveSleepSettings(data.settings);
                    saveSleepLog(data.log);

                    // Update UI
                    updateSleepDisplay();
                    updateSleepDashboard();

                    // Update input values
                    const wakeInput = document.getElementById('sleep-wake-input');
                    const hoursInput = document.getElementById('sleep-hours-input');
                    if (wakeInput) {
                        const h = data.settings.wakeHour.toString().padStart(2, '0');
                        const m = data.settings.wakeMinute.toString().padStart(2, '0');
                        wakeInput.value = `${h}:${m}`;
                    }
                    if (hoursInput) {
                        hoursInput.value = data.settings.targetSleepHours;
                    }

                    // Show feedback
                    const importBtn = document.getElementById('btn-import-sleep');
                    if (importBtn) {
                        const originalText = importBtn.innerHTML;
                        importBtn.innerHTML = '<span class="btn-icon">✓</span> Imported!';
                        setTimeout(() => {
                            importBtn.innerHTML = originalText;
                        }, 2000);
                    }
                }
            } catch (err) {
                alert('Error reading file: ' + err.message);
            }
        };
        reader.readAsText(file);
    };

    input.click();
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

async function initSleepCard() {
    const chip = document.getElementById('chip-rest');
    const modal = document.getElementById('sleep-modal');
    const backdrop = modal.querySelector('.modal-backdrop');
    const closeBtn = document.getElementById('sleep-modal-close');
    const wakeInput = document.getElementById('sleep-wake-input');
    const hoursInput = document.getElementById('sleep-hours-input');
    const goingToBedBtn = document.getElementById('btn-going-to-bed');
    const wokeUpBtn = document.getElementById('btn-woke-up');
    const manualDateInput = document.getElementById('manual-sleep-date');
    const manualBedInput = document.getElementById('manual-sleep-bed');
    const manualWakeInput = document.getElementById('manual-sleep-wake');
    const manualAddBtn = document.getElementById('btn-add-manual-sleep');

    // Load cloud data first (populates cache for sync functions)
    await loadSleepLogAsync();
    await loadSleepSettingsAsync();

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

    // Navigate to sleep page on chip click
    chip.addEventListener('click', () => {
        window.location.href = 'sleep.html';
    });

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
        goingToBedBtn.addEventListener('click', async () => {
            if (!goingToBedBtn.classList.contains('disabled')) {
                const bedtime = await logBedtime();
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
        wokeUpBtn.addEventListener('click', async () => {
            if (!wokeUpBtn.classList.contains('disabled')) {
                const wakeTime = await logWakeUp();
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

    // Manual entry - set default date to yesterday
    if (manualDateInput) {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        manualDateInput.value = yesterday.toISOString().split('T')[0];
        manualDateInput.max = new Date().toISOString().split('T')[0]; // Can't add future dates
    }

    // Manual entry button
    if (manualAddBtn) {
        manualAddBtn.addEventListener('click', () => {
            const date = manualDateInput.value;
            const bedTime = manualBedInput.value;
            const wakeTime = manualWakeInput.value;

            if (!date || !bedTime || !wakeTime) {
                return;
            }

            // Create bedtime datetime (night before)
            const bedDate = new Date(date);
            const [bedH, bedM] = bedTime.split(':').map(Number);
            bedDate.setHours(bedH, bedM, 0, 0);

            // If bedtime is after noon, it's the night before
            // If bedtime is before noon, assume it's early morning same day (unusual but possible)
            if (bedH >= 12) {
                // Bedtime is PM of previous day - no adjustment needed
            }

            // Create wake datetime
            const wakeDate = new Date(date);
            const [wakeH, wakeM] = wakeTime.split(':').map(Number);
            wakeDate.setHours(wakeH, wakeM, 0, 0);

            // If wake time is earlier than bed time, bed was previous day
            if (wakeDate <= bedDate) {
                bedDate.setDate(bedDate.getDate() - 1);
            }

            // Calculate duration
            const duration = (wakeDate - bedDate) / 1000 / 60 / 60;

            // Add to log
            const log = loadSleepLog();

            // Check if entry for this date already exists
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
                // Sort by date
                log.sort((a, b) => new Date(a.date) - new Date(b.date));
            }

            saveSleepLog(log);
            updateSleepDashboard();

            // Show feedback
            manualAddBtn.textContent = '✓';
            manualAddBtn.style.background = 'var(--check-green)';
            setTimeout(() => {
                manualAddBtn.textContent = '+';
                manualAddBtn.style.background = '';
                // Move date back one more day for next entry
                const nextDate = new Date(date);
                nextDate.setDate(nextDate.getDate() - 1);
                manualDateInput.value = nextDate.toISOString().split('T')[0];
            }, 1000);
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

    // Update every second (pause when tab hidden to save CPU)
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
