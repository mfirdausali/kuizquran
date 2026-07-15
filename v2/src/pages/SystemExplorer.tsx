import React from "react";
import { DataSet } from "vis-data";
import { Network, type Options } from "vis-network";
import {
  Database,
  HardDriveDownload,
  RefreshCw,
  User,
  Diamond,
  LogIn,
  LogOut,
  Cog,
  X,
  Info,
} from "lucide-react";
import {
  NODES,
  EDGES,
  type ExplorerNode,
  type NodeCategory,
  type EdgeKind,
} from "./graph-data";

// ── Design language (v2-D06 / VISUALIZE.md) ──────────────────────────────────
// teal = learning/strength path · coral = error/side-effect ONLY · amber = actors.
const C = {
  slate900: "#0f172a",
  slate800: "#1e293b",
  slate700: "#334155",
  slate400: "#94a3b8",
  slate200: "#e2e8f0",
  teal: "#1d9e75",
  coral: "#d85a30",
  amber: "#ba7517",
  purple: "#8b5cf6", // Test accent (v2-D16) — also the structured:false path
  pink: "#e879a6", // data relations (cylinders)
  green: "#3ea672", // ingress rectangles
  red: "#c8462a", // egress rectangles
  blue: "#3b82f6", // human actors (circles)
};

// Per-category node styling. Shapes chosen per VISUALIZE.md:
//   db → cylinder/database · human → circle(dot) · system → diamond
//   ingress/egress → box (rect) · engine → hexagon.
function styleForCategory(cat: NodeCategory) {
  switch (cat) {
    case "db-truth":
      return { shape: "database", color: C.pink, border: "#c05a86" };
    case "db-cache":
      return { shape: "database", color: "#5b6b8c", border: C.slate400 }; // muted = rebuildable, not truth
    case "actor-human":
      return { shape: "dot", color: C.blue, border: "#60a5fa" };
    case "actor-system":
      return { shape: "diamond", color: C.amber, border: "#d99a3a" };
    case "ingress":
      return { shape: "box", color: C.green, border: "#57c98a" };
    case "egress":
      return { shape: "box", color: C.red, border: "#e06a4a" };
    case "engine":
      return { shape: "hexagon", color: C.teal, border: "#3fbf95" };
  }
}

function edgeColor(kind: EdgeKind): string {
  switch (kind) {
    case "learn":
      return C.teal;
    case "sideEffect":
      return C.coral;
    case "actor":
      return C.amber;
    case "nonMutating":
      return C.purple;
    case "neutral":
      return C.slate700;
  }
}

const CATEGORY_LABEL: Record<NodeCategory, string> = {
  "db-truth": "Data · source of truth",
  "db-cache": "Data · rebuildable cache",
  "actor-human": "Actor · human",
  "actor-system": "Actor · system",
  ingress: "Ingress · action → event",
  egress: "Egress · side-effect / output",
  engine: "Shared engine (ported v1)",
};

function CategoryIcon({ cat }: { cat: NodeCategory }) {
  const p = { size: 16, strokeWidth: 2 };
  switch (cat) {
    case "db-truth":
      return <Database {...p} color={C.pink} />;
    case "db-cache":
      return <HardDriveDownload {...p} color={C.slate400} />;
    case "actor-human":
      return <User {...p} color={C.blue} />;
    case "actor-system":
      return <Diamond {...p} color={C.amber} />;
    case "ingress":
      return <LogIn {...p} color={C.green} />;
    case "egress":
      return <LogOut {...p} color={C.red} />;
    case "engine":
      return <RefreshCw {...p} color={C.teal} />;
  }
}

