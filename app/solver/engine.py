import os
from ortools.sat.python import cp_model
from typing import List, Dict, Any

def solve_school_timetable(
    work_days: List[Dict[str, Any]],
    time_slots: List[Dict[str, Any]],
    teachers: List[Dict[str, Any]],
    classes: List[Dict[str, Any]],
    rooms: List[Dict[str, Any]],
    lessons: List[Dict[str, Any]]
) -> Dict[str, Any]:
    
    model = cp_model.CpModel()

    # 1. Filter hari kerja aktif dan urutkan slot waktu (Kecualikan jam istirahat / BREAK)
    active_days = {d["day_index"] for d in work_days if d.get("is_active", True)}
    valid_slots = [
        s for s in time_slots 
        if s["day_index"] in active_days and s["slot_type"] != "BREAK"
    ]
    valid_slots.sort(key=lambda x: (x["day_index"], x["period_number"]))

    slots_by_day: Dict[int, List[Dict[str, Any]]] = {}
    for s in valid_slots:
        slots_by_day.setdefault(s["day_index"], []).append(s)

    slot_lookup = {(s["day_index"], s["period_number"]): s["id"] for s in valid_slots}

    # 2. Pecah Lesson menjadi pertemuan (Sessions) sesuai split_pattern (misal '2+2')
    sessions = []
    for l in lessons:
        pattern_str = str(l.get("split_pattern", "1")).strip()
        parts = [int(p) for p in pattern_str.split("+") if p.strip().isdigit()]
        if not parts:
            parts = [l["total_periods_per_week"]]

        for idx, duration in enumerate(parts):
            sessions.append({
                "session_id": f"{l['id']}_part_{idx}",
                "lesson_id": l["id"],
                "teacher_id": l["teacher_id"],
                "class_id": l["class_id"],
                "room_id": l.get("preferred_room_id"),
                "duration": duration,
                "allowed_slot_type": l.get("allowed_slot_types", "FORMAL"),
                "locked_slot_id": l.get("locked_time_slot_id") if idx == 0 else None
            })

    # 3. Buat Variabel Keputusan CP-SAT
    start_vars = {}
    active_vars: Dict[tuple, List[cp_model.IntVar]] = {}

    for sess in sessions:
        s_id = sess["session_id"]
        dur = sess["duration"]
        allowed_type = sess["allowed_slot_type"]
        possible_starts = []

        for day_idx, day_slots in slots_by_day.items():
            for i in range(len(day_slots) - dur + 1):
                block = day_slots[i : i + dur]
                
                if not all(b["slot_type"] == allowed_type for b in block):
                    continue

                if sess["locked_slot_id"] and block[0]["id"] != sess["locked_slot_id"]:
                    continue

                start_slot_id = block[0]["id"]
                var = model.NewBoolVar(f"start_{s_id}_{start_slot_id}")
                start_vars[(s_id, start_slot_id)] = var
                possible_starts.append(var)

                for b in block:
                    active_vars.setdefault((s_id, b["id"]), []).append(var)

        if not possible_starts:
            return {
                "status": "INFEASIBLE",
                "message": f"Tidak ada slot waktu yang muat untuk pelajaran ID {sess['lesson_id']} (Durasi: {dur} JP, Zona: {allowed_type})."
            }
        model.Add(sum(possible_starts) == 1)

    def is_session_active(sess_id: str, slot_id: str):
        vars_list = active_vars.get((sess_id, slot_id), [])
        return sum(vars_list) if vars_list else 0

    # 4. HARD CONSTRAINT: Pecahan pertemuan dari mapel yang sama tidak boleh di hari yang sama
    for l in lessons:
        l_sessions = [s for s in sessions if s["lesson_id"] == l["id"]]
        if len(l_sessions) > 1:
            for day_idx, day_slots in slots_by_day.items():
                day_slot_ids = {s["id"] for s in day_slots}
                starts_in_day = [
                    start_vars[(sess["session_id"], s_id)]
                    for sess in l_sessions
                    for s_id in day_slot_ids
                    if (sess["session_id"], s_id) in start_vars
                ]
                if starts_in_day:
                    model.Add(sum(starts_in_day) <= 1)

    # 5. HARD CONSTRAINT: Anti-Bentrok Guru, Kelas, dan Ruangan pada periode yang sama
    for slot in valid_slots:
        slot_id = slot["id"]

        for t in teachers:
            t_sessions = [s["session_id"] for s in sessions if s["teacher_id"] == t["id"]]
            active_in_slot = [is_session_active(s_id, slot_id) for s_id in t_sessions if (s_id, slot_id) in active_vars]
            if active_in_slot:
                model.Add(sum(active_in_slot) <= 1)

        for c in classes:
            c_sessions = [s["session_id"] for s in sessions if s["class_id"] == c["id"]]
            active_in_slot = [is_session_active(s_id, slot_id) for s_id in c_sessions if (s_id, slot_id) in active_vars]
            if active_in_slot:
                model.Add(sum(active_in_slot) <= 1)

        for r in rooms:
            r_sessions = [s["session_id"] for s in sessions if s["room_id"] == r["id"]]
            active_in_slot = [is_session_active(s_id, slot_id) for s_id in r_sessions if (s_id, slot_id) in active_vars]
            if active_in_slot:
                model.Add(sum(active_in_slot) <= 1)

    # 6. CONSTRAINT: Batas JP Harian Guru & JSON unavailable_slots
    soft_penalties = []

    for t in teachers:
        t_id = t["id"]
        max_per_day = t.get("max_periods_per_day", 8)
        t_sessions = [s["session_id"] for s in sessions if s["teacher_id"] == t_id]

        for day_idx, day_slots in slots_by_day.items():
            daily_load = [
                is_session_active(s_id, slot["id"])
                for slot in day_slots
                for s_id in t_sessions
                if (s_id, slot["id"]) in active_vars
            ]
            if daily_load:
                model.Add(sum(daily_load) <= max_per_day)

        rules = t.get("unavailable_slots") or []
        for rule in rules:
            day = rule.get("day_index")
            periods = rule.get("periods")
            level = rule.get("level", "HARD")

            affected_slot_ids = []
            if periods == "ALL":
                affected_slot_ids = [s["id"] for s in slots_by_day.get(day, [])]
            elif isinstance(periods, list):
                for p in periods:
                    if (day, p) in slot_lookup:
                        affected_slot_ids.append(slot_lookup[(day, p)])

            for s_id in t_sessions:
                for sl_id in affected_slot_ids:
                    if (s_id, sl_id) in active_vars:
                        expr = is_session_active(s_id, sl_id)
                        if level == "HARD":
                            model.Add(expr == 0)
                        elif level == "SOFT":
                            weight = int(rule.get("weight", 5))
                            soft_penalties.append(expr * weight)

    if soft_penalties:
        model.Minimize(sum(soft_penalties))

    # 7. Konfigurasi Eksekusi Solver (Otomatis menyesuaikan Render vs GitHub Actions)
    solver = cp_model.CpSolver()
    is_github_actions = os.environ.get("GITHUB_ACTIONS") == "true"
    
    solver.parameters.max_time_in_seconds = 60.0 if is_github_actions else 30.0
    solver.parameters.num_search_workers = 2 if is_github_actions else 1  # 1 worker hemat RAM untuk Render 512MB

    status = solver.Solve(model)

    if status in (cp_model.OPTIMAL, cp_model.FEASIBLE):
        schedule_rows = []
        for sess in sessions:
            s_id = sess["session_id"]
            for slot in valid_slots:
                sl_id = slot["id"]
                if (s_id, sl_id) in active_vars:
                    if solver.Value(is_session_active(s_id, sl_id)) == 1:
                        schedule_rows.append({
                            "lesson_id": sess["lesson_id"],
                            "time_slot_id": sl_id,
                            "teacher_id": sess["teacher_id"],
                            "class_id": sess["class_id"],
                            "room_id": sess["room_id"],
                            "is_locked": bool(sess["locked_slot_id"])
                        })
        return {
            "status": "SUCCESS",
            "schedule": schedule_rows,
            "message": f"Berhasil menyusun {len(schedule_rows)} slot jam pelajaran tanpa bentrok."
        }

    return {
        "status": "FAILED",
        "schedule": [],
        "message": "Jadwal tidak ditemukan (Infeasible). Periksa kembali beban jam guru atau ketersediaan slot waktu."
    }
