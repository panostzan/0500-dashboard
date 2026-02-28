// ═══════════════════════════════════════════════════════════════════════════════
// WORLD CLOCK LAYER — Globe-integrated time zones with floating glass panels
// ═══════════════════════════════════════════════════════════════════════════════

var clockActive = false;
var clockGlobeRef = null;
var clockUpdateTimer = null;
var clockConnectorTimer = null;
var clockPanelsContainer = null;
var clockConnectorsSvg = null;

var CLOCK_PANEL_POSITIONS = [
    { top: '0%', left: '5%' },
    { top: '0%', right: '5%' },
    { bottom: '5%', right: '5%' },
    { bottom: '5%', left: '5%' }
];

// ── Project lat/lng to screen XY using Three.js camera ──
function cityToScreen(globe, lat, lng) {
    try {
        var camera = globe.camera();
        var renderer = globe.renderer();
        var R = 100; // globe.gl internal radius

        // lat/lng to 3D position on globe surface
        var phi = (90 - lat) * Math.PI / 180;
        var theta = (lng + 180) * Math.PI / 180;
        var vec = new THREE.Vector3(
            R * Math.sin(phi) * Math.cos(theta),
            R * Math.cos(phi),
            -R * Math.sin(phi) * Math.sin(theta)
        );

        // Project to normalized device coords
        vec.project(camera);

        // Convert NDC to pixel coords within the canvas
        var w = renderer.domElement.clientWidth;
        var h = renderer.domElement.clientHeight;
        return {
            x: (vec.x * 0.5 + 0.5) * w,
            y: (-vec.y * 0.5 + 0.5) * h,
            visible: vec.z < 1 // behind camera check
        };
    } catch (e) {
        return null;
    }
}

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

