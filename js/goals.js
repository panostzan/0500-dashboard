// ═══════════════════════════════════════════════════════════════════════════════
// GOALS — Seamless inline editing with cloud sync
// ═══════════════════════════════════════════════════════════════════════════════

let goalsCache = null;

async function loadGoals() {
    if (!goalsCache) {
        goalsCache = await DataService.loadGoals();
    }
    return goalsCache;
}

async function saveGoals(goals) {
    goalsCache = goals;
    await DataService.saveGoals(goals);
}

function loadCollapsedState() {
    return DataService.loadCollapsedState();
}

function saveCollapsedState(state) {
    DataService.saveCollapsedState(state);
}

async function renderGoals() {
    const container = document.getElementById('goals-section');
    const goals = await loadGoals();
    const collapsed = loadCollapsedState();

    const sections = [
        { key: 'daily', title: 'DAILY', items: goals.daily, collapsible: true },
        { key: 'midTerm', title: 'MID-TERM', items: goals.midTerm, collapsible: true },
        { key: 'longTerm', title: 'LONG-TERM', items: goals.longTerm, collapsible: true }
    ];

    container.innerHTML = sections.map(section => {
        const isCollapsed = section.collapsible && collapsed[section.key];
        const totalCount = section.items.length;

        return `
            <div class="goal-group ${section.collapsible ? 'collapsible' : ''} ${isCollapsed ? 'collapsed' : ''}" data-section="${section.key}">
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
            checkbox.addEventListener('click', async (e) => {
                e.stopPropagation();
                const item = checkbox.closest('.goal-item');
                if (item.classList.contains('new-goal')) return;

                const index = parseInt(item.dataset.index);
                const goals = await loadGoals();
                goals[sectionKey][index].checked = !goals[sectionKey][index].checked;
                await saveGoals(goals);
                item.classList.toggle('checked');
            });
        });

        // Text editing
        group.querySelectorAll('.goal-text').forEach(textEl => {
            // Save on blur
            textEl.addEventListener('blur', async () => {
                const item = textEl.closest('.goal-item');
                const isNew = item.classList.contains('new-goal');
                const text = textEl.textContent.trim();
                const goals = await loadGoals();

                if (isNew) {
                    // Add new goal if text entered
                    if (text) {
                        goals[sectionKey].push({ text, checked: false });
                        await saveGoals(goals);
                        renderGoals();
                    }
                } else {
                    const index = parseInt(item.dataset.index);
                    if (text) {
                        // Update existing goal
                        goals[sectionKey][index].text = text;
                        await saveGoals(goals);
                    } else {
                        // Delete goal if empty
                        goals[sectionKey].splice(index, 1);
                        await saveGoals(goals);
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

async function initGoals() {
    await renderGoals();

    // Re-render when user changes
    window.addEventListener('userChanged', async () => {
        goalsCache = null;
        await renderGoals();
    });
}
