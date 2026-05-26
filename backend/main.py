"""
TaskFlow AI – FastAPI Backend
Exposes CopilotKit remote endpoint so the React frontend can call
Python-side AI actions (optional when using Copilot Cloud).
"""

from __future__ import annotations

import os
from typing import Optional
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv

from copilotkit.integrations.fastapi import add_fastapi_endpoint
from copilotkit import CopilotKitRemoteEndpoint, Action as CopilotAction

load_dotenv()

app = FastAPI(title="TaskFlow AI Backend", version="1.0.0")

# ── CORS ─────────────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── In-memory todo store (shared state for demo) ──────────────────────────────
class Todo(BaseModel):
    id: int
    text: str
    done: bool = False
    priority: str = "medium"


todos: list[dict] = [
    {"id": 1, "text": "Buy groceries", "done": False, "priority": "medium"},
    {"id": 2, "text": "Read a book", "done": False, "priority": "low"},
    {"id": 3, "text": "Exercise for 30 minutes", "done": True, "priority": "high"},
]

# ── REST API endpoints ────────────────────────────────────────────────────────

@app.get("/todos")
async def get_todos():
    return todos


@app.post("/todos")
async def create_todo(todo: Todo):
    todos.append(todo.model_dump())
    return todo


@app.patch("/todos/{todo_id}")
async def update_todo(todo_id: int, updates: dict):
    for t in todos:
        if t["id"] == todo_id:
            t.update(updates)
            return t
    return {"error": "not found"}, 404


@app.delete("/todos/{todo_id}")
async def delete_todo(todo_id: int):
    global todos
    todos = [t for t in todos if t["id"] != todo_id]
    return {"deleted": todo_id}


# ── CopilotKit Actions (Python-side) ─────────────────────────────────────────
# These are called by the AI when using the self-hosted runtime option.

async def action_add_todo(text: str, priority: Optional[str] = "medium"):
    """Add a new todo item."""
    import time
    new_id = int(time.time() * 1000) % 1_000_000
    new_todo = {"id": new_id, "text": text, "done": False, "priority": priority}
    todos.append(new_todo)
    return f'Added todo: "{text}" with {priority} priority (id={new_id})'


async def action_complete_todo(id: int, done: bool):
    """Mark a todo item as done or not done."""
    for t in todos:
        if t["id"] == id:
            t["done"] = done
            return f'Marked todo #{id} as {"done" if done else "undone"}'
    return f"Todo #{id} not found"


async def action_delete_todo(id: int):
    """Delete a todo item."""
    global todos
    before = len(todos)
    todos = [t for t in todos if t["id"] != id]
    if len(todos) < before:
        return f"Deleted todo #{id}"
    return f"Todo #{id} not found"


async def action_clear_completed():
    """Clear all completed todos."""
    global todos
    count = sum(1 for t in todos if t["done"])
    todos = [t for t in todos if not t["done"]]
    return f"Cleared {count} completed todo(s)"


async def action_get_todos():
    """Get a summary of all todos."""
    total = len(todos)
    done = sum(1 for t in todos if t["done"])
    items = "\n".join(
        f'  #{t["id"]} [{t["priority"].upper()}] {"✓" if t["done"] else "○"} {t["text"]}'
        for t in todos
    )
    return f"You have {total} todos ({done} done, {total - done} remaining):\n{items}"


# ── Register actions with CopilotKit ─────────────────────────────────────────
sdk = CopilotKitRemoteEndpoint(
    actions=[
        CopilotAction(
            name="addTodo",
            description="Add a new todo item to the list",
            parameters=[
                {"name": "text", "type": "string", "description": "The todo text", "required": True},
                {"name": "priority", "type": "string", "description": "Priority: low, medium, high", "required": False},
            ],
            handler=action_add_todo,
        ),
        CopilotAction(
            name="completeTodo",
            description="Mark a todo item as done or undone",
            parameters=[
                {"name": "id", "type": "number", "description": "Todo ID", "required": True},
                {"name": "done", "type": "boolean", "description": "Whether done", "required": True},
            ],
            handler=action_complete_todo,
        ),
        CopilotAction(
            name="deleteTodo",
            description="Delete a todo item by ID",
            parameters=[
                {"name": "id", "type": "number", "description": "Todo ID", "required": True},
            ],
            handler=action_delete_todo,
        ),
        CopilotAction(
            name="clearCompleted",
            description="Clear all completed todos",
            parameters=[],
            handler=action_clear_completed,
        ),
        CopilotAction(
            name="getTodos",
            description="Get a summary of all current todos",
            parameters=[],
            handler=action_get_todos,
        ),
    ]
)

# Mount the CopilotKit endpoint (no trailing slash)
add_fastapi_endpoint(app, sdk, "/copilotkit")


@app.get("/")
async def root():
    return {
        "status": "ok",
        "endpoints": {
            "todos": "/todos",
            "copilotkit": "/copilotkit",
            "docs": "/docs",
        },
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)