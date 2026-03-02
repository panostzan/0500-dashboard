// ═══════════════════════════════════════════════════════════════════════════════
// PEOPLE CRM — dashboard chip + standalone page
// ═══════════════════════════════════════════════════════════════════════════════

const PEOPLE_STORAGE_KEY = '0500_people';
const PEOPLE_VERSION_KEY = '0500_people_version';
const PEOPLE_SEED_VERSION = 1;
let peopleCache = null;
let peopleSortField = 'lastContact';
let peopleSortDir = 'desc';
let peopleSearchQuery = '';

// ─────────────────────────────────────────────────────────────────────────────
// DASHBOARD MODE — called from index.html
// ─────────────────────────────────────────────────────────────────────────────

function initPeople() {
    const chip = document.getElementById('chip-people');
    if (!chip) return;
    chip.classList.add('visible');
    chip.addEventListener('click', () => {
        window.location.href = 'people.html';
    });
}

// ─────────────────────────────────────────────────────────────────────────────
// PAGE MODE — called from people.html
// ─────────────────────────────────────────────────────────────────────────────

async function loadPeople() {
    const storedVersion = parseInt(localStorage.getItem(PEOPLE_VERSION_KEY) || '0', 10);
    const stored = localStorage.getItem(PEOPLE_STORAGE_KEY);

    if (stored && storedVersion >= PEOPLE_SEED_VERSION) {
        try {
            peopleCache = JSON.parse(stored);
            return;
        } catch (e) {
            console.warn('[PEOPLE] Bad localStorage data, re-seeding');
        }
    }
    try {
        const res = await fetch('js/people.json');
        peopleCache = await res.json();
        savePeople();
        localStorage.setItem(PEOPLE_VERSION_KEY, String(PEOPLE_SEED_VERSION));
    } catch (e) {
        console.warn('[PEOPLE] Failed to load seed data:', e.message);
        peopleCache = [];
    }
}

function savePeople() {
    localStorage.setItem(PEOPLE_STORAGE_KEY, JSON.stringify(peopleCache));
}

function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

// ─── Helpers ───

