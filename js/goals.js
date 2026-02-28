// ═══════════════════════════════════════════════════════════════════════════════
// GOALS — Seamless inline editing with atomic cloud sync
// ═══════════════════════════════════════════════════════════════════════════════

let goalsCache = null;
let swipeState = { el: null, startX: 0, currentX: 0 };

async function loadGoals() {
    if (!goalsCache) {
        goalsCache = await DataService.loadGoals();
        ['daily', 'midTerm', 'oneYear', 'longTerm'].forEach(cat => {
            if (!goalsCache[cat]) goalsCache[cat] = [];
        });
        hydrateGoalTimestamps(goalsCache);
    }
    return goalsCache;
}

// No-op — kept for supabase.js signOut compatibility
async function flushGoalSaves() {}

function loadCollapsedState() {
    return DataService.loadCollapsedState();
}

function saveCollapsedState(state) {
    DataService.saveCollapsedState(state);
}

// Create a single goal item element
function createGoalItem(item, index, isNew = false) {
    const div = document.createElement('div');
    div.className = `goal-item ${item?.checked ? 'checked' : ''} ${isNew ? 'new-goal' : ''}`;
    if (!isNew) {
        div.dataset.index = index;
        div.dataset.id = item?.id || '';
    }

    div.innerHTML = `
        <div class="swipe-delete-bg">Delete</div>
        <div class="goal-content-wrapper">
            <div class="goal-checkbox" role="checkbox" aria-checked="${item?.checked ? 'true' : 'false'}" tabindex="0"></div>
            <span class="goal-text" contenteditable="true" spellcheck="false" autocomplete="off" data-form-type="other" ${isNew ? 'data-placeholder="+ add goal"' : ''}>${item?.text || ''}</span>
        </div>
    `;

    return div;
}

function updateHeaderCount(group) {
    const meta = group.querySelector('.goal-header-meta');
    if (meta) {
        const count = group.querySelectorAll('.goal-item:not(.new-goal):not(.removing)').length;
        meta.textContent = count;
    }
}

function attachGoalListeners(item, sectionKey, group) {
    const checkbox = item.querySelector('.goal-checkbox');
    const textEl = item.querySelector('.goal-text');
    const isNew = item.classList.contains('new-goal');

    function toggleCheckbox() {
        if (isNew || !goalsCache) return;

        item.classList.toggle('checked');
        const isChecked = item.classList.contains('checked');
        checkbox.setAttribute('aria-checked', isChecked ? 'true' : 'false');

        const goalId = item.dataset.id;
        const index = parseInt(item.dataset.index);
        if (!goalsCache[sectionKey] || !goalsCache[sectionKey][index]) return;

        goalsCache[sectionKey][index].checked = isChecked;

        if (sectionKey === 'midTerm' || sectionKey === 'oneYear') {
            const ts = isChecked ? new Date().toISOString() : null;
            goalsCache[sectionKey][index].completedAt = ts;
            _saveGoalTimestamp(sectionKey, goalsCache[sectionKey][index].text, ts);
        }

        DataService.updateGoal(goalId, { checked: isChecked });
    }

    checkbox.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleCheckbox();
    });

    checkbox.addEventListener('keydown', (e) => {
        if (e.key === ' ' || e.key === 'Enter') {
            e.preventDefault();
            toggleCheckbox();
        }
    });

    textEl.addEventListener('blur', async () => {
        if (!goalsCache) return;

        const text = textEl.textContent.trim();

        if (isNew) {
            if (text) {
                const sortOrder = goalsCache[sectionKey].length;
                const id = await DataService.insertGoal(sectionKey, text, sortOrder);

                const goalObj = { id, text, checked: false };
                goalsCache[sectionKey].push(goalObj);

                const newItem = createGoalItem(goalObj, goalsCache[sectionKey].length - 1);
                newItem.classList.add('adding');
                item.before(newItem);
                attachGoalListeners(newItem, sectionKey, group);
                attachSwipeListeners(newItem, sectionKey, group);
                textEl.textContent = '';
                updateHeaderCount(group);
                setTimeout(() => newItem.classList.remove('adding'), 200);
                reindexGoalItems(group);
            }
        } else {
            const index = parseInt(item.dataset.index);
            const goalId = item.dataset.id;
            if (text) {
                if (goalsCache[sectionKey] && goalsCache[sectionKey][index]) {
                    goalsCache[sectionKey][index].text = text;
                    DataService.updateGoal(goalId, { text });
                }
            } else {
                removeGoalWithAnimation(item, sectionKey, index, group);
            }
        }
    });

    textEl.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            textEl.blur();
        }
    });

    textEl.addEventListener('paste', (e) => {
        e.preventDefault();
        const text = e.clipboardData.getData('text/plain');
        document.execCommand('insertText', false, text);
    });
}

