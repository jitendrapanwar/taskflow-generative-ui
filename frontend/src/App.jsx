import { useState, useCallback, useEffect, createContext, useContext } from "react";
import { CopilotKit } from "@copilotkit/react-core";
import { CopilotSidebar } from "@copilotkit/react-ui";
import { useCopilotReadable, useCopilotAction } from "@copilotkit/react-core";
import "@copilotkit/react-ui/styles.css";
import "./App.css";

// ─── Config ───────────────────────────────────────────────────────────────────
const CLOUD_KEY = import.meta.env.VITE_COPILOT_CLOUD_API_KEY;
const RUNTIME_URL = import.meta.env.VITE_RUNTIME_URL || "http://localhost:4000/copilotkit";
const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:8000";
const copilotProps = CLOUD_KEY ? { publicApiKey: CLOUD_KEY } : { runtimeUrl: RUNTIME_URL };

// ─── GenUI context ────────────────────────────────────────────────────────────
const GenUIContext = createContext({ genUI: true, setGenUI: () => { } });
const useGenUI = () => useContext(GenUIContext);

// ─── REST API helpers (all persistence goes to Python → CSV) ──────────────────
const api = {
  getAll: () => fetch(`${API_BASE}/todos`).then(r => r.json()),
  add: (text, pri) => fetch(`${API_BASE}/todos`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text, priority: pri, done: false }),
  }).then(r => r.json()),
  update: (id, patch) => fetch(`${API_BASE}/todos/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  }).then(r => r.json()),
  remove: (id) => fetch(`${API_BASE}/todos/${id}`, { method: "DELETE" }).then(r => r.json()),
  clearCompleted: () => fetch(`${API_BASE}/todos`, { method: "DELETE" }).then(r => r.json()),
};

// ─── Style tokens ─────────────────────────────────────────────────────────────
const PRIORITY_COLOR = { high: "#ef4444", medium: "#f59e0b", low: "#22c55e" };
const S = {
  card: {
    display: "flex", alignItems: "center", gap: 10, padding: "10px 14px",
    background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.09)",
    borderRadius: 10, margin: "2px 0", minWidth: 220
  },
  col: { display: "flex", flexDirection: "column" },
  row: { display: "flex", gap: 16, alignItems: "center" },
  title: { fontSize: 13, fontWeight: 600, color: "#e8e8f0" },
  sub: { fontSize: 11, color: "#6b6b80", marginTop: 2 },
  dot: (p) => ({ width: 9, height: 9, borderRadius: "50%", flexShrink: 0, background: PRIORITY_COLOR[p] || "#888" }),
  skel: (w = "80%") => ({ height: 12, background: "rgba(255,255,255,0.07)", borderRadius: 4, width: w }),
  bar: { height: 4, background: "rgba(255,255,255,0.08)", borderRadius: 2, width: "100%", overflow: "hidden" },
  fill: (p) => ({ height: "100%", background: "#7c6af7", borderRadius: 2, width: `${p}%`, transition: "width .4s" }),
  btnDanger: { padding: "5px 12px", background: "#ef4444", border: "none", borderRadius: 6, color: "#fff", fontSize: 11, cursor: "pointer" },
  btnGhost: { padding: "5px 12px", background: "transparent", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 6, color: "#6b6b80", fontSize: 11, cursor: "pointer" },
  check: (d) => ({
    width: 16, height: 16, borderRadius: 4,
    border: `1.5px solid ${d ? "#22c55e" : "rgba(255,255,255,0.2)"}`,
    background: d ? "rgba(34,197,94,0.15)" : "transparent",
    display: "flex", alignItems: "center", justifyContent: "center",
    fontSize: 9, color: "#22c55e", cursor: "pointer", flexShrink: 0
  }),
  badge: (c) => ({
    padding: "1px 7px", borderRadius: 99, background: `${c}22`,
    border: `1px solid ${c}55`, color: c, fontSize: 10, fontWeight: 600,
    textTransform: "uppercase", letterSpacing: "0.05em"
  }),
};

// ─── Generative UI card components ────────────────────────────────────────────

function Skeleton({ lines = 1 }) {
  return (
    <div style={S.card}>
      <div style={S.col}>
        {Array.from({ length: lines }).map((_, i) => (
          <div key={i} style={{ ...S.skel(i === 0 ? "75%" : "50%"), marginBottom: i < lines - 1 ? 6 : 0 }} />
        ))}
      </div>
    </div>
  );
}

function AddTodoCard({ args, status }) {
  if (status === "inProgress") return <Skeleton lines={2} />;
  const { text, priority = "medium" } = args;
  return (
    <div style={S.card}>
      <span style={S.dot(priority)} />
      <div style={S.col}>
        <span style={S.title}>{text}</span>
        <span style={S.sub}>
          Added · <span style={{ color: PRIORITY_COLOR[priority] }}>{priority}</span> priority · saved to CSV
        </span>
      </div>
    </div>
  );
}

function CompleteTodoCard({ args, status, todos }) {
  if (status === "inProgress") return <Skeleton lines={2} />;
  const todo = todos.find(t => t.id === args.id);
  return (
    <div style={S.card}>
      <div style={S.check(args.done)}>{args.done ? "✓" : ""}</div>
      <div style={S.col}>
        <span style={{ ...S.title, textDecoration: args.done ? "line-through" : "none", opacity: args.done ? 0.5 : 1 }}>
          {todo?.text ?? `Task #${args.id}`}
        </span>
        <span style={S.sub}>Marked {args.done ? "done" : "undone"} · saved to CSV</span>
      </div>
    </div>
  );
}

