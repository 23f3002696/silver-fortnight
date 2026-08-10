# Silver Fortnight — Trekking Management Application

A full-stack web application for trekking organizations to move away from spreadsheets, phone calls, and manual coordination. It centralizes trek creation, staff assignment, participant registration, slot management, and booking tracking into a single system, built with Flask, SQLAlchemy, Vue 3, and Bootstrap 5.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Backend | Python, Flask, SQLAlchemy |
| Frontend | Vue 3 + Vue Router (CDN, no build step), Bootstrap 5.3, Bootstrap Icons, Chart.js, Axios |
| Database | SQLite |
| Auth | JWT (Flask-JWT-Extended) |
| Caching | Flask-Caching with Redis |
| Background Jobs | Celery with Redis broker (scheduled + on-demand tasks) |
| Email | SMTP (localhost:1025 in development — works with MailHog) |

---

## Features

### Three Roles

**Admin**
- Create, edit, approve, and delete trekking routes
- Onboard trek staff and activate/deactivate their accounts
- Assign staff to treks
- Oversee all users and bookings
- Dashboard with booking stats and analytics charts
- Receives a monthly activity report by email

**Trek Staff**
- Manage only the treks assigned to them
- Update available slots and open/close treks
- Track trek completion status
- View the list of registered participants for their treks

**User (Trekker)**
- Register and log in
- Browse and filter open treks by difficulty, location, or duration
- Book available slots in one click
- Cancel bookings and track booking status and trekking history
- Export booking history to CSV (generated as a background job)
- Receive booking confirmation/cancellation notifications and pre-trek reminder emails

---

## Core System Rules

- No overbooking — bookings beyond available slots are rejected
- Staff can only manage treks assigned to them
- Bookings are only allowed on treks marked **Open**
- Duplicate bookings for the same trek by the same user are blocked

Trek lifecycle: `pending → approved → open → closed → completed`
Booking lifecycle: `booked → cancelled / completed`

---

## Project Structure

```
silver-fortnight/
├── backend/
│   ├── app.py                       # Flask app factory + CLI commands + Celery schedule
│   ├── celery_config.py             # Celery configuration
│   ├── openapi.yaml                 # API specification
│   ├── requirements.txt             # Direct dependencies
│   ├── instance/
│   │   └── silver-fortnight.db      # SQLite database (created via init-db)
│   └── application/
│       ├── config.py                # Environment config + cache TTLs
│       ├── constants.py             # Roles and status enums
│       ├── database.py              # SQLAlchemy setup
│       ├── models.py                # SQLAlchemy models
│       ├── routes.py                # All API route handlers
│       ├── security.py              # JWT setup and role guards
│       ├── cache.py                 # Flask-Caching setup and invalidation helpers
│       ├── celery_init.py           # Celery app factory
│       ├── mail.py                  # SMTP email helpers
│       └── tasks.py                 # Reminders, monthly report, CSV export
└── frontend/
    ├── templates/
    │   └── index.html               # SPA shell (Vue + Bootstrap via CDN)
    └── static/js/
        ├── app.js                   # Vue app bootstrap
        ├── router.js                # Vue Router routes + guards
        ├── api.js                   # Axios client
        ├── auth.js                  # JWT token handling
        ├── charts.js                # Chart.js helpers
        └── views/                   # Login, Register, Landing, admin/, user/, staff views
```

---

## Setup

### 1. Clone and create virtual environment

```bash
git clone <your-repo-url>
cd silver-fortnight/backend
python -m venv .venv  # If uv is installed: uv venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate
```

### 2. Install dependencies

```bash
pip install -r requirements.txt  # If uv is installed: uv pip install -r requirements.txt
```

### 3. Start Redis

Redis is required for Celery and used for caching. Defaults assume `redis://localhost:6379`:

| Redis DB | Purpose | Env var override |
|---|---|---|
| 0 | Celery broker | `CELERY_BROKER_URL` |
| 1 | Celery result backend | `CELERY_RESULT_BACKEND` |
| 2 | Flask-Caching | `CACHE_REDIS_URL` |

```bash
redis-server
```

> If Redis is unavailable, the cache layer falls back to in-memory SimpleCache, but Celery tasks (reminders, reports, CSV exports) will not run.

### 4. Initialize the database and create accounts

```bash
flask --app app init-db
flask --app app create-admin                              # defaults: admin / admin
flask --app app create-staff --username <u> --email <e> --password <p>  # optional
flask --app app seed-demo                                 # optional: demo accounts, treks, bookings
```

Trekker accounts self-register through the UI.

### 5. Run the application

Three processes are needed in development:

```bash
# Terminal 1 — Flask API + frontend (from backend/)
flask --app app run # flask --app app run --port 5050

# Terminal 2 — Celery worker (from backend/)
celery -A app.celery worker --loglevel=info

# Terminal 3 — Celery beat for scheduled tasks (from backend/)
celery -A app.celery beat --loglevel=info
```

The app is served at `http://localhost:5000` — the Vue frontend is served directly by Flask, so no separate frontend build or server is needed.

### 6. Email (optional)

Emails are sent via SMTP at `localhost:1025` by default. Run MailHog (or a similar SMTP sink) to capture them during development:

```bash
mailhog   # UI at http://localhost:8025
```

Scheduled emails:
- **Daily at 08:00** — trek reminders sent 1 day ahead of a trek
- **Monthly (1st, 00:05)** — activity report to the admin

---

## Validation

Form inputs are validated on the frontend with Bootstrap validation and on the backend as a safety net. Key rules:

| Field | Rule |
|---|---|
| Username / email | Must be unique at registration |
| Trek status transitions | Must follow the lifecycle (`pending → approved → open → closed → completed`) |
| Booking | Trek must be `open`, slots must be available, no duplicate booking per user |
| Staff actions | Restricted to treks assigned to the acting staff member |

---

## Security Notes

- Passwords are hashed before storage — never kept in plain text
- JWT-based auth with 6-hour token expiry; token is attached to every API request via Axios
- Role guards protect every admin, staff, and user endpoint
- Staff accounts can be deactivated by the admin, blocking their access
- CORS is enabled for `/api/*` in development — restrict origins for production
- The default `JWT_SECRET_KEY` in `config.py` is for local development only — replace it (or read it from an environment variable) before deploying

---

## Requirements

```
flask==3.1.3
flask-jwt-extended==4.7.4
flask-sqlalchemy==3.1.1
flask-cors==6.0.5
celery==5.6.3
redis==6.4.0
flask-caching==2.4.1
```
