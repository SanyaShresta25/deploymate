# DeployMate: Questions You Might Actually Ask

## What is this thing?
DeployMate is a tiny control panel for services. It lets you check if core services are alive, deploy one service with a click, and inspect recent logs.

## Who is this for?
People who run small systems and want a simple place to answer three urgent questions:
1. Is it up?
2. Can I redeploy it now?
3. What happened last time?

## What do I see when I open it?
A dashboard with cards for each service.
Each card shows:
- current status
- last deployed time
- deploy action
- show/hide logs action

There is also a summary strip (total services, running count, degraded/stopped count), a manual refresh button, and auto-refresh toggle.

## Where does the data come from?
From the Flask backend API:
- `GET /services` returns current service state
- `GET /summary` returns quick counts
- `POST /deploy/<service>` marks a service as deployed
- `GET /logs/<service>?limit=20` returns recent logs
- `POST /services/<service>/status` changes status (`running`, `stopped`, `degraded`)

## Is this production-ready?
Not yet. Current data is in-memory. Restarting the backend resets state and logs.

## How do I run it?
### Option 1: Docker Compose
```bash
docker compose up --build
```
- frontend: http://localhost:3000
- backend: http://localhost:5000

### Option 2: Run manually
Backend:
```bash
cd backend
pip install -r requirements.txt
python app.py
```

Frontend:
```bash
cd frontend
npm install
npm start
```

## Can I point frontend to another backend URL?
Yes.
Set:
```bash
REACT_APP_API_BASE_URL=http://your-host:5000
```
If not set, frontend defaults to `http://localhost:5000`.

## Why does this project exist?
Because every operations tool starts with a dashboard, but a useful one answers real questions fast.
