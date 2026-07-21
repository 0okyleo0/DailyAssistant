"""Backend tests for weekly tasks, version tasks, backup/restore (iteration 11)."""
import os
import pytest
import requests
from datetime import datetime, timezone, timedelta

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')
if not BASE_URL:
    with open('/app/frontend/.env') as f:
        for line in f:
            if line.startswith('REACT_APP_BACKEND_URL='):
                BASE_URL = line.split('=', 1)[1].strip().rstrip('/')
API = f"{BASE_URL}/api"


@pytest.fixture(scope="module")
def session():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def game_id(session):
    payload = {
        "name": "TEST_MultiType_Game",
        "path": "/opt/multi_game",
        "reset_time": "04:00",
        "daily_reminder_minutes": 30,
        "tasks": [
            {"id": "d1", "name": "daily-1", "completed": False},
            {"id": "d2", "name": "daily-2", "completed": False},
        ],
        "weekly_reset_day": 3,
        "weekly_reset_time": "06:30",
        "weekly_reminder_minutes": 60,
        "weekly_tasks": [
            {"id": "w1", "name": "weekly-1", "completed": False},
            {"id": "w2", "name": "weekly-2", "completed": False},
        ],
        "version_deadline": "2099-12-31T23:30",
        "version_reminder_minutes": 1440,
        "version_tasks": [
            {"id": "v1", "name": "version-1", "completed": False},
        ],
    }
    r = session.post(f"{API}/games", json=payload)
    assert r.status_code == 200, r.text
    data = r.json()
    # Verify all fields returned
    assert data["weekly_reset_day"] == 3
    assert data["weekly_reset_time"] == "06:30"
    assert data["weekly_reminder_minutes"] == 60
    assert len(data["weekly_tasks"]) == 2
    assert data["version_deadline"] == "2099-12-31T23:30"
    assert data["version_reminder_minutes"] == 1440
    assert len(data["version_tasks"]) == 1
    assert data["version_archived"] is False
    gid = data["id"]
    yield gid
    try:
        session.delete(f"{API}/games/{gid}")
    except Exception:
        pass


def test_toggle_task_daily(session, game_id):
    r = session.post(f"{API}/games/toggle-task", json={
        "game_id": game_id, "task_id": "d1", "completed": True, "task_type": "daily"
    })
    assert r.status_code == 200
    g = [x for x in session.get(f"{API}/games").json() if x["id"] == game_id][0]
    assert next(t for t in g["tasks"] if t["id"] == "d1")["completed"] is True


def test_toggle_task_weekly(session, game_id):
    r = session.post(f"{API}/games/toggle-task", json={
        "game_id": game_id, "task_id": "w1", "completed": True, "task_type": "weekly"
    })
    assert r.status_code == 200
    g = [x for x in session.get(f"{API}/games").json() if x["id"] == game_id][0]
    assert next(t for t in g["weekly_tasks"] if t["id"] == "w1")["completed"] is True
    # daily task w-w should NOT be affected because separate array
    assert next(t for t in g["tasks"] if t["id"] == "d1")["completed"] is True


def test_toggle_task_version(session, game_id):
    r = session.post(f"{API}/games/toggle-task", json={
        "game_id": game_id, "task_id": "v1", "completed": True, "task_type": "version"
    })
    assert r.status_code == 200
    g = [x for x in session.get(f"{API}/games").json() if x["id"] == game_id][0]
    assert g["version_tasks"][0]["completed"] is True


def test_uncheck_all_weekly_only(session, game_id):
    # first ensure daily is checked (d1), weekly checked (w1), version checked (v1)
    r = session.post(f"{API}/games/uncheck-all", json={"task_type": "weekly"})
    assert r.status_code == 200
    g = [x for x in session.get(f"{API}/games").json() if x["id"] == game_id][0]
    # weekly cleared
    assert all(not t["completed"] for t in g["weekly_tasks"])
    # daily untouched
    assert next(t for t in g["tasks"] if t["id"] == "d1")["completed"] is True
    # version untouched
    assert g["version_tasks"][0]["completed"] is True


def test_uncheck_all_all_types(session, game_id):
    r = session.post(f"{API}/games/uncheck-all", json={"task_type": "all"})
    assert r.status_code == 200
    g = [x for x in session.get(f"{API}/games").json() if x["id"] == game_id][0]
    assert all(not t["completed"] for t in g["tasks"])
    assert all(not t["completed"] for t in g["weekly_tasks"])
    assert all(not t["completed"] for t in g["version_tasks"])


