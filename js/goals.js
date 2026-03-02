// ═══════════════════════════════════════════════════════════════════════════════
// GOALS — GLASS variant with progress rings, fraction counters, hover delete
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

// Progress ring SVG helper
function progressRingSVG(checked, total, r = 11) {
    const c = 2 * Math.PI * r;
    const pct = total === 0 ? 0 : checked / total;
    const off = c * (1 - pct);
    const s = (r + 3) * 2;
    const cx = r + 3;
    return `<svg class="goal-ring" viewBox="0 0 ${s} ${s}"><circle class="goal-ring-bg" cx="${cx}" cy="${cx}" r="${r}"/><circle class="goal-ring-fill" cx="${cx}" cy="${cx}" r="${r}" stroke-dasharray="${c}" stroke-dashoffset="${off}" transform="rotate(-90 ${cx} ${cx})"/></svg>`;
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
            ${!isNew ? '<button class="goal-del-btn">&times;</button>' : ''}
        </div>
    `;

    return div;
}

function updateHeaderMeta(group) {
    const items = group.querySelectorAll('.goal-item:not(.new-goal):not(.removing)');
    const total = items.length;
    const checked = group.querySelectorAll('.goal-item.checked:not(.removing)').length;

    // Update fraction
    const frac = group.querySelector('.goal-frac');
    if (frac) frac.textContent = `${checked}/${total}`;

    // Update ring
    const ringFill = group.querySelector('.goal-ring-fill');
    if (ringFill) {
        const r = 11;
        const c = 2 * Math.PI * r;
        const pct = total === 0 ? 0 : checked / total;
        const off = c * (1 - pct);
        ringFill.setAttribute('stroke-dashoffset', off);
    }

    // Show/hide ring + frac if total changes to/from 0
    const ringEl = group.querySelector('.goal-ring');
    if (ringEl) ringEl.style.display = total > 0 ? '' : 'none';
    if (frac) frac.style.display = total > 0 ? '' : 'none';
}

function attachGoalListeners(item, sectionKey, group) {
    const checkbox = item.querySelector('.goal-checkbox');
    const textEl = item.querySelector('.goal-text');
    const delBtn = item.querySelector('.goal-del-btn');
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
        updateHeaderMeta(group);

        // Fire globe burst on daily goal check
        if (isChecked && sectionKey === 'daily' && window._fireBurstPulses) {
            window._fireBurstPulses();
        }
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

    // Delete button (hover-reveal)
    if (delBtn) {
        delBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const index = parseInt(item.dataset.index);
            removeGoalWithAnimation(item, sectionKey, index, group);
        });
    }

    textEl.addEventListener('blur', async () => {
        if (!goalsCache) return;

        const text = textEl.textContent.trim();

        if (isNew) {
            if (text) {
                const sortOrder = goalsCache[sectionKey].length;
                let id;
                try {
                    id = await DataService.insertGoal(sectionKey, text, sortOrder);
                } catch (err) {
                    console.error('Failed to insert goal:', err);
                    return;
                }

                const goalObj = { id, text, checked: false };
                goalsCache[sectionKey].push(goalObj);

                const newItem = createGoalItem(goalObj, goalsCache[sectionKey].length - 1);
                newItem.classList.add('adding');
                item.before(newItem);
                attachGoalListeners(newItem, sectionKey, group);
                attachSwipeListeners(newItem, sectionKey, group);
                textEl.innerHTML = '';
                updateHeaderMeta(group);
                setTimeout(() => newItem.classList.remove('adding'), 250);
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
        updateHeaderMeta(group);
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
                updateHeaderMeta(group);
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
        const total = section.items.length;
        const checked = section.items.filter(i => i.checked).length;

        return `
            <div class="goal-group ${isCollapsed ? 'collapsed' : ''}" data-section="${section.key}">
                <div class="goal-header">
                    <span class="goal-header-title">${section.title}</span>
                    ${section.key === 'daily' ? '<button class="daily-clear-btn" title="Clear daily goals">CLR</button>' : ''}
                    ${total > 0 ? progressRingSVG(checked, total) : ''}
                    ${total > 0 ? `<span class="goal-frac">${checked}/${total}</span>` : ''}
                    <span class="goal-header-spacer"></span>
                    <span class="goal-toggle-icon">${isCollapsed ? '+' : '−'}</span>
                </div>
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

        const header = group.querySelector('.goal-header');
        if (header) {
            header.addEventListener('click', (e) => {
                // Don't toggle when clicking CLR button
                if (e.target.closest('.daily-clear-btn')) return;

                const collapsed = loadCollapsedState();
                collapsed[sectionKey] = !collapsed[sectionKey];
                saveCollapsedState(collapsed);

                group.classList.toggle('collapsed');
                const icon = header.querySelector('.goal-toggle-icon');
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

    // Build detailed per-goal breakdown
    const goals = daily.map(g => ({
        text: g.text,
        done: !!g.checked
    }));

    const history = DataService.loadDailyGoalHistory();
    const existing = history.findIndex(h => h.date === today);
    const entry = { date: today, completed, total, goals };
    if (existing >= 0) {
        history[existing] = entry;
    } else {
        history.push(entry);
    }
    if (history.length > 90) history.splice(0, history.length - 90);
    DataService.saveDailyGoalHistory(history);

    // Uncheck all daily goals atomically
    await DataService.uncheckDailyGoals();
    goalsCache.daily = daily.map(g => ({ ...g, checked: false }));

    goalsCache = null;
    await renderGoals();
}

// Build missed-goals summary for the new-day banner
function populateMissedGoals() {
    const container = document.getElementById('new-day-missed');
    if (!container || !goalsCache || !goalsCache.daily) return;

    const daily = goalsCache.daily;
    const missed = daily.filter(g => !g.checked);
    const done = daily.filter(g => g.checked);

    if (daily.length === 0) {
        container.innerHTML = '';
        return;
    }

    // If everything was completed, show a nice message
    if (missed.length === 0) {
        container.innerHTML = `<div class="missed-summary all-done">All ${done.length} goals completed yesterday</div>`;
        return;
    }

    const missedHtml = missed.map(g =>
        `<div class="missed-goal-item"><span class="missed-x">&times;</span><span class="missed-text">${escGoalText(g.text)}</span></div>`
    ).join('');

    const doneHtml = done.map(g =>
        `<div class="missed-goal-item done"><span class="missed-check">&#10003;</span><span class="missed-text">${escGoalText(g.text)}</span></div>`
    ).join('');

    container.innerHTML = `
        <div class="missed-summary">${done.length}/${daily.length} completed yesterday</div>
        <div class="missed-goals-list">${doneHtml}${missedHtml}</div>
    `;
}

function escGoalText(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

async function initGoals() {
    await renderGoals();

    // Populate missed goals in new-day banner if it's visible
    populateMissedGoals();

    window.addEventListener('userChanged', async () => {
        goalsCache = null;
        await renderGoals();
    });
}
