import { useState, useCallback, createContext, useContext } from "react";
import { CopilotKit } from "@copilotkit/react-core";
import { CopilotSidebar } from "@copilotkit/react-ui";
import { useCopilotReadable, useCopilotAction } from "@copilotkit/react-core";
import { AddTodoCard, CompleteTodoCard, DeleteTodoCard, ClearCompletedCard, SetPriorityCard, StatsCard } from "./GenUI";
import "@copilotkit/react-ui/styles.css";
import "./App.css";

// ─── CopilotKit config ────────────────────────────────────────────────────────
const CLOUD_KEY = import.meta.env.VITE_COPILOT_CLOUD_API_KEY;
const RUNTIME_URL = import.meta.env.VITE_RUNTIME_URL || "http://localhost:4000/copilotkit";
const copilotProps = CLOUD_KEY ? { publicApiKey: CLOUD_KEY } : { runtimeUrl: RUNTIME_URL };

// ─── GenUI mode context ───────────────────────────────────────────────────────
const GenUIContext = createContext({ genUI: true });
const useGenUI = () => useContext(GenUIContext);



// ─── Toggle button rendered inside the CopilotSidebar header ──────────────────
function GenUIToggle({ genUI, onToggle }) {
  return (
    <button
      onClick={onToggle}
      title={genUI ? "Switch to text responses" : "Switch to UI responses"}
      style={{
        display: "flex", alignItems: "center", gap: 6,
        padding: "4px 10px", borderRadius: 99,
        border: `1px solid ${genUI ? "#7c6af755" : "rgba(255,255,255,0.12)"}`,
        background: genUI ? "rgba(124,106,247,0.12)" : "transparent",
        color: genUI ? "#a89af5" : "#6b6b80",
        fontSize: 11, fontWeight: 600, cursor: "pointer",
        letterSpacing: "0.04em", transition: "all 0.2s",
        position: "absolute", top: 14, right: 14, zIndex: 10,
      }}
    >
      <span style={{ fontSize: 13 }}>{genUI ? "◈" : "≡"}</span>
      {genUI ? "UI" : "Text"}
    </button>
  );
}

