import type { GameState, World, Fragment, Pos, Dir, CellObs, CellType } from "./types";
import { key, parseKey, inBounds, wallsAt, cellAt, neighbor, opposite, wallBetween, defaultWalls } from "./types";
import { generateWorld } from "./world";

let fragCounter = 0;
function newFragId() { return `F${++fragCounter}`; }

function makeFragment(label: string, startType: CellType): Fragment {
  const cells = new Map<string, CellObs>();
  cells.set("0,0", { visited: true, type: startType, walls: defaultWalls() });
  return {
    id: newFragId(),
    label,
    cells,
    playerPos: { x: 0, y: 0 },
    originNote: label,
    placement: { x: 0, y: 0 },
    locked: false,
    opacity: 0.55,
  };
}

export function initState(seed = 12345): GameState {
  const world = generateWorld(seed, 8);
  const startType = cellAt(world, world.start).type;
  const frag = makeFragment("A · Старт", startType);
  // sync walls for start cell from world
  syncCellWalls(frag, { x: 0, y: 0 }, world, world.start);
  return {
    world,
    realPos: { ...world.start },
    carrying: "none",
    fragments: [frag],
    currentFragmentId: frag.id,
    message: "Ты входишь в лабиринт. Найди клад и вынеси его через выход.",
    turn: 0,
    status: "playing",
    selectedFragmentId: frag.id,
    overlayVisible: true,
    overlayOpacity: 0.55,
    showConflict: true,
  };
}

function syncCellWalls(frag: Fragment, local: Pos, world: World, worldPos: Pos) {
  const obs = frag.cells.get(key(local));
  if (!obs) return;
  obs.walls = { ...wallsAt(world, worldPos) };
}

function currentFrag(state: GameState): Fragment {
  return state.fragments.find((f) => f.id === state.currentFragmentId)!;
}

export function move(state: GameState, dir: Dir): GameState {
  if (state.status !== "playing") return state;
  const w = state.world;
  const from = state.realPos;
  // wall check
  if (wallBetween(w, from, dir)) {
    // record wall in current fragment at current local pos
    const frag = currentFrag(state);
    const cell = frag.cells.get(key(frag.playerPos));
    if (cell) cell.walls[dir.toLowerCase() as "n" | "e" | "s" | "w"] = true;
    // neighbor maybe unknown; ensure not marking passage
    const ns = { ...state, message: `Стена на ${dir}. Ты остался на месте.`, turn: state.turn + 1 };
    return ns;
  }
  const to = neighbor(from, dir);
  if (!inBounds(w, to)) {
    const ns = { ...state, message: `Граница лабиринта.`, turn: state.turn + 1 };
    return ns;
  }
  // open passage
  const frag = currentFrag(state);
  const cell = frag.cells.get(key(frag.playerPos));
  if (cell) cell.walls[dir.toLowerCase() as "n" | "e" | "s" | "w"] = false;
  // move real
  let realPos = to;
  let carrying = state.carrying;
  let message = "";
  const cellType = cellAt(w, to).type;

  // handle pit teleport
  if (cellType === "pit") {
    const targetKey = w.pits.get(key(to))!;
    const target = parseKey(targetKey);
    // record visited pit cell in current fragment
    const localTo = { x: frag.playerPos.x + (to.x - from.x), y: frag.playerPos.y + (to.y - from.y) };
    // ensure cell exists
    if (!frag.cells.has(key(localTo))) {
      frag.cells.set(key(localTo), { visited: true, type: "pit", walls: { ...wallsAt(w, to) } });
    } else {
      const c = frag.cells.get(key(localTo))!;
      c.visited = true; c.type = "pit"; c.walls = { ...wallsAt(w, to) };
    }
    // passage between current and pit
    // open already
    // new fragment at target
    const newFrag = makeFragment(`Фрагмент ${state.fragments.length + 1} · После ямы`, cellAt(w, target).type);
    syncCellWalls(newFrag, { x: 0, y: 0 }, w, target);
    // record pit cell type target
    const tc = newFrag.cells.get("0,0")!;
    tc.type = cellAt(w, target).type;
    tc.walls = { ...wallsAt(w, target) };
    // update real pos to target
    realPos = target;
    // message
    message = "Ты попал в яму и потерял ориентир. Новый фрагмент карты.";
    // add fragment
    const fragments = [...state.fragments, newFrag];
    const newState: GameState = {
      ...state,
      realPos,
      carrying,
      fragments,
      currentFragmentId: newFrag.id,
      selectedFragmentId: newFrag.id,
      message,
      turn: state.turn + 1,
    };
    // handle treasure/exit at target? treat below generically? target could be pit? no (pits paired not same). Could be treasure/exit. Let's handle events for target.
    return applyCellEvent(newState, target, cellAt(w, target).type);
  }

  // normal move: update fragment local
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const localTo = { x: frag.playerPos.x + dx, y: frag.playerPos.y + dy };
  if (!frag.cells.has(key(localTo))) {
    frag.cells.set(key(localTo), { visited: true, type: cellType, walls: { ...wallsAt(w, to) } });
  } else {
    const c = frag.cells.get(key(localTo))!;
    c.visited = true;
    if (c.type === "unknown") c.type = cellType;
    c.walls = { ...wallsAt(w, to) };
  }
  frag.playerPos = localTo;
  // passage wall false already on 'from' side; set opposite on 'to' side? open
  const toCell = frag.cells.get(key(localTo))!;
  toCell.walls[opposite(dir).toLowerCase() as "n" | "e" | "s" | "w"] = false;

  message = cellMessage(cellType);
  const ns: GameState = {
    ...state,
    realPos: to,
    carrying,
    message,
    turn: state.turn + 1,
  };
  return applyCellEvent(ns, to, cellType);
}