function reindexGoalItems(group) {
    const items = group.querySelectorAll('.goal-item:not(.new-goal)');
    items.forEach((item, idx) => {
        item.dataset.index = idx;
    });
}

async function removeGoalWithAnimation(item, sectionKey, index, group) {
    if (!goalsCache || !goalsCache[sectionKey]) return;

    const goalId = item.dataset.id;
    goalsCache[sectionKey].splice(index, 1);
    DataService.deleteGoal(goalId);

    item.classList.add('removing');
    setTimeout(() => {
        item.remove();
        reindexGoalItems(group);
        updateHeaderCount(group);
    }, 200);
}

// Swipe-to-delete handlers (mobile)
function attachSwipeListeners(item, sectionKey, group) {
    if (item.classList.contains('new-goal')) return;

    const isTouchDevice = 'ontouchstart' in window;

    const startSwipe = (e) => {
        if (e.type === 'mousedown' && e.button !== 0) return;

        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        swipeState = { el: item, startX: clientX, currentX: clientX };

        document.addEventListener(isTouchDevice ? 'touchmove' : 'mousemove', handleSwipe, { passive: false });
        document.addEventListener(isTouchDevice ? 'touchend' : 'mouseup', endSwipe);
    };

    const handleSwipe = (e) => {
        if (!swipeState.el) return;

        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        swipeState.currentX = clientX;
        const diff = swipeState.startX - clientX;

        if (diff > 40) {
            swipeState.el.classList.add('swiping');
            e.preventDefault();
        } else {
            swipeState.el.classList.remove('swiping');
        }
    };

    const endSwipe = async () => {
        if (!swipeState.el) return;

        const diff = swipeState.startX - swipeState.currentX;
        const el = swipeState.el;

        if (diff > 100) {
            const index = parseInt(el.dataset.index);
            const goalId = el.dataset.id;
            el.classList.remove('swiping');
            el.classList.add('swipe-deleting');

            if (goalsCache && goalsCache[sectionKey]) {
                goalsCache[sectionKey].splice(index, 1);
                DataService.deleteGoal(goalId);
            }

            setTimeout(() => {
                el.remove();
                reindexGoalItems(group);
                updateHeaderCount(group);
            }, 200);
        } else {
            el.classList.remove('swiping');
        }

        swipeState = { el: null, startX: 0, currentX: 0 };

        document.removeEventListener('touchmove', handleSwipe);
        document.removeEventListener('mousemove', handleSwipe);
        document.removeEventListener('touchend', endSwipe);
        document.removeEventListener('mouseup', endSwipe);
    };

    if (isTouchDevice) {
        item.addEventListener('touchstart', startSwipe, { passive: true });
    } else {
        item.addEventListener('mousedown', (e) => {
            if (window.innerWidth < 768) startSwipe(e);
        });
    }
}

