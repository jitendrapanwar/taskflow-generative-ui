"""
TaskFlow AI – FastAPI Backend  (REST + CSV only)
CopilotKit actions removed — frontend handles AI interactions.
Python is responsible for persistence only.
"""
from __future__ import annotations

import csv, os, time
from pathlib import Path
from typing import Optional
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv

load_dotenv()

app = FastAPI(title="TaskFlow AI Backend", version="3.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── CSV helpers ───────────────────────────────────────────────────────────────
CSV_PATH = Path(os.getenv("CSV_PATH", "todos.csv"))
FIELDS   = ["id", "text", "done", "priority"]

def _ensure_csv():
    if not CSV_PATH.exists():
        with open(CSV_PATH, "w", newline="") as f:
            csv.DictWriter(f, fieldnames=FIELDS).writeheader()
        _write_all([
            {"id": "1", "text": "Buy groceries",           "done": "False", "priority": "medium"},
            {"id": "2", "text": "Read a book",              "done": "False", "priority": "low"},
            {"id": "3", "text": "Exercise for 30 minutes",  "done": "True",  "priority": "high"},
        ])

def _read_all() -> list[dict]:
    _ensure_csv()
    with open(CSV_PATH, newline="") as f:
        rows = list(csv.DictReader(f))
    for r in rows:
        r["id"]   = int(r["id"])
        r["done"] = r["done"].lower() == "true"
    return rows

def _write_all(rows: list[dict]):
    with open(CSV_PATH, "w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=FIELDS)
        w.writeheader()
        w.writerows(rows)

def _new_id() -> int:
    return int(time.time() * 1000) % 10_000_000

# ── Pydantic models ───────────────────────────────────────────────────────────
class TodoCreate(BaseModel):
    text:     str
    done:     bool = False
    priority: str  = "medium"

class TodoUpdate(BaseModel):
    text:     Optional[str]  = None
    done:     Optional[bool] = None
    priority: Optional[str]  = None

# ── REST endpoints ────────────────────────────────────────────────────────────

@app.get("/todos")
async def get_todos():
    return _read_all()

@app.post("/todos", status_code=201)
async def create_todo(todo: TodoCreate):
    rows = _read_all()
    new  = {"id": _new_id(), "text": todo.text, "done": todo.done, "priority": todo.priority}
    rows.append(new)
    _write_all(rows)
    return new

@app.patch("/todos/{todo_id}")
async def update_todo(todo_id: int, updates: TodoUpdate):
    rows = _read_all()
    for r in rows:
        if r["id"] == todo_id:
            if updates.text     is not None: r["text"]     = updates.text
            if updates.done     is not None: r["done"]     = updates.done
            if updates.priority is not None: r["priority"] = updates.priority
            _write_all(rows)
            return r
    raise HTTPException(404, f"Todo {todo_id} not found")

@app.delete("/todos/{todo_id}")
async def delete_todo(todo_id: int):
    rows = _read_all()
    new  = [r for r in rows if r["id"] != todo_id]
    if len(new) == len(rows):
        raise HTTPException(404, f"Todo {todo_id} not found")
    _write_all(new)
    return {"deleted": todo_id}

@app.delete("/todos")
async def clear_completed():
    rows  = _read_all()
    kept  = [r for r in rows if not r["done"]]
    count = len(rows) - len(kept)
    _write_all(kept)
    return {"cleared": count}

@app.get("/")
async def root():
    return {
        "status":    "ok",
        "csv":       str(CSV_PATH.resolve()),
        "endpoints": {
            "GET    /todos":          "list all todos",
            "POST   /todos":          "create a todo",
            "PATCH  /todos/{id}":     "update a todo",
            "DELETE /todos/{id}":     "delete a todo",
            "DELETE /todos":          "clear completed",
            "GET    /docs":           "swagger UI",
        }
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)