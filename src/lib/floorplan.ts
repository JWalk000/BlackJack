export type UnitType = "studio" | "oneBed" | "twoBed" | "threeBed";

export type MixCounts = {
  studio: number;
  oneBed: number;
  twoBed: number;
  threeBed: number;
  units: number;
  efficiency: number;
};

/** Footprint modules in plan feet (approx.) */
export const UNIT_DIMS: Record<
  UnitType,
  { w: number; d: number; label: string; sf: number; rooms: RoomSpec[] }
> = {
  studio: {
    w: 18,
    d: 26,
    label: "Studio",
    sf: 470,
    rooms: [
      { id: "entry", x: 0.05, y: 0.72, w: 0.28, h: 0.22, name: "Entry" },
      { id: "kit", x: 0.05, y: 0.42, w: 0.38, h: 0.28, name: "Kit" },
      { id: "bath", x: 0.05, y: 0.08, w: 0.28, h: 0.28, name: "Bath" },
      { id: "lr", x: 0.42, y: 0.08, w: 0.52, h: 0.86, name: "Living / Sleep" },
    ],
  },
  oneBed: {
    w: 24,
    d: 30,
    label: "1 Bed",
    sf: 720,
    rooms: [
      { id: "entry", x: 0.05, y: 0.72, w: 0.22, h: 0.22, name: "Entry" },
      { id: "kit", x: 0.05, y: 0.4, w: 0.34, h: 0.28, name: "Kitchen" },
      { id: "lr", x: 0.42, y: 0.4, w: 0.52, h: 0.54, name: "Living" },
      { id: "bath", x: 0.05, y: 0.08, w: 0.28, h: 0.26, name: "Bath" },
      { id: "br", x: 0.38, y: 0.08, w: 0.56, h: 0.28, name: "Bedroom" },
    ],
  },
  twoBed: {
    w: 30,
    d: 34,
    label: "2 Bed",
    sf: 980,
    rooms: [
      { id: "entry", x: 0.04, y: 0.74, w: 0.2, h: 0.2, name: "Entry" },
      { id: "kit", x: 0.04, y: 0.46, w: 0.3, h: 0.24, name: "Kitchen" },
      { id: "lr", x: 0.38, y: 0.46, w: 0.56, h: 0.48, name: "Living" },
      { id: "bath", x: 0.04, y: 0.18, w: 0.22, h: 0.22, name: "Bath" },
      { id: "br1", x: 0.3, y: 0.04, w: 0.32, h: 0.36, name: "BR 1" },
      { id: "br2", x: 0.66, y: 0.04, w: 0.3, h: 0.36, name: "BR 2" },
    ],
  },
  threeBed: {
    w: 34,
    d: 38,
    label: "3 Bed",
    sf: 1220,
    rooms: [
      { id: "entry", x: 0.04, y: 0.76, w: 0.18, h: 0.18, name: "Entry" },
      { id: "kit", x: 0.04, y: 0.5, w: 0.28, h: 0.22, name: "Kitchen" },
      { id: "lr", x: 0.36, y: 0.5, w: 0.58, h: 0.44, name: "Living" },
      { id: "bath1", x: 0.04, y: 0.26, w: 0.18, h: 0.18, name: "Bath" },
      { id: "br1", x: 0.04, y: 0.04, w: 0.28, h: 0.2, name: "BR 1" },
      { id: "br2", x: 0.36, y: 0.04, w: 0.28, h: 0.4, name: "BR 2" },
      { id: "br3", x: 0.68, y: 0.04, w: 0.28, h: 0.4, name: "BR 3" },
    ],
  },
};

export type RoomSpec = {
  id: string;
  /** 0–1 fractions relative to unit box */
  x: number;
  y: number;
  w: number;
  h: number;
  name: string;
};

export type PlacedUnit = {
  id: string;
  type: UnitType;
  /** feet from plate origin */
  x: number;
  y: number;
  w: number;
  d: number;
  /** north = top of plate, corridor side is inner */
  side: "north" | "south";
  label: string;
  unitNo: number;
};

export type FloorPlate = {
  widthFt: number;
  depthFt: number;
  corridorY: number;
  corridorH: number;
  units: PlacedUnit[];
  cores: { x: number; y: number; w: number; d: number; kind: "stair" | "elev" | "trash" }[];
  floorUnitCount: number;
  floorsEstimate: number;
};

const TYPE_ORDER: UnitType[] = ["studio", "oneBed", "twoBed", "threeBed"];