function DeleteTodoCard({ args, status, todos, onConfirm }) {
  const [confirmed, setConfirmed] = useState(false);
  if (status === "inProgress") return <Skeleton lines={2} />;
  const todo = todos.find(t => t.id === args.id);
  if (confirmed) {
    return (
      <div style={S.card}>
        <span>🗑</span>
        <span style={S.sub}>"{todo?.text ?? `#${args.id}`}" deleted from CSV</span>
      </div>
    );
  }
  return (
    <div style={{ ...S.card, flexDirection: "column", alignItems: "flex-start", gap: 8 }}>
      <div style={S.row}>
        <span>🗑</span>
        <span style={S.title}>Delete "{todo?.text ?? `Task #${args.id}`}"?</span>
      </div>
      <div style={S.row}>
        <button style={S.btnDanger} onClick={() => { onConfirm(args.id); setConfirmed(true); }}>Delete</button>
        <button style={S.btnGhost}>Cancel</button>
      </div>
    </div>
  );
}

function ClearCompletedCard({ status, count }) {
  if (status === "inProgress") return <Skeleton />;
  return (
    <div style={S.card}>
      <span>✨</span>
      <div style={S.col}>
        <span style={S.title}>Cleared {count} completed task{count !== 1 ? "s" : ""}</span>
        <span style={S.sub}>CSV updated</span>
      </div>
    </div>
  );
}

function SetPriorityCard({ args, status, todos }) {
  if (status === "inProgress") return <Skeleton lines={2} />;
  const todo = todos.find(t => t.id === args.id);
  return (
    <div style={S.card}>
      <span style={S.dot(args.priority)} />
      <div style={S.col}>
        <span style={S.title}>{todo?.text ?? `Task #${args.id}`}</span>
        <span style={S.sub}>
          Priority → <span style={{ color: PRIORITY_COLOR[args.priority] }}>{args.priority}</span> · saved to CSV
        </span>
      </div>
    </div>
  );
}

function StatsCard({ status, todos }) {
  if (status === "inProgress") return <Skeleton lines={2} />;
  const done = todos.filter(t => t.done).length;
  const pct = todos.length ? Math.round((done / todos.length) * 100) : 0;
  const byPriority = ["high", "medium", "low"].map(p => ({
    p, count: todos.filter(t => t.priority === p && !t.done).length,
  }));
  return (
    <div style={{ ...S.card, flexDirection: "column", alignItems: "stretch", gap: 8 }}>
      <div style={{ ...S.row, justifyContent: "space-around" }}>
        {[["Total", todos.length, "#7c6af7"], ["Done", done, "#22c55e"], ["Left", todos.length - done, "#f59e0b"]]
          .map(([l, v, c]) => (
            <div key={l} style={{ textAlign: "center" }}>
              <div style={{ fontSize: 20, fontWeight: 700, color: c }}>{v}</div>
              <div style={S.sub}>{l}</div>
            </div>
          ))}
      </div>
      <div style={S.bar}><div style={S.fill(pct)} /></div>
      <div style={{ ...S.sub, textAlign: "center" }}>{pct}% complete · from CSV</div>
      <div style={{ ...S.row, gap: 6, justifyContent: "center", marginTop: 2 }}>
        {byPriority.filter(x => x.count > 0).map(({ p, count }) => (
          <span key={p} style={S.badge(PRIORITY_COLOR[p])}>{count} {p}</span>
        ))}
      </div>
    </div>
  );
}

