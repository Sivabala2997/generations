# Generations

A static family storytelling prototype for preserving memories, recipes, traditions, and life lessons. The main page provides story browsing, search, categories, favorites, story entry, reading, and accessibility controls. Login and signup are prototype flows.

## Project files

- `index.html` — main application markup and page-level script.
- `app.js` — browser interactions and local storage behavior.
- `data.js` — sample stories.
- `style.css` — main site styles.
- `login.html`, `signup.html`, `auth.css` — prototype authentication screens and styles.
- `color-sample.html` — standalone color exploration page; it labels itself as a sample.

## Run locally

There is no package manifest or build script in the project. Open `index.html` in a browser to view the site. If browser storage or navigation behaves differently from expected when opened as a file, serve this folder with any already-installed local static HTTP server and visit its `index.html`. No specific server command is assumed because none is configured here.

Google Fonts are loaded from Google Fonts when network access is available; system fonts are fallbacks.

## Using the guidance

Keep `AGENTS.md` and `PROMPTS.md` at the project root. Cursor can use `AGENTS.md` as project guidance; prompts can ask Cursor to read the relevant template in `PROMPTS.md`. Update these files only when the project structure, confirmed workflow, or team preferences change. Do not add setup commands here until they are verified against the project.
