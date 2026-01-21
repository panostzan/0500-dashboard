// ═══════════════════════════════════════════════════════════════════════════════
// MAIN - Application Initialization
// ═══════════════════════════════════════════════════════════════════════════════

// Initialize all components when DOM is ready
document.addEventListener('DOMContentLoaded', async () => {
    try {
        // Initialize lava lamp background
        const lavaLamp = new LavaLamp(document.getElementById('lava-canvas'));

        // Initialize clock
        initClock();

        // Initialize goals
        initGoals();

        // Initialize schedule
        initSchedule();

        // Initialize timer
        initTimer();

        // Initialize weather
        initWeather();

        // Initialize notes
        initNotes();

        // Initialize HUD elements (globe arcs)
        const hud = initHUD();

        // Initialize globes
        const mainGlobe = new DottedGlobe(document.getElementById('globe-canvas'), {
            size: 450,
            highlightLocation: CONFIG.location,
            rotationSpeed: 0.001,
            dotSpacing: 2.0,
            dotColor: '#2d2d2d',
            highlightColor: '#e67635',
            initialRotation: 1.4
        });

        const timerGlobe = new DottedGlobe(document.getElementById('timer-globe-canvas'), {
            size: 650,
            highlightLocation: CONFIG.location,
            rotationSpeed: 0.0006,
            dotSpacing: 2.5,
            dotColor: '#4a4a4a',
            highlightColor: '#e67635',
            initialRotation: 1.4
        });

        // Load land data for both globes
        await Promise.all([
            mainGlobe.loadLandData(),
            timerGlobe.loadLandData()
        ]);

        // Handle window resize
        window.addEventListener('resize', () => {
            mainGlobe.resize();
            timerGlobe.resize();
        });
    } catch (error) {
        console.error('Initialization error:', error);
        // Hide loading indicator even on error
        const loading = document.getElementById('globe-loading');
        if (loading) loading.style.display = 'none';
    }
});