function GenUIToggle({ genUI, onToggle }) {
  return (
    <button onClick={onToggle}
      title={genUI ? "Switch to text" : "Switch to UI"}
      style={{
        display: "flex", alignItems: "center", gap: 6, padding: "4px 10px", borderRadius: 99,
        border: `1px solid ${genUI ? "#7c6af755" : "rgba(255,255,255,0.12)"}`,
        background: genUI ? "rgba(124,106,247,0.12)" : "transparent",
        color: genUI ? "#a89af5" : "#6b6b80", fontSize: 11, fontWeight: 600,
        cursor: "pointer", position: "absolute", top: 14, right: 14, zIndex: 10, transition: "all 0.2s"
      }}>
      <span>{genUI ? "◈" : "≡"}</span>{genUI ? "UI" : "Text"}
    </button>
  );
}

// ─── Todo App ─────────────────────────────────────────────────────────────────
function TodoApp() {
  const { genUI, setGenUI } = useGenUI();
  const [todos, setTodos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [newTodo, setNewTodo] = useState("");
  const [filter, setFilter] = useState("all");
  const [lastCleared, setLastCleared] = useState(0);

  // ── Load from CSV on mount ─────────────────────────────────────────────────
  useEffect(() => {
    api.getAll()
      .then(setTodos)
      .catch(() => console.warn("Python backend unavailable"))
      .finally(() => setLoading(false));
  }, []);

  // ── refresh: fetches CSV, updates state, returns fresh list ──────────────
  // Returning the fresh list lets handlers use it immediately in their
  // return string — before React has re-rendered with the new state.
  const refresh = async () => {
    const fresh = await api.getAll().catch(() => todos);
    setTodos(fresh);
    return fresh;
  };

  // ── AI reads the todo list ─────────────────────────────────────────────────
  useCopilotReadable({
    description: "Current todo list from CSV. Each item: id (number), text, done (bool), priority (low/medium/high).",
    value: todos,
  });

  // ── Toggle: undefined render = plain text fallback, fn = UI card ──────────
  const maybeRender = (fn) => genUI ? fn : undefined;

  // ── AI actions ────────────────────────────────────────────────────────────
  // Each handler:
  //   1. Optimistically updates local state FIRST (useCopilotReadable sees it instantly)
  //   2. Persists to CSV via REST API
  //   3. Calls refresh() to confirm CSV matches — uses returned fresh list
  //      for accurate counts in the response string

  useCopilotAction({
    name: "addTodo",
    description: "Add a new todo (saved to CSV)",
    parameters: [
      { name: "text", type: "string", description: "Todo text", required: true },
      { name: "priority", type: "string", description: "low/medium/high", required: false },
    ],
    handler: async ({ text, priority = "medium" }) => {
      // 1. Optimistic update
      const tempId = Date.now();
      setTodos(prev => [...prev, { id: tempId, text, done: false, priority }]);
      // 2. Persist
      await api.add(text, priority);
      // 3. Confirm from CSV (replaces temp item with real CSV id)
      const fresh = await refresh();
      const done = fresh.filter(t => t.done).length;
      return `Added "${text}" (${priority}). You now have ${fresh.length} todos, ${done} completed.`;
    },
    render: maybeRender(({ args, status }) =>
      <AddTodoCard args={args} status={status} />
    ),
  });

  useCopilotAction({
    name: "completeTodo",
    description: "Mark a todo done or undone",
    parameters: [
      { name: "id", type: "number", description: "Todo ID", required: true },
      { name: "done", type: "boolean", description: "true = done", required: true },
    ],
    handler: async ({ id, done }) => {
      // 1. Optimistic update — AI sees new count immediately
      setTodos(prev => prev.map(t => t.id === id ? { ...t, done } : t));
      // 2. Persist
      await api.update(id, { done });
      // 3. Confirm and build accurate response
      const fresh = await refresh();
      const completed = fresh.filter(t => t.done).length;
      const remaining = fresh.filter(t => !t.done).length;
      return `Todo #${id} marked ${done ? "done ✓" : "undone ○"}. ${completed} completed, ${remaining} remaining.`;
    },
    render: maybeRender(({ args, status }) =>
      <CompleteTodoCard args={args} status={status} todos={todos} />
    ),
  });

  useCopilotAction({
    name: "deleteTodo",
    description: "Delete a todo by ID",
    parameters: [
      { name: "id", type: "number", description: "Todo ID", required: true },
    ],
    handler: async ({ id }) => {
      // 1. Optimistic update
      setTodos(prev => prev.filter(t => t.id !== id));
      // 2. Persist
      await api.remove(id);
      // 3. Confirm
      const fresh = await refresh();
      return `Deleted todo #${id}. ${fresh.length} todos remaining.`;
    },
    render: maybeRender(({ args, status }) =>
      <DeleteTodoCard args={args} status={status} todos={todos}
        onConfirm={async (id) => { await api.remove(id); await refresh(); }} />
    ),
  });

  useCopilotAction({
    name: "clearCompleted",
    description: "Remove all completed todos",
    parameters: [],
    handler: async () => {
      const count = todos.filter(t => t.done).length;
      setLastCleared(count);
      // 1. Optimistic update
      setTodos(prev => prev.filter(t => !t.done));
      // 2. Persist
      await api.clearCompleted();
      // 3. Confirm
      const fresh = await refresh();
      return `Cleared ${count} completed todo(s). ${fresh.length} active tasks remain.`;
    },
    render: maybeRender(({ status }) =>
      <ClearCompletedCard status={status} count={lastCleared} />
    ),
  });

  useCopilotAction({
    name: "setPriority",
    description: "Change the priority of a todo",
    parameters: [
      { name: "id", type: "number", description: "Todo ID", required: true },
      { name: "priority", type: "string", description: "low/medium/high", required: true },
    ],
    handler: async ({ id, priority }) => {
      // 1. Optimistic update
      setTodos(prev => prev.map(t => t.id === id ? { ...t, priority } : t));
      // 2. Persist
      await api.update(id, { priority });
      // 3. Confirm
      await refresh();
      return `Set todo #${id} priority to ${priority}`;
    },
    render: maybeRender(({ args, status }) =>
      <SetPriorityCard args={args} status={status} todos={todos} />
    ),
  });

  useCopilotAction({
    name: "getTodos",
    description: "Show a stats summary of all todos",
    parameters: [],
    handler: async () => {
      // Always fetch fresh from CSV so counts are never stale
      const fresh = await refresh();
      const done = fresh.filter(t => t.done).length;
      const remaining = fresh.filter(t => !t.done).length;
      return `${fresh.length} todos — ${done} completed, ${remaining} remaining.`;
    },
    render: maybeRender(({ status }) =>
      <StatsCard status={status} todos={todos} />
    ),
  });

  // ── Manual UI handlers ────────────────────────────────────────────────────
  // Pattern:
  //   1. setTodos(optimistic) → instant visual feedback
  //   2. await api.*()        → persist to CSV
  //   3. await refresh()      → fetch confirmed data from API → setTodos(fresh)
  //                             useCopilotReadable is now synced with actual CSV
  //
  // Awaiting refresh() is the key — it guarantees useCopilotReadable holds
  // confirmed API data before the handler ends. React will have re-rendered
  // with the fresh state by the time the user types their next AI message.

  const addTodo = useCallback(async () => {
    if (!newTodo.trim()) return;
    const text = newTodo.trim();
    setNewTodo("");
    setTodos(prev => [...prev, { id: Date.now(), text, done: false, priority: "medium" }]);
    await api.add(text, "medium");
    await refresh(); // ← awaited: readable syncs with confirmed CSV data
  }, [newTodo]);

  const toggleTodo = async (id) => {
    const todo = todos.find(t => t.id === id);
    setTodos(prev => prev.map(t => t.id === id ? { ...t, done: !todo.done } : t));
    await api.update(id, { done: !todo.done });
    await refresh(); // ← awaited: readable syncs with confirmed CSV data
  };

  const deleteTodo = async (id) => {
    setTodos(prev => prev.filter(t => t.id !== id));
    await api.remove(id);
    await refresh(); // ← awaited: readable syncs with confirmed CSV data
  };

  const filtered = todos.filter(t =>
    filter === "active" ? !t.done : filter === "done" ? t.done : true
  );
  const remaining = todos.filter(t => !t.done).length;

  return (
    <div className="app-container">
      <header className="app-header">
        <div className="header-content">
          <div className="header-left">
            <span className="logo-icon">✦</span>
            <h1 className="app-title">TaskFlow</h1>
          </div>
          <div className="header-stats">
            <span className="stat-badge">{remaining} remaining</span>
            <span className="stat-badge done">{todos.length - remaining} done</span>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 6 }}>
          <p className="header-hint">💾 CSV · {API_BASE}</p>
          <button className={`mode-toggle ${genUI ? "active" : ""}`}
            onClick={() => setGenUI(v => !v)}>
            <span>{genUI ? "◈" : "≡"}</span>{genUI ? "UI mode" : "Text mode"}
          </button>
        </div>
      </header>

      <main className="main-content">
        <div className="input-section">
          <input className="todo-input" placeholder="What needs to be done?"
            value={newTodo} onChange={e => setNewTodo(e.target.value)}
            onKeyDown={e => e.key === "Enter" && addTodo()} />
          <button className="add-btn" onClick={addTodo}><span>+</span></button>
        </div>

        <div className="filter-bar">
          {["all", "active", "done"].map(f => (
            <button key={f} className={`filter-btn ${filter === f ? "active" : ""}`}
              onClick={() => setFilter(f)}>
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>

        <ul className="todo-list">
          {loading && <li className="empty-state"><span>⏳</span><p>Loading from CSV…</p></li>}
          {!loading && filtered.length === 0 && (
            <li className="empty-state"><span>✨</span><p>Nothing here — ask the AI!</p></li>
          )}
          {filtered.map(todo => (
            <li key={todo.id} className={`todo-item ${todo.done ? "done" : ""}`}>
              <button className="check-btn" onClick={() => toggleTodo(todo.id)}>
                {todo.done ? "✓" : ""}
              </button>
              <span className="todo-text">{todo.text}</span>
              <span className="priority-dot"
                style={{ background: PRIORITY_COLOR[todo.priority] }}
                title={`${todo.priority} priority`} />
              <span className="todo-id">#{todo.id}</span>
              <button className="delete-btn" onClick={() => deleteTodo(todo.id)}>×</button>
            </li>
          ))}
        </ul>

        {todos.some(t => t.done) && (
          <div className="footer-actions">
            <button className="clear-btn"
              onClick={async () => {
                setTodos(prev => prev.filter(t => !t.done));
                await api.clearCompleted();
                await refresh();
              }}>
              Clear completed
            </button>
          </div>
        )}
      </main>
    </div>
  );
}

// ─── Root ─────────────────────────────────────────────────────────────────────
export default function App() {
  const [genUI, setGenUI] = useState(true);
  return (
    <GenUIContext.Provider value={{ genUI, setGenUI }}>
      <CopilotKit {...copilotProps}>
        <CopilotSidebar
          defaultOpen={false}
          labels={{
            title: "TaskFlow AI",
            initial: "Hi! I manage your todos saved in CSV.\n\nToggle **◈ UI / ≡ Text** mode anytime.\n\nTry:\n• *\"Add buy milk with high priority\"*\n• *\"Complete task #1\"*\n• *\"Show my stats\"*\n• *\"Delete task #2\"*",
          }}
          clickOutsideToClose={false}
          Header={() => <GenUIToggle genUI={genUI} onToggle={() => setGenUI(v => !v)} />}
        >
          <TodoApp />
        </CopilotSidebar>
      </CopilotKit>
    </GenUIContext.Provider>
  );
}