export function SystemExplorer() {
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const networkRef = React.useRef<Network | null>(null);
  const [selected, setSelected] = React.useState<ExplorerNode | null>(null);
  const [panelOpen, setPanelOpen] = React.useState(true);
  const [stabilizing, setStabilizing] = React.useState(true);

  React.useEffect(() => {
    if (!containerRef.current) return;

    const nodes = new DataSet(
      NODES.map((n) => {
        const s = styleForCategory(n.category);
        return {
          id: n.id,
          label: n.label,
          shape: s.shape,
          size: n.category === "actor-human" ? 22 : 18,
          color: {
            background: s.color,
            border: s.border,
            highlight: { background: s.color, border: C.slate200 },
          },
          font: {
            color: C.slate200,
            size: 14,
            face: "ui-sans-serif, system-ui, sans-serif",
            strokeWidth: 3,
            strokeColor: C.slate900,
          },
          borderWidth: 2,
          shadow: false,
        };
      }),
    );

    const edges = new DataSet(
      EDGES.map((e, i) => {
        const col = edgeColor(e.kind);
        return {
          id: `e${i}`,
          from: e.from,
          to: e.to,
          label: e.label,
          arrows: { to: { enabled: true, scaleFactor: 0.7 } },
          color: { color: col, highlight: C.slate200, opacity: 0.9 },
          dashes: e.kind === "nonMutating" ? [6, 6] : false,
          width: e.kind === "learn" ? 2.5 : 1.6,
          font: {
            color: C.slate400,
            size: 11,
            strokeWidth: 4,
            strokeColor: C.slate900,
            align: "middle",
          },
          smooth: { enabled: true, type: "dynamic", roundness: 0.5 },
        };
      }),
    );

    const options: Options = {
      autoResize: true,
      layout: { improvedLayout: true },
      interaction: { hover: true, dragNodes: true, tooltipDelay: 120, navigationButtons: false },
      physics: {
        enabled: true,
        stabilization: { enabled: true, iterations: 300, updateInterval: 25 },
        barnesHut: {
          gravitationalConstant: -12000,
          centralGravity: 0.25,
          springLength: 150,
          springConstant: 0.04,
          damping: 0.5,
          avoidOverlap: 0.6,
        },
      },
      nodes: { margin: { top: 8, right: 12, bottom: 8, left: 12 } as never },
    };

    const network = new Network(containerRef.current, { nodes, edges }, options);
    networkRef.current = network;

    network.on("stabilizationIterationsDone", () => setStabilizing(false));
    network.on("click", (params: { nodes: string[] }) => {
      const id = params.nodes?.[0];
      if (!id) return;
      const node = NODES.find((n) => n.id === id) ?? null;
      setSelected(node);
      if (node) setPanelOpen(true);
    });

    return () => {
      network.destroy();
      networkRef.current = null;
    };
  }, []);

  const focus = (id: string) => {
    const node = NODES.find((n) => n.id === id) ?? null;
    setSelected(node);
    setPanelOpen(true);
    networkRef.current?.selectNodes([id]);
    networkRef.current?.focus(id, { scale: 1.1, animation: { duration: 500, easingFunction: "easeInOutQuad" } });
  };

  return (
    <div style={S.root}>
      {/* LEFT — full-bleed graph canvas */}
      <div style={S.canvasWrap}>
        <header style={S.header}>
          <div>
            <div style={S.h1}>iman.app v2 · System Explorer</div>
            <div style={S.h2}>
              Living map of the real infrastructure — append-only events → engine rebuild →
              computed strength. Grounded in DECISIONS.md &amp; ../v1/packages/engine.
            </div>
          </div>
          <Legend />
        </header>

        <div ref={containerRef} style={S.canvas} />

        {stabilizing && <div style={S.stabilizing}>stabilizing physics…</div>}

        {!panelOpen && (
          <button style={S.reopen} onClick={() => setPanelOpen(true)} title="Open inspector">
            <Info size={16} /> Inspector
          </button>
        )}
      </div>

      {/* RIGHT — collapsible Context Inspector & Payload Panel */}
      {panelOpen && (
        <aside style={S.panel}>
          <div style={S.panelHead}>
            <span style={S.panelTitle}>Context Inspector &amp; Payload</span>
            <button style={S.iconBtn} onClick={() => setPanelOpen(false)} title="Collapse">
              <X size={18} />
            </button>
          </div>

          {!selected ? (
            <EmptyState onPick={focus} />
          ) : (
            <NodeInspector node={selected} onJump={focus} />
          )}
        </aside>
      )}
    </div>
  );
}

function Legend() {
  const rows: Array<[string, string]> = [
    ["learning / strength path", C.teal],
    ["error / side-effect", C.coral],
    ["actor / consistency", C.amber],
    ["structured:false (recorded, no strength change)", C.purple],
  ];
  return (
    <div style={S.legend}>
      {rows.map(([label, color]) => (
        <div key={label} style={S.legendRow}>
          <span style={{ ...S.swatch, background: color }} />
          <span style={S.legendLabel}>{label}</span>
        </div>
      ))}
    </div>
  );
}

