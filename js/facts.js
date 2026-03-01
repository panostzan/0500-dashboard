// ═══════════════════════════════════════════════════════════════════════════════
// DAILY FACT — chip + floating card
// ═══════════════════════════════════════════════════════════════════════════════

let factsData = null;
let currentFactIndex = -1;

function showFact(index) {
    const fact = factsData[index];
    currentFactIndex = index;
    document.getElementById('daily-fact-title').textContent = fact.title;
    document.getElementById('daily-fact-text').textContent = fact.text;
}

async function initDailyFact() {
    const chip = document.getElementById('chip-fact');
    const card = document.getElementById('fact-card');
    if (!chip || !card) return;

    try {
        const res = await fetch('js/facts.json');
        factsData = await res.json();
    } catch (e) {
        console.warn('[FACTS] Failed to load facts:', e.message);
        return;
    }

    if (!factsData || !factsData.length) return;

    // Deterministic pick: day-of-year mod total facts
    const now = new Date();
    const startOfYear = new Date(now.getFullYear(), 0, 0);
    const dayOfYear = Math.floor((now - startOfYear) / 86400000);
    showFact(dayOfYear % factsData.length);

    chip.classList.add('visible');

    chip.addEventListener('click', () => {
        const isOpen = card.classList.toggle('open');
        chip.classList.toggle('active', isOpen);
    });

    // Shuffle button — random fact
    const shuffleBtn = document.getElementById('fact-shuffle');
    if (shuffleBtn) {
        shuffleBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            let next;
            do {
                next = Math.floor(Math.random() * factsData.length);
            } while (next === currentFactIndex && factsData.length > 1);
            showFact(next);
        });
    }

    // Close on outside click
    document.addEventListener('click', (e) => {
        if (!chip.contains(e.target) && !card.contains(e.target)) {
            card.classList.remove('open');
            chip.classList.remove('active');
        }
    });
}
