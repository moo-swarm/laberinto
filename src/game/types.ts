export type Dir = "N" | "S" | "E" | "W";
export const DIRS: Dir[] = ["N", "E", "S", "W"];

export type CellType = "empty" | "pit" | "treasure" | "falseTreasure" | "exit" | "start";

export interface Pos { x: number; y: number; }

export interface Walls { n: boolean; e: boolean; s: boolean; w: boolean; }

export interface WorldCell { type: CellType; }

export interface World {
  size: number;
  cells: Map<string, WorldCell>; // key x,y
  walls: Map<string, Walls>; // per cell
  pits: Map<string, string>; // pit cell key -> target cell key
  start: Pos;
  seed: number;
}

export type ObsType = "wall" | "moved";

export interface CellObs {
  visited: boolean;
  type: CellType | "unknown";
  walls: Walls;
}

export interface Fragment {
  id: string;
  label: string;
  cells: Map<string, CellObs>; // local key
  playerPos: Pos; // local
  originNote: string;
  // overlay placement on notebook canvas (in cell units)
  placement: Pos;
  locked: boolean;
  opacity: number;
}

export interface GameState {
  world: World;
  realPos: Pos;
  carrying: "none" | "real" | "false";
  fragments: Fragment[];
  currentFragmentId: string;
  message: string;
  turn: number;
  status: "playing" | "won" | "lost";
  selectedFragmentId: string | null;
  overlayVisible: boolean;
  overlayOpacity: number;
  showConflict: boolean;
}

export function key(p: Pos) { return `${p.x},${p.y}`; }
export function parseKey(k: string): Pos { const [x, y] = k.split(",").map(Number); return { x, y }; }
export function inBounds(w: World, p: Pos) {
  return p.x >= 0 && p.y >= 0 && p.x < w.size && p.y < w.size;
}
export function wallsAt(w: World, p: Pos): Walls {
  return w.walls.get(key(p)) ?? { n: true, e: true, s: true, w: true };
}
export function cellAt(w: World, p: Pos): WorldCell {
  return w.cells.get(key(p)) ?? { type: "empty" };
}
export function neighbor(p: Pos, d: Dir): Pos {
  switch (d) {
    case "N": return { x: p.x, y: p.y - 1 };
    case "S": return { x: p.x, y: p.y + 1 };
    case "E": return { x: p.x + 1, y: p.y };
    case "W": return { x: p.x - 1, y: p.y };
  }
}
export function opposite(d: Dir): Dir {
  switch (d) {
    case "N": return "S";
    case "S": return "N";
    case "E": return "W";
    case "W": return "E";
  }
}
export function wallBetween(w: World, from: Pos, dir: Dir): boolean {
  const walls = wallsAt(w, from);
  return walls[dir.toLowerCase() as "n" | "e" | "s" | "w"];
}
export function defaultWalls(): Walls { return { n: true, e: true, s: true, w: true }; }
export function emptyObs(type: CellType = "empty"): CellObs {
  return { visited: true, type, walls: defaultWalls() };
}
