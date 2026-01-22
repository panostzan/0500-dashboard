// ═══════════════════════════════════════════════════════════════════════════════
// NOTES — Modal with localStorage persistence
// ═══════════════════════════════════════════════════════════════════════════════

const NOTES_STORAGE_KEY = '0500_notes';

function loadNotes() {
    return localStorage.getItem(NOTES_STORAGE_KEY) || '';
}

function saveNotes(content) {
    localStorage.setItem(NOTES_STORAGE_KEY, content);
}

function getNotesPreview() {
    const notes = loadNotes();
    if (!notes.trim()) return '';

    // Count lines or show character count
    const lines = notes.split('\n').filter(l => l.trim()).length;
    if (lines > 0) {
        return `${lines} line${lines !== 1 ? 's' : ''}`;
    }
    return '';
}

function updateNotesChip() {
    const chipValue = document.getElementById('chip-notes-count');
    if (chipValue) {
        chipValue.textContent = getNotesPreview();
    }
}

function openNotesModal() {
    const modal = document.getElementById('notes-modal');
    const input = document.getElementById('notes-input');

    modal.classList.add('active');
    document.body.style.overflow = 'hidden';

    // Focus input after animation
    setTimeout(() => input.focus(), 300);
}

function closeNotesModal() {
    const modal = document.getElementById('notes-modal');
    modal.classList.remove('active');
    document.body.style.overflow = '';
    updateNotesChip();
}

function initNotes() {
    const chip = document.getElementById('chip-notes');
    const modal = document.getElementById('notes-modal');
    const backdrop = modal.querySelector('.modal-backdrop');
    const closeBtn = document.getElementById('notes-modal-close');
    const input = document.getElementById('notes-input');

    // Load saved content
    input.value = loadNotes();
    updateNotesChip();

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

    // Auto-save on input
    input.addEventListener('input', () => {
        saveNotes(input.value);
    });
}
