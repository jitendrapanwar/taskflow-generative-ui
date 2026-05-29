// ─── Shared style tokens ──────────────────────────────────────────────────────
const PRIORITY_COLOR = { high: "#ef4444", medium: "#f59e0b", low: "#22c55e" };

export const S = {
  card: {
    display: "flex", alignItems: "center", gap: 10,
    padding: "10px 14px",
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,255,255,0.09)",
    borderRadius: 10, margin: "2px 0", minWidth: 220,
  },
  col: { display: "flex", flexDirection: "column" },
  row: { display: "flex", gap: 16, alignItems: "center" },
  title: { fontSize: 13, fontWeight: 600, color: "#e8e8f0" },
  sub: { fontSize: 11, color: "#6b6b80", marginTop: 2 },
  dot: (p) => ({ width: 9, height: 9, borderRadius: "50%", flexShrink: 0, background: PRIORITY_COLOR[p] || "#888" }),
  skel: (w = "80%") => ({ height: 12, background: "rgba(255,255,255,0.07)", borderRadius: 4, width: w }),
  bar: { height: 4, background: "rgba(255,255,255,0.08)", borderRadius: 2, width: "100%", overflow: "hidden" },
  fill: (pct) => ({ height: "100%", background: "#7c6af7", borderRadius: 2, width: `${pct}%`, transition: "width .4s" }),
  btnDanger: {
    padding: "5px 12px", background: "#ef4444", border: "none",
    borderRadius: 6, color: "#fff", fontSize: 11, cursor: "pointer",
  },
  btnGhost: {
    padding: "5px 12px", background: "transparent",
    border: "1px solid rgba(255,255,255,0.15)",
    borderRadius: 6, color: "#6b6b80", fontSize: 11, cursor: "pointer",
  },
  check: (done) => ({
    width: 16, height: 16, borderRadius: 4,
    border: `1.5px solid ${done ? "#22c55e" : "rgba(255,255,255,0.2)"}`,
    background: done ? "rgba(34,197,94,0.15)" : "transparent",
    display: "flex", alignItems: "center", justifyContent: "center",
    fontSize: 9, color: "#22c55e", cursor: "pointer", flexShrink: 0,
  }),
  badge: (color) => ({
    padding: "1px 7px", borderRadius: 99,
    background: `${color}22`, border: `1px solid ${color}55`,
    color, fontSize: 10, fontWeight: 600, textTransform: "uppercase",
    letterSpacing: "0.05em",
  }),
};

// ─── Generative UI components ─────────────────────────────────────────────────

export function Skeleton({ lines = 1 }) {
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

export function AddTodoCard({ args, status }) {
  if (status === "inProgress") return <Skeleton lines={2} />;
  const { text, priority = "medium" } = args;
  return (
    <div style={S.card}>
      <span style={S.dot(priority)} />
      <div style={S.col}>
        <span style={S.title}>{text}</span>
        <span style={S.sub}>Added · <span style={{ color: PRIORITY_COLOR[priority] }}>{priority}</span> priority</span>
      </div>
    </div>
  );
}

export function CompleteTodoCard({ args, status, todos }) {
  if (status === "inProgress") return <Skeleton lines={2} />;
  const todo = todos.find(t => t.id === args.id);
  const done = args.done;
  return (
    <div style={S.card}>
      <div style={S.check(done)}>{done ? "✓" : ""}</div>
      <div style={S.col}>
        <span style={{ ...S.title, textDecoration: done ? "line-through" : "none", opacity: done ? 0.5 : 1 }}>
          {todo?.text ?? `Task #${args.id}`}
        </span>
        <span style={S.sub}>Marked as {done ? "done" : "undone"}</span>
      </div>
    </div>
  );
}

export function DeleteTodoCard({ args, status, todos, onConfirm }) {
  const [confirmed, setConfirmed] = useState(false);
  if (status === "inProgress") return <Skeleton lines={2} />;
  const todo = todos.find(t => t.id === args.id);
  if (confirmed) {
    return (
      <div style={S.card}>
        <span style={{ fontSize: 14 }}>🗑</span>
        <span style={S.sub}>"{todo?.text ?? `#${args.id}`}" deleted</span>
      </div>
    );
  }
  return (
    <div style={{ ...S.card, flexDirection: "column", alignItems: "flex-start", gap: 8 }}>
      <div style={S.row}>
        <span style={{ fontSize: 13 }}>🗑</span>
        <span style={S.title}>Delete "{todo?.text ?? `Task #${args.id}`}"?</span>
      </div>
      <div style={S.row}>
        <button style={S.btnDanger} onClick={() => { onConfirm(args.id); setConfirmed(true); }}>Delete</button>
        <button style={S.btnGhost}>Cancel</button>
      </div>
    </div>
  );
}

export function ClearCompletedCard({ status, count }) {
  if (status === "inProgress") return <Skeleton />;
  return (
    <div style={S.card}>
      <span style={{ fontSize: 14 }}>✨</span>
      <div style={S.col}>
        <span style={S.title}>Cleared {count} completed task{count !== 1 ? "s" : ""}</span>
        <span style={S.sub}>All done items removed</span>
      </div>
    </div>
  );
}

export function SetPriorityCard({ args, status, todos }) {
  if (status === "inProgress") return <Skeleton lines={2} />;
  const todo = todos.find(t => t.id === args.id);
  return (
    <div style={S.card}>
      <span style={S.dot(args.priority)} />
      <div style={S.col}>
        <span style={S.title}>{todo?.text ?? `Task #${args.id}`}</span>
        <span style={S.sub}>
          Priority set to <span style={{ color: PRIORITY_COLOR[args.priority] }}>{args.priority}</span>
        </span>
      </div>
    </div>
  );
}

export function StatsCard({ status, todos }) {
  if (status === "inProgress") return <Skeleton lines={2} />;
  const done = todos.filter(t => t.done).length;
  const remaining = todos.length - done;
  const pct = todos.length ? Math.round((done / todos.length) * 100) : 0;
  const byPriority = ["high", "medium", "low"].map(p => ({
    p, count: todos.filter(t => t.priority === p && !t.done).length,
  }));
  return (
    <div style={{ ...S.card, flexDirection: "column", alignItems: "stretch", gap: 8 }}>
      <div style={{ ...S.row, justifyContent: "space-around" }}>
        {[
          { label: "Total", value: todos.length, color: "#7c6af7" },
          { label: "Done", value: done, color: "#22c55e" },
          { label: "Remaining", value: remaining, color: "#f59e0b" },
        ].map(({ label, value, color }) => (
          <div key={label} style={{ textAlign: "center" }}>
            <div style={{ fontSize: 20, fontWeight: 700, color }}>{value}</div>
            <div style={S.sub}>{label}</div>
          </div>
        ))}
      </div>
      <div style={S.bar}><div style={S.fill(pct)} /></div>
      <div style={{ ...S.sub, textAlign: "center" }}>{pct}% complete</div>
      <div style={{ ...S.row, gap: 6, justifyContent: "center", marginTop: 2 }}>
        {byPriority.filter(x => x.count > 0).map(({ p, count }) => (
          <span key={p} style={S.badge(PRIORITY_COLOR[p])}>{count} {p}</span>
        ))}
      </div>
    </div>
  );
}