"""Seed helper for HistoryView chart aggregation testing.

Creates 3 games and multiple daily_records PER GAME PER DAY (same dates)
so that the chart date-aggregation bug can be verified.

Usage:
    python seed_history_charts.py backup   -> saves current data to /tmp/hist_backup.json
    python seed_history_charts.py seed     -> seeds deterministic records
    python seed_history_charts.py restore  -> restores /tmp/hist_backup.json
"""
import json
import os
import sys
from datetime import datetime, timedelta, timezone

import requests
from dotenv import dotenv_values

frontend_env = dotenv_values("/app/frontend/.env")
BASE_URL = (os.environ.get("REACT_APP_BACKEND_URL") or frontend_env.get("REACT_APP_BACKEND_URL")).rstrip("/")
API = f"{BASE_URL}/api"
BACKUP_PATH = "/tmp/hist_backup.json"

GAME_NAMES = ["TEST_GameA", "TEST_GameB", "TEST_GameC"]
# (total_tasks, completed_tasks) per game -> weighted avg for a day
GAME_STATS = [(10, 10), (5, 0), (5, 5)]  # weighted = 15/20 = 75%, simple avg = 66.67%


def task(i, done):
    return {"id": f"t{i}", "name": f"TEST_task_{i}", "completed": done}


def do_backup():
    r = requests.get(f"{API}/backup", timeout=30)
    r.raise_for_status()
    with open(BACKUP_PATH, "w") as fh:
        json.dump(r.json(), fh)
    print(f"backup saved -> {BACKUP_PATH}")


def do_restore():
    with open(BACKUP_PATH) as fh:
        data = json.load(fh)
    payload = {
        "games": data.get("games") or [],
        "settings": data.get("settings") or {},
        "daily_records": data.get("daily_records") or [],
    }
    r = requests.post(f"{API}/restore", json=payload, timeout=30)
    r.raise_for_status()
    print("restored original data:", r.json())


def do_seed():
    # wipe games + records for a clean deterministic state
    requests.post(f"{API}/restore", json={"games": [], "daily_records": []}, timeout=30).raise_for_status()

    game_ids = []
    for name in GAME_NAMES:
        res = requests.post(
            f"{API}/games",
            json={"name": name, "path": "C:/test.exe", "tasks": [task(1, False), task(2, False)]},
            timeout=30,
        )
        res.raise_for_status()
        game_ids.append(res.json()["id"])
    print("created games:", game_ids)

    today = datetime.now(timezone.utc).date()
    records = []
    # 12 distinct dates x 3 games x 4 task types
    dates = [(today - timedelta(days=d)).strftime("%Y-%m-%d") for d in range(1, 13)]
    for date in dates:
        for gid, gname, (total, done) in zip(game_ids, GAME_NAMES, GAME_STATS):
            for ttype in ("daily", "weekly", "monthly", "version"):
                records.append(
                    {
                        "id": f"record_{ttype}_{gid}_{date}",
                        "date": date,
                        "game_id": gid,
                        "game_name": gname,
                        "task_type": ttype,
                        "tasks": [task(i, i <= done) for i in range(1, total + 1)],
                        "total_tasks": total,
                        "completed_tasks": done,
                        "completion_rate": round(done / total * 100, 2),
                    }
                )
    r = requests.post(f"{API}/restore", json={"daily_records": records}, timeout=60)
    r.raise_for_status()
    print(f"seeded {len(records)} records across {len(dates)} distinct dates")
    print("expected weighted rate per day:", round(sum(d for _, d in GAME_STATS) / sum(t for t, _ in GAME_STATS) * 100))
    print("distinct dates (desc):", sorted(dates, reverse=True))


if __name__ == "__main__":
    cmd = sys.argv[1] if len(sys.argv) > 1 else "seed"
    {"backup": do_backup, "seed": do_seed, "restore": do_restore}[cmd]()
