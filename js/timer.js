// ═══════════════════════════════════════════════════════════════════════════════
// TIMER
// ═══════════════════════════════════════════════════════════════════════════════

let timerInterval = null;
let timerRemaining = 0;
let timerPaused = false;
let timerEndTime = null;   // wall-clock ms when timer should finish
let timerPausedAt = null;  // wall-clock ms when pause was pressed

function renderTimerPresets() {
    const container = document.getElementById('timer-bar');

    container.innerHTML = CONFIG.timerPresets.map(minutes => `
        <button class="timer-preset" data-minutes="${minutes}">${minutes}</button>
    `).join('');

    container.querySelectorAll('.timer-preset').forEach(btn => {
        btn.addEventListener('click', () => {
            startTimer(parseInt(btn.dataset.minutes));
        });
    });
}

function startTimer(minutes) {
    timerRemaining = minutes * 60;
    timerPaused = false;
    timerEndTime = Date.now() + timerRemaining * 1000;
    timerPausedAt = null;

    document.getElementById('dashboard').classList.add('hidden');
    document.getElementById('timer-overlay').classList.add('active');
    document.getElementById('timer-pause').textContent = 'PAUSE';

    // Animate timer display on start
    const timerDisplay = document.getElementById('timer-display');
    if (timerDisplay && typeof animateTimerStart === 'function') {
        animateTimerStart(timerDisplay, minutes, 800, () => {
            // Start the actual countdown after animation completes
            startTimerCountdown();
        });
    } else {
        updateTimerDisplay();
        startTimerCountdown();
    }
}

function startTimerCountdown() {
    timerInterval = setInterval(() => {
        if (!timerPaused) {
            timerRemaining = Math.max(0, Math.round((timerEndTime - Date.now()) / 1000));
            updateTimerDisplay();

            if (timerRemaining <= 0) {
                endTimer();
            }
        }
    }, 1000);
}

function updateTimerDisplay() {
    const minutes = Math.floor(timerRemaining / 60);
    const seconds = timerRemaining % 60;
    const timeStr = `${minutes}:${seconds.toString().padStart(2, '0')}`;
    document.getElementById('timer-display').textContent = timeStr;
    document.title = `${timeStr} — Focus`;
}

function endTimer() {
    clearInterval(timerInterval);
    timerInterval = null;

    document.title = '0500';
    document.getElementById('dashboard').classList.remove('hidden');
    document.getElementById('timer-overlay').classList.remove('active');
}

function initTimer() {
    renderTimerPresets();

    document.getElementById('timer-pause').addEventListener('click', () => {
        timerPaused = !timerPaused;
        if (timerPaused) {
            timerPausedAt = Date.now();
        } else {
            // Shift end time forward by however long we were paused
            timerEndTime += Date.now() - timerPausedAt;
            timerPausedAt = null;
        }
        document.getElementById('timer-pause').textContent = timerPaused ? 'RESUME' : 'PAUSE';
    });

    document.getElementById('timer-stop').addEventListener('click', endTimer);
}
