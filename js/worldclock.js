// ═══════════════════════════════════════════════════════════════════════════════
// WORLD CLOCK LAYER — Globe-pinned city time labels via shared htmlElementsData
// ═══════════════════════════════════════════════════════════════════════════════

var clockActive = false;
var clockGlobeRef = null;
var clockUpdateTimer = null;

function getCityTime(timezone) {
    try {
        return new Intl.DateTimeFormat('en-US', {
            timeZone: timezone, hour: 'numeric', minute: '2-digit', hour12: true
        }).format(new Date());
    } catch (e) { return '--:--'; }
}

function getCityHour(timezone) {
    try {
        return parseInt(new Intl.DateTimeFormat('en-US', {
            timeZone: timezone, hour: 'numeric', hour12: false
        }).format(new Date()), 10);
    } catch (e) { return 12; }
}

function isDaytime(timezone) {
    var hour = getCityHour(timezone);
    return hour >= 6 && hour < 20;
}

function getUtcOffset(timezone) {
    try {
        var now = new Date();
        var utcH = parseInt(new Intl.DateTimeFormat('en-US', {
            timeZone: 'UTC', hour: 'numeric', hour12: false
        }).format(now), 10);
        var localH = parseInt(new Intl.DateTimeFormat('en-US', {
            timeZone: timezone, hour: 'numeric', hour12: false
        }).format(now), 10);
        var diff = localH - utcH;
        if (diff > 12) diff -= 24;
        if (diff < -12) diff += 24;
        return (diff >= 0 ? '+' : '') + diff;
    } catch (e) { return ''; }
}

function createClockLabelElement(item) {
    var city = item._city;
    var daytime = isDaytime(city.timezone);
    var time = getCityTime(city.timezone);
    var offset = 'UTC' + getUtcOffset(city.timezone);

    var el = document.createElement('div');
    el.className = 'clock-label' + (daytime ? '' : ' clock-label-night');
    el.innerHTML =
        '<div class="clock-label-city">' + city.name + '</div>' +
        '<div class="clock-label-time">' + time + '</div>' +
        '<div class="clock-label-offset">' + offset + '</div>';
    return el;
}

function buildClockHtmlItems() {
    var cities = CONFIG.worldClockCities || [];
    return cities.map(function(city) {
        return {
            _lat: city.lat,
            _lng: city.lng,
            _alt: 0.12,
            _city: city,
            _createEl: createClockLabelElement
        };
    });
}

function renderClocksOnGlobe(globe) {
    if (!globe) return;
    window._globeHtmlGlobe = globe;

    // Dot markers at each city via labelsData
    var cities = CONFIG.worldClockCities || [];
    var labelData = cities.map(function(city) {
        return {
            lat: city.lat, lng: city.lng, text: '',
            color: isDaytime(city.timezone) ? '#ffb090' : '#4a8fa8',
            size: 1.2
        };
    });
    globe
        .labelsData(labelData)
        .labelLat('lat').labelLng('lng')
        .labelText('text').labelColor('color')
        .labelSize('size').labelDotRadius(0.6)
        .labelAltitude(0.015).labelResolution(6);

    // HTML labels via shared registry
    window._globeHtmlRegistry.clock = buildClockHtmlItems();
    _syncGlobeHtmlLayer();
}

function updateClocksOnGlobe(globe) {
    if (!globe) return;
    // Rebuild HTML items with fresh times
    window._globeHtmlRegistry.clock = buildClockHtmlItems();
    _syncGlobeHtmlLayer();

    // Update dot colors
    var cities = CONFIG.worldClockCities || [];
    var labelData = cities.map(function(city) {
        return {
            lat: city.lat, lng: city.lng, text: '',
            color: isDaytime(city.timezone) ? '#ffb090' : '#4a8fa8',
            size: 1.2
        };
    });
    globe
        .labelsData(labelData)
        .labelLat('lat').labelLng('lng')
        .labelText('text').labelColor('color')
        .labelSize('size').labelDotRadius(0.6)
        .labelAltitude(0.015).labelResolution(6);
}

function clearClocksFromGlobe(globe) {
    if (!globe) return;
    globe.labelsData([]);
    window._globeHtmlRegistry.clock = [];
    _syncGlobeHtmlLayer();
}

function toggleClock(globe, userLocation) {
    clockActive = !clockActive;
    clockGlobeRef = globe;

    var chip = document.getElementById('chip-clock');
    if (chip) chip.classList.toggle('active', clockActive);

    if (clockActive) {
        renderClocksOnGlobe(globe);

        clockUpdateTimer = setInterval(function() {
            updateClocksOnGlobe(globe);
        }, 60000);
    } else {
        clearInterval(clockUpdateTimer);
        clockUpdateTimer = null;
        clearClocksFromGlobe(globe);
    }
}

function initClockLayer(globe, getUserLocation) {
    var chip = document.getElementById('chip-clock');
    if (!chip) return;

    chip.addEventListener('click', function() {
        var loc = getUserLocation();
        toggleClock(globe, loc);
    });
}
