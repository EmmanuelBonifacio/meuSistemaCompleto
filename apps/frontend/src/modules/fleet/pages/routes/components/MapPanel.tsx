"use client";

import "leaflet/dist/leaflet.css";
import React, { useEffect, useRef } from "react";
import type { Route, StopInput } from "../../../types/routes.types";

interface MapPanelProps {
  depot: { lat: number | null; lng: number | null; address: string } | null;
  stops: StopInput[];
  routes: Route[];
}

// This component renders a Leaflet map. It must ONLY be rendered on the client.
// Use dynamic import with ssr:false from the parent (already done in CreateRoutesPage).
export function MapPanel({ depot, stops, routes }: MapPanelProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const markersRef = useRef<any[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const polylinesRef = useRef<any[]>([]);

  // ── Initialize map once on mount ───────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    import("leaflet").then((L) => {
      if (!containerRef.current || mapRef.current) return;

      // Fix broken default icons in Next.js / webpack
      const iconProto = L.Icon.Default.prototype as unknown as Record<
        string,
        unknown
      >;
      delete iconProto._getIconUrl;
      L.Icon.Default.mergeOptions({
        iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
        iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
        shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
      });

      mapRef.current = L.map(containerRef.current, {
        center: [-17.2225, -46.8741], // Paracatu MG como padrão
        zoom: 13,
        zoomControl: true,
        scrollWheelZoom: true,
      });

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(mapRef.current);

      mapRef.current.invalidateSize?.();
    });

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Redraw markers/polylines when data changes ──────────────────────────────
  useEffect(() => {
    if (!mapRef.current) return;

    import("leaflet").then((L) => {
      if (!mapRef.current) return;

      // Remove previous layers
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];
      polylinesRef.current.forEach((p) => p.remove());
      polylinesRef.current = [];

      const bounds: Array<[number, number]> = [];

      let depotLat: number | undefined;
      let depotLng: number | undefined;
      if (
        depot?.lat != null &&
        depot?.lng != null &&
        !Number.isNaN(depot.lat) &&
        !Number.isNaN(depot.lng)
      ) {
        depotLat = depot.lat;
        depotLng = depot.lng;
      }

      // Depot marker
      if (depotLat != null && depotLng != null && depot) {
        const depotIcon = L.divIcon({
          className: "",
          html: `<div style="width:32px;height:32px;border-radius:50%;background:#185FA5;border:3px solid white;display:flex;align-items:center;justify-content:center;color:white;font-weight:bold;font-size:13px;box-shadow:0 2px 6px rgba(0,0,0,0.3)">D</div>`,
          iconSize: [32, 32],
          iconAnchor: [16, 16],
        });
        const m = L.marker([depotLat, depotLng], { icon: depotIcon })
          .addTo(mapRef.current)
          .bindPopup(`<b>Depósito</b><br/>${depot.address}`);
        markersRef.current.push(m);
        bounds.push([depotLat, depotLng]);
      }

      // Unassigned stops (grey) — only when no optimized routes yet
      if (routes.length === 0) {
        stops.forEach((s, idx) => {
          if (!s.lat || !s.lng) return;
          const icon = L.divIcon({
            className: "",
            html: `<div style="width:26px;height:26px;border-radius:50%;background:#9CA3AF;border:2px solid white;display:flex;align-items:center;justify-content:center;color:white;font-weight:bold;font-size:10px;box-shadow:0 1px 4px rgba(0,0,0,0.2)">${idx + 1}</div>`,
            iconSize: [26, 26],
            iconAnchor: [13, 13],
          });
          const m = L.marker([s.lat, s.lng], { icon })
            .addTo(mapRef.current!)
            .bindPopup(`<b>Parada #${idx + 1}</b><br/>${s.address}`);
          markersRef.current.push(m);
          bounds.push([s.lat, s.lng]);
        });
      }

      // Optimized routes with colored markers and polylines
      routes.forEach((route) => {
        const coords: Array<[number, number]> = [];
        if (depotLat != null && depotLng != null) coords.push([depotLat, depotLng]);

        route.stops.forEach((stop, idx) => {
          if (!stop.lat || !stop.lng) return;
          const icon = L.divIcon({
            className: "",
            html: `<div style="width:26px;height:26px;border-radius:50%;background:${route.color};border:2px solid white;display:flex;align-items:center;justify-content:center;color:white;font-weight:bold;font-size:10px;box-shadow:0 1px 4px rgba(0,0,0,0.2)">${idx + 1}</div>`,
            iconSize: [26, 26],
            iconAnchor: [13, 13],
          });
          const m = L.marker([stop.lat, stop.lng], { icon })
            .addTo(mapRef.current!)
            .bindPopup(`<b>${route.name} #${idx + 1}</b><br/>${stop.address}`);
          markersRef.current.push(m);
          coords.push([stop.lat, stop.lng]);
          bounds.push([stop.lat, stop.lng]);
        });

        if (depotLat != null && depotLng != null) coords.push([depotLat, depotLng]);

        if (coords.length >= 2) {
          const line = L.polyline(coords, {
            color: route.color,
            weight: 3,
            opacity: 0.8,
          }).addTo(mapRef.current!);
          polylinesRef.current.push(line);
        }
      });

      // Fit map to all markers
      if (bounds.length >= 2) {
        mapRef.current.fitBounds(bounds, { padding: [40, 40] });
      } else if (bounds.length === 1) {
        mapRef.current.flyTo(bounds[0], 14);
      }

      mapRef.current.invalidateSize?.();
    });
  }, [depot, stops, routes]);

  return (
    <>
      <div
        ref={containerRef}
        className="absolute inset-0 z-0 rounded-none"
        style={{ position: "absolute", inset: 0 }}
      />
      {!depot && stops.length === 0 && (
        <div className="pointer-events-none absolute inset-0 z-[400] flex items-center justify-center">
          <div className="rounded-xl border border-gray-100 bg-white/90 px-6 py-4 text-center shadow-sm">
            <p className="text-sm font-medium text-gray-600">
              Defina o depósito e paradas para visualizar no mapa
            </p>
            <p className="mt-1 text-xs text-gray-400">OpenStreetMap · sem chave de API</p>
          </div>
        </div>
      )}
    </>
  );
}
