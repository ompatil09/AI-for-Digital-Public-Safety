# Sentinel AI

Guidance for all future Codex tasks in this repository.

## Project Focus

Sentinel AI is a hackathon prototype for the problem statement:

**AI for Digital Public Safety: Defeating Counterfeiting, Fraud & Digital Arrest Scams.**

The product goal is to build a working local prototype that detects:

- Digital arrest scams
- Fake payment requests
- Suspicious messages
- UPI fraud
- Fake KYC messages
- Scam networks

## Core Prototype Flow

Build and preserve this flow one working feature at a time:

1. User enters a suspicious message.
2. Backend analyzes the message.
3. System returns scam type, risk score, red flags, extracted phone/UPI/link entities, and recommendation.
4. Report is saved.
5. Dashboard shows reports and analytics.
6. Fraud network graph shows connected scam entities.

## Required Backend Endpoints

The backend must expose these endpoints:

- `POST /api/analyze`
- `GET /api/reports`
- `GET /api/dashboard`
- `GET /api/graph`

## Tech Stack

Frontend:

- React + Vite
- Tailwind CSS
- Axios
- Recharts
- React Flow

Backend:

- FastAPI
- SQLite
- SQLAlchemy
- Pydantic

## Coding Rules

- Do not overbuild.
- Do not add features unless explicitly asked.
- Build one working feature at a time.
- Prefer simple, working code over complex architecture.
- Use mock data where real integrations are not available.
- Do not hardcode API keys.
- AI API usage must be optional.
- If no API key exists, use a rule-based fallback classifier.
- The app must run locally.
- Keep file structure clean.
- Add comments only where helpful.
- Do not invent unavailable APIs or datasets.

## Implementation Preferences

- Keep backend logic small and easy to inspect.
- Prefer deterministic rule-based scam detection before adding optional AI calls.
- Store analyzed reports in SQLite through SQLAlchemy models.
- Return predictable JSON responses that the frontend can render directly.
- Extract obvious scam entities such as phone numbers, UPI IDs, and links with simple parsing.
- Use React components that map clearly to the prototype screens: message analyzer, reports, dashboard, and graph.
- Use Recharts only for dashboard analytics.
- Use React Flow only for scam entity network visualization.

## Task Completion Checklist

After every coding task:

- List changed files.
- Run the app, build, or tests when possible.
- Mention any commands that could not be run.
- Keep the final response concise and focused on what changed.

