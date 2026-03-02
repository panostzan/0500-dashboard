// ═══════════════════════════════════════════════════════════════════════════════
// STRAVA FITNESS — chip + floating card
// ═══════════════════════════════════════════════════════════════════════════════

const STRAVA_KEYS = {
    clientId: '0500_strava_client_id',
    clientSecret: '0500_strava_client_secret',
    refreshToken: '0500_strava_refresh_token',
    accessToken: '0500_strava_access_token',
    tokenExpiry: '0500_strava_token_expiry',
    cache: '0500_strava_cache',
    cacheTime: '0500_strava_cache_time'
};

const STRAVA_CACHE_TTL = 60 * 60 * 1000; // 1 hour

// ─── Credential helpers ──────────────────────────────────────────────────────

function hasStravaCredentials() {
    return !!(
        localStorage.getItem(STRAVA_KEYS.clientId) &&
        localStorage.getItem(STRAVA_KEYS.clientSecret) &&
        localStorage.getItem(STRAVA_KEYS.refreshToken)
    );
}

function getStravaCredentials() {
    return {
        clientId: localStorage.getItem(STRAVA_KEYS.clientId),
        clientSecret: localStorage.getItem(STRAVA_KEYS.clientSecret),
        refreshToken: localStorage.getItem(STRAVA_KEYS.refreshToken)
    };
}

function saveStravaCredentials(clientId, clientSecret, refreshToken) {
    localStorage.setItem(STRAVA_KEYS.clientId, clientId.trim());
    localStorage.setItem(STRAVA_KEYS.clientSecret, clientSecret.trim());
    localStorage.setItem(STRAVA_KEYS.refreshToken, refreshToken.trim());
}

function clearStravaCredentials() {
    Object.values(STRAVA_KEYS).forEach(k => localStorage.removeItem(k));
}

// ─── Token management ────────────────────────────────────────────────────────

async function refreshAccessToken() {
    const creds = getStravaCredentials();
    const res = await fetch('https://www.strava.com/oauth/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            client_id: creds.clientId,
            client_secret: creds.clientSecret,
            refresh_token: creds.refreshToken,
            grant_type: 'refresh_token'
        })
    });

    if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`Token refresh failed (${res.status}): ${text}`);
    }

    const data = await res.json();
    localStorage.setItem(STRAVA_KEYS.accessToken, data.access_token);
    localStorage.setItem(STRAVA_KEYS.tokenExpiry, String(data.expires_at * 1000));
    // Strava rotates refresh tokens
    if (data.refresh_token) {
        localStorage.setItem(STRAVA_KEYS.refreshToken, data.refresh_token);
    }
    return data.access_token;
}

async function getAccessToken() {
    const token = localStorage.getItem(STRAVA_KEYS.accessToken);
    const expiry = Number(localStorage.getItem(STRAVA_KEYS.tokenExpiry) || 0);

    // Refresh if expired or within 5 min of expiry
    if (!token || Date.now() > expiry - 5 * 60 * 1000) {
        return await refreshAccessToken();
    }
    return token;
}

// ─── API fetch ───────────────────────────────────────────────────────────────

