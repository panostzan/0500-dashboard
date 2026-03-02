// ═══════════════════════════════════════════════════════════════════════════════
// BOOKS SHELF — dashboard chip + standalone page CRUD
// ═══════════════════════════════════════════════════════════════════════════════

const BOOKS_STORAGE_KEY = '0500_books';
let booksCache = null;

// ─────────────────────────────────────────────────────────────────────────────
// DASHBOARD MODE — called from index.html via deferInit
// ─────────────────────────────────────────────────────────────────────────────

function initBooks() {
    const chip = document.getElementById('chip-books');
    if (!chip) return;

    chip.classList.add('visible');

    chip.addEventListener('click', () => {
        window.location.href = 'books.html';
    });
}

// ─────────────────────────────────────────────────────────────────────────────
// PAGE MODE — called from books.html
// ─────────────────────────────────────────────────────────────────────────────

async function loadBooks() {
    const stored = localStorage.getItem(BOOKS_STORAGE_KEY);
    if (stored) {
        try {
            booksCache = JSON.parse(stored);
            return;
        } catch (e) {
            console.warn('[BOOKS] Bad localStorage data, re-seeding');
        }
    }
    // First visit — seed from JSON
    try {
        const res = await fetch('js/books.json');
        booksCache = await res.json();
        saveBooks();
    } catch (e) {
        console.warn('[BOOKS] Failed to load seed data:', e.message);
        booksCache = [];
    }
}

function saveBooks() {
    localStorage.setItem(BOOKS_STORAGE_KEY, JSON.stringify(booksCache));
}

function updateBookCount() {
    const el = document.getElementById('books-count');
    if (el && booksCache) {
        el.textContent = `${booksCache.length} book${booksCache.length !== 1 ? 's' : ''}`;
    }
}

function renderBooksPage() {
    const tbody = document.getElementById('books-tbody');
    if (!tbody || !booksCache) return;

    // Sort by date descending (most recent first), undated at bottom
    const sorted = [...booksCache].sort((a, b) => {
        if (!a.date && !b.date) return 0;
        if (!a.date) return 1;
        if (!b.date) return -1;
        return new Date(b.date) - new Date(a.date);
    });

    tbody.innerHTML = sorted.map((book, sortIdx) => {
        // Find the actual index in booksCache for edits
        const realIdx = booksCache.indexOf(book);
        const barWidth = (Math.min(Math.max(book.rating || 0, 0), 10) / 10) * 100;
        return `<tr data-idx="${realIdx}">
            <td class="books-col-title">
                <input type="text" class="books-input-title" value="${esc(book.title)}" data-field="title" data-idx="${realIdx}">
            </td>
            <td class="books-col-author">
                <input type="text" class="books-input-author" value="${esc(book.author)}" data-field="author" data-idx="${realIdx}">
            </td>
            <td class="books-col-date">
                <input type="text" class="books-input-date" value="${esc(book.date)}" data-field="date" data-idx="${realIdx}" placeholder="—">
            </td>
            <td class="books-col-rating">
                <div class="books-rating-cell">
                    <input type="number" min="1" max="10" value="${book.rating || ''}" data-field="rating" data-idx="${realIdx}">
                    <div class="books-rating-bar"><div class="books-rating-fill" style="width:${barWidth}%"></div></div>
                </div>
            </td>
            <td class="books-col-notes">
                <input type="text" class="books-input-notes" value="${esc(book.notes)}" data-field="notes" data-idx="${realIdx}" placeholder="—">
            </td>
            <td class="books-col-delete">
                <button class="books-delete-btn" data-idx="${realIdx}" title="Remove">&times;</button>
            </td>
        </tr>`;
    }).join('');

    updateBookCount();
}

function esc(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function handleFieldBlur(e) {
    const input = e.target;
    if (!input.dataset || !input.dataset.field) return;

    const idx = parseInt(input.dataset.idx, 10);
    const field = input.dataset.field;
    if (isNaN(idx) || !booksCache[idx]) return;

    let val = input.value.trim();
    if (field === 'rating') {
        val = parseInt(val, 10);
        if (isNaN(val) || val < 1) val = 1;
        if (val > 10) val = 10;
        input.value = val;
        // Live-update the bar next to this input
        const bar = input.closest('.books-rating-cell')?.querySelector('.books-rating-fill');
        if (bar) bar.style.width = `${(val / 10) * 100}%`;
    }

    booksCache[idx][field] = val;
    saveBooks();
}

function handleRatingInput(e) {
    const input = e.target;
    if (input.dataset.field !== 'rating') return;
    let val = parseInt(input.value, 10);
    if (isNaN(val)) return;
    if (val < 1) val = 1;
    if (val > 10) val = 10;
    const bar = input.closest('.books-rating-cell')?.querySelector('.books-rating-fill');
    if (bar) bar.style.width = `${(val / 10) * 100}%`;
}

function handleDelete(e) {
    const btn = e.target.closest('.books-delete-btn');
    if (!btn) return;

    const idx = parseInt(btn.dataset.idx, 10);
    if (isNaN(idx) || !booksCache[idx]) return;

    const row = btn.closest('tr');
    if (row) {
        row.classList.add('books-row-removing');
        setTimeout(() => {
            booksCache.splice(idx, 1);
            saveBooks();
            renderBooksPage();
        }, 200);
    }
}

function handleAddBook() {
    booksCache.push({
        title: '',
        author: '',
        date: '',
        rating: 5,
        notes: ''
    });
    saveBooks();
    renderBooksPage();

    // Focus the title input of the last row
    const tbody = document.getElementById('books-tbody');
    if (tbody) {
        const rows = tbody.querySelectorAll('tr');
        const lastRow = rows[rows.length - 1];
        if (lastRow) {
            const titleInput = lastRow.querySelector('.books-input-title');
            if (titleInput) titleInput.focus();
        }
    }
}

async function initBooksPage() {
    await loadBooks();
    renderBooksPage();

    const tbody = document.getElementById('books-tbody');
    if (tbody) {
        // Delegated blur handler for all inputs
        tbody.addEventListener('focusout', handleFieldBlur);
        // Live rating bar update on input
        tbody.addEventListener('input', handleRatingInput);
        // Delegated click handler for delete buttons
        tbody.addEventListener('click', handleDelete);
    }

    const addBtn = document.getElementById('books-add-row');
    if (addBtn) {
        addBtn.addEventListener('click', handleAddBook);
    }
}
