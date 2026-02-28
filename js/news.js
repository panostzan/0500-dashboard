// ═══════════════════════════════════════════════════════════════════════════════
// NEWS LAYER — Globe-integrated breaking news with floating glass panels
// ═══════════════════════════════════════════════════════════════════════════════

// Country centroid lookup (lat, lng) for geotagging stories
const COUNTRY_CENTROIDS = {
    'united states': { lat: 39.8, lng: -98.5 },
    'u.s.': { lat: 39.8, lng: -98.5 },
    'us': { lat: 39.8, lng: -98.5 },
    'america': { lat: 39.8, lng: -98.5 },
    'united kingdom': { lat: 55.3, lng: -3.4 },
    'uk': { lat: 55.3, lng: -3.4 },
    'britain': { lat: 55.3, lng: -3.4 },
    'canada': { lat: 56.1, lng: -106.3 },
    'australia': { lat: -25.3, lng: 133.7 },
    'germany': { lat: 51.1, lng: 10.4 },
    'france': { lat: 46.6, lng: 2.2 },
    'paris': { lat: 48.9, lng: 2.3 },
    'japan': { lat: 36.2, lng: 138.2 },
    'tokyo': { lat: 35.7, lng: 139.7 },
    'china': { lat: 35.8, lng: 104.1 },
    'beijing': { lat: 39.9, lng: 116.4 },
    'india': { lat: 20.6, lng: 78.9 },
    'brazil': { lat: -14.2, lng: -51.9 },
    'russia': { lat: 61.5, lng: 105.3 },
    'moscow': { lat: 55.8, lng: 37.6 },
    'ukraine': { lat: 48.3, lng: 31.1 },
    'kyiv': { lat: 50.5, lng: 30.5 },
    'south korea': { lat: 35.9, lng: 127.7 },
    'korea': { lat: 35.9, lng: 127.7 },
    'north korea': { lat: 40.0, lng: 127.0 },
    'mexico': { lat: 23.6, lng: -102.5 },
    'italy': { lat: 41.8, lng: 12.5 },
    'rome': { lat: 41.9, lng: 12.5 },
    'spain': { lat: 40.4, lng: -3.7 },
    'turkey': { lat: 38.9, lng: 35.2 },
    'saudi arabia': { lat: 23.9, lng: 45.0 },
    'south africa': { lat: -30.5, lng: 22.9 },
    'argentina': { lat: -38.4, lng: -63.6 },
    'nigeria': { lat: 9.1, lng: 8.7 },
    'egypt': { lat: 26.8, lng: 30.8 },
    'cairo': { lat: 30.0, lng: 31.2 },
    'poland': { lat: 51.9, lng: 19.1 },
    'israel': { lat: 31.0, lng: 34.8 },
    'iran': { lat: 32.4, lng: 53.7 },
    'tehran': { lat: 35.7, lng: 51.4 },
    'iraq': { lat: 33.2, lng: 43.7 },
    'syria': { lat: 34.8, lng: 38.9 },
    'indonesia': { lat: -0.8, lng: 113.9 },
    'pakistan': { lat: 30.4, lng: 69.3 },
    'thailand': { lat: 15.9, lng: 100.9 },
    'vietnam': { lat: 14.1, lng: 108.3 },
    'philippines': { lat: 12.9, lng: 121.7 },
    'colombia': { lat: 4.5, lng: -74.3 },
    'kenya': { lat: -0.02, lng: 37.9 },
    'sweden': { lat: 60.1, lng: 18.6 },
    'norway': { lat: 60.5, lng: 8.5 },
    'switzerland': { lat: 46.8, lng: 8.2 },
    'netherlands': { lat: 52.1, lng: 5.3 },
    'taiwan': { lat: 23.7, lng: 121.0 },
    'singapore': { lat: 1.3, lng: 103.8 },
    'uae': { lat: 23.4, lng: 53.8 },
    'united arab emirates': { lat: 23.4, lng: 53.8 },
    'dubai': { lat: 25.2, lng: 55.3 },
    'new zealand': { lat: -40.9, lng: 174.9 },
    'chile': { lat: -35.7, lng: -71.5 },
    'greece': { lat: 39.1, lng: 21.8 },
    'portugal': { lat: 39.4, lng: -8.2 },
    'afghanistan': { lat: 33.9, lng: 67.7 },
    'ethiopia': { lat: 9.1, lng: 40.5 },
    'ghana': { lat: 7.9, lng: -1.0 },
    'peru': { lat: -9.2, lng: -75.0 },
    'gaza': { lat: 31.5, lng: 34.5 },
    'palestine': { lat: 31.9, lng: 35.2 },
    'lebanon': { lat: 33.9, lng: 35.5 },
    'yemen': { lat: 15.6, lng: 48.5 },
    'sudan': { lat: 12.9, lng: 30.2 },
    'myanmar': { lat: 19.8, lng: 96.2 },
    'venezuela': { lat: 6.4, lng: -66.6 },
    'cuba': { lat: 21.5, lng: -78.0 },
    'nato': { lat: 50.9, lng: 4.4 },
    'eu': { lat: 50.8, lng: 4.4 },
    'european union': { lat: 50.8, lng: 4.4 },
    'europe': { lat: 50.0, lng: 10.0 },
    'africa': { lat: 2.0, lng: 21.0 },
    'middle east': { lat: 29.0, lng: 41.0 },
    'asia': { lat: 34.0, lng: 100.0 },
    'london': { lat: 51.5, lng: -0.1 },
    'washington': { lat: 38.9, lng: -77.0 },
    'pentagon': { lat: 38.9, lng: -77.1 },
    'congress': { lat: 38.9, lng: -77.0 },
    'white house': { lat: 38.9, lng: -77.0 },
    'kremlin': { lat: 55.8, lng: 37.6 },
    'un': { lat: 40.7, lng: -74.0 },
    'united nations': { lat: 40.7, lng: -74.0 }
};

