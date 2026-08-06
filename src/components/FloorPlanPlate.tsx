"use client";

import { useMemo, useState } from "react";
import {
  buildFloorPlate,
  mixTypeList,
  typeColor,
  UNIT_DIMS,
  type MixCounts,
  type PlacedUnit,
  type UnitType,
} from "@/lib/floorplan";

type FloorPlanPlateProps = {
  mix: MixCounts;
  name: string;
};

export function FloorPlanPlate({ mix, name }: FloorPlanPlateProps) {
  const plate = useMemo(() => buildFloorPlate(mix), [mix]);
  const [selectedUnit, setSelectedUnit] = useState<PlacedUnit | null>(null);
  const [hoverType, setHoverType] = useState<UnitType | null>(null);

  // Fit plate into 760× viewBox with padding
  const pad = 18;
  const maxW = 760;
  const maxH = 320;
  const scale = Math.min(
    (maxW - pad * 2) / plate.widthFt,
    (maxH - pad * 2) / plate.depthFt,
  );
  const drawW = plate.widthFt * scale;
  const drawH = plate.depthFt * scale;
  const ox = (maxW - drawW) / 2;
  const oy = (maxH - drawH) / 2 + 8;

  const activeType = selectedUnit?.type ?? hoverType;
  const detailType: UnitType = activeType ?? "oneBed";
  const detail = UNIT_DIMS[detailType];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wider text-sage">
            Typical floor plate · {name}
          </p>
          <p className="mt-1 text-sm text-steel">
            {plate.floorUnitCount} units / floor · ~{plate.floorsEstimate} floors
            to program · double-loaded corridor ·{" "}
            {Math.round(plate.widthFt)}′ × {Math.round(plate.depthFt)}′ plate
          </p>
        </div>
        <p className="text-xs text-steel">
          Click a unit for a schematic plan →
        </p>
      </div>

      <div className="overflow-x-auto border border-line bg-[#f7f4ef]">
        <svg
          viewBox={`0 0 ${maxW} ${maxH + 24}`}
          className="h-auto w-full min-w-[520px]"
          role="img"
          aria-label={`Floor plate for ${name}`}
        >
          {/* Site / building shell */}
          <rect
            x={ox - 4}
            y={oy - 4}
            width={drawW + 8}
            height={drawH + 8}
            fill="none"
            stroke="#0c1612"
            strokeWidth={1.5}
          />

          {/* Corridor */}
          <rect
            x={ox}
            y={oy + plate.corridorY * scale}
            width={drawW}
            height={plate.corridorH * scale}
            fill="#e8e2d6"
            stroke="#b8b0a2"
            strokeWidth={0.75}
          />
          <text
            x={ox + drawW / 2}
            y={oy + (plate.corridorY + plate.corridorH / 2) * scale + 4}
            textAnchor="middle"
            fill="#6b8f7c"
            fontSize={10}
            fontFamily="var(--font-manrope), system-ui, sans-serif"
            letterSpacing="0.12em"
          >
            CORRIDOR
          </text>

          {/* Cores */}
          {plate.cores.map((c, i) => (
            <g key={i}>
              <rect
                x={ox + c.x * scale}
                y={oy + c.y * scale}
                width={c.w * scale}
                height={c.d * scale}
                fill="#0c1612"
                opacity={0.85}
              />
              <text
                x={ox + (c.x + c.w / 2) * scale}
                y={oy + (c.y + c.d / 2) * scale + 3}
                textAnchor="middle"
                fill="#f5f1ea"
                fontSize={9}
                fontFamily="var(--font-manrope), system-ui, sans-serif"
              >
                {c.kind === "stair"
                  ? "STAIR"
                  : c.kind === "elev"
                    ? "ELEV"
                    : "UTIL"}
              </text>
            </g>
          ))}

          {/* Units */}
          {plate.units.map((u) => {
            const colors = typeColor(u.type);
            const active =
              selectedUnit?.id === u.id ||
              (hoverType === u.type && selectedUnit == null);
            return (
              <g
                key={u.id}
                className="cursor-pointer"
                onClick={() => setSelectedUnit(u)}
                onMouseEnter={() => setHoverType(u.type)}
                onMouseLeave={() => setHoverType(null)}
              >
                <rect
                  x={ox + u.x * scale}
                  y={oy + u.y * scale}
                  width={u.w * scale}
                  height={u.d * scale}
                  fill={colors.fill}
                  stroke={active ? "#b86b3c" : colors.stroke}
                  strokeWidth={active ? 2 : 1}
                  opacity={hoverType && hoverType !== u.type ? 0.45 : 1}
                />
                {/* Door swing mark toward corridor */}
                <circle
                  cx={
                    ox +
                    (u.x + u.w / 2) * scale
                  }
                  cy={
                    oy +
                    (u.side === "north"
                      ? u.y + u.d
                      : u.y) *
                      scale
                  }
                  r={2.2}
                  fill="#0c1612"
                />
                <text
                  x={ox + (u.x + u.w / 2) * scale}
                  y={oy + (u.y + u.d / 2) * scale - 2}
                  textAnchor="middle"
                  fill="#0c1612"
                  fontSize={Math.max(8, Math.min(11, u.w * scale * 0.22))}
                  fontFamily="var(--font-manrope), system-ui, sans-serif"
                  fontWeight={600}
                >
                  {u.label}
                </text>
                <text
                  x={ox + (u.x + u.w / 2) * scale}
                  y={oy + (u.y + u.d / 2) * scale + 11}
                  textAnchor="middle"
                  fill="#0c1612"
                  opacity={0.65}
                  fontSize={8}
                  fontFamily="var(--font-jetbrains), monospace"
                >
                  {UNIT_DIMS[u.type].sf} sf
                </text>
              </g>
            );
          })}

          {/* Dimension strings */}
          <line
            x1={ox}
            y1={oy + drawH + 14}
            x2={ox + drawW}
            y2={oy + drawH + 14}
            stroke="#6b8f7c"
            strokeWidth={0.75}
          />
          <text
            x={ox + drawW / 2}
            y={oy + drawH + 26}
            textAnchor="middle"
            fill="#3d4a52"
            fontSize={9}
            fontFamily="var(--font-jetbrains), monospace"
          >
            {Math.round(plate.widthFt)}′ building length
          </text>
        </svg>
      </div>

      <div className="flex flex-wrap gap-4 text-xs text-steel">
        {mixTypeList(mix).map((t) => {
          const c = typeColor(t);
          return (
            <button
              key={t}
              type="button"
              onMouseEnter={() => setHoverType(t)}
              onMouseLeave={() => setHoverType(null)}
              onClick={() => {
                const first = plate.units.find((u) => u.type === t);
                if (first) setSelectedUnit(first);
              }}
              className="flex items-center gap-1.5 transition hover:text-ink"
            >
              <i
                className="inline-block h-3 w-3 border"
                style={{ background: c.fill, borderColor: c.stroke }}
              />
              {UNIT_DIMS[t].label}
            </button>
          );
        })}
      </div>

      {/* Unit schematic */}
      <div className="grid gap-6 border-t border-line pt-6 lg:grid-cols-[1fr_1.1fr]">
        <div>
          <p className="text-xs uppercase tracking-wider text-sage">
            Unit plan · {detail.label}
          </p>
          <p className="mt-1 text-sm text-steel">
            Schematic layout (~{detail.sf} sf · {detail.w}′ × {detail.d}′
            module). Not construction documents — program diagram for mix
            review.
          </p>
          {selectedUnit && (
            <p className="mt-3 font-mono text-xs text-copper">
              Plate unit {selectedUnit.id} selected
            </p>
          )}
        </div>
        <UnitSchematic type={detailType} />
      </div>
    </div>
  );
}

