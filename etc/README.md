# Timeseries Dashboard Migration

React + FastAPI replacement for the original Streamlit dashboard.

## Backend (FastAPI)

Requirements: Python 3.10+

```bash
pip install -r requirements.txt
py -m uvicorn api:app --reload --port 8000
```

Health check: <http://localhost:8000/health>

Main endpoints:

- `GET /filters/options`
- `POST /data/query`
- `POST /notes/load`
- `POST /notes/save`

## Frontend (React + Vite + TS)

From project root:

```bash
cd frontend
npm install
npm run dev -- --port 5173
```

Open <http://localhost:5173>.

Environment variables (optional) – create `frontend/.env.local`:

```
VITE_API_BASE_URL=http://localhost:8000
```

## Notes

- API responses include timing metrics (`metrics.total_ms`, etc.) to help diagnose bottlenecks.
- Charts use ECharts with virtual scrolling; data is grouped per `variant_id` + `pattern`.
- Notes are stored per `variant_id` in `notes.db`.

