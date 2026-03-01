// ═══════════════════════════════════════════════════════════════════════════════
// NEWS LAYER — Globe-pinned HUD labels via globe.gl htmlElementsData
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

// ── Feed configuration ──
const NEWS_FEEDS = {
    WORLD:      { topic: 'WORLD',      label: 'WORLD',   color: '#ffb090' },
    TECHNOLOGY: { topic: 'TECHNOLOGY',  label: 'TECH',    color: '#90c8ff' },
    SCIENCE:    { topic: 'SCIENCE',     label: 'SCIENCE', color: '#a0ffb0' },
    BUSINESS:   { topic: 'BUSINESS',    label: 'BIZ',     color: '#ffd080' }
};

// Fallback locations for stories that don't mention a country in the headline
const CATEGORY_FALLBACK_LOCATIONS = {
    WORLD:      'washington',
    TECHNOLOGY: 'united states',
    SCIENCE:    'switzerland',
    BUSINESS:   'united states'
};

const STOP_WORDS = new Set([
    'the','a','an','and','or','but','in','on','at','to','for','of','with','by',
    'from','is','are','was','were','be','been','being','have','has','had','do',
    'does','did','will','would','shall','should','may','might','can','could',
    'not','no','nor','as','if','than','that','this','it','its','he','she','they',
    'we','you','i','my','your','his','her','our','their','what','which','who',
    'whom','how','when','where','why','all','each','every','both','few','more',
    'most','other','some','such','only','own','same','so','too','very','just',
    'about','after','before','between','into','through','during','above','below',
    'over','under','again','further','then','once','here','there','up','down',
    'out','off','new','says','said','also','first','last','long','get','back',
    'could','make','like','still','since','two','three','many','way','may','part'
]);

let newsActive = false;
let newsData = [];
let newsRefreshTimer = null;
let _newsGetUserLocation = null;

// ── Helpers ──

function detectCountry(title) {
    const lower = title.toLowerCase();
    const sorted = Object.keys(COUNTRY_CENTROIDS).sort((a, b) => b.length - a.length);
    for (const key of sorted) {
        const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp('\\b' + escaped + '\\b', 'i');
        if (regex.test(lower)) return key;
    }
    return null;
}

function extractSource(title) {
    const dash = title.lastIndexOf(' - ');
    if (dash > 0) return title.substring(dash + 3).trim();
    return '';
}

function extractHeadline(title) {
    const dash = title.lastIndexOf(' - ');
    if (dash > 0) return title.substring(0, dash).trim();
    return title;
}

function getCountryCoords(country) {
    if (!country) return null;
    return COUNTRY_CENTROIDS[country.toLowerCase().trim()] || null;
}

function timeAgo(dateStr) {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
}

// ── Smart deduplication ──

function getSignificantWords(headline) {
    return headline.toLowerCase()
        .replace(/[^a-z0-9\s]/g, '')
        .split(/\s+/)
        .filter(w => w.length > 2 && !STOP_WORDS.has(w));
}

function headlinesOverlap(wordsA, wordsB) {
    let shared = 0;
    const setB = new Set(wordsB);
    for (const w of wordsA) {
        if (setB.has(w)) shared++;
        if (shared >= 3) return true;
    }
    return false;
}

const COUNTRY_ALIASES = {};
(function buildAliases() {
    const byCoords = {};
    for (const [key, val] of Object.entries(COUNTRY_CENTROIDS)) {
        const ck = `${val.lat},${val.lng}`;
        if (!byCoords[ck]) byCoords[ck] = [];
        byCoords[ck].push(key);
    }
    for (const keys of Object.values(byCoords)) {
        const canonical = keys.sort((a, b) => b.length - a.length)[0];
        for (const k of keys) COUNTRY_ALIASES[k] = canonical;
    }
})();

function canonicalCountry(country) {
    if (!country) return null;
    return COUNTRY_ALIASES[country.toLowerCase().trim()] || country.toLowerCase().trim();
}

// ── Multi-feed fetcher ──

function buildFeedUrl(topic) {
    return 'https://api.rss2json.com/v1/api.json?rss_url=' +
        encodeURIComponent(`https://news.google.com/rss/headlines/section/topic/${topic}?hl=en-US&gl=US&ceid=US:en`);
}

