const weeklyGoalSaves = new Set();
function trackWeeklyGoalSave(action) {
    _activeSaveCount++;
    const pending = Promise.resolve().then(action);
    weeklyGoalSaves.add(pending);
    return pending.finally(() => { weeklyGoalSaves.delete(pending); _activeSaveCount--; });
}

// Weekly goals share the goal card, with optional per-goal numeric targets.
function weeklyNumber(value) { return Number(value.toFixed(2)).toString(); }
function weeklyIsHours(unit) { return /^(h|hr|hrs|hour|hours)$/i.test(unit.trim()); }

function createWeeklyGoalItem(goal, index, isNew) {
    if (isNew) {
        const row = document.createElement('div');
        row.className = 'weekly-add-row';
        row.innerHTML = '<button type="button" class="weekly-add">+ add goal</button>';
        return row;
    }
    const row = createGoalItem({ ...goal, text: '' }, index);
    row.classList.add('weekly-goal');
    // Use textContent for names; saved goal text must never become markup.
    row.querySelector('.goal-text').textContent = goal.text;
    const controls = document.createElement('div');
    controls.className = 'weekly-controls';
    if (goal.progress) {
        row.classList.add('weekly-measured');
        controls.innerHTML = '<button type="button" class="weekly-minus" aria-label="Decrease progress">−</button><label class="weekly-counter"><input class="weekly-value" type="number" min="0" step="any" aria-label="Current progress"><span class="weekly-target"></span></label><button type="button" class="weekly-plus" aria-label="Increase progress">+</button>';
        const checkbox = row.querySelector('.goal-checkbox');
        checkbox.removeAttribute('role');
        checkbox.removeAttribute('tabindex');
        checkbox.removeAttribute('aria-checked');
        checkbox.setAttribute('role', 'progressbar');
        checkbox.innerHTML = progressRingSVG(goal.progress.value, goal.progress.target, 8);
    }
    const edit = document.createElement('button');
    edit.type = 'button';
    edit.className = 'weekly-edit';
    edit.textContent = goal.progress ? 'edit target' : 'set target';
    controls.append(edit);
    row.querySelector('.goal-content-wrapper').append(controls);
    const error = document.createElement('div');
    error.className = 'weekly-error';
    error.setAttribute('role', 'alert');
    row.append(error);
    refreshWeeklyGoal(row, goal);
    return row;
}

function refreshWeeklyGoal(row, goal) {
    row.classList.toggle('checked', !!goal.checked);
    const checkbox = row.querySelector('.goal-checkbox');
    if (!goal.progress) { checkbox.setAttribute('aria-checked', String(!!goal.checked)); return; }
    if (!row.querySelector('.weekly-value')) return;
    const p = goal.progress;
    row.querySelector('.weekly-value').value = weeklyNumber(p.value);
    row.querySelector('.weekly-value').max = p.target;
    row.querySelector('.weekly-value').style.width = Math.max(3.5, weeklyNumber(p.value).length + 0.5) + 'ch';
    row.querySelector('.weekly-target').textContent = '/' + weeklyNumber(p.target) + (weeklyIsHours(p.unit) ? 'h' : '');
    row.querySelector('.weekly-counter').title = p.unit || 'completed';
    row.querySelector('.weekly-minus').disabled = p.value <= 0;
    row.querySelector('.weekly-plus').disabled = p.value >= p.target;
    checkbox.setAttribute('aria-valuemin', '0');
    checkbox.setAttribute('aria-valuemax', p.target);
    checkbox.setAttribute('aria-valuenow', p.value);
    checkbox.setAttribute('aria-label', goal.text);
    checkbox.setAttribute('aria-valuetext', `${weeklyNumber(p.value)} of ${weeklyNumber(p.target)} ${p.unit}`);
    row.querySelector('.goal-ring-fill').setAttribute('stroke-dashoffset', 2 * Math.PI * 8 * (1 - p.value / p.target));
}

function weeklyGoalError(row, message) {
    row.querySelector('.weekly-error').textContent = message;
}

