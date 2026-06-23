import shutil
from contextlib import asynccontextmanager

from fastapi import BackgroundTasks, FastAPI, HTTPException
from fastapi.concurrency import run_in_threadpool
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel

from src.config import PAPERS_ROOT, pdf_path
from src.rag import pipeline
from src.services import ingest


@asynccontextmanager
async def lifespan(app: FastAPI):
    # papers/ is an ephemeral scratch dir: created on startup, wiped on shutdown
    # (fires on SIGTERM, i.e. `docker compose down`).
    PAPERS_ROOT.mkdir(parents=True, exist_ok=True)
    try:
        yield
    finally:
        shutil.rmtree(PAPERS_ROOT, ignore_errors=True)


app = FastAPI(lifespan=lifespan)

origins = [
    "http://localhost",
    "http://localhost:3000",
    "http://localhost:8000",
    "http://127.0.0.1",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:8000",
    "http://0.0.0.0",
    "http://0.0.0.0:3000",
    "http://0.0.0.0:8000",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class IngestRequest(BaseModel):
    url: str
    req_id: str


class ChatRequest(BaseModel):
    req_id: str
    message: str
    highlight: str | None = None


@app.get("/")
async def root():
    return {"message": "The server is up and running!"}


@app.post("/ingest", status_code=202)
async def start_ingest(payload: IngestRequest, background: BackgroundTasks):
    if ingest.get_status(payload.req_id):
        return {"req_id": payload.req_id, "status": "already_started"}
    # Seed status synchronously so an immediate /status poll sees it.
    ingest.seed(payload.req_id)
    background.add_task(ingest.run_ingestion, payload.req_id, payload.url)
    return {"req_id": payload.req_id, "status": "downloading"}


@app.get("/status/{req_id}")
async def status(req_id: str):
    state = ingest.get_status(req_id)
    if not state:
        raise HTTPException(status_code=404, detail="Unknown req_id")
    return state


@app.get("/pdf/{req_id}")
async def get_pdf(req_id: str):
    path = pdf_path(req_id)
    if not path.exists():
        raise HTTPException(status_code=404, detail="PDF not available yet")
    return FileResponse(str(path), media_type="application/pdf", filename="paper.pdf")


@app.post("/chat")
async def chat(payload: ChatRequest):
    if not ingest.is_ready(payload.req_id):
        raise HTTPException(status_code=409, detail="Paper is not ready yet")
    result = await run_in_threadpool(
        pipeline.chat, payload.req_id, payload.message, payload.highlight
    )
    return {
        "answer": result.answer,
        "citations": [{"page": c.page, "section_path": c.section_path} for c in result.citations],
    }