function UnitSchematic({ type }: { type: UnitType }) {
  const unit = UNIT_DIMS[type];
  const colors = typeColor(type);
  const vbW = 320;
  const vbH = 280;
  const margin = 20;
  const availW = vbW - margin * 2;
  const availH = vbH - margin * 2;
  const s = Math.min(availW / unit.w, availH / unit.d);
  const w = unit.w * s;
  const h = unit.d * s;
  const x0 = (vbW - w) / 2;
  const y0 = (vbH - h) / 2;

  return (
    <div className="border border-line bg-[#f7f4ef] p-3">
      <svg
        viewBox={`0 0 ${vbW} ${vbH}`}
        className="h-auto w-full"
        role="img"
        aria-label={`${unit.label} schematic floor plan`}
      >
        {/* Outer wall */}
        <rect
          x={x0}
          y={y0}
          width={w}
          height={h}
          fill={colors.fill}
          stroke="#0c1612"
          strokeWidth={2.5}
        />

        {/* Rooms */}
        {unit.rooms.map((r) => {
          const rx = x0 + r.x * w;
          const ry = y0 + r.y * h;
          const rw = r.w * w;
          const rh = r.h * h;
          return (
            <g key={r.id}>
              <rect
                x={rx}
                y={ry}
                width={rw}
                height={rh}
                fill="#f5f1ea"
                stroke="#0c1612"
                strokeWidth={1}
                opacity={0.95}
              />
              <text
                x={rx + rw / 2}
                y={ry + rh / 2 + 3}
                textAnchor="middle"
                fill="#3d4a52"
                fontSize={Math.min(11, rw * 0.2)}
                fontFamily="var(--font-manrope), system-ui, sans-serif"
              >
                {r.name}
              </text>
            </g>
          );
        })}

        {/* Entry door gap on bottom */}
        <rect
          x={x0 + w * 0.12}
          y={y0 + h - 3}
          width={w * 0.14}
          height={6}
          fill="#f7f4ef"
        />
        <path
          d={`M ${x0 + w * 0.12} ${y0 + h} A ${w * 0.14} ${w * 0.14} 0 0 1 ${x0 + w * 0.26} ${y0 + h - w * 0.12}`}
          fill="none"
          stroke="#b86b3c"
          strokeWidth={1.25}
        />

        {/* Window ticks on top wall */}
        {[0.25, 0.5, 0.75].map((t) => (
          <line
            key={t}
            x1={x0 + w * t - 8}
            y1={y0}
            x2={x0 + w * t + 8}
            y2={y0}
            stroke="#6b8f7c"
            strokeWidth={3}
          />
        ))}

        <text
          x={vbW / 2}
          y={vbH - 6}
          textAnchor="middle"
          fill="#6b8f7c"
          fontSize={9}
          fontFamily="var(--font-jetbrains), monospace"
        >
          {unit.w}′ × {unit.d}′
        </text>
      </svg>
    </div>
  );
}