async function saveWeeklyGoal(row, group, goal, changes) {
    if (row.dataset.saving) return false;
    row.dataset.saving = 'true';
    const controls = [...row.querySelectorAll('button, input')];
    controls.forEach(el => el.disabled = true);
    row.querySelector('.goal-text').contentEditable = 'false';
    weeklyGoalError(row, '');
    const updated = { ...goal, ...changes };
    if (updated.progress) updated.checked = updated.progress.value >= updated.progress.target;
    try {
        await trackWeeklyGoalSave(() => DataService.updateGoal(goal.id, { text: updated.text, checked: updated.checked, progress: updated.progress || null }));
        Object.assign(goal, updated);
        if (!updated.progress) delete goal.progress;
        refreshWeeklyGoal(row, goal);
        updateHeaderMeta(group);
        return true;
    } catch (error) {
        row.querySelector('.goal-text').textContent = goal.text;
        refreshWeeklyGoal(row, goal);
        weeklyGoalError(row, 'Could not save. Please try again.');
        return false;
    } finally {
        delete row.dataset.saving;
        controls.forEach(el => el.disabled = false);
        row.querySelector('.goal-text').contentEditable = 'true';
        refreshWeeklyGoal(row, goal);
    }
}

function attachWeeklyGoalListeners(row, group) {
    if (row.classList.contains('weekly-add-row')) {
        row.querySelector('button').addEventListener('click', () => openWeeklyGoalForm(group));
        return;
    }
    const goal = goalsCache.weekly.find(g => g.id === row.dataset.id);
    const text = row.querySelector('.goal-text');
    text.addEventListener('blur', () => {
        const name = text.textContent.trim();
        if (!name) { text.textContent = goal.text; return; }
        if (name !== goal.text) saveWeeklyGoal(row, group, goal, { text: name });
    });
    text.addEventListener('keydown', e => {
        if (e.key === 'Enter') { e.preventDefault(); text.blur(); }
    });
    text.addEventListener('paste', e => {
        e.preventDefault(); document.execCommand('insertText', false, e.clipboardData.getData('text/plain'));
    });
    row.querySelector('.weekly-edit').addEventListener('click', () => openWeeklyGoalForm(group, goal, row));
    row.querySelector('.goal-del-btn').addEventListener('click', async e => {
        e.stopPropagation();
        if (row.dataset.saving) return;
        row.dataset.saving = 'true';
        try {
            await trackWeeklyGoalSave(() => DataService.deleteGoal(goal.id));
            goalsCache.weekly = goalsCache.weekly.filter(g => g.id !== goal.id);
            row.remove(); reindexGoalItems(group); updateHeaderMeta(group);
        } catch (_) { weeklyGoalError(row, 'Could not delete. Please try again.'); }
        finally { delete row.dataset.saving; }
    });
    if (!goal.progress) {
        const check = row.querySelector('.goal-checkbox');
        const toggle = () => saveWeeklyGoal(row, group, goal, { checked: !goal.checked });
        check.addEventListener('click', toggle);
        check.addEventListener('keydown', e => {
            if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); }
        });
        return;
    }
    const input = row.querySelector('.weekly-value');
    const setValue = value => {
        if (!Number.isFinite(value) || value < 0 || value > goal.progress.target) {
            weeklyGoalError(row, `Enter a number from 0 to ${weeklyNumber(goal.progress.target)}.`);
            input.value = weeklyNumber(goal.progress.value);
            return;
        }
        value = Math.round(value * 100) / 100;
        if (value !== goal.progress.value) saveWeeklyGoal(row, group, goal, { progress: { ...goal.progress, value } });
    };
    input.addEventListener('change', () => setValue(input.value === '' ? NaN : Number(input.value)));
    input.addEventListener('keydown', e => {
        if (e.key === 'Enter') { e.preventDefault(); input.blur(); }
        if (e.key === 'Escape') { input.value = weeklyNumber(goal.progress.value); input.blur(); }
    });
    row.querySelector('.weekly-minus').addEventListener('click', () => setValue(Math.max(0, goal.progress.value - goal.progress.step)));
    row.querySelector('.weekly-plus').addEventListener('click', () => setValue(Math.min(goal.progress.target, goal.progress.value + goal.progress.step)));
}