async function fetchStravaActivities(token) {
    // Fetch from start of last month (~62 days max) for month-over-month comparison
    const now = new Date();
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const afterEpoch = Math.floor(lastMonthStart.getTime() / 1000);
    const url = `https://www.strava.com/api/v3/athlete/activities?after=${afterEpoch}&per_page=200`;

    const res = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` }
    });

    if (res.status === 429) throw new Error('RATE_LIMITED');
    if (res.status === 401) throw new Error('UNAUTHORIZED');
    if (!res.ok) throw new Error(`API error (${res.status})`);

    return await res.json();
}

// ─── Data processing ─────────────────────────────────────────────────────────

function getDailyBreakdown(activities) {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const todayDate = today.getDate(); // 1-based

    const days = Array.from({ length: daysInMonth }, (_, i) => ({
        distance: 0, time: 0, count: 0,
        date: new Date(now.getFullYear(), now.getMonth(), i + 1),
        dayOfMonth: i + 1,
        isFuture: (i + 1) > todayDate
    }));

    for (const act of activities) {
        const actDate = new Date(act.start_date_local || act.start_date);
        if (actDate.getFullYear() === now.getFullYear() && actDate.getMonth() === now.getMonth()) {
            const idx = actDate.getDate() - 1;
            if (idx >= 0 && idx < daysInMonth) {
                days[idx].distance += act.distance || 0;
                days[idx].time += act.moving_time || 0;
                days[idx].count++;
            }
        }
    }
    return days;
}

function processActivities(activities) {
    const now = new Date();
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);

    const thisMonth = { activities: [], distance: 0, time: 0, count: 0 };
    const lastMonth = { activities: [], distance: 0, time: 0, count: 0 };

    const allActivities = [];

    for (const act of activities) {
        const actDate = new Date(act.start_date_local || act.start_date);
        const bucket = actDate >= thisMonthStart ? thisMonth
            : actDate >= lastMonthStart ? lastMonth
            : null;

        if (bucket) {
            bucket.activities.push(act);
            bucket.distance += act.distance || 0;
            bucket.time += act.moving_time || 0;
            bucket.count++;
        }
        allActivities.push(act);
    }

    allActivities.sort((a, b) =>
        new Date(b.start_date_local || b.start_date) - new Date(a.start_date_local || a.start_date)
    );

    thisMonth.activities.sort((a, b) =>
        new Date(b.start_date_local || b.start_date) - new Date(a.start_date_local || a.start_date)
    );
    lastMonth.activities.sort((a, b) =>
        new Date(b.start_date_local || b.start_date) - new Date(a.start_date_local || a.start_date)
    );

    const lastActivity = thisMonth.activities[0] || lastMonth.activities[0] || null;

    // Month-over-month deltas
    const distDelta = lastMonth.distance > 0
        ? ((thisMonth.distance - lastMonth.distance) / lastMonth.distance) * 100
        : thisMonth.distance > 0 ? 100 : 0;
    const timeDelta = lastMonth.time > 0
        ? ((thisMonth.time - lastMonth.time) / lastMonth.time) * 100
        : thisMonth.time > 0 ? 100 : 0;
    const sessionDelta = thisMonth.count - lastMonth.count;

    const dailyBreakdown = getDailyBreakdown(activities);

    return {
        thisMonth, lastMonth, lastActivity, allActivities, dailyBreakdown,
        deltas: { distance: distDelta, time: timeDelta, sessions: sessionDelta }
    };
}

function computeFitnessStatus(data) {
    const { deltas, thisMonth, lastMonth } = data;
    const d = deltas.distance;
    const sessionsDown = thisMonth.count < lastMonth.count;

    if (d > 15 && !sessionsDown) return { label: 'BUILDING', cls: 'status-building' };
    if (d > 5) return { label: 'PUSHING', cls: 'status-pushing' };
    if (d < -20 && sessionsDown) return { label: 'RECOVERING', cls: 'status-recovering' };
    if (d < -10) return { label: 'TAPERING', cls: 'status-tapering' };
    return { label: 'MAINTAINING', cls: 'status-maintaining' };
}

// ─── Formatters ──────────────────────────────────────────────────────────────

function formatDistance(meters) {
    const km = meters / 1000;
    return km >= 10 ? km.toFixed(1) : km.toFixed(1);
}

function formatDuration(seconds) {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m`;
}

function formatPace(meters, seconds) {
    if (!meters || meters === 0) return '--:--';
    const paceSecsPerKm = seconds / (meters / 1000);
    const min = Math.floor(paceSecsPerKm / 60);
    const sec = Math.floor(paceSecsPerKm % 60);
    return `${min}:${String(sec).padStart(2, '0')}/km`;
}

function formatRelativeDate(dateStr) {
    const date = new Date(dateStr);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const actDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const diffDays = Math.round((today - actDay) / 86400000);

    const time = date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    if (diffDays === 0) return `Today ${time}`;
    if (diffDays === 1) return `Yesterday ${time}`;
    return `${date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })} ${time}`;
}

function formatActivityType(type) {
    const map = {
        'Run': 'Run', 'Ride': 'Ride', 'Swim': 'Swim',
        'WeightTraining': 'Weights', 'Workout': 'Workout',
        'Soccer': 'Soccer', 'Yoga': 'Yoga', 'Hike': 'Hike',
        'Walk': 'Walk', 'VirtualRun': 'Virtual Run',
        'VirtualRide': 'Virtual Ride'
    };
    return map[type] || type;
}

// ─── Delta arrow helper ──────────────────────────────────────────────────────

function deltaHTML(value, label, isUp) {
    if (typeof isUp === 'undefined') isUp = value > 0;
    const arrow = isUp ? '&uarr;' : '&darr;';
    const cls = isUp ? 'delta-up' : 'delta-down';
    const sign = value > 0 ? '+' : '';
    const display = typeof value === 'number'
        ? `${sign}${Math.round(value)}%`
        : `${sign}${value}`;
    return `<span class="fitness-delta ${cls}">${arrow} ${display} ${label}</span>`;
}

