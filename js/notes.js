// ═══════════════════════════════════════════════════════════════════════════════
// NOTES — Floating card with cloud sync
// ═══════════════════════════════════════════════════════════════════════════════

let notesCache = null;
let saveTimeout = null;

async function loadNotesContent() {
    if (notesCache === null) {
        notesCache = await DataService.loadNotes();
    }
    return notesCache;
}

async function saveNotesContent(content) {
    notesCache = content;
    clearTimeout(saveTimeout);
    saveTimeout = setTimeout(async () => {
        await DataService.saveNotes(content);
    }, 500);
}

// Flush pending debounced save immediately (called before sign-out / page unload)
async function flushNotesSave() {
    if (saveTimeout) {
        clearTimeout(saveTimeout);
        saveTimeout = null;
        await DataService.saveNotes(notesCache);
    }
}

async function getNotesPreview() {
    const notes = await loadNotesContent();
    if (!notes.trim()) return '';
    const lines = notes.split('\n').filter(l => l.trim()).length;
    if (lines > 0) {
        return `${lines} line${lines !== 1 ? 's' : ''}`;
    }
    return '';
}

async function updateNotesChip() {
    const chipValue = document.getElementById('chip-notes-count');
    if (chipValue) {
        chipValue.textContent = await getNotesPreview();
    }
}

function openNotesCard() {
    const card = document.getElementById('notes-card');
    const chip = document.getElementById('chip-notes');
    const input = document.getElementById('notes-input');
    card.classList.add('open');
    chip.classList.add('active');
    setTimeout(() => input.focus(), 100);
}

function closeNotesCard() {
    const card = document.getElementById('notes-card');
    const chip = document.getElementById('chip-notes');
    card.classList.remove('open');
    chip.classList.remove('active');
    updateNotesChip();
}

async function initNotes() {
    const chip = document.getElementById('chip-notes');
    const card = document.getElementById('notes-card');
    const input = document.getElementById('notes-input');

    // Load saved content
    input.value = await loadNotesContent();
    await updateNotesChip();

    // Toggle card on chip click
    chip.addEventListener('click', async () => {
        if (card.classList.contains('open')) {
            closeNotesCard();
        } else {
            input.value = await loadNotesContent();
            openNotesCard();
        }
    });

    // Close on outside click
    document.addEventListener('click', (e) => {
        if (card.classList.contains('open') && !chip.contains(e.target) && !card.contains(e.target)) {
            closeNotesCard();
        }
    });

    // Close on Escape
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && card.classList.contains('open')) {
            closeNotesCard();
        }
    });

    // Auto-save on input
    input.addEventListener('input', () => {
        saveNotesContent(input.value);
    });

    // Re-load when user changes
    window.addEventListener('userChanged', async () => {
        notesCache = null;
        input.value = await loadNotesContent();
        await updateNotesChip();
    });
}
