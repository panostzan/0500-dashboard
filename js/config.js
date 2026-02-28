// ═══════════════════════════════════════════════════════════════════════════════
// CONFIGURATION — Edit this section to customize your dashboard
// ═══════════════════════════════════════════════════════════════════════════════

const CONFIG = {
    // Default location (used as fallback if geolocation unavailable)
    // Users' actual location is detected automatically via browser geolocation
    defaultLocation: {
        lat: 40.7128,
        lon: -74.006,
        name: "New York, NY"
    },

    // Timer presets in minutes
    timerPresets: [5, 10, 15, 25],

    // News refresh interval in ms (10 minutes)
    newsRefreshInterval: 10 * 60 * 1000,

    // World Clock cities
    worldClockCities: [
        { name: 'TOKYO', lat: 35.7, lng: 139.7, timezone: 'Asia/Tokyo' },
        { name: 'LONDON', lat: 51.5, lng: -0.1, timezone: 'Europe/London' },
        { name: 'DUBAI', lat: 25.2, lng: 55.3, timezone: 'Asia/Dubai' },
        { name: 'SÃO PAULO', lat: -23.5, lng: -46.6, timezone: 'America/Sao_Paulo' }
    ]
};

// ═══════════════════════════════════════════════════════════════════════════════
// END CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════════
