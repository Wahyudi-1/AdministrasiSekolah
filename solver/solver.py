import os
import sys
import time
import json
import math
from supabase import create_client, Client
from ortools.sat.python import cp_model

SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY") or os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
JOB_ID = os.environ.get("JOB_ID", "").strip()
SCHOOL_ID = os.environ.get("SCHOOL_ID", "").strip()

if not SUPABASE_URL or not SUPABASE_KEY:
    print("ERROR: SUPABASE_URL atau SUPABASE_KEY tidak ditemukan.")
    sys.exit(1)

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)


def update_job(job_id: str, status: str, message: str, elapsed_ms: int = None):
    if not job_id:
        return
    payload = {"status": status, "progress_message": message}
    if elapsed_ms is not None:
        payload["execution_time_ms"] = elapsed_ms
    try:
        supabase.table("generation_jobs").update(payload).eq("id", job_id).execute()
    except Exception as e:
        print(f"Warning update_job: {e}")


def parse_split_pattern(pattern_raw, total_jp: int):
    if isinstance(pattern_raw, list):
        parts = [int(x) for x in pattern_raw if str(x).isdigit() and int(x) > 0]
    else:
        s = str(pattern_raw or "").strip()
        parts = [int(p.strip()) for p in s.split("+") if p.strip().isdigit() and int(p.strip()) > 0]
    if not parts or sum(parts) != total_jp:
        return [total_jp] if total_jp > 0 else []
    return parts


