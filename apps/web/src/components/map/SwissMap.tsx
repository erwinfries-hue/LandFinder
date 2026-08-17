"use client";

import { useEffect, useRef } from "react";
import "leaflet/dist/leaflet.css";

/**
 * Eingebettete Karte auf Basis der öffentlichen swisstopo-WMTS-Kacheln
 * (wmts.geo.admin.ch, EPSG:3857 "Web Mercator" — von Leaflet direkt unterstützt, kein
 * API-Key nötig, Pflichtvermerk "© swisstopo"). Ergänzt den bisherigen reinen
 * Google-Maps-Link (`MapLink`, packages/ui) dort, wo bereits echte Koordinaten
 * vorliegen (Objekt-Vertiefung/Cham-Demo) — MapLink bleibt für alles andere (nur
 * Adresstext, keine Koordinaten) bestehen.
 *
 * Bewusst per `L.circleMarker` statt Standard-Pin-Icon: Leaflets Default-Icon-Bilder
 * lösen sich unter Bundlern wie Next.js/Webpack nicht zuverlässig auf (bekanntes
 * Leaflet-Problem, würde einen manuellen Asset-Copy-Schritt brauchen) — ein simpler
 * gezeichneter Kreis in der bestehenden Petrol-Akzentfarbe braucht das nicht.
 *
 * Leaflet selbst greift auf `window`/`document` zu — deshalb Import + Initialisierung
 * bewusst erst innerhalb von `useEffect` (nie während SSR ausgeführt), nicht als
 * statischer Top-Level-Import.
 */
export function SwissMap({ lat, lon, label }: { lat: number; lon: number; label?: string }) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    let map: import("leaflet").Map | undefined;

    void (async () => {
      const L = await import("leaflet");
      if (cancelled || !containerRef.current) return;

      map = L.map(containerRef.current, { attributionControl: true }).setView([lat, lon], 15);
      L.tileLayer("https://wmts.geo.admin.ch/1.0.0/ch.swisstopo.pixelkarte-farbe/default/current/3857/{z}/{x}/{y}.jpeg", {
        maxZoom: 18,
        attribution: "© swisstopo",
      }).addTo(map);
      L.circleMarker([lat, lon], { radius: 8, color: "#0E6E68", weight: 2, fillColor: "#4FC2B4", fillOpacity: 0.9 })
        .addTo(map)
        .bindTooltip(label ?? `${lat.toFixed(4)}, ${lon.toFixed(4)}`);
    })();

    return () => {
      cancelled = true;
      map?.remove();
    };
  }, [lat, lon, label]);

  return <div ref={containerRef} className="swissmap" role="img" aria-label={label ?? "Kartenausschnitt"} />;
}
