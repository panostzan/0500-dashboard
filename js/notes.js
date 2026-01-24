// ═══════════════════════════════════════════════════════════════════════════════
// NOTES — Modal with cloud sync
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
    // Debounce saves to avoid too many API calls
    clearTimeout(saveTimeout);
    saveTimeout = setTimeout(async () => {
        await DataService.saveNotes(content);
    }, 500);
}

async function getNotesPreview() {
    const notes = await loadNotesContent();
    if (!notes.trim()) return '';

    // Count lines or show character count
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

async function openNotesModal() {
    const modal = document.getElementById('notes-modal');
    const input = document.getElementById('notes-input');

    modal.classList.add('active');
    document.body.style.overflow = 'hidden';

    // Load content
    input.value = await loadNotesContent();

    // Focus input after animation
    setTimeout(() => input.focus(), 300);
}

function closeNotesModal() {
    const modal = document.getElementById('notes-modal');
    modal.classList.remove('active');
    document.body.style.overflow = '';
    updateNotesChip();
}

async function initNotes() {
    const chip = document.getElementById('chip-notes');
    const modal = document.getElementById('notes-modal');
    const backdrop = modal.querySelector('.modal-backdrop');
    const closeBtn = document.getElementById('notes-modal-close');
    const input = document.getElementById('notes-input');

    // Load saved content
    input.value = await loadNotesContent();
    await updateNotesChip();

    // Open modal on chip click
    chip.addEventListener('click', openNotesModal);

    // Close modal
    closeBtn.addEventListener('click', closeNotesModal);
    backdrop.addEventListener('click', closeNotesModal);

    // Close on Escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && modal.classList.contains('active')) {
            closeNotesModal();
        }
    });

    // Remove readonly on focus (prevents iOS autofill popup)
    input.addEventListener('focus', () => {
        input.removeAttribute('readonly');
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