def test_reset_weekly_creates_record(session, game_id):
    # check w2
    session.post(f"{API}/games/toggle-task", json={
        "game_id": game_id, "task_id": "w2", "completed": True, "task_type": "weekly"
    })
    r = session.post(f"{API}/games/reset-weekly", json={"game_id": game_id})
    assert r.status_code == 200, r.text
    body = r.json()
    rec = body["record"]
    assert rec["task_type"] == "weekly"
    assert rec["game_id"] == game_id
    assert rec["total_tasks"] == 2
    assert rec["completed_tasks"] == 1
    assert rec["completion_rate"] == 50.0

    # game weekly tasks reset
    g = [x for x in session.get(f"{API}/games").json() if x["id"] == game_id][0]
    assert all(not t["completed"] for t in g["weekly_tasks"])
    assert g["weekly_last_reset_date"] != ""


def test_daily_records_filter_by_task_type(session, game_id):
    # Should have at least one weekly record now
    r = session.get(f"{API}/daily-records", params={"task_type": "weekly", "game_id": game_id})
    assert r.status_code == 200
    recs = r.json()
    assert len(recs) >= 1
    assert all(rec["task_type"] == "weekly" for rec in recs)

    # daily filter for this game -> none yet
    r2 = session.get(f"{API}/daily-records", params={"task_type": "daily", "game_id": game_id})
    assert r2.status_code == 200
    assert all(rec["task_type"] == "daily" for rec in r2.json())


def test_stats_filter_by_task_type(session, game_id):
    r = session.get(f"{API}/stats", params={"task_type": "weekly", "game_id": game_id})
    assert r.status_code == 200
    data = r.json()
    assert data["total_records"] >= 1


def test_archive_version(session, game_id):
    # mark v1 completed again (it was cleared)
    session.post(f"{API}/games/toggle-task", json={
        "game_id": game_id, "task_id": "v1", "completed": True, "task_type": "version"
    })
    r = session.post(f"{API}/games/archive-version", json={"game_id": game_id})
    assert r.status_code == 200, r.text
    body = r.json()
    rec = body["record"]
    assert rec["task_type"] == "version"
    assert rec["total_tasks"] == 1
    assert rec["completed_tasks"] == 1

    # game version archived, deadline cleared, version_tasks empty
    g = [x for x in session.get(f"{API}/games").json() if x["id"] == game_id][0]
    assert g["version_archived"] is True
    assert g["version_deadline"] == ""
    assert g["version_tasks"] == []


def test_backup_returns_all(session, game_id):
    r = session.get(f"{API}/backup")
    assert r.status_code == 200
    data = r.json()
    assert data["version"] == 2
    assert "timestamp" in data
    assert isinstance(data["games"], list)
    assert isinstance(data["daily_records"], list)
    assert any(g["id"] == game_id for g in data["games"])


def test_restore_replaces_data(session, game_id):
    # snapshot current state
    backup = session.get(f"{API}/backup").json()

    # send a minimal restore with just one different game
    restore_payload = {
        "games": [{
            "id": "restored_test_game",
            "name": "TEST_Restored",
            "path": "/tmp/restored",
            "order": 0,
            "tasks": [],
            "reset_time": "00:00",
            "last_reset_date": "",
            "daily_reminder_minutes": 0,
            "weekly_tasks": [],
            "weekly_reset_day": 1,
            "weekly_reset_time": "00:00",
            "weekly_last_reset_date": "",
            "weekly_reminder_minutes": 0,
            "version_tasks": [],
            "version_deadline": "",
            "version_reminder_minutes": 0,
            "version_archived": False,
        }],
        "settings": backup["settings"],
        "daily_records": [],
    }
    r = session.post(f"{API}/restore", json=restore_payload)
    assert r.status_code == 200, r.text

    games = session.get(f"{API}/games").json()
    assert len(games) == 1
    assert games[0]["id"] == "restored_test_game"

    recs = session.get(f"{API}/daily-records").json()
    assert recs == []

    # Now restore original backup
    r2 = session.post(f"{API}/restore", json={
        "games": backup["games"],
        "settings": backup["settings"],
        "daily_records": backup["daily_records"],
    })
    assert r2.status_code == 200
