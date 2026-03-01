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

    // World Clock cities (one per major timezone)
    worldClockCities: [
        { name: 'VANCOUVER',    lat: 49.3,  lng: -123.1, timezone: 'America/Vancouver' },     // UTC-8
        { name: 'TORONTO',     lat: 43.7,  lng: -79.4,  timezone: 'America/Toronto' },       // UTC-5
        { name: 'SÃO PAULO',   lat: -23.5, lng: -46.6,  timezone: 'America/Sao_Paulo' },     // UTC-3
        { name: 'LONDON',      lat: 51.5,  lng: -0.1,   timezone: 'Europe/London' },          // UTC+0
        { name: 'ROME',        lat: 41.9,  lng: 12.5,   timezone: 'Europe/Rome' },            // UTC+1
        { name: 'CAPE TOWN',   lat: -33.9, lng: 18.4,   timezone: 'Africa/Johannesburg' },    // UTC+2
        { name: 'SINGAPORE',   lat: 1.3,   lng: 103.8,  timezone: 'Asia/Singapore' },         // UTC+8
        { name: 'TOKYO',       lat: 35.7,  lng: 139.7,  timezone: 'Asia/Tokyo' },             // UTC+9
        { name: 'SYDNEY',      lat: -33.9, lng: 151.2,  timezone: 'Australia/Sydney' }        // UTC+11
    ]
};

// ═══════════════════════════════════════════════════════════════════════════════
// END CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════════
