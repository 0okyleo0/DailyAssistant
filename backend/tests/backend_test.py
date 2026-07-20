"""Backend API tests for Game Daily Tracker after schema change (path + per-game reset_time)."""
import os
import pytest
import requests
from datetime import datetime, timezone, timedelta

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')
if not BASE_URL:
    # Fallback to reading frontend .env
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
def created_game_ids():
    ids = []
    yield ids
    # teardown
    s = requests.Session()
    for gid in ids:
        try:
            s.delete(f"{API}/games/{gid}", timeout=10)
        except Exception:
            pass


# ==== Health ====
def test_root(session):
    r = session.get(f"{API}/")
    assert r.status_code == 200


# ==== Games ====
def test_create_game_with_path_and_reset_time(session, created_game_ids):
    payload = {
        "name": "TEST_Game_A",
        "path": r"C:\Games\test_a.exe",
        "reset_time": "05:30",
        "tasks": [
            {"id": "t1", "name": "Daily quest 1", "completed": False},
            {"id": "t2", "name": "Daily quest 2", "completed": False},
        ],
    }
    r = session.post(f"{API}/games", json=payload)
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["name"] == "TEST_Game_A"
    assert data["path"] == payload["path"]
    assert data["reset_time"] == "05:30"
    assert len(data["tasks"]) == 2
    assert "id" in data
    created_game_ids.append(data["id"])

    # verify persistence
    r2 = session.get(f"{API}/games")
    assert r2.status_code == 200
    assert any(g["id"] == data["id"] and g["reset_time"] == "05:30" for g in r2.json())


def test_create_game_default_reset_time(session, created_game_ids):
    payload = {"name": "TEST_Game_B", "path": "/opt/game_b", "tasks": []}
    r = session.post(f"{API}/games", json=payload)
    assert r.status_code == 200
    data = r.json()
    assert data["reset_time"] == "00:00"
    created_game_ids.append(data["id"])


def test_update_game_reset_time(session, created_game_ids):
    gid = created_game_ids[0]
    r = session.put(f"{API}/games/{gid}", json={"reset_time": "12:00", "name": "TEST_Game_A_Edited"})
    assert r.status_code == 200
    data = r.json()
    assert data["reset_time"] == "12:00"
    assert data["name"] == "TEST_Game_A_Edited"
    # verify GET
    r2 = session.get(f"{API}/games")
    match = [g for g in r2.json() if g["id"] == gid][0]
    assert match["reset_time"] == "12:00"


def test_reset_game_endpoint(session, created_game_ids):
    gid = created_game_ids[0]
    # complete one task
    r = session.post(f"{API}/games/toggle-task", json={"game_id": gid, "task_id": "t1", "completed": True})
    assert r.status_code == 200

    # reset this game only
    r = session.post(f"{API}/games/reset-game", json={"game_id": gid})
    assert r.status_code == 200, r.text
    body = r.json()
    assert "record" in body
    rec = body["record"]
    assert rec["game_id"] == gid
    assert rec["total_tasks"] == 2
    assert rec["completed_tasks"] == 1
    assert rec["completion_rate"] == 50.0

    # game should have tasks reset
    games = session.get(f"{API}/games").json()
    g = [x for x in games if x["id"] == gid][0]
    assert all(not t["completed"] for t in g["tasks"])
    assert g["last_reset_date"] != ""


def test_daily_records_filter_by_game_id(session, created_game_ids):
    gid = created_game_ids[0]
    r = session.get(f"{API}/daily-records", params={"game_id": gid})
    assert r.status_code == 200
    records = r.json()
    assert len(records) >= 1
    assert all(rec["game_id"] == gid for rec in records)

    # unrelated filter
    r2 = session.get(f"{API}/daily-records", params={"game_id": "nonexistent_id"})
    assert r2.status_code == 200
    assert r2.json() == []


def test_stats_filter_by_game_id(session, created_game_ids):
    gid = created_game_ids[0]
    r = session.get(f"{API}/stats", params={"game_id": gid})
    assert r.status_code == 200
    data = r.json()
    assert data["total_records"] >= 1
    assert "last_7_days" in data and "last_30_days" in data

    # global stats
    r2 = session.get(f"{API}/stats")
    assert r2.status_code == 200
    assert r2.json()["total_records"] >= data["total_records"]


def test_reset_game_not_found(session):
    r = session.post(f"{API}/games/reset-game", json={"game_id": "nonexistent_id_xyz"})
    assert r.status_code == 404


def test_settings_notifications_only(session):
    r = session.get(f"{API}/settings")
    assert r.status_code == 200
    data = r.json()
    assert "notifications_enabled" in data
    # Confirm no reset_time field in settings model
    assert "reset_time" not in data

    r2 = session.put(f"{API}/settings", json={"notifications_enabled": True})
    assert r2.status_code == 200
    assert r2.json()["notifications_enabled"] is True
    # revert
    session.put(f"{API}/settings", json={"notifications_enabled": False})


def test_delete_game(session, created_game_ids):
    # delete the second game
    gid = created_game_ids[1]
    r = session.delete(f"{API}/games/{gid}")
    assert r.status_code == 200
    # verify gone
    games = session.get(f"{API}/games").json()
    assert not any(g["id"] == gid for g in games)
    created_game_ids.remove(gid)
