// ═══════════════════════════════════════════════════════════════════════════════
// GOALS
// ═══════════════════════════════════════════════════════════════════════════════

function renderGoals() {
    const container = document.getElementById('goals-section');

    const sections = [
        { title: 'DAILY', items: CONFIG.daily },
        { title: 'MID-TERM', items: CONFIG.midTerm },
        { title: 'LONG-TERM', items: CONFIG.longTerm }
    ];

    container.innerHTML = sections.map(section => `
        <div class="goal-group hud-frame">
            <div class="hud-corners"></div>
            <h3>${section.title}</h3>
            ${section.items.map((item, idx) => `
                <div class="goal-item" data-section="${section.title}" data-index="${idx}">
                    <div class="goal-checkbox"></div>
                    <span class="goal-text">${item}</span>
                </div>
            `).join('')}
        </div>
    `).join('');

    container.querySelectorAll('.goal-item').forEach(item => {
        item.addEventListener('click', () => {
            item.classList.toggle('checked');
        });
    });
}

function initGoals() {
    renderGoals();
}
