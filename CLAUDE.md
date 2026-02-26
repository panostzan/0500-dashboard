# 0500 Morning Dashboard

Desktop-only productivity PWA with a cinematic sunrise aesthetic. Globe-centered design, ambient UI, warm color palette.

## Quick Start

```bash
# Serve locally (any static server works)
npx serve .
# or
python -m http.server 8000
```

Open `index.html` in browser. No build step required.

## Architecture

**Single-page vanilla JS app** with modular architecture. No framework, no bundler.

```
0500/
├── index.html          # Main app (all HTML structure)
├── sleep.html          # Standalone sleep page (96KB - separate entry)
├── manifest.json       # PWA manifest
├── sw.js               # Service worker for offline/caching
├── css/
│   ├── styles.css      # Main styles
│   └── sleep-theme.css # Sleep page styles
├── js/
│   ├── config.js       # User configuration (goals, schedule, location)
│   ├── data.js         # DataService - abstracts Supabase/localStorage
│   ├── supabase.js     # Supabase client init
│   ├── auth.js         # Authentication UI/logic
│   ├── main.js         # App initialization, service worker registration
│   ├── goals.js        # Goals section (daily/mid-term/long-term)
│   ├── schedule.js     # Notebook-style schedule
│   ├── sleep.js        # Sleep tracking core functions
│   ├── timer.js        # Pomodoro focus timer
│   ├── weather.js      # Weather integration (Open-Meteo API)
│   ├── globe.js        # 3D dotted globe (canvas)
│   ├── hud.js          # HUD overlay elements
│   ├── clock.js        # Time display
│   ├── notes.js        # Notes modal
│   └── animations.js   # Shared animation utilities
└── icons/              # PWA icons and splash screens
```

## Data Layer

`DataService` in `data.js` abstracts storage:
- **Signed in** → Supabase (cloud sync)
- **Anonymous** → localStorage (prefixed with `0500_`)

All data functions are async. Key methods:
- `DataService.loadGoals()` / `insertGoal(category, text, sortOrder)` / `updateGoal(id, updates)` / `deleteGoal(id)` / `uncheckDailyGoals()`
- `DataService.loadSchedule()` / `saveSchedule(entries)`
- `DataService.loadSleepLog()` / `saveSleepLog(log)` / `addSleepEntry(entry)`
- `DataService.loadNotes()` / `saveNotes(content)`

localStorage keys: `0500_goals`, `0500_schedule_entries`, `0500_sleep_log`, `0500_sleep_settings`, `0500_notes`, `0500_goals_collapsed`

## Key Patterns

### Goals Structure
```js
{
  daily: [{ text: "...", checked: false }],
  midTerm: [{ text: "...", checked: false }],    // "3 MONTH" in UI
  oneYear: [{ text: "...", checked: false }],    // "1 YEAR" in UI
  longTerm: [{ text: "...", checked: false }]
}
```

### Schedule Structure
```js
[
  { time: "5:00", activity: "Wake up" },
  { time: "5:30", activity: "Workout" },
  // ... 20 rows default
]
```

### Sleep Entry
```js
{
  date: "2025-01-27",
  bedtime: "2025-01-26T22:00:00",
  wakeTime: "2025-01-27T05:00:00",
  hours: 7
}
```

## UI Components

| Component | Location | Notes |
|-----------|----------|-------|
| Goals panel | Left side | 4 collapsible sections (Daily, 3 Month, 1 Year, Long-Term), inline edit |
| Globe | Center | Canvas-based dotted globe with location highlight |
| Schedule | Right side | Notebook-style, HUD frame aesthetic |
| Timer bar | Below globe | Preset buttons (5/10/15/25 min) |
| Bottom chips | Footer | Notes button, sync indicator, REST (sleep) button |
| Sleep page | `sleep.html` | Full sleep dashboard (standalone page via REST chip) |
| Timer overlay | Fullscreen | Focus mode with large globe |

## Design Tokens

```css
--bg-dark: #0f0a12
--accent: #ffb090 (warm sunrise orange)
--text-primary: rgba(255, 255, 255, 0.9)
--text-muted: rgba(255, 255, 255, 0.5)
```

Fonts: Orbitron (headers/clock), Inter (body)

## Version History

- **v1.1** ✓ Data persistence (localStorage)
- **v1.2** 🔜 Customizable goals & schedule UI (drag-and-drop pending)
- **v1.3** ✓ Weather integration (Open-Meteo, sunrise/sunset)
- **v1.4** Calendar integration (Google/Apple)
- **v2.0** Public launch on Vercel (auth, cloud sync, onboarding)

## Current State

Goals and schedule already support:
- Add/edit/delete via inline editing
- Persistence (local + cloud)

Still needed for v1.2:
- Drag-and-drop reordering for goals
- Drag-and-drop reordering for schedule rows

## External APIs

- **Open-Meteo** - Weather data (no API key needed)
- **Supabase** - Auth + database (credentials in supabase.js)

## Testing

No test suite currently. Manual testing in browser.

To test PWA:
1. Serve over HTTPS or localhost
2. Check Application tab in DevTools for service worker
3. Test offline mode

## Conventions

- Cache busting via query params: `styles.css?v=11`
- All localStorage keys prefixed with `0500_`
- Async/await for all data operations
- Event-driven updates: `window.addEventListener('userChanged', ...)`
- No emojis in code/comments (UI exceptions: sleep buttons 🌙 ☀️)
