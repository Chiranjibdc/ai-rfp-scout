# AI RFP Scout

Enterprise web application that helps **IT services firms, BPOs, consulting companies, and MSPs** discover, qualify, and analyze RFPs.

## Features

| Page | Purpose |
|------|---------|
| **Dashboard** | KPI cards, proposal status donut, country/industry charts, deadlines |
| **RFP Search** | Filters (country, industry, service, value, deadline, keywords), sortable table, pagination |
| **Opportunity Details** | Go/No-Go worksheet (weighted criteria + approver), requirements, risks, match score /100 |
| **Company Profile** | Editable profile (services, countries, certs, case studies) saved in-browser for RFP match scoring |
| **Proposal Workspace** | Rich-text sections, AI assist, Word/HTML/TXT document export |
| **Compliance Matrix** | Upload RFP, track requirement / page / status / owner / due date / comments, export Excel |
| **Settings** | Notifications, search prefs, team, integrations |

## Theme

Professional **blue & white** enterprise UI with:

- Fixed left navigation
- Responsive layout (desktop → tablet → mobile)
- Sticky top bar with global search
- Cards, tables, badges, and progress indicators

## Authentication

- **Register:** full name, email, password, confirm password, optional company & role  
- **Log in:** email, password, remember me  
- Passwords are hashed (SHA-256 + salt) and stored only in this browser’s `localStorage`  
- **Log out** is available in the sidebar footer  

## Backend API

A production-ready **FastAPI + PostgreSQL** backend lives in [`backend/`](backend/).

- Swagger docs: `http://localhost:8000/docs`
- See **[backend/README.md](backend/README.md)** for structure, env vars, Docker, and Render/Railway/Azure deploy.

```bash
cd backend
copy .env.docker .env    # Windows — optional defaults
docker compose up --build
```

Full guide: **[backend/DOCKER.md](backend/DOCKER.md)** (Postgres + volumes + env vars).

## How to run (frontend)

No build step or server required for the static UI.

1. Open `index.html` in a modern browser (Chrome, Edge, Firefox).
2. Register an account, then log in.
3. Or serve the folder with any static server, for example:

```powershell
cd "C:\Users\2024\Desktop\My Apps\ai-rfp-scout"
# If Python is available:
python -m http.server 8080
```

Then visit `http://localhost:8080`.

## Web hosting

The root [`render.yaml`](render.yaml) deploys the frontend and FastAPI backend
as one web service, so browser API calls use the same origin and no production
API URL is embedded in the frontend. Connect this repository to Render with the
blueprint. The blueprint provisions PostgreSQL for `DATABASE_URL` and a
persistent disk for uploaded RFP documents. Set `CORS_ORIGINS` only if you later
host the frontend on a different HTTPS origin.

For a separately hosted static frontend, set `window.APP_CONFIG.API_BASE`
before `js/config.js` loads, or open it once with
`?apiBase=https://your-api.example.com`; the selected API URL is retained in
browser storage. Add that frontend origin to the API's `CORS_ORIGINS`.

## Project structure

```
ai-rfp-scout/
├── index.html          # App shell
├── css/
│   └── styles.css      # Enterprise theme + responsive rules
├── js/
│   ├── data.js         # Sample RFPs, company profile, matrix
│   └── app.js          # Routing, pages, interactions
└── README.md
```

## Starting data

The app starts clean (no sample RFPs or company profile). Team members: **Chitra**, **Manoj**, **Chiranjib**, **John**. Enter your own company profile and RFPs to begin.

## Browser support

Modern evergreen browsers (Chrome, Edge, Firefox, Safari). Uses CSS Grid, Flexbox, and ES6+.