function escP(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function daysSince(dateStr) {
    if (!dateStr) return null;
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return null;
    return Math.floor((Date.now() - d.getTime()) / (1000 * 60 * 60 * 24));
}

function formatDaysAgo(days) {
    if (days === null) return '';
    if (days === 0) return 'today';
    if (days === 1) return 'yesterday';
    if (days < 7) return `${days}d ago`;
    if (days < 30) return `${Math.floor(days / 7)}w ago`;
    if (days < 365) return `${Math.floor(days / 30)}mo ago`;
    return `${Math.floor(days / 365)}y ago`;
}

function freshnessBadge(days) {
    if (days === null) return 'stale';
    if (days <= 7) return 'fresh';
    if (days <= 30) return 'warm';
    if (days <= 90) return 'fading';
    return 'stale';
}

// ─── Sorting & Filtering ───

function sortPeople(arr, field, dir) {
    const mul = dir === 'asc' ? 1 : -1;
    return [...arr].sort((a, b) => {
        let va = a[field] || '';
        let vb = b[field] || '';
        if (!va && !vb) return 0;
        if (!va) return 1;
        if (!vb) return -1;
        if (field === 'lastContact' || field === 'dateMet') return mul * (new Date(va) - new Date(vb));
        return mul * va.localeCompare(vb, undefined, { sensitivity: 'base' });
    });
}

function filterPeople(arr, query) {
    if (!query) return arr;
    const q = query.toLowerCase();
    return arr.filter(p =>
        (p.name || '').toLowerCase().includes(q) ||
        (p.occupation || '').toLowerCase().includes(q) ||
        (p.metWhere || '').toLowerCase().includes(q) ||
        (p.tags || '').toLowerCase().includes(q) ||
        (p.notes || '').toLowerCase().includes(q)
    );
}

// ─── Sort UI ───

function updatePeopleSortIndicators() {
    document.querySelectorAll('.people-table th[data-sort]').forEach(th => {
        const arrow = th.querySelector('.sort-arrow');
        if (th.dataset.sort === peopleSortField) {
            th.classList.add('sorted');
            if (arrow) arrow.textContent = peopleSortDir === 'asc' ? ' \u25B2' : ' \u25BC';
        } else {
            th.classList.remove('sorted');
            if (arrow) arrow.textContent = '';
        }
    });
}

function handlePeopleSort(field) {
    if (peopleSortField === field) {
        peopleSortDir = peopleSortDir === 'asc' ? 'desc' : 'asc';
    } else {
        peopleSortField = field;
        peopleSortDir = field === 'name' ? 'asc' : 'desc';
    }
    renderPeoplePage();
}

// ─── Count ───

function updatePeopleCount() {
    const el = document.getElementById('people-count');
    if (el && peopleCache) {
        el.textContent = `${peopleCache.length} contact${peopleCache.length !== 1 ? 's' : ''}`;
    }
}

// ─── Rendering ───

function renderPeoplePage() {
    const tbody = document.getElementById('people-tbody');
    if (!tbody || !peopleCache) return;

    const filtered = filterPeople(peopleCache, peopleSearchQuery);
    const sorted = sortPeople(filtered, peopleSortField, peopleSortDir);
    updatePeopleSortIndicators();

    tbody.innerHTML = sorted.map(person => {
        const realIdx = peopleCache.indexOf(person);
        const days = daysSince(person.lastContact);
        const freshness = freshnessBadge(days);
        const daysText = formatDaysAgo(days);
        const tagsList = (person.tags || '').split(',').map(t => t.trim()).filter(Boolean);
        const tagsHtml = tagsList.map(t => `<span class="people-tag">${escP(t)}</span>`).join('');

        return `<tr data-idx="${realIdx}">
            <td class="people-col-name">
                <input type="text" class="people-input people-input-name" value="${escP(person.name)}" data-field="name" data-idx="${realIdx}" placeholder="Name">
            </td>
            <td class="people-col-occupation">
                <input type="text" class="people-input people-input-occ" value="${escP(person.occupation)}" data-field="occupation" data-idx="${realIdx}" placeholder="What they do">
            </td>
            <td class="people-col-met">
                <input type="text" class="people-input people-input-met" value="${escP(person.metWhere)}" data-field="metWhere" data-idx="${realIdx}" placeholder="Where / how">
            </td>
            <td class="people-col-lastcontact">
                <div class="people-lastcontact-cell">
                    <span class="people-freshness ${freshness}" title="${person.lastContact || 'No date'}">${daysText || '—'}</span>
                    <input type="date" class="people-input-date" value="${person.lastContact || ''}" data-field="lastContact" data-idx="${realIdx}">
                </div>
            </td>
            <td class="people-col-tags">
                <div class="people-tags-cell">
                    ${tagsHtml}
                    <input type="text" class="people-input people-input-tags" value="${escP(person.tags)}" data-field="tags" data-idx="${realIdx}" placeholder="tag1, tag2">
                </div>
            </td>
            <td class="people-col-notes">
                <input type="text" class="people-input people-input-notes" value="${escP(person.notes)}" data-field="notes" data-idx="${realIdx}" placeholder="What you talked about...">
                <div class="people-notes-popout${person.notes ? ' has-text' : ''}">${escP(person.notes)}</div>
            </td>
            <td class="people-col-delete">
                <button class="people-delete-btn" data-idx="${realIdx}" title="Remove">&times;</button>
            </td>
        </tr>`;
    }).join('');

    updatePeopleCount();
}

// ─── Event Handlers ───

function handlePeopleFieldBlur(e) {
    const input = e.target;
    if (!input.dataset || !input.dataset.field) return;
    const idx = parseInt(input.dataset.idx, 10);
    const field = input.dataset.field;
    if (isNaN(idx) || !peopleCache[idx]) return;

    peopleCache[idx][field] = input.value.trim();
    savePeople();

    // Re-render if tags changed (to update tag badges)
    if (field === 'tags') renderPeoplePage();
}

function handlePeopleDelete(e) {
    const btn = e.target.closest('.people-delete-btn');
    if (!btn) return;
    const idx = parseInt(btn.dataset.idx, 10);
    if (isNaN(idx) || !peopleCache[idx]) return;

    const row = btn.closest('tr');
    if (row) {
        row.classList.add('people-row-removing');
        setTimeout(() => {
            peopleCache.splice(idx, 1);
            savePeople();
            renderPeoplePage();
        }, 200);
    }
}

function handleAddPerson() {
    peopleCache.unshift({
        id: generateId(),
        name: '',
        occupation: '',
        metWhere: '',
        dateMet: new Date().toISOString().split('T')[0],
        lastContact: new Date().toISOString().split('T')[0],
        tags: '',
        notes: ''
    });
    savePeople();
    renderPeoplePage();

    // Focus name input of first row
    const tbody = document.getElementById('people-tbody');
    if (tbody) {
        const firstRow = tbody.querySelector('tr');
        if (firstRow) {
            const nameInput = firstRow.querySelector('.people-input-name');
            if (nameInput) nameInput.focus();
        }
    }
}

// ─── Init ───

async function initPeoplePage() {
    await loadPeople();
    renderPeoplePage();

    const tbody = document.getElementById('people-tbody');
    if (tbody) {
        tbody.addEventListener('focusout', handlePeopleFieldBlur);
        tbody.addEventListener('change', handlePeopleFieldBlur);
        tbody.addEventListener('click', handlePeopleDelete);
    }

    const addBtn = document.getElementById('people-add-row');
    if (addBtn) {
        addBtn.addEventListener('click', handleAddPerson);
    }

    // Search
    const searchInput = document.getElementById('people-search');
    if (searchInput) {
        searchInput.addEventListener('input', () => {
            peopleSearchQuery = searchInput.value.trim();
            renderPeoplePage();
        });
    }

    // Sortable columns
    document.querySelectorAll('.people-table th[data-sort]').forEach(th => {
        th.addEventListener('click', () => handlePeopleSort(th.dataset.sort));
    });
}
