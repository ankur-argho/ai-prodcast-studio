# ai-prodcast-studio
AI Podcast Studio is a full-stack web app for creating podcast content faster using AI. It supports idea brainstorming via chat, structured script generation, and local history management with SQLite. Built with React, TypeScript, Node.js, and Express, it keeps API keys secure on the server while providing a smooth, single-page writing workflow.

## Deploying with Vercel + Railway

Recommended setup:

- Vercel hosts the frontend at `https://yourdomain.com`
- Railway hosts the API at `https://api.yourdomain.com`

### Frontend on Vercel

Set this environment variable in Vercel:

- `VITE_API_BASE_URL=https://api.yourdomain.com`

Build settings:

- Build command: `npm run build`
- Output directory: `dist`

### Backend on Railway

Railway can run the API with:

- Start command: `npm start`

Set these environment variables in Railway:

- `OPENROUTER_API_KEY=...`
- `OPENROUTER_MODEL=openrouter/auto` or your preferred model
- `OPENROUTER_SITE_URL=https://yourdomain.com`
- `OPENROUTER_SITE_NAME=AI Podcast Studio`
- `CORS_ORIGINS=http://localhost:5174,https://yourdomain.com`

Optional:

- `DB_PATH=../data/history.db`

### Important note about history storage

Saved history currently uses local SQLite via `better-sqlite3`. That is fine for local development and can work on Railway only if you attach persistent storage correctly. For more reliable production history, move this to a hosted database later.