function getCityDay(timezone) {
    try {
        return new Intl.DateTimeFormat('en-US', {
            timeZone: timezone, weekday: 'short'
        }).format(new Date()).toUpperCase();
    } catch (e) { return ''; }
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

function createClockPanelElements() {
    var wrapper = document.getElementById('globe-wrapper');
    if (!wrapper) return;

    if (clockPanelsContainer) clockPanelsContainer.remove();
    if (clockConnectorsSvg) clockConnectorsSvg.remove();

    clockConnectorsSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    clockConnectorsSvg.classList.add('news-connectors');
    clockConnectorsSvg.setAttribute('viewBox', '0 0 550 550');
    wrapper.appendChild(clockConnectorsSvg);

    clockPanelsContainer = document.createElement('div');
    clockPanelsContainer.className = 'news-panels-container';
    wrapper.appendChild(clockPanelsContainer);
}

// ── Update connector lines to track actual city positions ──
function updateClockConnectors() {
    if (!clockConnectorsSvg || !clockPanelsContainer || !clockGlobeRef) return;
    clockConnectorsSvg.innerHTML = '';

    var cities = CONFIG.worldClockCities || [];
    var wrapperEl = document.getElementById('globe-wrapper');
    if (!wrapperEl) return;
    var wrapperBounds = wrapperEl.getBoundingClientRect();

    clockPanelsContainer.querySelectorAll('.clock-panel').forEach(function(panel) {
        var idx = parseInt(panel.dataset.cityIndex, 10);
        var city = cities[idx];
        if (!city) return;

        var screen = cityToScreen(clockGlobeRef, city.lat, city.lng);
        if (!screen || !screen.visible) return;

        // Check if city dot is on the front hemisphere (not occluded)
        var globeCx = wrapperBounds.width / 2;
        var globeCy = wrapperBounds.height / 2;
        var dist = Math.sqrt(Math.pow(screen.x - globeCx, 2) + Math.pow(screen.y - globeCy, 2));
        var maxR = wrapperBounds.width * 0.4;
        if (dist > maxR) return;

        var panelRect = panel.getBoundingClientRect();
        var px = panelRect.left + panelRect.width / 2 - wrapperBounds.left;
        var py = panelRect.top + panelRect.height / 2 - wrapperBounds.top;

        var line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        line.setAttribute('x1', px.toFixed(1));
        line.setAttribute('y1', py.toFixed(1));
        line.setAttribute('x2', screen.x.toFixed(1));
        line.setAttribute('y2', screen.y.toFixed(1));
        line.classList.add('news-connector-line');
        clockConnectorsSvg.appendChild(line);
    });
}

function renderClockPanels() {
    if (!clockPanelsContainer) return;
    clockPanelsContainer.innerHTML = '';

    var cities = CONFIG.worldClockCities || [];

    cities.forEach(function(city, i) {
        var pos = CLOCK_PANEL_POSITIONS[i % CLOCK_PANEL_POSITIONS.length];
        var daytime = isDaytime(city.timezone);
        var time = getCityTime(city.timezone);
        var day = getCityDay(city.timezone);
        var offset = getUtcOffset(city.timezone);

        var panel = document.createElement('div');
        panel.className = 'news-panel clock-panel';
        panel.dataset.cityIndex = i;
        if (!daytime) panel.classList.add('clock-night');

        panel.innerHTML =
            '<div class="clock-panel-header">' +
                '<span class="clock-panel-city">' + city.name + '</span>' +
                '<span class="clock-panel-indicator">' + (daytime ? '\u2600' : '\u263E') + '</span>' +
            '</div>' +
            '<div class="clock-panel-time">' + time + '</div>' +
            '<div class="clock-panel-sub">' +
                '<span>' + day + '</span>' +
                '<span>UTC' + offset + '</span>' +
            '</div>';

        Object.assign(panel.style, pos);
        clockPanelsContainer.appendChild(panel);

        setTimeout(function() { panel.classList.add('visible'); }, 100 + i * 150);
    });

    // Start tracking connectors to real city positions as globe rotates
    setTimeout(updateClockConnectors, 500);
    if (clockConnectorTimer) clearInterval(clockConnectorTimer);
    clockConnectorTimer = setInterval(updateClockConnectors, 200);
}

function updateClockTimes() {
    if (!clockPanelsContainer) return;
    var cities = CONFIG.worldClockCities || [];

    clockPanelsContainer.querySelectorAll('.clock-panel').forEach(function(panel) {
        var idx = parseInt(panel.dataset.cityIndex, 10);
        var city = cities[idx];
        if (!city) return;

        var daytime = isDaytime(city.timezone);
        var timeEl = panel.querySelector('.clock-panel-time');
        if (timeEl) timeEl.textContent = getCityTime(city.timezone);

        var dayEl = panel.querySelector('.clock-panel-sub span:first-child');
        if (dayEl) dayEl.textContent = getCityDay(city.timezone);

        var indEl = panel.querySelector('.clock-panel-indicator');
        if (indEl) indEl.textContent = daytime ? '\u2600' : '\u263E';

        panel.classList.toggle('clock-night', !daytime);
    });
}

function hideClockPanels() {
    if (clockConnectorTimer) {
        clearInterval(clockConnectorTimer);
        clockConnectorTimer = null;
    }
    if (clockPanelsContainer) {
        clockPanelsContainer.querySelectorAll('.clock-panel').forEach(function(p) {
            p.classList.remove('visible');
            p.classList.add('hiding');
        });
        setTimeout(function() {
            if (clockPanelsContainer) clockPanelsContainer.innerHTML = '';
            if (clockConnectorsSvg) clockConnectorsSvg.innerHTML = '';
        }, 250);
    }
}

function updateGlobeClockLayer(globe) {
    if (!globe) return;
    var cities = CONFIG.worldClockCities || [];

    var labels = cities.map(function(city) {
        return {
            lat: city.lat, lng: city.lng, text: '',
            color: isDaytime(city.timezone) ? '#ffb090' : '#4a8fa8',
            size: 1.0
        };
    });

    globe
        .labelsData(labels)
        .labelLat('lat').labelLng('lng')
        .labelText('text').labelColor('color')
        .labelSize('size').labelDotRadius(0.5)
        .labelAltitude(0.015).labelResolution(6);
}

function clearGlobeClockLayer(globe) {
    if (!globe) return;
    globe.labelsData([]);
}

function toggleClock(globe, userLocation) {
    clockActive = !clockActive;
    clockGlobeRef = globe;

    var chip = document.getElementById('chip-clock');
    if (chip) chip.classList.toggle('active', clockActive);

    if (clockActive) {
        createClockPanelElements();
        updateGlobeClockLayer(globe);
        renderClockPanels();

        clockUpdateTimer = setInterval(function() {
            updateClockTimes();
            updateGlobeClockLayer(globe);
        }, 60000);
    } else {
        clearInterval(clockUpdateTimer);
        clockUpdateTimer = null;
        hideClockPanels();
        clearGlobeClockLayer(globe);
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
