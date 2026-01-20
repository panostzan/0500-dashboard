// ═══════════════════════════════════════════════════════════════════════════════
// TIMER
// ═══════════════════════════════════════════════════════════════════════════════

let timerInterval = null;
let timerRemaining = 0;
let timerPaused = false;

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
    updateTimerDisplay();

    document.getElementById('dashboard').classList.add('hidden');
    document.getElementById('timer-overlay').classList.add('active');
    document.getElementById('timer-pause').textContent = 'PAUSE';

    timerInterval = setInterval(() => {
        if (!timerPaused) {
            timerRemaining--;
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
    document.getElementById('timer-display').textContent =
        `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

function endTimer() {
    clearInterval(timerInterval);
    timerInterval = null;

    document.getElementById('dashboard').classList.remove('hidden');
    document.getElementById('timer-overlay').classList.remove('active');
}

function initTimer() {
    renderTimerPresets();

    document.getElementById('timer-pause').addEventListener('click', () => {
        timerPaused = !timerPaused;
        document.getElementById('timer-pause').textContent = timerPaused ? 'RESUME' : 'PAUSE';
    });

    document.getElementById('timer-stop').addEventListener('click', endTimer);
}