/** Build a representative typical floor from mix ratios */
export function buildFloorPlate(mix: MixCounts): FloorPlate {
  const total = Math.max(mix.units, 1);
  const targetPerFloor = Math.min(
    16,
    Math.max(8, Math.round(10 + (mix.efficiency - 0.75) * 40)),
  );

  const queue: UnitType[] = [];
  const weights: [UnitType, number][] = [
    ["studio", mix.studio / total],
    ["oneBed", mix.oneBed / total],
    ["twoBed", mix.twoBed / total],
    ["threeBed", mix.threeBed / total],
  ];

  // Greedy assignment of ~targetPerFloor units matching mix proportions
  const assigned: Record<UnitType, number> = {
    studio: 0,
    oneBed: 0,
    twoBed: 0,
    threeBed: 0,
  };
  for (let i = 0; i < targetPerFloor; i++) {
    let best: UnitType = "oneBed";
    let bestScore = -Infinity;
    for (const [t, w] of weights) {
      if (w <= 0 && i > 0) continue;
      const current = assigned[t] / Math.max(i, 1);
      const score = w - current + (w > 0 ? 0.001 : -1);
      if (score > bestScore) {
        bestScore = score;
        best = t;
      }
    }
    assigned[best] += 1;
    queue.push(best);
  }

  // Sort alternating larger/smaller for cleaner packing: put 2/3 beds at ends, studios/1s mid
  queue.sort((a, b) => {
    const rank = { threeBed: 0, twoBed: 1, oneBed: 2, studio: 3 };
    return rank[a] - rank[b];
  });

  const corridorH = 6;
  // Unit depth on each side = max depth among units used
  const northDepth = Math.max(...queue.map((t) => UNIT_DIMS[t].d));
  const southDepth = northDepth;
  const depthFt = northDepth + corridorH + southDepth;

  const coreW = 12;
  const gap = 0.5; // party wall
  const units: PlacedUnit[] = [];
  let cursorX = coreW + 2;
  let unitNo = 1;

  // Place in pairs (north + south) along corridor
  for (let i = 0; i < queue.length; i += 2) {
    const northType = queue[i];
    const southType = queue[i + 1] ?? queue[i];
    const nw = UNIT_DIMS[northType].w;
    const sw = UNIT_DIMS[southType].w;
    const bayW = Math.max(nw, sw);

    units.push({
      id: `N${unitNo}`,
      type: northType,
      x: cursorX + (bayW - nw) / 2,
      y: 0,
      w: nw,
      d: UNIT_DIMS[northType].d,
      side: "north",
      label: UNIT_DIMS[northType].label,
      unitNo: unitNo++,
    });

    if (queue[i + 1]) {
      units.push({
        id: `S${unitNo}`,
        type: southType,
        x: cursorX + (bayW - sw) / 2,
        y: northDepth + corridorH + (southDepth - UNIT_DIMS[southType].d),
        w: sw,
        d: UNIT_DIMS[southType].d,
        side: "south",
        label: UNIT_DIMS[southType].label,
        unitNo: unitNo++,
      });
    }

    cursorX += bayW + gap;
  }

  const widthFt = cursorX + coreW + 2;
  const corridorY = northDepth;

  const cores: FloorPlate["cores"] = [
    { x: 1, y: corridorY - 2, w: coreW, d: corridorH + 4, kind: "stair" },
    {
      x: widthFt - coreW - 1,
      y: corridorY - 2,
      w: coreW,
      d: corridorH + 4,
      kind: "elev",
    },
  ];

  // Mid-building trash/utility if plate is long
  if (widthFt > 140) {
    cores.push({
      x: widthFt / 2 - 5,
      y: corridorY,
      w: 10,
      d: corridorH,
      kind: "trash",
    });
  }

  const floorsEstimate = Math.max(1, Math.ceil(mix.units / units.length));

  return {
    widthFt,
    depthFt,
    corridorY,
    corridorH,
    units,
    cores,
    floorUnitCount: units.length,
    floorsEstimate,
  };
}

export function typeColor(type: UnitType): { fill: string; stroke: string } {
  switch (type) {
    case "studio":
      return { fill: "#c5d4cb", stroke: "#2a4f40" };
    case "oneBed":
      return { fill: "#9bb5a6", stroke: "#1a3329" };
    case "twoBed":
      return { fill: "#6b8f7c", stroke: "#0c1612" };
    case "threeBed":
      return { fill: "#2a4f40", stroke: "#0c1612" };
  }
}

export function mixTypeList(mix: MixCounts): UnitType[] {
  return TYPE_ORDER.filter((t) => {
    if (t === "studio") return mix.studio > 0;
    if (t === "oneBed") return mix.oneBed > 0;
    if (t === "twoBed") return mix.twoBed > 0;
    return mix.threeBed > 0;
  });
}