// Google News RSS → JSON (no API key needed)
const NEWS_FEED_URL = 'https://api.rss2json.com/v1/api.json?rss_url=' +
    encodeURIComponent('https://news.google.com/rss/headlines/section/topic/WORLD?hl=en-US&gl=US&ceid=US:en');

let newsActive = false;
let newsData = [];
let newsRefreshTimer = null;
let newsPanelsContainer = null;
let newsConnectorsSvg = null;

// Extract country/location from headline text
function detectCountry(title) {
    const lower = title.toLowerCase();
    // Check longest keys first to match "south korea" before "korea", "united states" before "us", etc.
    const sorted = Object.keys(COUNTRY_CENTROIDS).sort((a, b) => b.length - a.length);
    for (const key of sorted) {
        // Word boundary check — avoid matching "us" inside "focus", "russia" inside "prussian", etc.
        const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp('\\b' + escaped + '\\b', 'i');
        if (regex.test(lower)) {
            return key;
        }
    }
    return null;
}

// Extract source name from Google News title format: "Headline - Source Name"
function extractSource(title) {
    const dash = title.lastIndexOf(' - ');
    if (dash > 0) return title.substring(dash + 3).trim();
    return '';
}

// Extract clean headline (without source suffix)
function extractHeadline(title) {
    const dash = title.lastIndexOf(' - ');
    if (dash > 0) return title.substring(0, dash).trim();
    return title;
}

function getCountryCoords(country) {
    if (!country) return null;
    const key = country.toLowerCase().trim();
    return COUNTRY_CENTROIDS[key] || null;
}

function timeAgo(dateStr) {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
}

