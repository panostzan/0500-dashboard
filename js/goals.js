// ═══════════════════════════════════════════════════════════════════════════════
// GOALS — Seamless inline editing with localStorage persistence
// ═══════════════════════════════════════════════════════════════════════════════

const GOALS_STORAGE_KEY = '0500_goals';
const GOALS_COLLAPSED_KEY = '0500_goals_collapsed';

function loadCollapsedState() {
    const saved = localStorage.getItem(GOALS_COLLAPSED_KEY);
    if (saved) {
        return JSON.parse(saved);
    }
    // Default: mid-term and long-term are collapsed
    return { midTerm: true, longTerm: true };
}

function saveCollapsedState(state) {
    localStorage.setItem(GOALS_COLLAPSED_KEY, JSON.stringify(state));
}

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
    const collapsed = loadCollapsedState();

    const sections = [
        { key: 'daily', title: 'DAILY', items: goals.daily, collapsible: false },
        { key: 'midTerm', title: 'MID-TERM', items: goals.midTerm, collapsible: true },
        { key: 'longTerm', title: 'LONG-TERM', items: goals.longTerm, collapsible: true }
    ];

    container.innerHTML = sections.map(section => {
        const isCollapsed = section.collapsible && collapsed[section.key];
        const totalCount = section.items.length;

        return `
            <div class="goal-group hud-frame ${section.collapsible ? 'collapsible' : ''} ${isCollapsed ? 'collapsed' : ''}" data-section="${section.key}">
                <div class="hud-corners"></div>
                <h3 class="${section.collapsible ? 'goal-header-toggle' : ''}">
                    ${section.title}
                    ${section.collapsible ? `
                        <span class="goal-header-meta">${totalCount}</span>
                        <span class="goal-toggle-icon">${isCollapsed ? '+' : '−'}</span>
                    ` : ''}
                </h3>
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
        `;
    }).join('');

    // Attach event listeners
    container.querySelectorAll('.goal-group').forEach(group => {
        const sectionKey = group.dataset.section;

        // Collapsible header toggle
        const headerToggle = group.querySelector('.goal-header-toggle');
        if (headerToggle) {
            headerToggle.addEventListener('click', () => {
                const collapsed = loadCollapsedState();
                collapsed[sectionKey] = !collapsed[sectionKey];
                saveCollapsedState(collapsed);

                group.classList.toggle('collapsed');
                const icon = headerToggle.querySelector('.goal-toggle-icon');
                if (icon) {
                    icon.textContent = collapsed[sectionKey] ? '+' : '−';
                }
            });
        }

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
