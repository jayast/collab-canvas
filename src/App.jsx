import React, { useState, useRef, useEffect, useCallback } from "react";

const INITIAL_NODES = [
  { id: "1", x: 120, y: 160, title: "Next.js Web Client", category: "frontend", latency: "14ms" },
  { id: "2", x: 480, y: 160, title: "Golang API Gateway", category: "api", latency: "4ms" },
  { id: "3", x: 840, y: 160, title: "PostgreSQL Primary", category: "database", latency: "2ms" },
];

const INITIAL_EDGES = [
  { id: "e-1-2", from: "1", to: "2" },
  { id: "e-2-3", from: "2", to: "3" },
];

// Color definitions per architecture tier
const CATEGORY_STYLES = {
  frontend: {
    accent: "from-sky-500 to-blue-600",
    border: "border-sky-500/40",
    text: "text-sky-400",
    badge: "bg-sky-500/10 text-sky-400 border-sky-500/20",
    glow: "shadow-[0_0_15px_rgba(56,189,248,0.15)]",
  },
  api: {
    accent: "from-violet-500 to-purple-600",
    border: "border-violet-500/40",
    text: "text-violet-400",
    badge: "bg-violet-500/10 text-violet-400 border-violet-500/20",
    glow: "shadow-[0_0_15px_rgba(168,85,247,0.15)]",
  },
  database: {
    accent: "from-emerald-500 to-teal-600",
    border: "border-emerald-500/40",
    text: "text-emerald-400",
    badge: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    glow: "shadow-[0_0_15px_rgba(16,185,129,0.15)]",
  },
};