// ─── Todo App ─────────────────────────────────────────────────────────────────
function TodoApp() {
  const { genUI, setGenUI } = useGenUI();

  const [todos, setTodos] = useState([
    { id: 1, text: "Buy groceries", done: false, priority: "medium" },
    { id: 2, text: "Read a book", done: false, priority: "low" },
    { id: 3, text: "Exercise for 30 minutes", done: true, priority: "high" },
  ]);
  const [newTodo, setNewTodo] = useState("");
  const [filter, setFilter] = useState("all");

  // Keep cleared count in a ref so the ClearCompleted card can read it
  const [lastClearedCount, setLastClearedCount] = useState(0);

  useCopilotReadable({
    description: "Current todo list with ID, text, done status, priority",
    value: todos,
  });

  // Conditionally attach render prop based on genUI toggle
  const maybeRender = (fn) => genUI ? fn : undefined;

  useCopilotAction({
    name: "addTodo",
    description: "Add a new todo item to the list",
    parameters: [
      { name: "text", type: "string", description: "The todo text", required: true },
      { name: "priority", type: "string", description: "Priority: low, medium, or high", required: false },
    ],
    handler: async ({ text, priority = "medium" }) => {
      setTodos(prev => [...prev, { id: Date.now(), text, done: false, priority }]);
      return `Added: "${text}" (${priority} priority)`;
    },
    render: maybeRender(({ args, status }) => <AddTodoCard args={args} status={status} />),
  });

  useCopilotAction({
    name: "completeTodo",
    description: "Mark a todo as done or undone by its numeric ID",
    parameters: [
      { name: "id", type: "number", description: "The todo item ID", required: true },
      { name: "done", type: "boolean", description: "true = done", required: true },
    ],
    handler: async ({ id, done }) => {
      setTodos(prev => prev.map(t => t.id === id ? { ...t, done } : t));
      return `Todo #${id} marked as ${done ? "done ✓" : "undone ○"}`;
    },
    render: maybeRender(({ args, status }) => (
      <CompleteTodoCard args={args} status={status} todos={todos} />
    )),
  });

  useCopilotAction({
    name: "deleteTodo",
    description: "Delete a todo item by its numeric ID",
    parameters: [
      { name: "id", type: "number", description: "The todo item ID", required: true },
    ],
    handler: async ({ id }) => {
      setTodos(prev => prev.filter(t => t.id !== id));
      return `Deleted todo #${id}`;
    },
    render: maybeRender(({ args, status }) => (
      <DeleteTodoCard
        args={args} status={status} todos={todos}
        onConfirm={(id) => setTodos(p => p.filter(t => t.id !== id))}
      />
    )),
  });

  useCopilotAction({
    name: "clearCompleted",
    description: "Remove all completed todo items",
    parameters: [],
    handler: async () => {
      const count = todos.filter(t => t.done).length;
      setLastClearedCount(count);
      setTodos(prev => prev.filter(t => !t.done));
      return `Cleared ${count} completed todo(s)`;
    },
    render: maybeRender(({ status }) => (
      <ClearCompletedCard status={status} count={lastClearedCount} />
    )),
  });

  useCopilotAction({
    name: "setPriority",
    description: "Change the priority of a todo item",
    parameters: [
      { name: "id", type: "number", description: "The todo item ID", required: true },
      { name: "priority", type: "string", description: "low, medium, high", required: true },
    ],
    handler: async ({ id, priority }) => {
      setTodos(prev => prev.map(t => t.id === id ? { ...t, priority } : t));
      return `Set todo #${id} priority to ${priority}`;
    },
    render: maybeRender(({ args, status }) => (
      <SetPriorityCard args={args} status={status} todos={todos} />
    )),
  });

  useCopilotAction({
    name: "getTodos",
    description: "Show a stats summary of all todos",
    parameters: [],
    handler: async () => {
      const done = todos.filter(t => t.done).length;
      return `You have ${todos.length} todos — ${done} done, ${todos.length - done} remaining.`;
    },
    render: maybeRender(({ status }) => <StatsCard status={status} todos={todos} />),
  });

  // ── Local UI handlers ────────────────────────────────────────────────────────
  const addTodo = useCallback(() => {
    if (!newTodo.trim()) return;
    setTodos(prev => [...prev, { id: Date.now(), text: newTodo.trim(), done: false, priority: "medium" }]);
    setNewTodo("");
  }, [newTodo]);

  const toggleTodo = id => setTodos(prev => prev.map(t => t.id === id ? { ...t, done: !t.done } : t));
  const deleteTodo = id => setTodos(prev => prev.filter(t => t.id !== id));

  const filtered = todos.filter(t =>
    filter === "active" ? !t.done : filter === "done" ? t.done : true
  );
  const priorities = { high: "#ef4444", medium: "#f59e0b", low: "#22c55e" };
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
          <p className="header-hint">
            {CLOUD_KEY ? "☁️ CopilotKit Cloud" : `🖥️ ${RUNTIME_URL}`}
          </p>
          {/* Toggle visible in the main app too */}
          <button
            className={`mode-toggle ${genUI ? "active" : ""}`}
            onClick={() => setGenUI(v => !v)}
            title="Toggle AI response mode"
          >
            <span>{genUI ? "◈" : "≡"}</span>
            {genUI ? "UI mode" : "Text mode"}
          </button>
        </div>
      </header>

      <main className="main-content">
        <div className="input-section">
          <input
            className="todo-input"
            placeholder="What needs to be done?"
            value={newTodo}
            onChange={e => setNewTodo(e.target.value)}
            onKeyDown={e => e.key === "Enter" && addTodo()}
          />
          <button className="add-btn" onClick={addTodo}><span>+</span></button>
        </div>

        <div className="filter-bar">
          {["all", "active", "done"].map(f => (
            <button key={f} className={`filter-btn ${filter === f ? "active" : ""}`} onClick={() => setFilter(f)}>
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>

        <ul className="todo-list">
          {filtered.length === 0 && (
            <li className="empty-state">
              <span>✨</span>
              <p>Nothing here — ask the AI assistant!</p>
            </li>
          )}
          {filtered.map(todo => (
            <li key={todo.id} className={`todo-item ${todo.done ? "done" : ""}`}>
              <button className="check-btn" onClick={() => toggleTodo(todo.id)}>
                {todo.done ? "✓" : ""}
              </button>
              <span className="todo-text">{todo.text}</span>
              <span className="priority-dot" style={{ background: priorities[todo.priority] }} title={`${todo.priority} priority`} />
              <span className="todo-id">#{todo.id}</span>
              <button className="delete-btn" onClick={() => deleteTodo(todo.id)}>×</button>
            </li>
          ))}
        </ul>

        {todos.some(t => t.done) && (
          <div className="footer-actions">
            <button className="clear-btn" onClick={() => setTodos(p => p.filter(t => !t.done))}>
              Clear completed
            </button>
          </div>
        )}
      </main>
    </div>
  );
}

// ─── Root — owns genUI state, injects via context ─────────────────────────────
export default function App() {
  const [genUI, setGenUI] = useState(true);

  return (
    <GenUIContext.Provider value={{ genUI, setGenUI }}>
      <CopilotKit {...copilotProps}>
        <CopilotSidebar
          defaultOpen={false}
          labels={{
            title: "TaskFlow AI",
            initial: "Hi! I can help manage your tasks.\n\nTry:\n• *\"Add buy milk with high priority\"*\n• *\"Show my stats\"*\n• *\"Complete task #1\"*\n\nToggle **UI / Text** mode using the button in the top-right.",
          }}
          clickOutsideToClose={false}
          // Inject the toggle button into the sidebar header area
          Header={() => (
            <GenUIToggle genUI={genUI} onToggle={() => setGenUI(v => !v)} />
          )}
        >
          <TodoApp />
        </CopilotSidebar>
      </CopilotKit>
    </GenUIContext.Provider>
  );
}