def main():
    start_time = time.time()
    global JOB_ID, SCHOOL_ID

    if not JOB_ID:
        res = (
            supabase.table("generation_jobs")
            .select("*")
            .eq("status", "queued")
            .order("created_at", desc=True)
            .limit(1)
            .execute()
        )
        if res.data:
            JOB_ID = res.data[0]["id"]
            SCHOOL_ID = res.data[0].get("school_id") or SCHOOL_ID

    if not SCHOOL_ID and JOB_ID:
        job_row = supabase.table("generation_jobs").select("school_id").eq("id", JOB_ID).execute()
        if job_row.data:
            SCHOOL_ID = job_row.data[0].get("school_id") or ""

    print(f"Memulai Solver untuk SCHOOL_ID={SCHOOL_ID}, JOB_ID={JOB_ID}")
    update_job(JOB_ID, "processing", "Mesin GitHub Actions aktif: Membaca data sekolah...")

    try:
        def fetch_table(table_name):
            q = supabase.table(table_name).select("*")
            if SCHOOL_ID:
                q = q.eq("school_id", SCHOOL_ID)
            return q.execute().data or []

        work_days = [d for d in fetch_table("work_days") if d.get("is_active")]
        active_day_indices = {d["day_index"] for d in work_days}

        all_slots = fetch_table("time_slots")
        teaching_slots = [
            s for s in all_slots
            if s["day_index"] in active_day_indices and s.get("slot_type") != "BREAK"
        ]
        teaching_slots.sort(key=lambda x: (x["day_index"], x["period_number"]))

        teachers = fetch_table("teachers")
        classes = fetch_table("classes")
        lessons = fetch_table("lessons")

        if not teaching_slots or not lessons:
            raise ValueError("Slot waktu aktif atau Kartu Beban Mengajar masih kosong untuk sekolah ini.")

        slot_by_day_period = {(s["day_index"], s["period_number"]): s for s in teaching_slots}
        days_sorted = sorted(list(active_day_indices))
        num_active_days = max(len(days_sorted), 1)

        periods_by_day = {}
        for d in days_sorted:
            periods_by_day[d] = sorted([s["period_number"] for s in teaching_slots if s["day_index"] == d])

        model = cp_model.CpModel()

        meetings = []
        teacher_total_jp = {}

        for l in lessons:
            total_jp = int(l.get("total_periods") or l.get("total_periods_per_week") or 0)
            if total_jp <= 0:
                continue

            t_id = l["teacher_id"]
            teacher_total_jp[t_id] = teacher_total_jp.get(t_id, 0) + total_jp

            blocks = parse_split_pattern(l.get("split_pattern"), total_jp)
            allowed_zone = l.get("allowed_slot_types") or "FORMAL"

            for b_idx, duration in enumerate(blocks):
                meetings.append({
                    "id": f"{l['id']}_{b_idx}",
                    "lesson_id": l["id"],
                    "teacher_id": t_id,
                    "class_id": l["class_id"],
                    "room_id": l.get("preferred_room_id"),
                    "duration": duration,
                    "zone": allowed_zone,
                })

        start_vars = {}
        slot_coverage = {s["id"]: [] for s in teaching_slots}

        for m_idx, m in enumerate(meetings):
            valid_starts = []
            dur = m["duration"]
            zone = m["zone"]

            for d in days_sorted:
                day_periods = periods_by_day[d]
                for i in range(len(day_periods) - dur + 1):
                    candidate_periods = day_periods[i : i + dur]
                    is_contiguous = all(
                        candidate_periods[k + 1] - candidate_periods[k] == 1
                        for k in range(len(candidate_periods) - 1)
                    )
                    if not is_contiguous:
                        continue

                    candidate_slots = [slot_by_day_period[(d, p)] for p in candidate_periods]
                    if any(s.get("slot_type") != zone for s in candidate_slots):
                        continue

                    var = model.NewBoolVar(f"m{m_idx}_d{d}_p{candidate_periods[0]}")
                    start_vars[(m_idx, d, candidate_periods[0])] = var
                    valid_starts.append(var)

                    for s in candidate_slots:
                        slot_coverage[s["id"]].append((m_idx, var))

            if not valid_starts:
                raise ValueError(
                    f"Tidak ditemukan {dur} slot berurutan di zona {zone} untuk pelajaran ID {m['lesson_id']}."
                )

            model.Add(sum(valid_starts) == 1)

        # Constraint 1: Pecahan blok dari lesson yang sama tidak boleh jatuh di hari yang sama
        for l in lessons:
            l_meetings = [idx for idx, m in enumerate(meetings) if m["lesson_id"] == l["id"]]
            if len(l_meetings) > 1:
                for d in days_sorted:
                    vars_in_day = [
                        var for (m_idx, day, _), var in start_vars.items()
                        if m_idx in l_meetings and day == d
                    ]
                    if vars_in_day:
                        model.Add(sum(vars_in_day) <= 1)

        # Constraint 2: Anti-Bentrok Kelas, Guru, dan Ruangan Khusus
        for s_id, active_list in slot_coverage.items():
            by_class = {}
            by_teacher = {}
            by_room = {}

            for m_idx, var in active_list:
                m = meetings[m_idx]
                by_class.setdefault(m["class_id"], []).append(var)
                by_teacher.setdefault(m["teacher_id"], []).append(var)
                if m["room_id"]:
                    by_room.setdefault(m["room_id"], []).append(var)

            for vars_cls in by_class.values():
                if len(vars_cls) > 1:
                    model.Add(sum(vars_cls) <= 1)

            for vars_tch in by_teacher.values():
                if len(vars_tch) > 1:
                    model.Add(sum(vars_tch) <= 1)

            for vars_rm in by_room.values():
                if len(vars_rm) > 1:
                    model.Add(sum(vars_rm) <= 1)

        # Constraint 3: Kebijakan Fleksibel Beban Mengajar Guru & Soft Constraint Pemerataan Harian
        teacher_map = {t["id"]: t for t in teachers}
        soft_penalty_terms = []

        for t_id, t_data in teacher_map.items():
            max_per_day = int(t_data.get("max_periods_per_day") or 8)
            max_consecutive = int(t_data.get("max_consecutive_periods") or 4)
            disallow_full_day = bool(t_data.get("disallow_full_day", True))
            unavail = t_data.get("unavailable_slots") or []

            if isinstance(unavail, str):
                try:
                    unavail = json.loads(unavail)
                except Exception:
                    unavail = []

            # 3A. Hard Constraint: Jam Berhalangan Mengajar Guru
            for rule in unavail:
                r_day = int(rule.get("day_index", 0))
                r_periods = rule.get("periods", "ALL")
                for s in teaching_slots:
                    if s["day_index"] == r_day:
                        if r_periods == "ALL" or (isinstance(r_periods, list) and s["period_number"] in r_periods):
                            for m_idx, var in slot_coverage[s["id"]]:
                                if meetings[m_idx]["teacher_id"] == t_id:
                                    model.Add(var == 0)

            # Hitung rata-rata jam ideal harian untuk guru ini
            total_t_jp = teacher_total_jp.get(t_id, 0)
            ideal_daily_avg = math.ceil(total_t_jp / num_active_days) if total_t_jp > 0 else 0
            daily_load_vars = []

            # 3B. Evaluasi Harian per Guru
            for d in days_sorted:
                day_slots = [s for s in teaching_slots if s["day_index"] == d]
                day_slots.sort(key=lambda s: s["period_number"])

                day_teaching_vars = []
                for s in day_slots:
                    t_active_in_slot = [
                        var for m_idx, var in slot_coverage[s["id"]]
                        if meetings[m_idx]["teacher_id"] == t_id
                    ]
                    if t_active_in_slot:
                        day_teaching_vars.append(sum(t_active_in_slot))
                    else:
                        day_teaching_vars.append(0)

                total_slots_in_day = len(day_teaching_vars)
                if total_slots_in_day == 0:
                    continue

                # Variabel beban mengajar guru t pada hari d
                daily_load = model.NewIntVar(0, total_slots_in_day, f"load_{t_id}_d{d}")
                model.Add(daily_load == sum(day_teaching_vars))
                daily_load_vars.append(daily_load)

                # 3C. Hard Constraint: Batas Maksimal Jam Mengajar dalam 1 Hari
                model.Add(daily_load <= max_per_day)

                # 3D. Hard Constraint: Larangan Full Mengajar dari Periode Pertama sampai Akhir
                if disallow_full_day and total_slots_in_day >= 4:
                    model.Add(daily_load <= total_slots_in_day - 1)

                # 3E. Hard Constraint: Batas Maksimal Jam Mengajar Berturut-Turut (Sliding Window)
                window_size = max_consecutive + 1
                if total_slots_in_day >= window_size:
                    for w_start in range(total_slots_in_day - window_size + 1):
                        window = day_teaching_vars[w_start : w_start + window_size]
                        model.Add(sum(window) <= max_consecutive)

                # 3F. Soft Constraint: Penalti Deviasi jika beban hari ini melebihi rata-rata ideal
                if total_t_jp > 0:
                    overload_day = model.NewIntVar(0, total_slots_in_day, f"over_{t_id}_d{d}")
                    model.Add(overload_day >= daily_load - ideal_daily_avg)
                    # Bobot penalti 10 per JP kelebihan di atas rata-rata harian
                    soft_penalty_terms.append(overload_day * 10)

            # 3G. Soft Constraint: Minimalkan Puncak Beban Harian (Min-Max Daily Load Balancing)
            if daily_load_vars and total_t_jp > 0:
                peak_load = model.NewIntVar(0, 16, f"peak_{t_id}")
                model.AddMaxEquality(peak_load, daily_load_vars)
                # Bobot penalti 25 untuk menekan puncak jam tertinggi agar merata ke hari lain
                soft_penalty_terms.append(peak_load * 25)

        # Terapkan Fungsi Objektif (Minimalkan Penalti Ketidakmerataan)
        if soft_penalty_terms:
            model.Minimize(sum(soft_penalty_terms))

        update_job(
            JOB_ID,
            "processing",
            "Menjalankan optimasi CP-SAT & pemerataan beban harian guru...",
        )
        solver = cp_model.CpSolver()
        solver.parameters.max_time_in_seconds = 30.0
        solver.parameters.num_search_workers = 4
        status = solver.Solve(model)

        if status not in (cp_model.OPTIMAL, cp_model.FEASIBLE):
            raise RuntimeError(
                "Tidak ditemukan kombinasi jadwal tanpa bentrok yang memenuhi seluruh batasan jam berturut-turut dan syarat guru. Coba longgarkan batas jam berturut-turut atau tambah kapasitas slot waktu."
            )

        schedule_rows = []
        for s in teaching_slots:
            for m_idx, var in slot_coverage[s["id"]]:
                if solver.Value(var) == 1:
                    m = meetings[m_idx]
                    row = {
                        "lesson_id": m["lesson_id"],
                        "time_slot_id": s["id"],
                        "teacher_id": m["teacher_id"],
                        "class_id": m["class_id"],
                        "room_id": m["room_id"],
                        "is_locked": False,
                    }
                    if SCHOOL_ID:
                        row["school_id"] = SCHOOL_ID
                    schedule_rows.append(row)

        del_q = supabase.table("schedules").delete()
        if SCHOOL_ID:
            del_q = del_q.eq("school_id", SCHOOL_ID)
        else:
            del_q = del_q.neq("id", "00000000-0000-0000-0000-000000000000")
        del_q.execute()

        if schedule_rows:
            supabase.table("schedules").insert(schedule_rows).execute()

        elapsed_ms = int((time.time() - start_time) * 1000)
        status_label = "OPTIMAL" if status == cp_model.OPTIMAL else "FEASIBLE"
        msg = f"SUKSES ({status_label}): Berhasil menyusun {len(schedule_rows)} slot jam pelajaran secara merata tanpa bentrok."
        print(msg)
        update_job(JOB_ID, "completed", msg, elapsed_ms)

    except Exception as e:
        elapsed_ms = int((time.time() - start_time) * 1000)
        err_msg = f"GAGAL: {str(e)}"
        print(err_msg)
        update_job(JOB_ID, "failed", err_msg, elapsed_ms)
        sys.exit(1)


if __name__ == "__main__":
    main()
