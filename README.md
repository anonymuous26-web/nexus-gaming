# Nexus Gaming Marketplace

The codebase is separated into two independent runnable applications:

- [`frontend/`](frontend) — Next.js 14 (App Router) + React + Tailwind CSS + Firebase Client SDK
- [`backend/`](backend) — Node.js + Express API server + Firebase Admin SDK + Cloudinary + Gemini AI

## Running the Backend

```bash
cd backend
npm install
npm run dev
```

Runs on `http://localhost:5000` by default (configured via `backend/.env`).

## Running the Frontend

```bash
cd frontend
npm install
npm run dev
```

Runs on `http://localhost:3000` by default and communicates with the backend via `NEXT_PUBLIC_API_URL` in `frontend/.env.local`.
