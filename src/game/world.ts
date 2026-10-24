import type { World, Pos, Walls } from "./types";
import { key } from "./types";

function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
}

export function generateWorld(seed = 12345, size = 8): World {
  const r = rng(seed);
  // start with all walls
  const walls = new Map<string, Walls>();
  const cells = new Map<string, { type: "empty" }>();
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      walls.set(`${x},${y}`, { n: true, e: true, s: true, w: true });
      cells.set(`${x},${y}`, { type: "empty" });
    }
  }
  // DFS carve
  const visited = new Set<string>();
  function carve(x: number, y: number) {
    visited.add(`${x},${y}`);
    const dirs: [number, number, "n" | "e" | "s" | "w", "n" | "e" | "s" | "w"][] = [
      [0, -1, "n", "s"],
      [0, 1, "s", "n"],
      [1, 0, "e", "w"],
      [-1, 0, "w", "e"],
    ];
    // shuffle
    for (let i = dirs.length - 1; i > 0; i--) {
      const j = Math.floor(r() * (i + 1));
      [dirs[i], dirs[j]] = [dirs[j], dirs[i]];
    }
    for (const [dx, dy, d1, d2] of dirs) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= size || ny >= size) continue;
      if (visited.has(`${nx},${ny}`)) continue;
      const w1 = walls.get(`${x},${y}`)!;
      const w2 = walls.get(`${nx},${ny}`)!;
      w1[d1] = false;
      w2[d2] = false;
      carve(nx, ny);
    }
  }
  carve(0, 0);
  // add extra openings for loops
  for (let i = 0; i < size * size; i++) {
    const x = Math.floor(r() * size);
    const y = Math.floor(r() * size);
    const d = r() < 0.5 ? "e" : "s";
    let nx = x, ny = y;
    if (d === "e") nx = x + 1; else ny = y + 1;
    if (nx >= size || ny >= size) continue;
    const w1 = walls.get(`${x},${y}`)!;
    const w2 = walls.get(`${nx},${ny}`)!;
    if (d === "e") { w1.e = false; w2.w = false; }
    else { w1.s = false; w2.n = false; }
  }

  const world: World = {
    size,
    cells: new Map(),
    walls,
    pits: new Map(),
    start: { x: 0, y: 0 },
    seed,
  };
  for (const [k, v] of cells) world.cells.set(k, { type: v.type });

  // place pits: two 2-cycles
  const pitCells: Pos[] = [];
  while (pitCells.length < 4) {
    const p = { x: Math.floor(r() * size), y: Math.floor(r() * size) };
    if (p.x === 0 && p.y === 0) continue;
    if (pitCells.some((q) => q.x === p.x && q.y === p.y)) continue;
    pitCells.push(p);
  }
  // cycle 0<->1, 2<->3
  for (let i = 0; i < 4; i += 2) {
    const a = key(pitCells[i]);
    const b = key(pitCells[i + 1]);
    world.pits.set(a, b);
    world.pits.set(b, a);
    world.cells.set(a, { type: "pit" });
    world.cells.set(b, { type: "pit" });
  }

  // place treasure, false treasure, exit
  function randomCell(exclude: Set<string>) {
    while (true) {
      const p = { x: Math.floor(r() * size), y: Math.floor(r() * size) };
      const k = key(p);
      if (exclude.has(k)) continue;
      if (world.pits.has(k)) continue;
      return p;
    }
  }
  const exclude = new Set<string>(["0,0"]);
  const treasure = randomCell(exclude); exclude.add(key(treasure));
  const falseTreasure = randomCell(exclude); exclude.add(key(falseTreasure));
  const exit = randomCell(exclude); exclude.add(key(exit));

  world.cells.set(key(treasure), { type: "treasure" });
  world.cells.set(key(falseTreasure), { type: "falseTreasure" });
  world.cells.set(key(exit), { type: "exit" });
  world.start = { x: 0, y: 0 };
  world.cells.set("0,0", { type: "start" });

  return world;
}
