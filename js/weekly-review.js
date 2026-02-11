// ═══════════════════════════════════════════════════════════════════════════════
// WEEKLY REVIEW — Sleep stats + goal completion for the past 7 days
// ═══════════════════════════════════════════════════════════════════════════════

const LAST_REVIEW_KEY = '0500_last_weekly_review';

function generateWeeklyReview() {
    // --- Sleep data (reuse sleep.js functions) ---
    const sleepDays = getLastNDaysLog(7);
    const sleepStats = calculatePeriodStats(sleepDays);
    const sleepScore = calculateSleepScore(sleepDays);
    const nightsLogged = sleepDays.filter(d => d.duration).length;

    // --- Daily goal history ---
    const history = DataService.loadDailyGoalHistory();
    const now = new Date();
    const last7Dates = [];
    for (let i = 6; i >= 0; i--) {
        const d = new Date(now);
        d.setDate(d.getDate() - i);
        last7Dates.push(d.toISOString().split('T')[0]);
    }

    const dailyByDay = last7Dates.map(date => {
        const entry = history.find(h => h.date === date);
        const d = new Date(date + 'T12:00:00');
        return {
            date,
            dayName: d.toLocaleDateString('en-US', { weekday: 'short' }),
            completed: entry ? entry.completed : null,
            total: entry ? entry.total : null
        };
    });

    const daysWithGoals = dailyByDay.filter(d => d.total !== null && d.total > 0);
    const totalCompleted = daysWithGoals.reduce((s, d) => s + d.completed, 0);
    const totalGoals = daysWithGoals.reduce((s, d) => s + d.total, 0);
    const completionRate = totalGoals > 0 ? Math.round((totalCompleted / totalGoals) * 100) : null;

    // --- Mid-term goals completed this week ---
    const weekAgo = new Date(now);
    weekAgo.setDate(weekAgo.getDate() - 7);
    let midTermCompleted = [];
    if (typeof goalsCache !== 'undefined' && goalsCache && goalsCache.midTerm) {
        // Ensure timestamps are hydrated
        if (typeof hydrateMidTermTimestamps === 'function') hydrateMidTermTimestamps(goalsCache);
        midTermCompleted = goalsCache.midTerm.filter(g => {
            if (!g.checked || !g.completedAt) return false;
            return new Date(g.completedAt) >= weekAgo;
        });
    }

    return {
        sleep: {
            avgDuration: sleepStats.avgDuration,
            avgBedtime: sleepStats.avgBedtime,
            avgWakeTime: sleepStats.avgWakeTime,
            score: sleepScore ? sleepScore.total : null,
            nightsLogged,
            bestNight: sleepStats.bestNight,
            worstNight: sleepStats.worstNight
        },
        goals: {
            dailyByDay,
            totalCompleted,
            totalGoals,
            completionRate,
            daysTracked: daysWithGoals.length,
            midTermCompleted
        }
    };
}

function formatReviewTime(timeObj) {
    if (!timeObj) return '--';
    let h = timeObj.hour;
    const m = timeObj.minute.toString().padStart(2, '0');
    const period = h >= 12 ? 'p' : 'a';
    h = h % 12 || 12;
    return `${h}:${m}${period}`;
}

