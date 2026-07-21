from fastapi import FastAPI, APIRouter, HTTPException
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, ConfigDict
from typing import List, Optional
from datetime import datetime, timezone, timedelta

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

app = FastAPI()
api_router = APIRouter(prefix="/api")


# ===== Models =====

class Task(BaseModel):
    id: str
    name: str
    completed: bool = False


class Game(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    name: str
    path: str
    order: int = 0

    # Daily
    tasks: List[Task] = []
    reset_time: str = "00:00"
    last_reset_date: str = ""
    daily_reminder_minutes: int = 0  # 0 = disabled

    # Weekly
    weekly_tasks: List[Task] = []
    weekly_reset_day: int = 1  # 0=Sun ... 6=Sat, default Monday
    weekly_reset_time: str = "00:00"
    weekly_last_reset_date: str = ""
    weekly_reminder_minutes: int = 0

    # Version (one-shot deadline)
    version_tasks: List[Task] = []
    version_deadline: str = ""  # ISO datetime "YYYY-MM-DDTHH:MM" or empty
    version_reminder_minutes: int = 0
    version_archived: bool = False


class GameCreate(BaseModel):
    name: str
    path: str
    tasks: List[Task] = []
    reset_time: str = "00:00"
    daily_reminder_minutes: int = 0
    weekly_tasks: List[Task] = []
    weekly_reset_day: int = 1
    weekly_reset_time: str = "00:00"
    weekly_reminder_minutes: int = 0
    version_tasks: List[Task] = []
    version_deadline: str = ""
    version_reminder_minutes: int = 0


class GameUpdate(BaseModel):
    name: Optional[str] = None
    path: Optional[str] = None
    tasks: Optional[List[Task]] = None
    reset_time: Optional[str] = None
    last_reset_date: Optional[str] = None
    daily_reminder_minutes: Optional[int] = None
    weekly_tasks: Optional[List[Task]] = None
    weekly_reset_day: Optional[int] = None
    weekly_reset_time: Optional[str] = None
    weekly_last_reset_date: Optional[str] = None
    weekly_reminder_minutes: Optional[int] = None
    version_tasks: Optional[List[Task]] = None
    version_deadline: Optional[str] = None
    version_reminder_minutes: Optional[int] = None
    version_archived: Optional[bool] = None
    order: Optional[int] = None


class Settings(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = "default"
    notifications_enabled: bool = False
    custom_protocol: str = "gamelauncher"


class SettingsUpdate(BaseModel):
    notifications_enabled: Optional[bool] = None
    custom_protocol: Optional[str] = None


class DailyRecord(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    date: str
    game_id: str
    game_name: str
    task_type: str = "daily"  # daily | weekly | version
    tasks: List[Task]
    total_tasks: int
    completed_tasks: int
    completion_rate: float


class TaskToggle(BaseModel):
    game_id: str
    task_id: str
    completed: bool
    task_type: str = "daily"  # daily | weekly | version


class ResetRequest(BaseModel):
    game_id: str


class UncheckAllRequest(BaseModel):
    task_type: str = "all"  # daily | weekly | version | all


# ===== Helpers =====

def field_for_type(task_type: str):
    return {
        "daily": "tasks",
        "weekly": "weekly_tasks",
        "version": "version_tasks",
    }.get(task_type, "tasks")


# ===== Routes =====

@api_router.get("/")
async def root():
    return {"message": "Daily Task Manager API"}


# Games
@api_router.get("/games", response_model=List[Game])
async def get_games():
    games = await db.games.find({}, {"_id": 0}).sort("order", 1).to_list(1000)
    return games


@api_router.post("/games", response_model=Game)
async def create_game(game_input: GameCreate):
    existing = await db.games.find({}, {"_id": 0, "order": 1}).to_list(1000)
    max_order = max([g.get("order", 0) for g in existing], default=-1)

    game_dict = game_input.model_dump()
    game_dict["id"] = f"game_{datetime.now(timezone.utc).timestamp()}"
    game_dict["order"] = max_order + 1
    game_dict["last_reset_date"] = ""
    game_dict["weekly_last_reset_date"] = ""
    game_dict["version_archived"] = False

    game_obj = Game(**game_dict)
    await db.games.insert_one(game_obj.model_dump())
    return game_obj


@api_router.put("/games/{game_id}", response_model=Game)
async def update_game(game_id: str, game_update: GameUpdate):
    existing = await db.games.find_one({"id": game_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Game not found")

    update_data = {k: v for k, v in game_update.model_dump().items() if v is not None}
    if update_data:
        await db.games.update_one({"id": game_id}, {"$set": update_data})

    updated = await db.games.find_one({"id": game_id}, {"_id": 0})
    return Game(**updated)


@api_router.delete("/games/{game_id}")
async def delete_game(game_id: str):
    result = await db.games.delete_one({"id": game_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Game not found")
    return {"message": "Game deleted successfully"}


@api_router.post("/games/toggle-task")
async def toggle_task(toggle: TaskToggle):
    game = await db.games.find_one({"id": toggle.game_id}, {"_id": 0})
    if not game:
        raise HTTPException(status_code=404, detail="Game not found")

    field = field_for_type(toggle.task_type)
    tasks = game.get(field, [])
    found = False
    for task in tasks:
        if task["id"] == toggle.task_id:
            task["completed"] = toggle.completed
            found = True
            break

    if not found:
        raise HTTPException(status_code=404, detail="Task not found")

    await db.games.update_one({"id": toggle.game_id}, {"$set": {field: tasks}})
    return {"message": "Task updated successfully"}


@api_router.post("/games/uncheck-all")
async def uncheck_all(req: UncheckAllRequest):
    games = await db.games.find({}, {"_id": 0}).to_list(1000)
    fields = []
    if req.task_type in ("daily", "all"):
        fields.append("tasks")
    if req.task_type in ("weekly", "all"):
        fields.append("weekly_tasks")
    if req.task_type in ("version", "all"):
        fields.append("version_tasks")

    for game in games:
        update = {}
        for f in fields:
            tasks = game.get(f, [])
            for t in tasks:
                t["completed"] = False
            update[f] = tasks
        if update:
            await db.games.update_one({"id": game["id"]}, {"$set": update})

    return {"message": "Tasks unchecked successfully"}


async def _save_record_and_reset(game, task_type: str, tasks_field: str, date_field: str):
    tasks = game.get(tasks_field, [])
    total = len(tasks)
    completed = sum(1 for t in tasks if t.get("completed"))
    rate = round((completed / total * 100) if total > 0 else 0, 2)

    yesterday = (datetime.now(timezone.utc) - timedelta(days=1)).strftime("%Y-%m-%d")
    record = DailyRecord(
        id=f"record_{task_type}_{game['id']}_{yesterday}",
        date=yesterday,
        game_id=game["id"],
        game_name=game["name"],
        task_type=task_type,
        tasks=[Task(**t) for t in tasks],
        total_tasks=total,
        completed_tasks=completed,
        completion_rate=rate,
    )
    await db.daily_records.update_one(
        {"id": record.id},
        {"$set": record.model_dump()},
        upsert=True,
    )

    for t in tasks:
        t["completed"] = False
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    await db.games.update_one(
        {"id": game["id"]},
        {"$set": {tasks_field: tasks, date_field: today}},
    )
    return record


@api_router.post("/games/reset-daily")
async def reset_daily(req: ResetRequest):
    game = await db.games.find_one({"id": req.game_id}, {"_id": 0})
    if not game:
        raise HTTPException(status_code=404, detail="Game not found")
    record = await _save_record_and_reset(game, "daily", "tasks", "last_reset_date")
    return {"message": "Daily reset", "record": record.model_dump()}


# Backward compatible alias
@api_router.post("/games/reset-game")
async def reset_game_alias(req: ResetRequest):
    return await reset_daily(req)


@api_router.post("/games/reset-weekly")
async def reset_weekly(req: ResetRequest):
    game = await db.games.find_one({"id": req.game_id}, {"_id": 0})
    if not game:
        raise HTTPException(status_code=404, detail="Game not found")
    record = await _save_record_and_reset(game, "weekly", "weekly_tasks", "weekly_last_reset_date")
    return {"message": "Weekly reset", "record": record.model_dump()}


@api_router.post("/games/archive-version")
async def archive_version(req: ResetRequest):
    game = await db.games.find_one({"id": req.game_id}, {"_id": 0})
    if not game:
        raise HTTPException(status_code=404, detail="Game not found")
    record = await _save_record_and_reset(game, "version", "version_tasks", "last_reset_date")
    await db.games.update_one(
        {"id": req.game_id},
        {"$set": {"version_archived": True, "version_deadline": "", "version_tasks": []}},
    )
    return {"message": "Version archived", "record": record.model_dump()}


# Settings
@api_router.get("/settings", response_model=Settings)
async def get_settings():
    settings = await db.settings.find_one({"id": "default"}, {"_id": 0})
    if not settings:
        default = Settings()
        await db.settings.insert_one(default.model_dump())
        return default
    return Settings(**settings)


@api_router.put("/settings", response_model=Settings)
async def update_settings(su: SettingsUpdate):
    existing = await db.settings.find_one({"id": "default"}, {"_id": 0})
    if not existing:
        default = Settings()
        await db.settings.insert_one(default.model_dump())

    update_data = {k: v for k, v in su.model_dump().items() if v is not None}
    if update_data:
        await db.settings.update_one({"id": "default"}, {"$set": update_data})
    updated = await db.settings.find_one({"id": "default"}, {"_id": 0})
    return Settings(**updated)


# Daily records
@api_router.get("/daily-records", response_model=List[DailyRecord])
async def get_daily_records(limit: int = 100, game_id: Optional[str] = None, task_type: Optional[str] = None):
    query = {}
    if game_id:
        query["game_id"] = game_id
    if task_type and task_type != "all":
        query["task_type"] = task_type
    records = await db.daily_records.find(query, {"_id": 0}).sort("date", -1).limit(limit).to_list(limit)
    return records


@api_router.delete("/daily-records/bulk/delete")
async def bulk_delete_records(record_ids: List[str]):
    result = await db.daily_records.delete_many({"id": {"$in": record_ids}})
    return {"message": f"{result.deleted_count} records deleted"}


@api_router.delete("/daily-records/{record_id}")
async def delete_daily_record(record_id: str):
    result = await db.daily_records.delete_one({"id": record_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Record not found")
    return {"message": "Record deleted"}


@api_router.get("/stats")
async def get_stats(game_id: Optional[str] = None, task_type: Optional[str] = None):
    query = {}
    if game_id:
        query["game_id"] = game_id
    if task_type and task_type != "all":
        query["task_type"] = task_type
    records = await db.daily_records.find(query, {"_id": 0}).sort("date", -1).to_list(1000)
    today = datetime.now(timezone.utc).date()

    def days_ago(r):
        return (today - datetime.fromisoformat(r["date"]).date()).days

    last_7 = [r for r in records if days_ago(r) <= 7]
    last_30 = [r for r in records if days_ago(r) <= 30]

    def avg(arr):
        return round(sum(r["completion_rate"] for r in arr) / len(arr), 2) if arr else 0

    return {
        "total_records": len(records),
        "last_7_days": {"count": len(last_7), "avg_completion": avg(last_7)},
        "last_30_days": {"count": len(last_30), "avg_completion": avg(last_30)},
    }


# Backup / Restore
@api_router.get("/backup")
async def backup_data():
    games = await db.games.find({}, {"_id": 0}).to_list(1000)
    settings = await db.settings.find_one({"id": "default"}, {"_id": 0}) or {}
    records = await db.daily_records.find({}, {"_id": 0}).to_list(10000)
    return {
        "version": 2,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "games": games,
        "settings": settings,
        "daily_records": records,
    }


class RestoreData(BaseModel):
    games: Optional[List[dict]] = None
    settings: Optional[dict] = None
    daily_records: Optional[List[dict]] = None


@api_router.post("/restore")
async def restore_data(data: RestoreData):
    if data.games is not None:
        await db.games.delete_many({})
        if data.games:
            await db.games.insert_many(data.games)
    if data.settings is not None:
        await db.settings.delete_many({})
        if data.settings:
            data.settings["id"] = data.settings.get("id", "default")
            await db.settings.insert_one(data.settings)
    if data.daily_records is not None:
        await db.daily_records.delete_many({})
        if data.daily_records:
            await db.daily_records.insert_many(data.daily_records)
    return {"message": "Restore complete"}


app.include_router(api_router)
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