// ─── Render ──────────────────────────────────────────────────────────────────

function renderStravaData(data) {
    const body = document.getElementById('strava-body');
    if (!body) return;

    const { thisMonth, deltas, lastActivity } = data;
    const status = computeFitnessStatus(data);

    const offlineTag = !navigator.onLine ? ' <span class="fitness-cached">(cached)</span>' : '';

    let html = '';

    // Status badge
    html += `<div class="fitness-status ${status.cls}"><span class="fitness-status-dot"></span>${status.label}${offlineTag}</div>`;

    if (thisMonth.count === 0 && data.lastMonth.count === 0) {
        html += `<div class="fitness-empty">No activities recorded recently</div>`;
        body.innerHTML = html;
        return;
    }

    // Hero stats: sessions + km + combined trend
    const trendVal = Math.round(deltas.distance);
    const trendSign = trendVal > 0 ? '+' : '';
    const trendCls = trendVal >= 0 ? 'delta-up' : 'delta-down';
    const trendArrow = trendVal >= 0 ? '&uarr;' : '&darr;';

    html += `<div class="fitness-hero-stats">`;
    html += `<div class="fitness-hero-stat"><span class="fitness-hero-num">${thisMonth.count}</span><span class="fitness-hero-label">sessions</span></div>`;
    html += `<div class="fitness-hero-stat"><span class="fitness-hero-num">${formatDistance(thisMonth.distance)}</span><span class="fitness-hero-label">km</span></div>`;
    html += `<div class="fitness-trend ${trendCls}">${trendArrow} ${trendSign}${trendVal}%</div>`;
    html += `</div>`;

    // Last activity — single compact line
    if (lastActivity) {
        const name = lastActivity.name || formatActivityType(lastActivity.type);
        const dist = lastActivity.distance ? ` · ${formatDistance(lastActivity.distance)} km` : '';
        const when = formatRelativeDate(lastActivity.start_date_local || lastActivity.start_date);
        html += `<div class="fitness-last-compact">${name}${dist} · ${when}</div>`;
    }

    // VIEW MORE link
    html += `<a href="fitness.html" class="fitness-view-more">VIEW MORE &rarr;</a>`;

    body.innerHTML = html;
}

// ─── Cache helpers ───────────────────────────────────────────────────────────

function getCachedData() {
    try {
        const raw = localStorage.getItem(STRAVA_KEYS.cache);
        return raw ? JSON.parse(raw) : null;
    } catch { return null; }
}

function setCachedData(data) {
    localStorage.setItem(STRAVA_KEYS.cache, JSON.stringify(data));
    localStorage.setItem(STRAVA_KEYS.cacheTime, String(Date.now()));
}

function isCacheStale() {
    const t = Number(localStorage.getItem(STRAVA_KEYS.cacheTime) || 0);
    return Date.now() - t > STRAVA_CACHE_TTL;
}

// ─── Public API for fitness.html ──────────────────────────────────────────────

async function getStravaDataForPage() {
    // Return cached if fresh
    if (!isCacheStale()) {
        const cached = getCachedData();
        if (cached) {
            // Old cache might lack monthly data — force refresh
            if (cached.dailyBreakdown && cached.allActivities && cached.thisMonth) return cached;
        }
    }

    // Fetch fresh
    const token = await getAccessToken();
    const activities = await fetchStravaActivities(token);
    const data = processActivities(activities);
    setCachedData(data);
    return data;
}

// ─── Load data (fetch or cache) ──────────────────────────────────────────────

