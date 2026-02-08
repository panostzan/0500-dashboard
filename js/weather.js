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

            const location = {
                lat: position.coords.latitude,
                lon: position.coords.longitude,
                name: 'Current Location',
                timestamp: Date.now()
            };

            // Save to localStorage
            localStorage.setItem(LOCATION_STORAGE_KEY, JSON.stringify(location));
            return location;
        } catch (err) {
            console.log('Geolocation unavailable, using default');
        }
    }

    // Fallback: use stale cached location if available, else default
    if (saved) return JSON.parse(saved);
    return CONFIG.defaultLocation;
}

// Expose location globally for globe.js
window.userLocation = null;

const WEATHER_CODES = {
    0: { label: 'CLEAR', icon: '○' },
    1: { label: 'MOSTLY CLEAR', icon: '○' },
    2: { label: 'PARTLY CLOUDY', icon: '◐' },
    3: { label: 'OVERCAST', icon: '●' },
    45: { label: 'FOG', icon: '≡' },
    48: { label: 'FOG', icon: '≡' },
    51: { label: 'DRIZZLE', icon: '.' },
    53: { label: 'DRIZZLE', icon: '..' },
    55: { label: 'DRIZZLE', icon: '...' },
    61: { label: 'RAIN', icon: '∴' },
    63: { label: 'RAIN', icon: '∴∴' },
    65: { label: 'HEAVY RAIN', icon: '∴∴∴' },
    71: { label: 'SNOW', icon: '✦' },
    73: { label: 'SNOW', icon: '✦✦' },
    75: { label: 'HEAVY SNOW', icon: '✦✦✦' },
    77: { label: 'SNOW GRAINS', icon: '✦' },
    80: { label: 'SHOWERS', icon: '∴' },
    81: { label: 'SHOWERS', icon: '∴∴' },
    82: { label: 'HEAVY SHOWERS', icon: '∴∴∴' },
    85: { label: 'SNOW SHOWERS', icon: '✦' },
    86: { label: 'SNOW SHOWERS', icon: '✦✦' },
    95: { label: 'STORM', icon: '⚡' },
    96: { label: 'HAIL STORM', icon: '⚡' },
    99: { label: 'HAIL STORM', icon: '⚡' }
};

async function fetchWeather() {
    const location = await getUserLocation();
    window.userLocation = location; // Share with globe.js
    const { lat, lon } = location;

    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code&daily=sunrise,sunset&timezone=auto`;

    // Show syncing status
    updateWeatherStatus('syncing');

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
        updateWeatherStatus('offline');
        return;
    }

    // Create structure with placeholder for animation
    container.innerHTML = `
        <div class="weather-temp" id="weather-temp-value">--°</div>
        <div class="weather-condition">${data.weather.icon} ${data.weather.label}</div>
        <div class="weather-sun">
            <span class="sun-item"><span class="sun-label">RISE</span> ${data.sunrise}</span>
            <span class="sun-item"><span class="sun-label">SET</span> ${data.sunset}</span>
        </div>
    `;

    // Animate temperature if animation function is available
    const tempElement = document.getElementById('weather-temp-value');
    if (tempElement && typeof animateTemperature === 'function') {
        animateTemperature(tempElement, data.temp, 1000);
    } else if (tempElement) {
        tempElement.textContent = `${data.temp}°`;
    }

    // Update status indicator
    updateWeatherStatus('active');
}

// Weather status indicator helper
function updateWeatherStatus(status) {
    const indicator = document.getElementById('weather-status-indicator');
    if (indicator) {
        indicator.classList.remove('status-active', 'status-syncing', 'status-offline');
        indicator.classList.add(`status-${status}`);
    }
}

function initWeather() {
    fetchWeather();
    // Refresh every 15 minutes
    setInterval(fetchWeather, 15 * 60 * 1000);
}
