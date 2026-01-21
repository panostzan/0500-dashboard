// ═══════════════════════════════════════════════════════════════════════════════
// NOTES — Expandable quick notes with localStorage persistence
// ═══════════════════════════════════════════════════════════════════════════════

const NOTES_STORAGE_KEY = '0500_notes';
const NOTES_EXPANDED_KEY = '0500_notes_expanded';

function loadNotes() {
    return localStorage.getItem(NOTES_STORAGE_KEY) || '';
}

function saveNotes(content) {
    localStorage.setItem(NOTES_STORAGE_KEY, content);
}

function loadExpanded() {
    return localStorage.getItem(NOTES_EXPANDED_KEY) === 'true';
}

function saveExpanded(expanded) {
    localStorage.setItem(NOTES_EXPANDED_KEY, expanded);
}

function initNotes() {
    const card = document.getElementById('notes-card');
    const header = document.getElementById('notes-header');
    const input = document.getElementById('notes-input');

    // Load saved content
    input.value = loadNotes();

    // Restore expanded state
    if (loadExpanded()) {
        card.classList.add('expanded');
    }

    // Toggle expand/collapse
    header.addEventListener('click', () => {
        card.classList.toggle('expanded');
        saveExpanded(card.classList.contains('expanded'));

        // Focus input when expanding
        if (card.classList.contains('expanded')) {
            setTimeout(() => input.focus(), 300);
        }
    });

    // Auto-save on input
    input.addEventListener('input', () => {
        saveNotes(input.value);
    });

    // Collapse on Enter
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            card.classList.remove('expanded');
            saveExpanded(false);
            input.blur();
        }
    });
}
