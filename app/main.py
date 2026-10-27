from fastapi import FastAPI, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
from app.database import get_supabase_client
from app.solver.runner import execute_solver_job

app = FastAPI(title="Timetable Solver Service (Render)", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class GenerateRequest(BaseModel):
    job_id: Optional[str] = None

@app.get("/")
def health_check():
    return {"status": "online", "engine": "Google OR-Tools CP-SAT"}

@app.post("/api/generate-timetable", status_code=202)
async def generate_timetable(payload: GenerateRequest, background_tasks: BackgroundTasks):
    supabase = get_supabase_client()

    job_id = payload.job_id
    if not job_id:
        res = supabase.table("generation_jobs").insert({
            "status": "queued",
            "progress_message": "Permintaan diterima oleh Render Solver..."
        }).execute()
        job_id = res.data[0]["id"]

    background_tasks.add_task(execute_solver_job, job_id)

    return {
        "status": "accepted",
        "job_id": job_id,
        "message": "Kalkulasi jadwal berjalan di latar belakang."
    }
