// ═══════════════════════════════════════════════════════════════════════════════
// GOALS — Seamless inline editing with smooth animations and cloud sync
// ═══════════════════════════════════════════════════════════════════════════════

let goalsCache = null;
let swipeState = { el: null, startX: 0, currentX: 0 };
let _pendingGoalSave = null; // Track in-flight save for sign-out guard

async function loadGoals() {
    if (!goalsCache) {
        goalsCache = await DataService.loadGoals();
        hydrateMidTermTimestamps(goalsCache);
    }
    return goalsCache;
}

async function saveGoals(goals) {
    goalsCache = goals;
    _pendingGoalSave = DataService.saveGoals(goals);
    await _pendingGoalSave;
    _pendingGoalSave = null;
}

// Wait for any in-flight save (called before sign-out)
async function flushGoalSaves() {
    if (_pendingGoalSave) await _pendingGoalSave;
}

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
    if (!isNew) div.dataset.index = index;

    // Structure for swipe-to-delete support
    div.innerHTML = `
        <div class="swipe-delete-bg">Delete</div>
        <div class="goal-content-wrapper">
            <div class="goal-checkbox" role="checkbox" aria-checked="${item?.checked ? 'true' : 'false'}" tabindex="0"></div>
            <span class="goal-text" contenteditable="true" spellcheck="false" autocomplete="off" data-form-type="other" ${isNew ? 'data-placeholder="+ add goal"' : ''}>${item?.text || ''}</span>
        </div>
    `;

    return div;
}

// Update header meta count
function updateHeaderCount(group) {
    const meta = group.querySelector('.goal-header-meta');
    if (meta) {
        const count = group.querySelectorAll('.goal-item:not(.new-goal):not(.removing)').length;
        meta.textContent = count;
    }
}

// Attach event listeners to a goal item
function attachGoalListeners(item, sectionKey, group) {
    const checkbox = item.querySelector('.goal-checkbox');
    const textEl = item.querySelector('.goal-text');
    const isNew = item.classList.contains('new-goal');

    // Checkbox toggle (optimistic UI - toggle instantly, save in background)
    function toggleCheckbox() {
        if (isNew) return;

        // Toggle visual state immediately
        item.classList.toggle('checked');
        const isChecked = item.classList.contains('checked');
        checkbox.setAttribute('aria-checked', isChecked ? 'true' : 'false');

        // Save in background (don't await)
        const index = parseInt(item.dataset.index);
        loadGoals().then(goals => {
            goals[sectionKey][index].checked = isChecked;
            // Track completedAt for mid-term goals (for weekly review)
            if (sectionKey === 'midTerm') {
                const ts = isChecked ? new Date().toISOString() : null;
                goals[sectionKey][index].completedAt = ts;
                // Also persist to localStorage for cross-session tracking
                _saveMidTermTimestamp(goals[sectionKey][index].text, ts);
            }
            saveGoals(goals);
        });
    }

    checkbox.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleCheckbox();
    });

    // Keyboard: Space/Enter toggles checkbox
    checkbox.addEventListener('keydown', (e) => {
        if (e.key === ' ' || e.key === 'Enter') {
            e.preventDefault();
            toggleCheckbox();
        }
    });

    // Text editing - save on blur (optimistic UI - update DOM instantly, save in background)
    textEl.addEventListener('blur', () => {
        const text = textEl.textContent.trim();

        if (isNew) {
            // Add new goal if text entered
            if (text) {
                // Update DOM immediately
                const goals = goalsCache;
                goals[sectionKey].push({ text, checked: false });
                const newItem = createGoalItem({ text, checked: false }, goals[sectionKey].length - 1);
                newItem.classList.add('adding');
                item.before(newItem);
                attachGoalListeners(newItem, sectionKey, group);
                attachSwipeListeners(newItem, sectionKey, group);
                textEl.textContent = '';
                updateHeaderCount(group);
                setTimeout(() => newItem.classList.remove('adding'), 200);
                reindexGoalItems(group);

                // Save in background
                saveGoals(goals);
            }
        } else {
            const index = parseInt(item.dataset.index);
            if (text) {
                // Update existing goal - save in background
                const goals = goalsCache;
                goals[sectionKey][index].text = text;
                saveGoals(goals);
            } else {
                // Delete goal if empty (with animation)
                removeGoalWithAnimation(item, sectionKey, index, group);
            }
        }
    });

    // Enter key = blur (save) and optionally focus next
    textEl.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            textEl.blur();
        }
    });

    // Sanitize paste: strip HTML formatting, insert plain text only
    textEl.addEventListener('paste', (e) => {
        e.preventDefault();
        const text = e.clipboardData.getData('text/plain');
        document.execCommand('insertText', false, text);
    });
}