function openWeeklyGoalForm(group, goal = null, row = null) {
    group.querySelector('.weekly-form')?.remove();
    const form = document.createElement('form');
    form.className = 'weekly-form';
    form.innerHTML = `<label>Goal<input name="name" required maxlength="300" placeholder="Focused robotics" autocomplete="off"></label>
        <label>Track<select name="type"><option value="target">Progress toward a target</option><option value="checkbox">Checkbox</option></select></label>
        <div class="weekly-fields"><label>Target<input name="target" type="number" min="0.01" max="1000000" step="0.01" placeholder="10"></label><label>Unit<input name="unit" maxlength="24" placeholder="hours, DMs…" autocomplete="off"></label><label>Step<input name="step" type="number" min="0.01" max="1000000" step="0.01" value="1"></label></div>
        <div class="weekly-form-actions"><button type="button" class="weekly-cancel">Cancel</button><button type="submit">${goal ? 'Save' : 'Add goal'}</button></div><div class="weekly-error" role="alert"></div>`;
    const field = name => form.elements.namedItem(name);
    field('name').value = goal?.text || '';
    field('type').value = goal && !goal.progress ? 'checkbox' : 'target';
    field('target').value = goal?.progress?.target || '';
    field('unit').value = goal?.progress?.unit || '';
    field('step').value = goal?.progress?.step || 1;
    const updateType = () => {
        const target = field('type').value === 'target';
        form.querySelector('.weekly-fields').hidden = !target;
        ['target', 'unit', 'step'].forEach(name => field(name).disabled = !target);
        field('target').required = target; field('step').required = target;
    };
    field('type').addEventListener('change', updateType);
    field('unit').addEventListener('input', () => { field('step').value = weeklyIsHours(field('unit').value) ? 0.5 : 1; });
    updateType();
    const close = () => { form.remove(); group.querySelector('.weekly-add').focus(); };
    form.querySelector('.weekly-cancel').addEventListener('click', close);
    form.addEventListener('keydown', e => { if (e.key === 'Escape' && !form.dataset.saving) { e.preventDefault(); close(); } });
    form.addEventListener('submit', async e => {
        e.preventDefault();
        if (form.dataset.saving) return;
        const text = field('name').value.trim();
        if (!text) { field('name').focus(); return; }
        let progress = null;
        if (field('type').value === 'target') {
            const target = Number(field('target').value), step = Number(field('step').value);
            if (!Number.isFinite(target) || target <= 0 || !Number.isFinite(step) || step <= 0) return;
            progress = { target, step, unit: field('unit').value.trim(), value: Math.min(goal?.progress?.value || 0, target) };
        }
        form.dataset.saving = 'true';
        [...form.elements].forEach(el => el.disabled = true);
        try {
            if (goal) {
                if (!await saveWeeklyGoal(row, group, goal, { text, progress, checked: progress ? progress.value >= progress.target : goal.checked })) throw new Error('save');
                const replacement = createWeeklyGoalItem(goal, goalsCache.weekly.indexOf(goal), false);
                row.replaceWith(replacement); attachWeeklyGoalListeners(replacement, group); attachSwipeListeners(replacement, 'weekly', group);
            } else {
                const id = await trackWeeklyGoalSave(() => DataService.insertGoal('weekly', text, goalsCache.weekly.length, progress));
                const newGoal = { id, text, checked: false, ...(progress ? { progress } : {}) };
                goalsCache.weekly.push(newGoal);
                const added = createWeeklyGoalItem(newGoal, goalsCache.weekly.length - 1, false);
                group.querySelector('.weekly-add-row').before(added);
                attachWeeklyGoalListeners(added, group); attachSwipeListeners(added, 'weekly', group);
            }
            updateHeaderMeta(group); close();
        } catch (_) {
            form.querySelector('.weekly-error').textContent = 'Could not save. Your entries are still here; please try again.';
        } finally {
            delete form.dataset.saving;
            [...form.elements].forEach(el => el.disabled = false);
            updateType();
        }
    });
    group.querySelector('.goal-list').append(form);
    field('name').focus();
}
