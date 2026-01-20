// ═══════════════════════════════════════════════════════════════════════════════
// MAIN - Application Initialization
// ═══════════════════════════════════════════════════════════════════════════════

// Initialize all components when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
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

    // Initialize HUD elements (clock arc, globe arcs)
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
    Promise.all([
        mainGlobe.loadLandData(),
        timerGlobe.loadLandData()
    ]);

    // Handle window resize
    window.addEventListener('resize', () => {
        mainGlobe.resize();
        timerGlobe.resize();
    });
});