// Reindex goal items after add/remove
function reindexGoalItems(group) {
    const items = group.querySelectorAll('.goal-item:not(.new-goal)');
    items.forEach((item, idx) => {
        item.dataset.index = idx;
    });
}

// Remove goal with animation
async function removeGoalWithAnimation(item, sectionKey, index, group) {
    const goals = await loadGoals();
    goals[sectionKey].splice(index, 1);
    await saveGoals(goals);

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
        // Only handle touch or left mouse button
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
            // Swiped far enough - delete
            const index = parseInt(el.dataset.index);
            el.classList.remove('swiping');
            el.classList.add('swipe-deleting');

            const goals = await loadGoals();
            goals[sectionKey].splice(index, 1);
            await saveGoals(goals);

            setTimeout(() => {
                el.remove();
                reindexGoalItems(group);
                updateHeaderCount(group);
            }, 200);
        } else {
            // Not enough - cancel
            el.classList.remove('swiping');
        }

        swipeState = { el: null, startX: 0, currentX: 0 };

        document.removeEventListener('touchmove', handleSwipe);
        document.removeEventListener('mousemove', handleSwipe);
        document.removeEventListener('touchend', endSwipe);
        document.removeEventListener('mouseup', endSwipe);
    };

    // Attach swipe start listener
    if (isTouchDevice) {
        item.addEventListener('touchstart', startSwipe, { passive: true });
    } else {
        // For desktop testing, only enable on narrow viewport
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
                <div class="goal-list"></div>
            </div>
        `;
    }).join('');

    // Populate each section with goal items
    container.querySelectorAll('.goal-group').forEach((group, sectionIdx) => {
        const sectionKey = sections[sectionIdx].key;
        const goalList = group.querySelector('.goal-list');
        const items = sections[sectionIdx].items;

        // Add existing goals
        items.forEach((item, idx) => {
            const goalEl = createGoalItem(item, idx);
            goalList.appendChild(goalEl);
            attachGoalListeners(goalEl, sectionKey, group);
            attachSwipeListeners(goalEl, sectionKey, group);
        });

        // Add "new goal" input
        const newGoalEl = createGoalItem(null, -1, true);
        goalList.appendChild(newGoalEl);
        attachGoalListeners(newGoalEl, sectionKey, group);

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
    });
}

// Mid-term completion timestamps (persisted in localStorage for weekly review)
function _saveMidTermTimestamp(text, ts) {
    const map = JSON.parse(localStorage.getItem('0500_midterm_completed') || '{}');
    if (ts) {
        map[text] = ts;
    } else {
        delete map[text];
    }
    safeSetItem('0500_midterm_completed', JSON.stringify(map));
}

function _loadMidTermTimestamps() {
    return JSON.parse(localStorage.getItem('0500_midterm_completed') || '{}');
}

// Hydrate completedAt from localStorage into goalsCache (after load)
function hydrateMidTermTimestamps(goals) {
    const map = _loadMidTermTimestamps();
    if (goals.midTerm) {
        goals.midTerm.forEach(g => {
            if (g.checked && map[g.text] && !g.completedAt) {
                g.completedAt = map[g.text];
            }
        });
    }
}

// Snapshot daily goals completion count to history, then uncheck all daily goals
async function snapshotDailyGoals() {
    const goals = await loadGoals();
    const daily = goals.daily;
    if (daily.length === 0) return;

    const today = new Date().toISOString().split('T')[0];
    const completed = daily.filter(g => g.checked).length;
    const total = daily.length;

    // Save to history
    const history = DataService.loadDailyGoalHistory();
    // Avoid duplicate entries for the same date
    const existing = history.findIndex(h => h.date === today);
    if (existing >= 0) {
        history[existing] = { date: today, completed, total };
    } else {
        history.push({ date: today, completed, total });
    }
    // Keep last 90 days max
    if (history.length > 90) history.splice(0, history.length - 90);
    DataService.saveDailyGoalHistory(history);

    // Uncheck all daily goals
    goals.daily = daily.map(g => ({ ...g, checked: false }));
    await saveGoals(goals);

    // Re-render goals UI
    goalsCache = null;
    await renderGoals();
}

async function initGoals() {
    await renderGoals();

    // Re-render when user changes
    window.addEventListener('userChanged', async () => {
        goalsCache = null;
        await renderGoals();
    });
}