function EmptyState({ onPick }: { onPick: (id: string) => void }) {
  const groups = Object.keys(CATEGORY_LABEL) as NodeCategory[];
  return (
    <div style={S.empty}>
      <p style={S.emptyLead}>
        Click any node to inspect its <strong>real schema / code signature</strong> —
        table columns, event fields, endpoint shape, or the ported engine function.
      </p>
      {groups.map((g) => {
        const items = NODES.filter((n) => n.category === g);
        if (!items.length) return null;
        return (
          <div key={g} style={{ marginBottom: 14 }}>
            <div style={S.groupHead}>
              <CategoryIcon cat={g} /> <span>{CATEGORY_LABEL[g]}</span>
            </div>
            <div style={S.chipWrap}>
              {items.map((n) => (
                <button key={n.id} style={S.chip} onClick={() => onPick(n.id)}>
                  {n.label}
                </button>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function NodeInspector({ node, onJump }: { node: ExplorerNode; onJump: (id: string) => void }) {
  const inbound = EDGES.filter((e) => e.to === node.id);
  const outbound = EDGES.filter((e) => e.from === node.id);
  const nameById = (id: string) => NODES.find((n) => n.id === id)?.label ?? id;

  return (
    <div style={S.inspector}>
      <div style={S.catTag}>
        <CategoryIcon cat={node.category} />
        <span>{CATEGORY_LABEL[node.category]}</span>
      </div>
      <h2 style={S.nodeTitle}>{node.label}</h2>
      <p style={S.summary}>{node.summary}</p>

      {node.nonMutating && (
        <div style={S.nonMutBadge}>
          structured:false — recorded for streak/heatmap, does NOT mutate strength (v2-D11 / v2-D14)
        </div>
      )}

      {node.signature && (
        <Section title="Code signature">
          <pre style={S.code}>{node.signature}</pre>
        </Section>
      )}

      {node.schema && node.schema.length > 0 && (
        <Section title="Schema / structural shape">
          <div style={S.schemaTable}>
            {node.schema.map((f) => (
              <div key={f.name} style={S.schemaRow}>
                <code style={S.fieldName}>{f.name}</code>
                <code style={S.fieldType}>{f.type}</code>
                {f.note && <span style={S.fieldNote}>{f.note}</span>}
              </div>
            ))}
          </div>
        </Section>
      )}

      {(inbound.length > 0 || outbound.length > 0) && (
        <Section title="Data flightpath">
          {inbound.map((e, i) => (
            <button key={`in${i}`} style={S.flowRow} onClick={() => onJump(e.from)}>
              <span style={{ ...S.dot, background: edgeColor(e.kind) }} />
              <span style={S.flowFrom}>{nameById(e.from)}</span>
              <span style={S.flowArrow}>──{e.label}──▶</span>
              <span style={S.flowHere}>this</span>
            </button>
          ))}
          {outbound.map((e, i) => (
            <button key={`out${i}`} style={S.flowRow} onClick={() => onJump(e.to)}>
              <span style={{ ...S.dot, background: edgeColor(e.kind) }} />
              <span style={S.flowHere}>this</span>
              <span style={S.flowArrow}>──{e.label}──▶</span>
              <span style={S.flowFrom}>{nameById(e.to)}</span>
            </button>
          ))}
        </Section>
      )}

      {node.source && (
        <Section title="Harvested from">
          <code style={S.source}>{node.source}</code>
        </Section>
      )}

      {node.refs.length > 0 && (
        <Section title="Grounded in">
          <div style={S.chipWrap}>
            {node.refs.map((r) => (
              <span key={r} style={S.refChip}>
                {r}
              </span>
            ))}
          </div>
        </Section>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginTop: 18 }}>
      <div style={S.sectionTitle}>
        <Cog size={13} /> {title}
      </div>
      {children}
    </div>
  );
}

// ── inline styles (self-contained; no external stylesheet) ────────────────────
const S: Record<string, React.CSSProperties> = {
  root: { display: "flex", height: "100vh", width: "100vw", overflow: "hidden", background: C.slate900, color: C.slate200, fontFamily: "ui-sans-serif, system-ui, -apple-system, sans-serif" },
  canvasWrap: { position: "relative", flex: 1, minWidth: 0, display: "flex", flexDirection: "column" },
  header: { position: "absolute", top: 0, left: 0, right: 0, zIndex: 5, display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, padding: "16px 20px", background: "linear-gradient(180deg, rgba(15,23,42,0.92), rgba(15,23,42,0))", pointerEvents: "none" },
  h1: { fontSize: 17, fontWeight: 700, letterSpacing: 0.2 },
  h2: { fontSize: 12, color: C.slate400, marginTop: 3, maxWidth: 560, lineHeight: 1.5 },
  canvas: { position: "absolute", inset: 0, background: C.slate900 },
  legend: { pointerEvents: "auto", background: "rgba(30,41,59,0.75)", border: `1px solid ${C.slate700}`, borderRadius: 8, padding: "8px 10px", display: "flex", flexDirection: "column", gap: 4 },
  legendRow: { display: "flex", alignItems: "center", gap: 7 },
  swatch: { width: 18, height: 4, borderRadius: 2, flex: "none" },
  legendLabel: { fontSize: 11, color: C.slate400 },
  stabilizing: { position: "absolute", bottom: 14, left: 18, fontSize: 11, color: C.slate400, background: "rgba(30,41,59,0.8)", padding: "4px 10px", borderRadius: 6, border: `1px solid ${C.slate700}` },
  reopen: { position: "absolute", top: 16, right: 16, zIndex: 6, display: "flex", alignItems: "center", gap: 6, background: C.slate800, color: C.slate200, border: `1px solid ${C.slate700}`, borderRadius: 8, padding: "8px 12px", cursor: "pointer", fontSize: 13 },

  panel: { width: 420, flex: "none", height: "100%", overflowY: "auto", background: "#111a2e", borderLeft: `1px solid ${C.slate700}`, display: "flex", flexDirection: "column" },
  panelHead: { position: "sticky", top: 0, display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 16px", background: "#111a2e", borderBottom: `1px solid ${C.slate700}`, zIndex: 2 },
  panelTitle: { fontSize: 13, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.6, color: C.slate400 },
  iconBtn: { background: "transparent", border: "none", color: C.slate400, cursor: "pointer", padding: 4, display: "flex" },

  empty: { padding: 16 },
  emptyLead: { fontSize: 13, color: C.slate400, lineHeight: 1.6, marginBottom: 18 },
  groupHead: { display: "flex", alignItems: "center", gap: 6, fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, color: C.slate400, marginBottom: 8 },
  chipWrap: { display: "flex", flexWrap: "wrap", gap: 6 },
  chip: { background: C.slate800, color: C.slate200, border: `1px solid ${C.slate700}`, borderRadius: 6, padding: "5px 9px", fontSize: 12, cursor: "pointer" },

  inspector: { padding: 16 },
  catTag: { display: "flex", alignItems: "center", gap: 6, fontSize: 11, fontWeight: 600, color: C.slate400, textTransform: "uppercase", letterSpacing: 0.5 },
  nodeTitle: { fontSize: 20, fontWeight: 700, margin: "8px 0 6px", color: C.slate200 },
  summary: { fontSize: 13, lineHeight: 1.6, color: "#cbd5e1" },
  nonMutBadge: { marginTop: 12, fontSize: 12, color: "#ddd6fe", background: "rgba(139,92,246,0.14)", border: `1px solid ${C.purple}`, borderRadius: 8, padding: "8px 10px", lineHeight: 1.5 },

  sectionTitle: { display: "flex", alignItems: "center", gap: 5, fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.6, color: C.teal, marginBottom: 8 },
  code: { background: "#0b1220", border: `1px solid ${C.slate700}`, borderRadius: 8, padding: "10px 12px", fontSize: 12, lineHeight: 1.6, color: "#a5f3d0", whiteSpace: "pre-wrap", wordBreak: "break-word", fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" },

  schemaTable: { display: "flex", flexDirection: "column", gap: 6 },
  schemaRow: { display: "grid", gridTemplateColumns: "minmax(70px,auto) minmax(70px,auto) 1fr", gap: 8, alignItems: "baseline", background: "#0b1220", border: `1px solid ${C.slate700}`, borderRadius: 6, padding: "6px 9px" },
  fieldName: { fontSize: 12, color: C.pink, fontFamily: "ui-monospace, Menlo, monospace", fontWeight: 600 },
  fieldType: { fontSize: 11, color: "#7dd3fc", fontFamily: "ui-monospace, Menlo, monospace" },
  fieldNote: { fontSize: 11, color: C.slate400, lineHeight: 1.4 },

  flowRow: { display: "flex", alignItems: "center", gap: 6, width: "100%", textAlign: "left", background: "transparent", border: "none", borderBottom: `1px solid ${C.slate800}`, color: C.slate200, cursor: "pointer", padding: "6px 0", fontSize: 11.5 },
  dot: { width: 8, height: 8, borderRadius: "50%", flex: "none" },
  flowFrom: { color: "#93c5fd" },
  flowHere: { color: C.slate400, fontStyle: "italic" },
  flowArrow: { color: C.slate400, fontFamily: "ui-monospace, Menlo, monospace", fontSize: 10.5 },

  source: { display: "block", fontSize: 11.5, color: C.slate400, background: "#0b1220", border: `1px solid ${C.slate700}`, borderRadius: 6, padding: "8px 10px", fontFamily: "ui-monospace, Menlo, monospace", lineHeight: 1.5, wordBreak: "break-word" },
  refChip: { fontSize: 11, color: C.amber, background: "rgba(186,117,23,0.14)", border: `1px solid ${C.amber}`, borderRadius: 5, padding: "3px 7px" },
};