async function fetchNews() {
    try {
        const response = await fetch(NEWS_FEED_URL);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();

        if (data.status !== 'ok' || !data.items || !data.items.length) {
            throw new Error('No items in feed');
        }

        // Parse and geo-tag stories
        const geoStories = data.items
            .map(item => {
                const headline = extractHeadline(item.title);
                const country = detectCountry(item.title);
                if (!country) return null;
                return {
                    title: headline,
                    source: extractSource(item.title) || 'Google News',
                    country: country,
                    link: item.link,
                    pubDate: item.pubDate
                };
            })
            .filter(Boolean)
            // Deduplicate by country — one story per location
            .filter((story, i, arr) => arr.findIndex(s => s.country === story.country) === i)
            .slice(0, 4);

        if (geoStories.length >= 2) return geoStories;

        // If world feed didn't yield enough geo-tagged stories, try top headlines
        const fallbackUrl = 'https://api.rss2json.com/v1/api.json?rss_url=' +
            encodeURIComponent('https://news.google.com/rss?hl=en-US&gl=US&ceid=US:en');
        const fbResp = await fetch(fallbackUrl);
        const fbData = await fbResp.json();

        if (fbData.status === 'ok' && fbData.items) {
            const fbStories = fbData.items
                .map(item => {
                    const headline = extractHeadline(item.title);
                    const country = detectCountry(item.title);
                    if (!country) return null;
                    return {
                        title: headline,
                        source: extractSource(item.title) || 'Google News',
                        country: country,
                        link: item.link,
                        pubDate: item.pubDate
                    };
                })
                .filter(Boolean)
                .filter((story, i, arr) => arr.findIndex(s => s.country === story.country) === i);

            // Merge, deduplicate, take 4
            const merged = [...geoStories, ...fbStories]
                .filter((s, i, arr) => arr.findIndex(x => x.country === s.country) === i)
                .slice(0, 4);
            if (merged.length >= 2) return merged;
        }

        throw new Error('Not enough geo-tagged stories');
    } catch (err) {
        console.warn('[NEWS] Fetch failed, using fallback:', err.message);
        // Fallback — still better than hardcoded demo data
        return [
            { title: 'Unable to load live headlines', source: 'Offline', country: 'united states',
              pubDate: new Date().toISOString(), link: '' }
        ];
    }
}

// Panel positions around the globe (relative to wrapper center)
const PANEL_POSITIONS = [
    { top: '5%', left: '-10%' },     // 10 o'clock
    { top: '5%', right: '-10%' },    // 2 o'clock
    { bottom: '10%', right: '-10%' }, // 5 o'clock
    { bottom: '10%', left: '-10%' }  // 8 o'clock
];

function createPanelElements() {
    const wrapper = document.getElementById('globe-wrapper');
    if (!wrapper) return;

    if (newsPanelsContainer) newsPanelsContainer.remove();
    if (newsConnectorsSvg) newsConnectorsSvg.remove();

    newsConnectorsSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    newsConnectorsSvg.classList.add('news-connectors');
    newsConnectorsSvg.setAttribute('viewBox', '0 0 550 550');
    wrapper.appendChild(newsConnectorsSvg);

    newsPanelsContainer = document.createElement('div');
    newsPanelsContainer.className = 'news-panels-container';
    wrapper.appendChild(newsPanelsContainer);
}

function renderNewsPanels(stories, globe) {
    if (!newsPanelsContainer || !newsConnectorsSvg) return;

    newsPanelsContainer.innerHTML = '';
    newsConnectorsSvg.innerHTML = '';

    const wrapperRect = document.getElementById('globe-wrapper');
    if (!wrapperRect) return;
    const wW = wrapperRect.offsetWidth;
    const wH = wrapperRect.offsetHeight;
    const cx = wW / 2;
    const cy = wH / 2;

    stories.forEach((story, i) => {
        const coords = getCountryCoords(story.country);
        if (!coords) return;

        const pos = PANEL_POSITIONS[i % PANEL_POSITIONS.length];

        const panel = document.createElement('div');
        panel.className = 'news-panel';
        if (story.link) {
            panel.style.cursor = 'pointer';
            panel.addEventListener('click', () => window.open(story.link, '_blank'));
        }
        panel.innerHTML = `
            <div class="news-panel-headline">${story.title}</div>
            <div class="news-panel-meta">
                <span class="news-panel-source">${story.source}</span>
                <span>${timeAgo(story.pubDate)}</span>
            </div>
        `;

        Object.assign(panel.style, pos);
        newsPanelsContainer.appendChild(panel);

        setTimeout(() => panel.classList.add('visible'), 100 + i * 120);

        setTimeout(() => {
            const panelRect = panel.getBoundingClientRect();
            const wrapperBounds = wrapperRect.getBoundingClientRect();

            const px = panelRect.left + panelRect.width / 2 - wrapperBounds.left;
            const py = panelRect.top + panelRect.height / 2 - wrapperBounds.top;

            const angle = Math.atan2(py - cy, px - cx);
            const globeR = Math.min(wW, wH) * 0.38;
            const gx = cx + Math.cos(angle) * globeR;
            const gy = cy + Math.sin(angle) * globeR;

            const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
            line.setAttribute('x1', px.toFixed(1));
            line.setAttribute('y1', py.toFixed(1));
            line.setAttribute('x2', gx.toFixed(1));
            line.setAttribute('y2', gy.toFixed(1));
            line.classList.add('news-connector-line');
            newsConnectorsSvg.appendChild(line);
        }, 300 + i * 120);
    });
}

