# 0500

A personal dashboard for setting goals and planning the day, inspired by the way I organize my notebook.

[Open the app](https://0500app.vercel.app)

## Features

- Daily and longer-term goals, weekly progress tracking, and reviews
- Daily schedule, focus timer, and notes
- Sleep tracking and analytics
- Bookshelf, people directory, and optional Strava fitness integration
- Weather, world clocks, and an interactive globe
- Browser-local persistence, optional Supabase sign-in and cloud sync, and a service worker

## Run locally

Requires Python 3. No package installation or build step is needed.

```sh
git clone https://github.com/panostzan/0500-dashboard.git
cd 0500-dashboard
python -m http.server 8000 --bind 127.0.0.1
```

Open http://localhost:8000. Use a local server rather than opening HTML files directly. Some features load libraries and data from external services and require an internet connection.

The interface is primarily designed for desktop. Anonymous use stores data in the current browser and origin; it does not automatically transfer between localhost and the hosted app.

## Project structure

| Path | Purpose |
| --- | --- |
| `index.html` | Main dashboard |
| `sleep.html`, `analytics.html` | Sleep tracking and analytics |
| `books.html`, `people.html`, `fitness.html` | Dedicated feature pages |
| `js/` | Feature modules and data access |
| `css/` | Shared styles and page themes |
| `js/config.js` | Default location, timer presets, and world clocks |
| `js/data.js` | Browser storage and cloud persistence |
| `js/supabase.js`, `js/auth.js` | Supabase client and authentication |
| `sw.js`, `manifest.json` | Service worker and PWA metadata |
| `tests/` | Browser smoke test |

## Data and integrations

The hosted app uses Supabase for authentication and selected synced data. Browser-only features retain their data locally. The bundled bookshelf provides initial content; it is not a database export of live users.

For an independent deployment, configure your own Supabase project in `js/supabase.js`, including authentication redirects, tables, and row-level policies. Database migrations are not included, so cloud sync is not a one-command setup. The existing public client key is not an administrator credential; do not use the maintainer's backend for your own deployment.

Weather uses Open-Meteo. Strava is optional and configured through the interface; the current personal-use integration stores supplied credentials in browser local storage. Use it only in a trusted browser. See [SECURITY.md](SECURITY.md) for the data boundary and credential guidance.

## Verification

The existing smoke test needs a recent Node.js release with a global WebSocket implementation and Google Chrome:

```sh
node tests/weekly-goals.browser.mjs
```

On systems where Chrome is not at the default Windows location, set `CHROME_PATH` to its executable. The test uses a separate temporary browser profile and blocks external traffic; it does not use your signed-in browser session.

## Deployment

The app is a static site hosted on Vercel with no build step. Keep personal backups, exports, credentials, and local browser data outside published files. Changes to browser storage keys, the service worker, or cloud schemas require care to preserve existing users' data.