async function renderGoals() {
    const container = document.getElementById('goals-section');
    const goals = await loadGoals();
    const collapsed = loadCollapsedState();

    const sections = [
        { key: 'daily', title: 'DAILY', items: goals.daily, collapsible: true },
        { key: 'midTerm', title: 'UNTIL APRIL', items: goals.midTerm, collapsible: true },
        { key: 'oneYear', title: '1 YEAR', items: goals.oneYear, collapsible: true },
        { key: 'longTerm', title: 'LONG-TERM', items: goals.longTerm, collapsible: true }
    ];

    container.innerHTML = sections.map(section => {
        const isCollapsed = section.collapsible && collapsed[section.key];
        const totalCount = section.items.length;

        return `
            <div class="goal-group ${section.collapsible ? 'collapsible' : ''} ${isCollapsed ? 'collapsed' : ''}" data-section="${section.key}">
                <h3 class="${section.collapsible ? 'goal-header-toggle' : ''}">
                    ${section.title}
                    ${section.key === 'daily' ? '<button class="daily-clear-btn" title="Clear daily goals">CLR</button>' : ''}
                    ${section.collapsible ? `
                        <span class="goal-header-meta">${totalCount}</span>
                        <span class="goal-toggle-icon">${isCollapsed ? '+' : '−'}</span>
                    ` : ''}
                </h3>
                <div class="goal-list"></div>
            </div>
        `;
    }).join('');

    container.querySelectorAll('.goal-group').forEach((group, sectionIdx) => {
        const sectionKey = sections[sectionIdx].key;
        const goalList = group.querySelector('.goal-list');
        const items = sections[sectionIdx].items;

        items.forEach((item, idx) => {
            const goalEl = createGoalItem(item, idx);
            goalList.appendChild(goalEl);
            attachGoalListeners(goalEl, sectionKey, group);
            attachSwipeListeners(goalEl, sectionKey, group);
        });

        const newGoalEl = createGoalItem(null, -1, true);
        goalList.appendChild(newGoalEl);
        attachGoalListeners(newGoalEl, sectionKey, group);

        const clearBtn = group.querySelector('.daily-clear-btn');
        if (clearBtn) {
            clearBtn.addEventListener('click', async (e) => {
                e.stopPropagation();
                if (!goalsCache || !goalsCache.daily || goalsCache.daily.length === 0) return;
                await DataService.clearDailyGoals();
                goalsCache.daily = [];
                goalsCache = null;
                await renderGoals();
            });
        }

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
    });
}

// Goal completion timestamps (persisted in localStorage for weekly review)
const _TIMESTAMP_KEYS = {
    midTerm: '0500_midterm_completed',
    oneYear: '0500_oneyear_completed'
};

function _saveGoalTimestamp(category, text, ts) {
    const key = _TIMESTAMP_KEYS[category];
    if (!key) return;
    const map = JSON.parse(localStorage.getItem(key) || '{}');
    if (ts) {
        map[text] = ts;
    } else {
        delete map[text];
    }
    safeSetItem(key, JSON.stringify(map));
}

function hydrateGoalTimestamps(goals) {
    for (const category of Object.keys(_TIMESTAMP_KEYS)) {
        const key = _TIMESTAMP_KEYS[category];
        const map = JSON.parse(localStorage.getItem(key) || '{}');
        if (goals[category]) {
            goals[category].forEach(g => {
                if (g.checked && map[g.text] && !g.completedAt) {
                    g.completedAt = map[g.text];
                }
            });
        }
    }
}

async function snapshotDailyGoals() {
    if (!goalsCache) return;

    const daily = goalsCache.daily;
    if (daily.length === 0) return;

    const today = new Date().toISOString().split('T')[0];
    const completed = daily.filter(g => g.checked).length;
    const total = daily.length;

    const history = DataService.loadDailyGoalHistory();
    const existing = history.findIndex(h => h.date === today);
    if (existing >= 0) {
        history[existing] = { date: today, completed, total };
    } else {
        history.push({ date: today, completed, total });
    }
    if (history.length > 90) history.splice(0, history.length - 90);
    DataService.saveDailyGoalHistory(history);

    // Uncheck all daily goals atomically
    await DataService.uncheckDailyGoals();
    goalsCache.daily = daily.map(g => ({ ...g, checked: false }));

    goalsCache = null;
    await renderGoals();
}

async function initGoals() {
    await renderGoals();

    window.addEventListener('userChanged', async () => {
        goalsCache = null;
        await renderGoals();
    });
}
