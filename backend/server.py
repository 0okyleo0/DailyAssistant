from fastapi import FastAPI, APIRouter, HTTPException
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional
from datetime import datetime, timezone

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Create the main app without a prefix
app = FastAPI()

# Create a router with the /api prefix
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
    url: str
    tasks: List[Task] = []
    order: int = 0

class GameCreate(BaseModel):
    name: str
    url: str
    tasks: List[Task] = []

class GameUpdate(BaseModel):
    name: Optional[str] = None
    url: Optional[str] = None
    tasks: Optional[List[Task]] = None
    order: Optional[int] = None

class Settings(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = "default"
    reset_time: str = "00:00"  # HH:MM format
    notifications_enabled: bool = False
    last_reset_date: str = ""  # ISO date string

class SettingsUpdate(BaseModel):
    reset_time: Optional[str] = None
    notifications_enabled: Optional[bool] = None
    last_reset_date: Optional[str] = None

class DailyRecord(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    date: str  # YYYY-MM-DD format
    games: List[Game]
    total_tasks: int
    completed_tasks: int
    completion_rate: float

class TaskToggle(BaseModel):
    game_id: str
    task_id: str
    completed: bool

# ===== Routes =====

@api_router.get("/")
async def root():
    return {"message": "Game Daily Tracker API"}

# Games endpoints
@api_router.get("/games", response_model=List[Game])
async def get_games():
    games = await db.games.find({}, {"_id": 0}).sort("order", 1).to_list(1000)
    return games

@api_router.post("/games", response_model=Game)
async def create_game(game_input: GameCreate):
    # Get the highest order number
    existing_games = await db.games.find({}, {"_id": 0, "order": 1}).to_list(1000)
    max_order = max([g.get("order", 0) for g in existing_games], default=-1)
    
    game_dict = game_input.model_dump()
    game_dict["id"] = f"game_{datetime.now(timezone.utc).timestamp()}"
    game_dict["order"] = max_order + 1
    
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
    
    tasks = game.get("tasks", [])
    task_found = False
    
    for task in tasks:
        if task["id"] == toggle.task_id:
            task["completed"] = toggle.completed
            task_found = True
            break
    
    if not task_found:
        raise HTTPException(status_code=404, detail="Task not found")
    
    await db.games.update_one({"id": toggle.game_id}, {"$set": {"tasks": tasks}})
    return {"message": "Task updated successfully"}

@api_router.post("/games/uncheck-all")
async def uncheck_all_tasks():
    games = await db.games.find({}, {"_id": 0}).to_list(1000)
    
    for game in games:
        tasks = game.get("tasks", [])
        for task in tasks:
            task["completed"] = False
        await db.games.update_one({"id": game["id"]}, {"$set": {"tasks": tasks}})
    
    return {"message": "All tasks unchecked successfully"}

# Settings endpoints
@api_router.get("/settings", response_model=Settings)
async def get_settings():
    settings = await db.settings.find_one({"id": "default"}, {"_id": 0})
    if not settings:
        # Create default settings
        default_settings = Settings(
            id="default",
            reset_time="00:00",
            notifications_enabled=False,
            last_reset_date=""
        )
        await db.settings.insert_one(default_settings.model_dump())
        return default_settings
    return Settings(**settings)

@api_router.put("/settings", response_model=Settings)
async def update_settings(settings_update: SettingsUpdate):
    existing = await db.settings.find_one({"id": "default"}, {"_id": 0})
    if not existing:
        # Create if doesn't exist
        default_settings = Settings(id="default")
        await db.settings.insert_one(default_settings.model_dump())
        existing = default_settings.model_dump()
    
    update_data = {k: v for k, v in settings_update.model_dump().items() if v is not None}
    
    if update_data:
        await db.settings.update_one({"id": "default"}, {"$set": update_data})
    
    updated = await db.settings.find_one({"id": "default"}, {"_id": 0})
    return Settings(**updated)

# Daily records endpoints
@api_router.post("/daily-records/save")
async def save_daily_record():
    # Get current games state
    games = await db.games.find({}, {"_id": 0}).to_list(1000)
    
    total_tasks = 0
    completed_tasks = 0
    
    for game in games:
        tasks = game.get("tasks", [])
        total_tasks += len(tasks)
        completed_tasks += sum(1 for task in tasks if task.get("completed", False))
    
    completion_rate = (completed_tasks / total_tasks * 100) if total_tasks > 0 else 0
    
    # Use yesterday's date for the record
    from datetime import timedelta
    yesterday = (datetime.now(timezone.utc) - timedelta(days=1)).strftime("%Y-%m-%d")
    
    record = DailyRecord(
        id=f"record_{yesterday}",
        date=yesterday,
        games=[Game(**game) for game in games],
        total_tasks=total_tasks,
        completed_tasks=completed_tasks,
        completion_rate=round(completion_rate, 2)
    )
    
    # Upsert the record
    await db.daily_records.update_one(
        {"id": record.id},
        {"$set": record.model_dump()},
        upsert=True
    )
    
    # Update last reset date in settings
    await db.settings.update_one(
        {"id": "default"},
        {"$set": {"last_reset_date": datetime.now(timezone.utc).strftime("%Y-%m-%d")}},
        upsert=True
    )
    
    return {"message": "Daily record saved successfully", "record": record.model_dump()}

@api_router.get("/daily-records", response_model=List[DailyRecord])
async def get_daily_records(limit: int = 30):
    records = await db.daily_records.find({}, {"_id": 0}).sort("date", -1).limit(limit).to_list(limit)
    return records

@api_router.delete("/daily-records/{record_id}")
async def delete_daily_record(record_id: str):
    result = await db.daily_records.delete_one({"id": record_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Record not found")
    return {"message": "Record deleted successfully"}

@api_router.delete("/daily-records/bulk/delete")
async def bulk_delete_records(record_ids: List[str]):
    result = await db.daily_records.delete_many({"id": {"$in": record_ids}})
    return {"message": f"{result.deleted_count} records deleted successfully"}

@api_router.get("/stats")
async def get_stats():
    # Get records for last 7 days and last 30 days
    all_records = await db.daily_records.find({}, {"_id": 0}).sort("date", -1).to_list(1000)
    
    from datetime import timedelta
    today = datetime.now(timezone.utc).date()
    
    last_7_days = [r for r in all_records if (today - datetime.fromisoformat(r["date"]).date()).days <= 7]
    last_30_days = [r for r in all_records if (today - datetime.fromisoformat(r["date"]).date()).days <= 30]
    
    def calc_avg_completion(records):
        if not records:
            return 0
        return sum(r["completion_rate"] for r in records) / len(records)
    
    return {
        "total_records": len(all_records),
        "last_7_days": {
            "count": len(last_7_days),
            "avg_completion": round(calc_avg_completion(last_7_days), 2)
        },
        "last_30_days": {
            "count": len(last_30_days),
            "avg_completion": round(calc_avg_completion(last_30_days), 2)
        }
    }

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()