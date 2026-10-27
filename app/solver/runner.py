import time
from app.database import get_supabase_client
from app.solver.engine import solve_school_timetable

def execute_solver_job(job_id: str = None):
    supabase = get_supabase_client()
    start_time = time.time()

    # Jika job_id belum ada (misal dipicu manual), buat baris baru di generation_jobs
    if not job_id:
        res = supabase.table("generation_jobs").insert({
            "status": "processing",
            "progress_message": "Memulai kalkulasi jadwal..."
        }).execute()
        job_id = res.data[0]["id"]
    else:
        supabase.table("generation_jobs").update({
            "status": "processing",
            "progress_message": "Mengambil data master dan menyusun matriks jadwal..."
        }).eq("id", job_id).execute()

    try:
        work_days = supabase.table("work_days").select("*").execute().data
        time_slots = supabase.table("time_slots").select("*").execute().data
        teachers = supabase.table("teachers").select("*").execute().data
        classes = supabase.table("classes").select("*").execute().data
        rooms = supabase.table("rooms").select("*").execute().data
        lessons = supabase.table("lessons").select("*").execute().data

        if not lessons or not time_slots:
            raise ValueError("Tabel lessons atau time_slots masih kosong.")

        result = solve_school_timetable(
            work_days=work_days,
            time_slots=time_slots,
            teachers=teachers,
            classes=classes,
            rooms=rooms,
            lessons=lessons
        )

        elapsed_ms = int((time.time() - start_time) * 1000)

        if result["status"] == "SUCCESS":
            supabase.table("schedules").delete().neq("id", "00000000-0000-0000-0000-000000000000").execute()

            records = [{**row, "job_id": job_id} for row in result["schedule"]]
            if records:
                supabase.table("schedules").insert(records).execute()

            supabase.table("generation_jobs").update({
                "status": "completed",
                "progress_message": result["message"],
                "execution_time_ms": elapsed_ms
            }).eq("id", job_id).execute()
        else:
            supabase.table("generation_jobs").update({
                "status": "failed",
                "progress_message": result["message"],
                "execution_time_ms": elapsed_ms
            }).eq("id", job_id).execute()

    except Exception as e:
        supabase.table("generation_jobs").update({
            "status": "failed",
            "progress_message": f"Kesalahan sistem: {str(e)}"
        }).eq("id", job_id).execute()