function renderWeeklyReview(data) {
    const container = document.getElementById('review-modal-body');
    if (!container) return;

    const s = data.sleep;
    const g = data.goals;

    // Sleep section
    const avgHrs = s.avgDuration != null ? s.avgDuration.toFixed(1) : '--';
    const scoreDisplay = s.score != null ? s.score : '--';
    const scoreClass = s.score >= 80 ? 'good' : s.score >= 60 ? 'ok' : 'poor';

    let bestWorstHtml = '';
    if (s.bestNight && s.worstNight && s.bestNight !== s.worstNight) {
        bestWorstHtml = `
            <div class="review-stat">
                <span class="review-stat-label">Best</span>
                <span class="review-stat-value">${s.bestNight.duration.toFixed(1)}h <span class="review-stat-sub">${s.bestNight.dayName}</span></span>
            </div>
            <div class="review-stat">
                <span class="review-stat-label">Worst</span>
                <span class="review-stat-value">${s.worstNight.duration.toFixed(1)}h <span class="review-stat-sub">${s.worstNight.dayName}</span></span>
            </div>`;
    }

    const sleepHtml = `
        <div class="review-card">
            <div class="review-card-title">SLEEP</div>
            <div class="review-stats-grid">
                <div class="review-stat">
                    <span class="review-stat-label">Avg hours</span>
                    <span class="review-stat-value">${avgHrs}h</span>
                </div>
                <div class="review-stat">
                    <span class="review-stat-label">Score</span>
                    <span class="review-stat-value review-score-${scoreClass}">${scoreDisplay}</span>
                </div>
                <div class="review-stat">
                    <span class="review-stat-label">Avg bedtime</span>
                    <span class="review-stat-value">${formatReviewTime(s.avgBedtime)}</span>
                </div>
                <div class="review-stat">
                    <span class="review-stat-label">Avg wake</span>
                    <span class="review-stat-value">${formatReviewTime(s.avgWakeTime)}</span>
                </div>
                <div class="review-stat">
                    <span class="review-stat-label">Nights logged</span>
                    <span class="review-stat-value">${s.nightsLogged}/7</span>
                </div>
                ${bestWorstHtml}
            </div>
        </div>`;

    // Goals section
    const rateDisplay = g.completionRate != null ? `${g.completionRate}%` : '--';
    const rateClass = g.completionRate >= 80 ? 'good' : g.completionRate >= 50 ? 'ok' : 'poor';

    let dayBarsHtml = g.dailyByDay.map(d => {
        const pct = (d.total && d.total > 0) ? Math.round((d.completed / d.total) * 100) : 0;
        const hasData = d.total !== null && d.total > 0;
        const label = hasData ? `${d.completed}/${d.total}` : '--';
        return `
            <div class="review-day-col">
                <div class="review-day-bar-track">
                    <div class="review-day-bar-fill ${hasData ? (pct >= 80 ? 'good' : pct >= 50 ? 'ok' : 'poor') : ''}" style="height: ${hasData ? pct : 0}%"></div>
                </div>
                <div class="review-day-label">${d.dayName}</div>
                <div class="review-day-count">${label}</div>
            </div>`;
    }).join('');

    let midTermHtml = '';
    if (g.midTermCompleted.length > 0) {
        const items = g.midTermCompleted.map(m =>
            `<div class="review-midterm-item">Completed <em>${m.text}</em> from mid-term goals</div>`
        ).join('');
        midTermHtml = `
            <div class="review-midterm-section">
                <div class="review-subsection-title">MID-TERM</div>
                ${items}
            </div>`;
    }

    const goalsHtml = `
        <div class="review-card">
            <div class="review-card-title">GOALS</div>
            ${g.daysTracked > 0 ? `
                <div class="review-goals-summary">
                    <span class="review-goals-rate review-score-${rateClass}">${rateDisplay}</span>
                    <span class="review-goals-detail">${g.totalCompleted}/${g.totalGoals} daily goals completed</span>
                </div>
                <div class="review-day-bars">
                    ${dayBarsHtml}
                </div>
            ` : `
                <div class="review-empty">No daily goal data this week</div>
            `}
            ${midTermHtml}
        </div>`;

    container.innerHTML = sleepHtml + goalsHtml;
}

function openWeeklyReview() {
    const data = generateWeeklyReview();
    renderWeeklyReview(data);

    const modal = document.getElementById('review-modal');
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';

    // Mark as shown
    localStorage.setItem(LAST_REVIEW_KEY, new Date().toISOString());
}

function closeWeeklyReview() {
    const modal = document.getElementById('review-modal');
    modal.classList.remove('active');
    document.body.style.overflow = '';
}

function checkAutoShowReview() {
    const now = new Date();
    const day = now.getDay(); // 0=Sun, 1=Mon
    const hour = now.getHours();

    // Sun after 6pm or Mon before noon
    const isSunEvening = day === 0 && hour >= 18;
    const isMonMorning = day === 1 && hour < 12;
    if (!isSunEvening && !isMonMorning) return;

    // Check if already shown this week
    const lastShown = localStorage.getItem(LAST_REVIEW_KEY);
    if (lastShown) {
        const lastDate = new Date(lastShown);
        const msSince = now - lastDate;
        const daysSince = msSince / (1000 * 60 * 60 * 24);
        if (daysSince < 5) return; // Don't show more than once per ~week
    }

    openWeeklyReview();
}

function initWeeklyReview() {
    const chip = document.getElementById('chip-review');
    const modal = document.getElementById('review-modal');
    if (!chip || !modal) return;

    const backdrop = modal.querySelector('.modal-backdrop');
    const closeBtn = document.getElementById('review-modal-close');

    chip.addEventListener('click', openWeeklyReview);
    closeBtn?.addEventListener('click', closeWeeklyReview);
    backdrop?.addEventListener('click', closeWeeklyReview);

    // Auto-show check (slight delay to not block paint)
    setTimeout(checkAutoShowReview, 3000);
}
