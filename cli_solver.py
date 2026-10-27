import sys
from app.solver.runner import execute_solver_job

if __name__ == "__main__":
    job_id = sys.argv[1] if len(sys.argv) > 1 and sys.argv[1] != "" else None
    print(f"Menjalankan Solver via CLI untuk job_id: {job_id}")
    execute_solver_job(job_id)
    print("Selesai.")
