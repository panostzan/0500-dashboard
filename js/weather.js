// ═══════════════════════════════════════════════════════════════════════════════
// WEATHER — Open-Meteo API (no key required)
// ═══════════════════════════════════════════════════════════════════════════════

const LOCATION_STORAGE_KEY = '0500_user_location';

// Get user location: localStorage > geolocation > default
async function getUserLocation() {
    // Check localStorage first (with 24-hour expiry)
    const saved = localStorage.getItem(LOCATION_STORAGE_KEY);
    if (saved) {
        const parsed = JSON.parse(saved);
        const age = Date.now() - (parsed.timestamp || 0);
        if (age < 24 * 60 * 60 * 1000) {
            return parsed;
        }
    }

    // Try browser geolocation
    if ('geolocation' in navigator) {
        try {
            const position = await new Promise((resolve, reject) => {
                navigator.geolocation.getCurrentPosition(resolve, reject, {
                    timeout: 10000,
                    maximumAge: 3600000 // 1 hour cache
                });
            });

            // Reverse geocode to get city name
            let cityName = 'Current Location';
            try {
                const geoRes = await fetch(
                    `https://nominatim.openstreetmap.org/reverse?lat=${position.coords.latitude}&lon=${position.coords.longitude}&format=json&zoom=10`
                );
                const geoData = await geoRes.json();
                const addr = geoData.address || {};
                const city = addr.city || addr.town || addr.village || addr.hamlet || '';
                const state = addr.state || '';
                if (city && state) cityName = city + ', ' + state;
                else if (city) cityName = city;
            } catch (e) {
                console.warn('[WEATHER] Reverse geocode failed:', e.message);
            }

            const location = {
                lat: position.coords.latitude,
                lon: position.coords.longitude,
                name: cityName,
                timestamp: Date.now()
            };

            // Save to localStorage
            localStorage.setItem(LOCATION_STORAGE_KEY, JSON.stringify(location));
            return location;
        } catch (err) {
            console.warn('Geolocation unavailable, using default');
        }
    }

    // Fallback: use stale cached location if available, else default
    if (saved) return JSON.parse(saved);
    return CONFIG.defaultLocation;
}

// Expose location globally for globe.js
window.userLocation = null;

const WEATHER_CODES = {
    0: { label: 'CLEAR', icon: 'sun' },
    1: { label: 'MOSTLY CLEAR', icon: 'sun' },
    2: { label: 'PARTLY CLOUDY', icon: 'cloud-sun' },
    3: { label: 'OVERCAST', icon: 'cloud' },
    45: { label: 'FOG', icon: 'fog' },
    48: { label: 'FOG', icon: 'fog' },
    51: { label: 'DRIZZLE', icon: 'drizzle' },
    53: { label: 'DRIZZLE', icon: 'drizzle' },
    55: { label: 'DRIZZLE', icon: 'drizzle' },
    61: { label: 'RAIN', icon: 'rain' },
    63: { label: 'RAIN', icon: 'rain' },
    65: { label: 'HEAVY RAIN', icon: 'rain' },
    71: { label: 'SNOW', icon: 'snow' },
    73: { label: 'SNOW', icon: 'snow' },
    75: { label: 'HEAVY SNOW', icon: 'snow' },
    77: { label: 'SNOW GRAINS', icon: 'snow' },
    80: { label: 'SHOWERS', icon: 'rain' },
    81: { label: 'SHOWERS', icon: 'rain' },
    82: { label: 'HEAVY SHOWERS', icon: 'rain' },
    85: { label: 'SNOW SHOWERS', icon: 'snow' },
    86: { label: 'SNOW SHOWERS', icon: 'snow' },
    95: { label: 'STORM', icon: 'storm' },
    96: { label: 'HAIL STORM', icon: 'storm' },
    99: { label: 'HAIL STORM', icon: 'storm' }
};