export default function App() {
  const [theme, setTheme] = useState("cyber"); // 'cyber' | 'paper' | 'obsidian'
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [isPanning, setIsPanning] = useState(false);
  const [startPan, setStartPan] = useState({ x: 0, y: 0 });

  const [history, setHistory] = useState({
    past: [],
    present: { nodes: INITIAL_NODES, edges: INITIAL_EDGES },
    future: [],
  });

  const { nodes, edges } = history.present;

  const [selectedNodeId, setSelectedNodeId] = useState(null);
  const [draggedNodeId, setDraggedNodeId] = useState(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [connectingSourceId, setConnectingSourceId] = useState(null);

  const canvasRef = useRef(null);

  // Undo / Redo engine
  const commitChange = useCallback((newPresent) => {
    setHistory((prev) => ({
      past: [...prev.past, prev.present],
      present: newPresent,
      future: [],
    }));
  }, []);

  const undo = () => {
    setHistory((prev) => {
      if (prev.past.length === 0) return prev;
      const previous = prev.past[prev.past.length - 1];
      return {
        past: prev.past.slice(0, -1),
        present: previous,
        future: [prev.present, ...prev.future],
      };
    });
  };

  const redo = () => {
    setHistory((prev) => {
      if (prev.future.length === 0) return prev;
      const next = prev.future[0];
      return {
        past: [...prev.past, prev.present],
        present: next,
        future: prev.future.slice(1),
      };
    });
  };

  const screenToWorld = (screenX, screenY) => {
    const rect = canvasRef.current.getBoundingClientRect();
    return {
      x: (screenX - rect.left - pan.x) / zoom,
      y: (screenY - rect.top - pan.y) / zoom,
    };
  };

  const handlePointerDown = (e) => {
    if (e.target.dataset.type === "canvas-bg") {
      setSelectedNodeId(null);
      setConnectingSourceId(null);
      setIsPanning(true);
      setStartPan({ x: e.clientX - pan.x, y: e.clientY - pan.y });
    }
  };

  const handlePointerMove = (e) => {
    if (isPanning) {
      setPan({ x: e.clientX - startPan.x, y: e.clientY - startPan.y });
      return;
    }

    if (draggedNodeId) {
      const worldPos = screenToWorld(e.clientX, e.clientY);
      const updatedNodes = nodes.map((node) => {
        if (node.id === draggedNodeId) {
          return {
            ...node,
            x: Math.round(worldPos.x - dragOffset.x),
            y: Math.round(worldPos.y - dragOffset.y),
          };
        }
        return node;
      });

      setHistory((prev) => ({
        ...prev,
        present: { ...prev.present, nodes: updatedNodes },
      }));
    }
  };

  const handlePointerUp = () => {
    if (isPanning) setIsPanning(false);
    if (draggedNodeId) {
      commitChange({ nodes, edges });
      setDraggedNodeId(null);
    }
  };

  const handleSourceClick = (e, nodeId) => {
    e.stopPropagation();
    setConnectingSourceId((prev) => (prev === nodeId ? null : nodeId));
  };

  const handleTargetClick = (e, targetNodeId) => {
    e.stopPropagation();
    if (!connectingSourceId || connectingSourceId === targetNodeId) {
      setConnectingSourceId(null);
      return;
    }

    const exists = edges.some(
      (edge) => edge.from === connectingSourceId && edge.to === targetNodeId
    );

    if (!exists) {
      const newEdge = {
        id: `e-${connectingSourceId}-${targetNodeId}-${Date.now()}`,
        from: connectingSourceId,
        to: targetNodeId,
      };
      commitChange({ nodes, edges: [...edges, newEdge] });
    }

    setConnectingSourceId(null);
  };

  const deleteEdge = (edgeId) => {
    commitChange({
      nodes,
      edges: edges.filter((e) => e.id !== edgeId),
    });
  };

  const addNode = (category) => {
    const center = screenToWorld(window.innerWidth / 2, window.innerHeight / 2);
    const cat = category || "api";
    const newNode = {
      id: Date.now().toString(),
      x: Math.round(center.x - 110),
      y: Math.round(center.y - 45),
      title: `Service Node ${nodes.length + 1}`,
      category: cat,
      latency: `${Math.floor(Math.random() * 8 + 2)}ms`,
    };
    commitChange({ nodes: [...nodes, newNode], edges });
    setSelectedNodeId(newNode.id);
  };

  const removeNode = (id) => {
    commitChange({
      nodes: nodes.filter((n) => n.id !== id),
      edges: edges.filter((e) => e.from !== id && e.to !== id),
    });
    setSelectedNodeId(null);
  };

  // Dynamic Theme Palette Resolver
  const themeClass =
    theme === "paper"
      ? "canvas-paper text-slate-800"
      : theme === "obsidian"
        ? "canvas-obsidian text-stone-100"
        : "canvas-cyber text-slate-100";

  const navClass =
    theme === "paper"
      ? "bg-white/80 border-slate-200 text-slate-800"
      : theme === "obsidian"
        ? "bg-stone-950/80 border-stone-800 text-stone-200"
        : "bg-slate-950/80 border-slate-800/80 text-slate-200";

  return (
    <div className={`w-screen h-screen flex flex-col select-none overflow-hidden font-sans ${themeClass}`}>
      {/* Studio Header Bar */}
      <header className={`h-14 backdrop-blur-xl border-b flex items-center justify-between px-6 z-20 shadow-md ${navClass}`}>
        <div className="flex items-center gap-3">
          {/* Logo mark */}
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-sky-500 via-indigo-500 to-fuchsia-500 flex items-center justify-center text-white font-black text-xs shadow-md">
              CF
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm tracking-tight">CollabFlow Studio</span>
                <span className="text-[10px] font-mono px-1.5 py-0.2 bg-slate-500/10 border border-slate-500/20 rounded">
                  v2.0
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Live Wiring Indicator */}
        <div className="flex items-center">
          {connectingSourceId ? (
            <div className="text-xs font-mono text-amber-300 bg-amber-500/10 border border-amber-500/30 px-3.5 py-1 rounded-full flex items-center gap-2 shadow-sm animate-pulse">
              <span className="w-2 h-2 rounded-full bg-amber-400" />
              Pick TARGET card (Green socket) to establish pipe
            </div>
          ) : (
            <div className="text-xs font-mono opacity-60 hidden md:block">
              Interactive Signal Mesh Engine • Double-click wire to disconnect
            </div>
          )}
        </div>

        {/* Header Tools */}
        <div className="flex items-center gap-2.5">
          {/* Theme Selector */}
          <div className="flex items-center bg-black/20 p-0.5 rounded-lg border border-white/10 text-xs font-mono">
            <button
              onClick={() => setTheme("cyber")}
              className={`px-2 py-1 rounded transition ${theme === "cyber" ? "bg-sky-500 text-white font-bold" : "opacity-60 hover:opacity-100"}`}
            >
              Cyber
            </button>
            <button
              onClick={() => setTheme("obsidian")}
              className={`px-2 py-1 rounded transition ${theme === "obsidian" ? "bg-amber-600 text-white font-bold" : "opacity-60 hover:opacity-100"}`}
            >
              Obsidian
            </button>
            <button
              onClick={() => setTheme("paper")}
              className={`px-2 py-1 rounded transition ${theme === "paper" ? "bg-slate-700 text-white font-bold" : "opacity-60 hover:opacity-100"}`}
            >
              Paper
            </button>
          </div>

          <div className="w-[1px] h-4 bg-white/10 mx-1" />

          {/* Quick Node Spawner */}
          <button
            onClick={() => addNode("api")}
            className="bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 text-white text-xs font-semibold px-3 py-1.5 rounded-lg shadow-sm transition active:scale-95 cursor-pointer"
          >
            + Add Microservice
          </button>

          <button
            onClick={undo}
            disabled={history.past.length === 0}
            className="bg-white/5 hover:bg-white/10 disabled:opacity-30 text-xs font-mono px-2.5 py-1.5 rounded-lg border border-white/10 transition cursor-pointer"
          >
            Undo
          </button>
          <button
            onClick={redo}
            disabled={history.future.length === 0}
            className="bg-white/5 hover:bg-white/10 disabled:opacity-30 text-xs font-mono px-2.5 py-1.5 rounded-lg border border-white/10 transition cursor-pointer"
          >
            Redo
          </button>
        </div>
      </header>

      {/* Infinite Canvas */}
      <div
        ref={canvasRef}
        data-type="canvas-bg"
        className="flex-1 relative cursor-grab active:cursor-grabbing overflow-hidden"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      >
        <div
          data-type="canvas-bg"
          className="absolute top-0 left-0 w-full h-full origin-top-left"
          style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})` }}
        >
          {/* SVG Connection Layer */}
          <svg className="absolute top-0 left-0 w-[6000px] h-[6000px] pointer-events-none">
            <defs>
              {/* Gradients for dynamic wire glowing */}
              <linearGradient id="cyberWireGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#38bdf8" />
                <stop offset="100%" stopColor="#a855f7" />
              </linearGradient>

              <marker
                id="wire-head"
                viewBox="0 0 10 10"
                refX="7"
                refY="5"
                markerWidth="6"
                markerHeight="6"
                orient="auto-start-reverse"
              >
                <path d="M 0 1.5 L 9 5 L 0 8.5 z" fill="#38bdf8" />
              </marker>
            </defs>

            {edges.map((edge) => {
              const fromNode = nodes.find((n) => n.id === edge.from);
              const toNode = nodes.find((n) => n.id === edge.to);
              if (!fromNode || !toNode) return null;

              // Card width: 230px, height: 92px
              const startX = fromNode.x + 230;
              const startY = fromNode.y + 46;
              const endX = toNode.x;
              const endY = toNode.y + 46;

              const dx = Math.max(Math.abs(endX - startX) * 0.5, 45);
              const pathData = `M ${startX} ${startY} C ${startX + dx} ${startY}, ${endX - dx} ${endY}, ${endX} ${endY}`;

              return (
                <g key={edge.id} className="pointer-events-auto group cursor-pointer">
                  {/* Invisible broad hitbox for deletion */}
                  <path
                    d={pathData}
                    fill="none"
                    stroke="transparent"
                    strokeWidth="20"
                    onClick={() => deleteEdge(edge.id)}
                  />
                  {/* Base static glow line */}
                  <path
                    d={pathData}
                    fill="none"
                    stroke="url(#cyberWireGrad)"
                    strokeWidth="2.5"
                    className="opacity-70 group-hover:stroke-rose-500 transition-colors"
                  />
                  {/* Animated pulse line on top */}
                  <path
                    d={pathData}
                    fill="none"
                    stroke="#ffffff"
                    strokeWidth="2"
                    markerEnd="url(#wire-head)"
                    className="wire-animated opacity-90 group-hover:stroke-rose-400 pointer-events-none"
                  />
                </g>
              );
            })}
          </svg>

          {/* Cards with Modern Frosted Glass Aesthetic */}
          {nodes.map((node) => {
            const isSelected = selectedNodeId === node.id;
            const isLinking = connectingSourceId === node.id;
            const categoryStyle = CATEGORY_STYLES[node.category] || CATEGORY_STYLES.api;

            return (
              <div
                key={node.id}
                onPointerDown={(e) => {
                  e.stopPropagation();
                  setSelectedNodeId(node.id);
                  const worldPos = screenToWorld(e.clientX, e.clientY);
                  setDragOffset({ x: worldPos.x - node.x, y: worldPos.y - node.y });
                  setDraggedNodeId(node.id);
                }}
                className={`absolute w-[230px] rounded-2xl p-3.5 flex flex-col justify-between cursor-move backdrop-blur-xl border transition-all ${categoryStyle.glow} ${theme === "paper"
                    ? "bg-white/90 border-slate-300 text-slate-800 shadow-lg"
                    : "bg-slate-900/80 border-white/10 text-slate-100"
                  } ${isLinking
                    ? "ring-2 ring-amber-400 border-amber-400"
                    : isSelected
                      ? "ring-2 ring-sky-400 border-sky-400"
                      : "hover:border-white/30"
                  }`}
                style={{ left: `${node.x}px`, top: `${node.y}px` }}
              >
                {/* Micro Category Top Strip */}
                <div className={`absolute top-0 left-6 right-6 h-[2px] rounded-full bg-gradient-to-r ${categoryStyle.accent}`} />

                {/* 🟢 IN Port (Left) */}
                <button
                  type="button"
                  title="Connect IN"
                  onClick={(e) => handleTargetClick(e, node.id)}
                  onPointerDown={(e) => e.stopPropagation()}
                  className={`absolute -left-3.5 top-1/2 -translate-y-1/2 w-7 h-7 rounded-xl bg-slate-950 border border-emerald-500/50 shadow-md flex items-center justify-center text-[10px] font-mono text-emerald-400 hover:scale-125 transition-transform cursor-pointer z-30 ${connectingSourceId ? "ring-4 ring-emerald-400/40 bg-emerald-950 animate-bounce" : ""
                    }`}
                >
                  <span className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.9)]" />
                </button>

                {/* 🔵 OUT Port (Right) */}
                <button
                  type="button"
                  title="Connect OUT"
                  onClick={(e) => handleSourceClick(e, node.id)}
                  onPointerDown={(e) => e.stopPropagation()}
                  className={`absolute -right-3.5 top-1/2 -translate-y-1/2 w-7 h-7 rounded-xl bg-slate-950 border border-sky-500/50 shadow-md flex items-center justify-center text-[10px] font-mono transition-transform cursor-pointer z-30 ${isLinking
                      ? "ring-4 ring-amber-400/50 bg-amber-950 border-amber-400 scale-125"
                      : "hover:scale-125"
                    }`}
                >
                  <span className={`w-2 h-2 rounded-full ${isLinking ? "bg-amber-400" : "bg-sky-400"} shadow-[0_0_8px_rgba(56,189,248,0.9)]`} />
                </button>

                {/* Card Header */}
                <div className="flex items-center justify-between pointer-events-none mb-1">
                  <div className="flex items-center gap-1.5">
                    <span className={`text-[10px] font-mono uppercase font-bold px-2 py-0.5 rounded-md border ${categoryStyle.badge}`}>
                      {node.category}
                    </span>
                    <span className="text-[10px] font-mono opacity-50">{node.latency}</span>
                  </div>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      removeNode(node.id);
                    }}
                    className="pointer-events-auto text-slate-400 hover:text-rose-400 text-sm leading-none px-1 rounded transition"
                  >
                    ×
                  </button>
                </div>

                {/* Editable Node Label */}
                <input
                  type="text"
                  value={node.title}
                  onChange={(e) => {
                    const updated = nodes.map((n) =>
                      n.id === node.id ? { ...n, title: e.target.value } : n
                    );
                    commitChange({ nodes: updated, edges });
                  }}
                  onPointerDown={(e) => e.stopPropagation()}
                  className={`border rounded-lg px-2.5 py-1 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-sky-400 transition ${theme === "paper"
                      ? "bg-slate-100/90 border-slate-300 text-slate-800"
                      : "bg-slate-950/60 border-white/10 text-white"
                    }`}
                />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}