async function fetchFeed(feedKey) {
    const feed = NEWS_FEEDS[feedKey];
    try {
        const resp = await fetch(buildFeedUrl(feed.topic));
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const data = await resp.json();
        if (data.status !== 'ok' || !data.items) return [];

        return data.items.map(item => {
            const headline = extractHeadline(item.title);
            const country = detectCountry(item.title);
            return {
                title: headline,
                source: extractSource(item.title) || 'Google News',
                country: country,
                category: feedKey,
                categoryLabel: feed.label,
                categoryColor: feed.color,
                link: item.link,
                pubDate: item.pubDate
            };
        });
    } catch (err) {
        console.warn(`[NEWS] ${feedKey} feed failed:`, err.message);
        return [];
    }
}

function assignFallbackLocation(story) {
    if (story.country && getCountryCoords(story.country)) return story;
    const fallback = CATEGORY_FALLBACK_LOCATIONS[story.category];
    return { ...story, country: fallback || 'united states' };
}

function canSelect(story, selected, usedCountries) {
    const cc = canonicalCountry(story.country);
    if (cc && usedCountries.has(cc)) return false;

    const words = getSignificantWords(story.title);
    return !selected.some(s => headlinesOverlap(words, getSignificantWords(s.title)));
}

function markSelected(story, selected, usedCountries) {
    selected.push(story);
    const cc = canonicalCountry(story.country);
    if (cc) usedCountries.add(cc);
}

async function fetchNews() {
    try {
        const results = await Promise.all(
            Object.keys(NEWS_FEEDS).map(key => fetchFeed(key))
        );

        const allStories = results.flat();
        if (!allStories.length) throw new Error('All feeds empty');

        // Assign fallback locations so no story is dropped for missing geo
        const located = allStories.map(assignFallbackLocation);

        // Sort each category by recency (newest first)
        const byCategory = {};
        for (const story of located) {
            if (!byCategory[story.category]) byCategory[story.category] = [];
            byCategory[story.category].push(story);
        }
        for (const cat of Object.keys(byCategory)) {
            byCategory[cat].sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate));
        }

        const selected = [];
        const usedCountries = new Set();

        // Pass 1: guarantee 1 story per category (most recent non-dupe)
        for (const cat of Object.keys(NEWS_FEEDS)) {
            const pool = byCategory[cat] || [];
            for (const story of pool) {
                if (canSelect(story, selected, usedCountries)) {
                    markSelected(story, selected, usedCountries);
                    break;
                }
            }
        }

        // Pass 2: fill remaining slots up to 8, max 2 per category
        const categoryCounts = {};
        for (const s of selected) {
            categoryCounts[s.category] = (categoryCounts[s.category] || 0) + 1;
        }

        for (const story of located.sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate))) {
            if (selected.length >= 5) break;
            if ((categoryCounts[story.category] || 0) >= 2) continue;
            if (selected.includes(story)) continue;
            if (!canSelect(story, selected, usedCountries)) continue;

            markSelected(story, selected, usedCountries);
            categoryCounts[story.category] = (categoryCounts[story.category] || 0) + 1;
        }

        if (selected.length >= 2) return selected;
        throw new Error('Not enough stories after selection');
    } catch (err) {
        console.warn('[NEWS] Fetch failed, using fallback:', err.message);
        return [{
            title: 'Unable to load live headlines',
            source: 'Offline',
            country: 'united states',
            category: 'WORLD',
            categoryLabel: 'WORLD',
            categoryColor: '#ffb090',
            pubDate: new Date().toISOString(),
            link: ''
        }];
    }
}

// ── Globe-pinned HTML labels via htmlElementsData ──

function createNewsLabelElement(story) {
    const el = document.createElement('div');
    el.className = 'news-label';
    if (story.link) {
        el.style.cursor = 'pointer';
        el.addEventListener('click', (e) => {
            e.stopPropagation();
            window.open(story.link, '_blank');
        });
    }
    el.innerHTML =
        `<div class="news-label-tag" style="background:${story.categoryColor}20;color:${story.categoryColor}">${story.categoryLabel}</div>` +
        `<div class="news-label-headline">${story.title}</div>` +
        `<div class="news-label-meta"><span class="news-label-source">${story.source}</span><span>${timeAgo(story.pubDate)}</span></div>`;
    return el;
}

