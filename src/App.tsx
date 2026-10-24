import React, { useState, useCallback } from "react";
import { initState, move, pickupTreasure, dropTreasure, setPlacement, toggleLock, setSelected, setOverlayVisible, setOverlayOpacity, resetFragmentPlacement } from "./game/engine";
import type { GameState, Fragment, Pos, Dir } from "./game/types";
import "./App.css";

const CELL = 26;
const CANVAS_CELLS = 16;

function App() {
  const [state, setState] = useState<GameState>(() => initState(12345));
  const [dragging, setDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState<Pos>({ x: 0, y: 0 });

  const doMove = useCallback((d: Dir) => {
    setState((s) => move(s, d));
  }, []);

  const selected = state.fragments.find((f) => f.id === state.selectedFragmentId) ?? null;

  const setPlacementState = (id: string, p: Pos) => {
    setState((s) => setPlacement(s, id, p));
  };

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "ArrowUp") doMove("N");
    else if (e.key === "ArrowDown") doMove("S");
    else if (e.key === "ArrowLeft") doMove("W");
    else if (e.key === "ArrowRight") doMove("E");
    else if (selected) {
      if (e.key === "w") setPlacementState(selected.id, { x: selected.placement.x, y: selected.placement.y - 1 });
      if (e.key === "s") setPlacementState(selected.id, { x: selected.placement.x, y: selected.placement.y + 1 });
      if (e.key === "a") setPlacementState(selected.id, { x: selected.placement.x - 1, y: selected.placement.y });
      if (e.key === "d") setPlacementState(selected.id, { x: selected.placement.x + 1, y: selected.placement.y });
    }
  }, [selected, doMove]);

  const onPointerDown = (e: React.PointerEvent) => {
    if (!selected) return;
    const canvas = document.getElementById("notebook-canvas");
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const cx = e.clientX - rect.left;
    const cy = e.clientY - rect.top;
    const fx = selected.placement.x * CELL;
    const fy = selected.placement.y * CELL;
    setDragOffset({ x: Math.floor((cx - fx) / CELL), y: Math.floor((cy - fy) / CELL) });
    setDragging(true);
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragging || !selected) return;
    const canvas = document.getElementById("notebook-canvas");
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const cx = e.clientX - rect.left;
    const cy = e.clientY - rect.top;
    const px = Math.floor(cx / CELL) - dragOffset.x;
    const py = Math.floor(cy / CELL) - dragOffset.y;
    setPlacementState(selected.id, { x: px, y: py });
  };

  const onPointerUp = () => setDragging(false);

  const renderFragmentGhost = (frag: Fragment) => {
    const cells = Array.from(frag.cells.entries());
    return cells.map(([k, obs]) => {
      const lp = k.split(",").map(Number);
      const cx = (frag.placement.x + lp[0]) * CELL;
      const cy = (frag.placement.y + lp[1]) * CELL;
      const color = frag.locked ? "rgba(197,154,73,0.95)" : "rgba(78,170,161,0.9)";
      return (
        <g key={`${frag.id}-${k}`}>
          <rect x={cx + 1} y={cy + 1} width={CELL - 2} height={CELL - 2} fill="none" stroke={color} strokeWidth={obs.visited ? 2 : 1} strokeDasharray={frag.locked ? "0" : "4 2"} />
          {obs.type === "pit" && <image href="/assets/pit.png" x={cx + 4} y={cy + 4} width={CELL - 8} height={CELL - 8} opacity={0.9} />}
          {obs.type === "treasure" && <image href="/assets/treasure.png" x={cx + 4} y={cy + 4} width={CELL - 8} height={CELL - 8} opacity={0.9} />}
          {obs.type === "falseTreasure" && <image href="/assets/treasure.png" x={cx + 4} y={cy + 4} width={CELL - 8} height={CELL - 8} opacity={0.5} />}
          {obs.type === "exit" && <text x={cx + CELL / 2} y={cy + CELL / 2 + 4} fontSize={9} textAnchor="middle" fill="#C59A49">ВЫХ</text>}
          {obs.walls.n && <line x1={cx} y1={cy} x2={cx + CELL} y2={cy} stroke={color} strokeWidth={2} />}
          {obs.walls.s && <line x1={cx} y1={cy + CELL} x2={cx + CELL} y2={cy + CELL} stroke={color} strokeWidth={2} />}
          {obs.walls.w && <line x1={cx} y1={cy} x2={cx} y2={cy + CELL} stroke={color} strokeWidth={2} />}
          {obs.walls.e && <line x1={cx + CELL} y1={cy} x2={cx + CELL} y2={cy + CELL} stroke={color} strokeWidth={2} />}
        </g>
      );
    });
  };

  return (
    <div className="app" tabIndex={0} onKeyDown={handleKeyDown}>
      <header className="topbar">
        <h1>Лабиринт</h1>
        <div className="status">
          <span>Ход: {state.turn}</span>
          <span>Клад: {state.carrying === "none" ? "нет" : state.carrying === "real" ? "настоящий" : "ложный"}</span>
          <span>Статус: {state.status}</span>
        </div>
      </header>

      <div className="main">
        <section className="notebook">
          <div className="notebook-header">
            <span>Блокнот картографа</span>
            <label>
              <input type="checkbox" checked={state.overlayVisible} onChange={(e) => setState((s) => setOverlayVisible(s, e.target.checked))} />
              слой
            </label>
            <input type="range" min={0.1} max={1} step={0.05} value={state.overlayOpacity}
              onChange={(e) => setState((s) => setOverlayOpacity(s, parseFloat(e.target.value)))} />
          </div>
          <svg id="notebook-canvas" width={CANVAS_CELLS * CELL} height={CANVAS_CELLS * CELL} className="canvas"
            onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp}>
            <defs>
              <pattern id="grid" width={CELL} height={CELL} patternUnits="userSpaceOnUse">
                <path d={`M ${CELL} 0 L 0 0 0 ${CELL}`} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={1} />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#grid)" />
            {state.overlayVisible && selected && (
              <g opacity={state.overlayOpacity}>
                {renderFragmentGhost(selected)}
              </g>
            )}
          </svg>
          <p className="hint">Перетащи фрагмент мышью. Стрелки — ход. W/A/S/D — сдвиг фрагмента.</p>
        </section>

        <aside className="side">
          <div className="panel message">
            <h3>Ведущий</h3>
            <p>{state.message}</p>
          </div>

          <div className="panel controls">
            <h3>Ход</h3>
            <div className="pad">
              <button onClick={() => doMove("N")}>↑</button>
              <div className="pad-row">
                <button onClick={() => doMove("W")}>←</button>
                <button onClick={() => doMove("S")}>↓</button>
                <button onClick={() => doMove("E")}>→</button>
              </div>
            </div>
            <div className="actions">
              <button onClick={() => setState((s) => pickupTreasure(s))}>Взять клад</button>
              <button onClick={() => setState((s) => dropTreasure(s))}>Оставить клад</button>
            </div>
          </div>

          <div className="panel inventory">
            <h3>Фрагменты</h3>
            {state.fragments.map((f) => (
              <div key={f.id} className={`frag-card ${f.id === state.selectedFragmentId ? "selected" : ""}`}>
                <button className="frag-select" onClick={() => setState((s) => setSelected(s, f.id))}>
                  {f.label} {f.locked ? "🔒" : ""}
                </button>
                <div className="frag-actions">
                  <button onClick={() => setState((s) => toggleLock(s, f.id))}>{f.locked ? "Снять" : "Закрепить"}</button>
                  <button onClick={() => setState((s) => resetFragmentPlacement(s, f.id))}>Сброс</button>
                </div>
              </div>
            ))}
          </div>

          <div className="panel">
            <button onClick={() => setState(initState(Math.floor(Math.random() * 99999)))}>Новая карта</button>
          </div>
        </aside>
      </div>
    </div>
  );
}

export default App;
