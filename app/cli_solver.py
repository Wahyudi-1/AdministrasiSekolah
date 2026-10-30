import os
import sys
import time
import uuid
from dotenv import load_dotenv
from supabase import create_client, Client
from solver.engine import solve_school_timetable

load_dotenv()

def is_valid_uuid(val: str) -> bool:
    if not val:
        return False
    try:
        uuid.UUID(str(val))
        return True
    except (ValueError, AttributeError):
        return False

def main():
    # 1. Inisialisasi Kredensial Supabase
    url = os.environ.get("SUPABASE_URL") or os.environ.get("VITE_SUPABASE_URL")
    key = (
        os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
        or os.environ.get("SUPABASE_SECRET_KEY")
        or os.environ.get("SUPABASE_KEY")
        or os.environ.get("SUPABASE_ANON_KEY")
    )

    if not url or not key:
        raise ValueError(
            f"Kredensial kosong! Status -> SUPABASE_URL: {'ADA' if url else 'KOSONG'}, "
            f"KEY: {'ADA' if key else 'KOSONG'}. "
            "Pastikan tersimpan di Settings > Secrets and variables > Actions > Repository secrets."
        )

    supabase: Client = create_client(url, key)
    start_time = time.time()

    # 2. Tangkap Parameter job_id dan school_id dari CLI argumen atau Environment Variables
    arg_job = sys.argv[1].strip() if len(sys.argv) > 1 and sys.argv[1] else os.environ.get("JOB_ID", "").strip()
    arg_school = sys.argv[2].strip() if len(sys.argv) > 2 and sys.argv[2] else os.environ.get("SCHOOL_ID", "").strip()

    job_id = arg_job if is_valid_uuid(arg_job) else None
    school_id = arg_school if is_valid_uuid(arg_school) else None

    # Jika job_id ada, sinkronkan school_id dari tabel generation_jobs
    if job_id:
        job_res = supabase.table("generation_jobs").select("*").eq("id", job_id).limit(1).execute()
        if job_res.data:
            if not school_id and job_res.data[0].get("school_id"):
                school_id = job_res.data[0]["school_id"]

    # Jika job_id belum ada namun school_id ada, cari job queued untuk sekolah ini atau buat baru
    if not job_id and school_id:
        res = (
            supabase.table("generation_jobs")
            .select("id")
            .eq("school_id", school_id)
            .eq("status", "queued")
            .order("created_at", desc=True)
            .limit(1)
            .execute()
        )
        if res.data:
            job_id = res.data[0]["id"]
        else:
            new_job = supabase.table("generation_jobs").insert({
                "school_id": school_id,
                "status": "processing",
                "progress_message": "Menjalankan Solver di mesin GitHub Actions (Multi-Tenant)..."
            }).execute()
            job_id = new_job.data[0]["id"]

    # Jika masih belum ada job_id dan school_id, cari queued job global tertua
    if not job_id and not school_id:
        res = (
            supabase.table("generation_jobs")
            .select("id, school_id")
            .eq("status", "queued")
            .order("created_at", desc=True)
            .limit(1)
            .execute()
        )
        if res.data:
            job_id = res.data[0]["id"]
            school_id = res.data[0].get("school_id")

    # VALIDASI MUTLAK: Jangan izinkan eksekusi tanpa school_id demi menjaga isolasi data
    if not school_id or not is_valid_uuid(school_id):
        err_msg = "FATAL: school_id tidak ditemukan atau tidak valid. Operasi dibatalkan demi keamanan isolasi data sekolah."
        if job_id:
            supabase.table("generation_jobs").update({
                "status": "failed",
                "progress_message": err_msg
            }).eq("id", job_id).execute()
        print(err_msg)
        sys.exit(1)

    print(f"--- MEMULAI SOLVER SEKOLAH: {school_id} (Job: {job_id}) ---")

    try:
        supabase.table("generation_jobs").update({
            "status": "processing",
            "progress_message": f"Mengambil data master sekolah ({school_id}) & menyiapkan solver..."
        }).eq("id", job_id).execute()

        # 3. Ambil data yang HANYA milik sekolah bersangkutan
        work_days = supabase.table("work_days").select("*").eq("school_id", school_id).execute().data
        time_slots = supabase.table("time_slots").select("*").eq("school_id", school_id).execute().data
        teachers = supabase.table("teachers").select("*").eq("school_id", school_id).execute().data
        classes = supabase.table("classes").select("*").eq("school_id", school_id).execute().data
        rooms = supabase.table("rooms").select("*").eq("school_id", school_id).execute().data
        lessons = supabase.table("lessons").select("*").eq("school_id", school_id).execute().data

        if not lessons or not time_slots:
            raise ValueError("Data kartu beban mengajar (lessons) atau slot waktu (time_slots) sekolah ini masih kosong.")

        # 4. Jalankan komputasi Google OR-Tools CP-SAT
        result = solve_school_timetable(
            work_days=work_days,
            time_slots=time_slots,
            teachers=teachers,
            classes=classes,
            rooms=rooms,
            lessons=lessons,
            school_id=school_id
        )

        elapsed_ms = int((time.time() - start_time) * 1000)

        # 5. Simpan Hasil Jadwal
        if result["status"] == "SUCCESS":
            # Hapus HANYA jadwal milik sekolah ini
            supabase.table("schedules").delete().eq("school_id", school_id).execute()

            # Pastikan setiap record jadwal memuat school_id dan job_id
            records = [
                {
                    "school_id": school_id,
                    "job_id": job_id,
                    "lesson_id": row["lesson_id"],
                    "time_slot_id": row["time_slot_id"],
                    "teacher_id": row["teacher_id"],
                    "class_id": row["class_id"],
                    "room_id": row.get("room_id"),
                    "is_locked": bool(row.get("is_locked", False))
                }
                for row in result["schedule"]
            ]

            # Masukkan dalam batch jika jumlah slot besar
            if records:
                batch_size = 300
                for i in range(0, len(records), batch_size):
                    supabase.table("schedules").insert(records[i:i + batch_size]).execute()

            supabase.table("generation_jobs").update({
                "status": "completed",
                "progress_message": result["message"],
                "execution_time_ms": elapsed_ms
            }).eq("id", job_id).execute()
            print(f"SUKSES: {result['message']} dalam {elapsed_ms} ms")

        else:
            supabase.table("generation_jobs").update({
                "status": "failed",
                "progress_message": result["message"],
                "execution_time_ms": elapsed_ms
            }).eq("id", job_id).execute()
            print(f"GAGAL (INFEASIBLE): {result['message']}")
            sys.exit(1)

    except Exception as e:
        supabase.table("generation_jobs").update({
            "status": "failed",
            "progress_message": f"Kesalahan sistem: {str(e)}"
        }).eq("id", job_id).execute()
        print(f"ERROR: {str(e)}")
        sys.exit(1)

if __name__ == "__main__":
    main()
