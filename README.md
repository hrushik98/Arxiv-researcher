# Arxiv Researcher

Read any arxiv paper side-by-side with an AI assistant. Paste an arxiv link,
the app downloads the PDF, builds a production-grade RAG index over it, and lets
you chat with the paper — including **Highlight & Ask** (select text in the PDF
and ask about it). The PDF renders on the left (70%) and the chat on the
right (30%).

## Architecture

- **Frontend** — Next.js 16 (App Router). Email/password auth backed by Neon
  Postgres (bcrypt + signed httpOnly JWT cookie). PDF rendered with `react-pdf`.
- **Backend** — FastAPI. Downloads only the PDF, then runs a modular RAG
  pipeline.
- **RAG** — per-paper **embedded Qdrant** index stored at
  `papers/<req_id>/qdrant/`:
  - Extraction: PyMuPDF (per-page text + section paths from the TOC).
  - Chunking: token-aware (200–300 tokens, max 400, ~15% overlap) with metadata.
  - Embeddings: FastEmbed dense `BAAI/bge-small-en-v1.5` + sparse `Qdrant/bm25`.
  - Retrieval: hybrid dense+sparse, **weighted RRF (0.7 / 0.3)**, adjacent-chunk
    expansion, cross-encoder reranking.
  - Generation: Google **Gemini `gemini-3.5-flash`**.
- **Ephemeral storage** — `papers/` is created on backend startup and deleted on
  shutdown, so all PDFs and indexes vanish when the container stops.

## Setup

### 1. Environment variables

`backend/.env` (see `backend/.env.example`):

```
GEMINI_API_KEY=your-gemini-api-key
```

`frontend/.env` (see `frontend/.env.example`):

```
NEON_DB_URL=postgresql://...        # Neon Postgres connection string
JWT_SECRET=<long-random-string>     # e.g. `openssl rand -hex 32`
NEXT_PUBLIC_BACKEND_URL=http://localhost:8000
```

### 2. Database migration (creates the `users` table)

```bash
cd frontend
bun install
bun run db/migrate.ts
```

## Run

### Docker (recommended)

```bash
docker compose up --build
```

Frontend: http://localhost:3000 · Backend: http://localhost:8000

`docker compose down` removes the container and the ephemeral `papers/` dir.

### Local dev

```bash
# Backend
cd backend && uv sync && uv run uvicorn main:app --reload --port 8000

# Frontend (separate terminal)
cd frontend && bun install && bun run dev
```

## Usage

1. Sign up / log in.
2. Paste an arxiv link (e.g. `https://arxiv.org/abs/1706.03762`).
3. Wait for download + indexing, then read the PDF and chat with it.
4. Highlight any passage and click **✨ Ask AI** to ask about it.

> First chat after startup is slower while FastEmbed downloads the embedding /
> reranker models into the cache.