// Push apart labels that are too close so they don't overlap
function decollideLabelCoords(items, minDist) {
    // Multiple passes to resolve chains of overlaps
    for (let pass = 0; pass < 5; pass++) {
        let moved = false;
        for (let i = 0; i < items.length; i++) {
            for (let j = i + 1; j < items.length; j++) {
                const dLat = items[j]._lat - items[i]._lat;
                const dLng = items[j]._lng - items[i]._lng;
                const dist = Math.sqrt(dLat * dLat + dLng * dLng);
                if (dist < minDist) {
                    const overlap = (minDist - dist) / 2 + 0.5;
                    const angle = dist > 0.01
                        ? Math.atan2(dLat, dLng)
                        : (Math.PI / 4) + (j * Math.PI / 3); // spread if exactly same spot
                    items[i]._lat -= Math.sin(angle) * overlap;
                    items[i]._lng -= Math.cos(angle) * overlap;
                    items[j]._lat += Math.sin(angle) * overlap;
                    items[j]._lng += Math.cos(angle) * overlap;
                    moved = true;
                }
            }
        }
        if (!moved) break;
    }
}

function renderNewsOnGlobe(globe, stories) {
    if (!globe) return;

    // Attach coords to each story for the accessors
    const labeled = stories.map(story => {
        const coords = getCountryCoords(story.country);
        if (!coords) return null;
        return { ...story, _lat: coords.lat, _lng: coords.lng };
    }).filter(Boolean);

    // Spread apart any labels that would overlap (~18° min separation)
    decollideLabelCoords(labeled, 18);

    // Pin HTML labels to globe coordinates
    globe
        .htmlElementsData(labeled)
        .htmlLat(d => d._lat)
        .htmlLng(d => d._lng)
        .htmlAltitude(0.1)
        .htmlElement(d => {
            // globe.gl caches elements per datum; create fresh each call
            return createNewsLabelElement(d);
        })
        .htmlTransitionDuration(0);
}

function updateGlobeNewsPoints(globe, stories) {
    if (!globe) return;

    const points = stories.map(story => {
        const coords = getCountryCoords(story.country);
        if (!coords) return null;
        return { lat: coords.lat, lng: coords.lng, size: 0.8, color: story.categoryColor || '#ffb090' };
    }).filter(Boolean);

    globe
        .pointsData(points)
        .pointLat('lat').pointLng('lng')
        .pointRadius('size').pointColor('color')
        .pointAltitude(0.01).pointsMerge(false);
}

function updateGlobeNewsArcs(globe, stories) {
    if (!globe || !_newsGetUserLocation) return;

    const userLoc = _newsGetUserLocation();
    if (!userLoc) return;
    const userLng = userLoc.lon || userLoc.lng;

    const arcs = stories.map(story => {
        const coords = getCountryCoords(story.country);
        if (!coords) return null;
        return {
            startLat: userLoc.lat,
            startLng: userLng,
            endLat: coords.lat,
            endLng: coords.lng,
            color: story.categoryColor || '#ffb090'
        };
    }).filter(Boolean);

    globe
        .arcsData(arcs)
        .arcStartLat('startLat').arcStartLng('startLng')
        .arcEndLat('endLat').arcEndLng('endLng')
        .arcColor(d => [`${d.color}60`, `${d.color}30`])
        .arcStroke(0.4)
        .arcDashLength(0.4)
        .arcDashGap(0.8)
        .arcDashAnimateTime(4000)
        .arcAltitudeAutoScale(0.3)
        .arcsTransitionDuration(0);
}

function clearNewsFromGlobe(globe) {
    if (!globe) return;
    globe.htmlElementsData([]);
    globe.pointsData([]);
    globe.arcsData([]);
}

// ── Toggle + init ──

async function toggleNews(globe) {
    newsActive = !newsActive;

    const chip = document.getElementById('chip-news');
    if (chip) chip.classList.toggle('active', newsActive);

    if (newsActive) {
        newsData = await fetchNews();
        renderNewsOnGlobe(globe, newsData);
        updateGlobeNewsPoints(globe, newsData);
        updateGlobeNewsArcs(globe, newsData);

        newsRefreshTimer = setInterval(async () => {
            newsData = await fetchNews();
            renderNewsOnGlobe(globe, newsData);
            updateGlobeNewsPoints(globe, newsData);
            updateGlobeNewsArcs(globe, newsData);
        }, CONFIG.newsRefreshInterval);
    } else {
        clearTimeout(newsRefreshTimer);
        newsRefreshTimer = null;
        clearNewsFromGlobe(globe);
    }
}

function initNewsLayer(globe, getUserLocation) {
    _newsGetUserLocation = getUserLocation || null;

    const chip = document.getElementById('chip-news');
    if (!chip) return;

    chip.addEventListener('click', () => toggleNews(globe));
}