async function loadStravaData(forceRefresh) {
    const card = document.getElementById('strava-card');
    const body = document.getElementById('strava-body');
    const chip = document.getElementById('chip-fitness');

    // Check cache first
    if (!forceRefresh && !isCacheStale()) {
        const cached = getCachedData();
        if (cached) {
            renderStravaData(cached);
            updateFitnessChip(cached);
            return;
        }
    }

    // Show loading
    if (body) body.innerHTML = '<div class="fitness-loading">Loading fitness data...</div>';

    try {
        const token = await getAccessToken();
        const activities = await fetchStravaActivities(token);
        const data = processActivities(activities);

        setCachedData(data);
        renderStravaData(data);
        updateFitnessChip(data);
    } catch (err) {
        console.warn('[STRAVA]', err.message);

        // Try showing cached data on error
        const cached = getCachedData();
        if (cached) {
            renderStravaData(cached);
            updateFitnessChip(cached);
            if (body) {
                const notice = document.createElement('div');
                notice.className = 'fitness-notice';
                if (err.message === 'RATE_LIMITED') {
                    notice.textContent = 'Rate limited — try again in 15 minutes';
                } else if (err.message.includes('Failed to fetch') || err.message.includes('NetworkError')) {
                    notice.textContent = 'Offline — showing cached data';
                } else {
                    notice.textContent = 'Update failed — showing cached data';
                }
                body.prepend(notice);
            }
            return;
        }

        // No cache, show error
        if (body) {
            if (err.message === 'RATE_LIMITED') {
                body.innerHTML = '<div class="fitness-error">Rate limited — try again in 15 minutes</div>';
            } else if (err.message === 'UNAUTHORIZED') {
                body.innerHTML = '<div class="fitness-error">Invalid credentials — please reconnect</div>';
                showStravaSetup();
            } else if (err.message.includes('Failed to fetch') || err.message.includes('NetworkError')) {
                body.innerHTML = '<div class="fitness-error">Offline — no cached data available</div>';
            } else {
                body.innerHTML = `<div class="fitness-error">Connection failed — check credentials</div>`;
            }
        }
    }
}

// ─── Chip update ─────────────────────────────────────────────────────────────

function updateFitnessChip(data) {
    const val = document.getElementById('chip-fitness-value');
    if (val && data) {
        val.textContent = `${data.thisMonth.count} this mo`;
    }
}

// ─── Setup / Data view switching ─────────────────────────────────────────────

function showStravaSetup() {
    const setup = document.getElementById('strava-setup');
    const dataView = document.getElementById('strava-data');
    if (setup) setup.style.display = '';
    if (dataView) dataView.style.display = 'none';
}

function showStravaDataView() {
    const setup = document.getElementById('strava-setup');
    const dataView = document.getElementById('strava-data');
    if (setup) setup.style.display = 'none';
    if (dataView) dataView.style.display = '';
}

// ─── Init ────────────────────────────────────────────────────────────────────

function initStrava() {
    const chip = document.getElementById('chip-fitness');
    const card = document.getElementById('strava-card');
    if (!chip || !card) return;

    chip.classList.add('visible');

    // Chip toggle
    chip.addEventListener('click', () => {
        const isOpen = card.classList.toggle('open');
        chip.classList.toggle('active', isOpen);
    });

    // Close on outside click
    document.addEventListener('click', (e) => {
        if (!chip.contains(e.target) && !card.contains(e.target)) {
            card.classList.remove('open');
            chip.classList.remove('active');
        }
    });

    // Close on Escape
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            card.classList.remove('open');
            chip.classList.remove('active');
        }
    });

    // Connect button
    const connectBtn = document.getElementById('strava-connect');
    if (connectBtn) {
        connectBtn.addEventListener('click', async () => {
            const idInput = document.getElementById('strava-client-id');
            const secretInput = document.getElementById('strava-client-secret');
            const tokenInput = document.getElementById('strava-refresh-token');
            const errEl = document.getElementById('strava-setup-error');

            const clientId = idInput?.value?.trim();
            const clientSecret = secretInput?.value?.trim();
            const refreshToken = tokenInput?.value?.trim();

            if (!clientId || !clientSecret || !refreshToken) {
                if (errEl) errEl.textContent = 'All three fields are required';
                return;
            }

            if (errEl) errEl.textContent = '';
            connectBtn.disabled = true;
            connectBtn.textContent = 'CONNECTING...';

            saveStravaCredentials(clientId, clientSecret, refreshToken);

            try {
                // Test the credentials by refreshing token
                await refreshAccessToken();
                showStravaDataView();
                await loadStravaData(true);
            } catch (err) {
                clearStravaCredentials();
                if (errEl) errEl.textContent = 'Invalid credentials — check your API settings';
                console.warn('[STRAVA] Connect failed:', err.message);
            } finally {
                connectBtn.disabled = false;
                connectBtn.textContent = 'CONNECT';
            }
        });
    }

    // Refresh button
    const refreshBtn = document.getElementById('strava-refresh');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            loadStravaData(true);
        });
    }

    // Disconnect button
    const disconnectBtn = document.getElementById('strava-disconnect');
    if (disconnectBtn) {
        disconnectBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            clearStravaCredentials();
            showStravaSetup();
            const body = document.getElementById('strava-body');
            if (body) body.innerHTML = '';
            updateFitnessChip(null);
            const val = document.getElementById('chip-fitness-value');
            if (val) val.textContent = '';
        });
    }

    // Initial state
    if (hasStravaCredentials()) {
        showStravaDataView();
        loadStravaData(false);
    } else {
        showStravaSetup();
    }
}