const WEATHER_SVGS = {
    sun: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32l1.41 1.41M2 12h2m16 0h2M4.93 19.07l1.41-1.41m11.32-11.32l1.41-1.41"/></svg>',
    'cloud-sun': '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M12 2v2m-6.36.64l1.42 1.42M2 12h2"/><circle cx="12" cy="8" r="3"/><path d="M8 16a4 4 0 1 1 7.3-2.3A3 3 0 1 1 18 17H8z"/></svg>',
    cloud: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M8 18a4 4 0 1 1 7.3-2.3A3 3 0 1 1 18 19H8z"/></svg>',
    fog: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M4 12h16M4 16h12M6 8h14"/></svg>',
    drizzle: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M8 14a4 4 0 1 1 7.3-2.3A3 3 0 1 1 18 15H8z"/><path d="M10 18v1m4-2v1"/></svg>',
    rain: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M8 14a4 4 0 1 1 7.3-2.3A3 3 0 1 1 18 15H8z"/><path d="M8 19v2m4-3v2m4-3v2"/></svg>',
    snow: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M8 14a4 4 0 1 1 7.3-2.3A3 3 0 1 1 18 15H8z"/><path d="M9 19l.5 1m5-.5l.5 1m-3.5-2v1.5"/></svg>',
    storm: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M8 12a4 4 0 1 1 7.3-2.3A3 3 0 1 1 18 13H8z"/><path d="M13 15l-2 4h4l-2 4"/></svg>'
};

async function fetchWeather() {
    const location = await getUserLocation();
    window.userLocation = location; // Share with globe.js
    const { lat, lon } = location;

    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code&daily=sunrise,sunset&timezone=auto`;

    try {
        const response = await fetch(url);
        const data = await response.json();

        const temp = Math.round(data.current.temperature_2m);
        const code = data.current.weather_code;
        const weather = WEATHER_CODES[code] || { label: 'UNKNOWN', icon: '?' };

        const sunrise = new Date(data.daily.sunrise[0]).toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
            hour12: false
        });
        const sunset = new Date(data.daily.sunset[0]).toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
            hour12: false
        });

        renderWeather({ temp, weather, sunrise, sunset });
    } catch (err) {
        console.error('Weather fetch failed:', err);
        renderWeather(null);
    }
}

function renderWeather(data) {
    const container = document.getElementById('weather-display');
    if (!container) return;

    if (!data) {
        container.innerHTML = `<span class="weather-error">--</span>`;
        return;
    }

    const iconKey = data.weather.icon || 'sun';
    const svg = WEATHER_SVGS[iconKey] || WEATHER_SVGS.sun;

    container.innerHTML = `
        <div class="weather-icon weather-icon-${iconKey}">${svg}</div>
        <div class="weather-data">
            <div class="weather-temp" id="weather-temp-value">--°</div>
            <div class="weather-condition">${data.weather.label}</div>
            <div class="weather-sun">
                <span class="sun-item"><span class="sun-label">SUNRISE</span>${data.sunrise}</span>
                <span class="sun-item"><span class="sun-label">SUNSET</span>${data.sunset}</span>
            </div>
        </div>
    `;

    // Animate temperature if animation function is available
    const tempElement = document.getElementById('weather-temp-value');
    if (tempElement && typeof animateTemperature === 'function') {
        animateTemperature(tempElement, data.temp, 1000);
    } else if (tempElement) {
        tempElement.textContent = `${data.temp}°`;
    }
}


let _weatherInterval = null;

function initWeather() {
    fetchWeather();

    // Refresh every 15 minutes
    _weatherInterval = setInterval(fetchWeather, 15 * 60 * 1000);

    // Pause/resume on tab visibility to save network when hidden
    document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
            if (_weatherInterval) {
                clearInterval(_weatherInterval);
                _weatherInterval = null;
            }
        } else {
            // Fetch immediately on return, then restart interval
            fetchWeather();
            _weatherInterval = setInterval(fetchWeather, 15 * 60 * 1000);
        }
    });
}
