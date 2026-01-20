// ═══════════════════════════════════════════════════════════════════════════════
// GOALS — Seamless inline editing with localStorage persistence
// ═══════════════════════════════════════════════════════════════════════════════

const GOALS_STORAGE_KEY = '0500_goals';

function loadGoals() {
    const saved = localStorage.getItem(GOALS_STORAGE_KEY);
    if (saved) {
        return JSON.parse(saved);
    }
    // First time: convert from CONFIG format
    return {
        daily: CONFIG.daily.map(text => ({ text, checked: false })),
        midTerm: CONFIG.midTerm.map(text => ({ text, checked: false })),
        longTerm: CONFIG.longTerm.map(text => ({ text, checked: false }))
    };
}

function saveGoals(goals) {
    localStorage.setItem(GOALS_STORAGE_KEY, JSON.stringify(goals));
}

function renderGoals() {
    const container = document.getElementById('goals-section');
    const goals = loadGoals();

    const sections = [
        { key: 'daily', title: 'DAILY', items: goals.daily },
        { key: 'midTerm', title: 'MID-TERM', items: goals.midTerm },
        { key: 'longTerm', title: 'LONG-TERM', items: goals.longTerm }
    ];

    container.innerHTML = sections.map(section => `
        <div class="goal-group hud-frame" data-section="${section.key}">
            <div class="hud-corners"></div>
            <h3>${section.title}</h3>
            <div class="goal-list">
                ${section.items.map((item, idx) => `
                    <div class="goal-item ${item.checked ? 'checked' : ''}" data-index="${idx}">
                        <div class="goal-checkbox"></div>
                        <span class="goal-text" contenteditable="true" spellcheck="false">${item.text}</span>
                    </div>
                `).join('')}
                <div class="goal-item new-goal">
                    <div class="goal-checkbox"></div>
                    <span class="goal-text" contenteditable="true" spellcheck="false" data-placeholder="+ add goal"></span>
                </div>
            </div>
        </div>
    `).join('');

    // Attach event listeners
    container.querySelectorAll('.goal-group').forEach(group => {
        const sectionKey = group.dataset.section;

        // Checkbox toggle
        group.querySelectorAll('.goal-checkbox').forEach(checkbox => {
            checkbox.addEventListener('click', (e) => {
                e.stopPropagation();
                const item = checkbox.closest('.goal-item');
                if (item.classList.contains('new-goal')) return;

                const index = parseInt(item.dataset.index);
                const goals = loadGoals();
                goals[sectionKey][index].checked = !goals[sectionKey][index].checked;
                saveGoals(goals);
                item.classList.toggle('checked');
            });
        });

        // Text editing
        group.querySelectorAll('.goal-text').forEach(textEl => {
            // Save on blur
            textEl.addEventListener('blur', () => {
                const item = textEl.closest('.goal-item');
                const isNew = item.classList.contains('new-goal');
                const text = textEl.textContent.trim();
                const goals = loadGoals();

                if (isNew) {
                    // Add new goal if text entered
                    if (text) {
                        goals[sectionKey].push({ text, checked: false });
                        saveGoals(goals);
                        renderGoals();
                    }
                } else {
                    const index = parseInt(item.dataset.index);
                    if (text) {
                        // Update existing goal
                        goals[sectionKey][index].text = text;
                        saveGoals(goals);
                    } else {
                        // Delete goal if empty
                        goals[sectionKey].splice(index, 1);
                        saveGoals(goals);
                        renderGoals();
                    }
                }
            });

            // Enter key = blur (save)
            textEl.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    textEl.blur();
                }
            });
        });
    });
}

function initGoals() {
    renderGoals();
}
