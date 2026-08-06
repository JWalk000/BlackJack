"use client";

import { useEffect } from "react";
import {
  CircleMarker,
  MapContainer,
  Popup,
  TileLayer,
  useMap,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { MARKET_MAP_VIEW } from "@/data/map-coords";
import type { MarketId } from "@/data/markets";

export type MapPin = {
  id: string;
  position: [number, number];
  title: string;
  subtitle?: string;
  passes: boolean;
  priceLabel?: string;
};

type DealMapProps = {
  marketId: MarketId;
  pins: MapPin[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  className?: string;
};

function FitToPins({
  pins,
  marketId,
}: {
  pins: MapPin[];
  marketId: MarketId;
}) {
  const map = useMap();
  useEffect(() => {
    if (!pins.length) {
      const v = MARKET_MAP_VIEW[marketId];
      map.setView(v.center, v.zoom);
      return;
    }
    if (pins.length === 1) {
      map.setView(pins[0].position, 12);
      return;
    }
    const lats = pins.map((p) => p.position[0]);
    const lngs = pins.map((p) => p.position[1]);
    map.fitBounds(
      [
        [Math.min(...lats), Math.min(...lngs)],
        [Math.max(...lats), Math.max(...lngs)],
      ],
      { padding: [36, 36], maxZoom: 12 },
    );
  }, [pins, marketId, map]);
  return null;
}

function FlyToSelected({
  pins,
  selectedId,
}: {
  pins: MapPin[];
  selectedId: string | null;
}) {
  const map = useMap();
  useEffect(() => {
    if (!selectedId) return;
    const pin = pins.find((p) => p.id === selectedId);
    if (pin) map.panTo(pin.position, { animate: true });
  }, [selectedId, pins, map]);
  return null;
}

export default function DealMap({
  marketId,
  pins,
  selectedId,
  onSelect,
  className = "",
}: DealMapProps) {
  const view = MARKET_MAP_VIEW[marketId];

  return (
    <div className={`relative h-full min-h-[360px] w-full ${className}`}>
      <MapContainer
        center={view.center}
        zoom={view.zoom}
        className="h-full w-full z-0"
        scrollWheelZoom
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <FitToPins pins={pins} marketId={marketId} />
        <FlyToSelected pins={pins} selectedId={selectedId} />

        {pins.map((pin) => {
          const selected = pin.id === selectedId;
          const color = pin.passes ? "#1a3329" : "#b86b3c";
          return (
            <CircleMarker
              key={pin.id}
              center={pin.position}
              radius={selected ? 12 : 8}
              pathOptions={{
                color: selected ? "#b86b3c" : color,
                fillColor: color,
                fillOpacity: selected ? 0.95 : 0.75,
                weight: selected ? 3 : 1.5,
              }}
              eventHandlers={{
                click: () => onSelect(pin.id),
              }}
            >
              <Popup>
                <div className="min-w-[160px] font-sans text-sm">
                  <p className="font-semibold text-[#0c1612]">{pin.title}</p>
                  {pin.subtitle && (
                    <p className="mt-0.5 text-xs text-[#3d4a52]">{pin.subtitle}</p>
                  )}
                  {pin.priceLabel && (
                    <p className="mt-1 text-xs font-medium text-[#1a3329]">
                      {pin.priceLabel}
                    </p>
                  )}
                  <p className="mt-1 text-[10px] uppercase tracking-wide text-[#6b8f7c]">
                    {pin.passes ? "Deal signal" : "Watch"}
                  </p>
                </div>
              </Popup>
            </CircleMarker>
          );
        })}
      </MapContainer>

      <div className="pointer-events-none absolute bottom-3 left-3 z-[1000] flex gap-2">
        <span className="bg-paper/95 px-2 py-1 text-[10px] text-steel shadow">
          <i className="mr-1 inline-block h-2 w-2 rounded-full bg-forest" /> Deal
        </span>
        <span className="bg-paper/95 px-2 py-1 text-[10px] text-steel shadow">
          <i className="mr-1 inline-block h-2 w-2 rounded-full bg-copper" /> Watch
        </span>
      </div>
    </div>
  );
}