function hideNewsPanels() {
    if (newsPanelsContainer) {
        const panels = newsPanelsContainer.querySelectorAll('.news-panel');
        panels.forEach(p => {
            p.classList.remove('visible');
            p.classList.add('hiding');
        });
        setTimeout(() => {
            if (newsPanelsContainer) newsPanelsContainer.innerHTML = '';
            if (newsConnectorsSvg) newsConnectorsSvg.innerHTML = '';
        }, 250);
    }
}

function updateGlobeNewsLayer(globe, stories, userLocation) {
    if (!globe) return;

    const userLat = userLocation?.lat || CONFIG.defaultLocation.lat;
    const userLng = userLocation?.lon || userLocation?.lng || CONFIG.defaultLocation.lon;

    const points = stories.map(story => {
        const coords = getCountryCoords(story.country);
        if (!coords) return null;
        return { lat: coords.lat, lng: coords.lng, size: 0.6, color: '#ffb090' };
    }).filter(Boolean);

    const arcs = stories.map(story => {
        const coords = getCountryCoords(story.country);
        if (!coords) return null;
        return {
            startLat: userLat, startLng: userLng,
            endLat: coords.lat, endLng: coords.lng,
            color: ['rgba(255, 176, 144, 0.5)', 'rgba(255, 176, 144, 0.05)']
        };
    }).filter(Boolean);

    globe
        .pointsData(points)
        .pointLat('lat').pointLng('lng')
        .pointRadius('size').pointColor('color')
        .pointAltitude(0.01).pointsMerge(false)
        .arcsData(arcs)
        .arcStartLat('startLat').arcStartLng('startLng')
        .arcEndLat('endLat').arcEndLng('endLng')
        .arcColor('color').arcStroke(0.5)
        .arcDashLength(0.4).arcDashGap(0.2)
        .arcDashAnimateTime(2000).arcAltitudeAutoScale(0.4);
}

function clearGlobeNewsLayer(globe) {
    if (!globe) return;
    globe.pointsData([]).arcsData([]);
}

async function toggleNews(globe, userLocation) {
    newsActive = !newsActive;

    const chip = document.getElementById('chip-news');
    if (chip) chip.classList.toggle('active', newsActive);

    if (newsActive) {
        createPanelElements();
        newsData = await fetchNews();
        updateGlobeNewsLayer(globe, newsData, userLocation);
        renderNewsPanels(newsData, globe);

        newsRefreshTimer = setInterval(async () => {
            newsData = await fetchNews();
            updateGlobeNewsLayer(globe, newsData, userLocation);
            renderNewsPanels(newsData, globe);
        }, CONFIG.newsRefreshInterval);
    } else {
        clearTimeout(newsRefreshTimer);
        newsRefreshTimer = null;
        hideNewsPanels();
        clearGlobeNewsLayer(globe);
    }
}

function initNewsLayer(globe, getUserLocation) {
    const chip = document.getElementById('chip-news');
    if (!chip) return;

    chip.addEventListener('click', () => {
        const loc = getUserLocation();
        toggleNews(globe, loc);
    });
}