function cellMessage(t: CellType): string {
  switch (t) {
    case "empty": return "Пустая клетка.";
    case "start": return "Стартовая клетка.";
    case "treasure": return "Найден запечатанный ларец.";
    case "falseTreasure": return "Найден ларец.";
    case "exit": return "Выход из лабиринта.";
    case "pit": return "Яма.";
    default: return "Клетка.";
  }
}

function applyCellEvent(state: GameState, _pos: Pos, type: CellType): GameState {
  if (type === "exit") {
    if (state.carrying !== "none") {
      // reveal
      const real = state.carrying === "real";
      return {
        ...state,
        status: real ? "won" : "lost",
        message: real
          ? "Вы вынесли настоящий клад. Победа!"
          : "Это был ложный клад. Поражение.",
      };
    }
    return { ...state, message: "Выход рядом. Нужно нести клад." };
  }
  return state;
}

export function pickupTreasure(state: GameState): GameState {
  if (state.status !== "playing") return state;
  const t = cellAt(state.world, state.realPos).type;
  if (t !== "treasure" && t !== "falseTreasure") {
    return { ...state, message: "Здесь нет клада." };
  }
  if (state.carrying !== "none") {
    return { ...state, message: "Ты уже несёшь клад." };
  }
  return {
    ...state,
    carrying: t === "treasure" ? "real" : "false",
    message: "Клад подобран. Найди выход.",
    turn: state.turn + 1,
  };
}

export function dropTreasure(state: GameState): GameState {
  if (state.carrying === "none") return state;
  return { ...state, carrying: "none", message: "Клад оставлен.", turn: state.turn + 1 };
}

export function resetFragmentPlacement(state: GameState, id: string): GameState {
  const frags = state.fragments.map((f) => (f.id === id ? { ...f, placement: { x: 0, y: 0 }, locked: false } : f));
  return { ...state, fragments: frags };
}

export function setPlacement(state: GameState, id: string, p: Pos): GameState {
  const frags = state.fragments.map((f) => (f.id === id ? { ...f, placement: p } : f));
  return { ...state, fragments: frags };
}

export function toggleLock(state: GameState, id: string): GameState {
  const frags = state.fragments.map((f) => (f.id === id ? { ...f, locked: !f.locked } : f));
  return { ...state, fragments: frags };
}

export function setSelected(state: GameState, id: string | null): GameState {
  return { ...state, selectedFragmentId: id };
}

export function setOverlayVisible(state: GameState, v: boolean): GameState {
  return { ...state, overlayVisible: v };
}

export function setOverlayOpacity(state: GameState, v: number): GameState {
  return { ...state, overlayOpacity: v };
}
