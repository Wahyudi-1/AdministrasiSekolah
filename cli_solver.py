import os
import sys
import time
from supabase import create_client, Client
from engine import solve_school_timetable

def main():
    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        raise ValueError("SUPABASE_URL dan SUPABASE_SERVICE_ROLE_KEY belum diatur di GitHub Secrets.")

    supabase: Client = create_client(url, key)
    start_time = time.time()

    # Ambil job_id dari argumen GitHub Actions, atau cari job berstatus 'queued' terbaru di Supabase
    job_id = sys.argv[1] if len(sys.argv) > 1 and sys.argv[1].strip() else None

    if not job_id:
        res = (
            supabase.table("generation_jobs")
            .select("id")
            .eq("status", "queued")
            .order("created_at", desc=True)
            .limit(1)
            .execute()
        )
        if res.data:
            job_id = res.data[0]["id"]
        else:
            # Buat job baru jika dipicu manual langsung dari tab GitHub Actions
            new_job = supabase.table("generation_jobs").insert({
                "status": "processing",
                "progress_message": "Menjalankan Solver di mesin GitHub Actions (RAM 7 GB)..."
            }).execute()
            job_id = new_job.data[0]["id"]

    try:
        supabase.table("generation_jobs").update({
            "status": "processing",
            "progress_message": "Mesin GitHub Actions aktif. Mengambil data & menghitung jadwal..."
        }).eq("id", job_id).execute()

        work_days = supabase.table("work_days").select("*").execute().data
        time_slots = supabase.table("time_slots").select("*").execute().data
        teachers = supabase.table("teachers").select("*").execute().data
        classes = supabase.table("classes").select("*").execute().data
        rooms = supabase.table("rooms").select("*").execute().data
        lessons = supabase.table("lessons").select("*").execute().data

        if not lessons or not time_slots:
            raise ValueError("Data pelajaran (lessons) atau slot waktu (time_slots) masih kosong.")

        # Panggil fungsi OR-Tools dari engine.py
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
            # Hapus jadwal lama yang tidak dikunci (is_locked = false)
            supabase.table("schedules").delete().eq("is_locked", False).execute()

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

if __name__ == "__main__":
    main()
