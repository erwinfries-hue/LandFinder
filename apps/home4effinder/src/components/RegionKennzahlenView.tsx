"use client";

import { useState } from "react";
import { Metric } from "./MetricPrimitives";
import { formatChf } from "@/lib/format";
import type { RegionKennzahlen } from "@/lib/regionExtraction";

/**
 * Kennzahlen-Metricgrid — als eigene Funktion, damit Gemeinde- und Kanton-Ansicht
 * exakt dieselbe Darstellung nutzen (Rückmeldung: "eine kleine Navigation... Stadt
 * resp. Kanton" — beide Ebenen sollen identisch aussehen, nur mit anderen Werten).
 */
function KennzahlenGrid({ kennzahlen }: { kennzahlen: RegionKennzahlen }) {
  return (
    <div className="metricgrid">
      {kennzahlen.bevoelkerungAnzahl !== undefined ? (
        <Metric
          l="Bevölkerung"
          v={formatChf(kennzahlen.bevoelkerungAnzahl)}
          sub={kennzahlen.bevoelkerungsentwicklung3JahrePercent !== undefined ? `Entwicklung 3J: ${kennzahlen.bevoelkerungsentwicklung3JahrePercent}%` : undefined}
        />
      ) : null}
      {kennzahlen.anzahlHaushalte !== undefined ? <Metric l="Haushalte" v={formatChf(kennzahlen.anzahlHaushalte)} /> : null}
      {kennzahlen.leerstandMehrfamilienhaeuserPercent !== undefined ? (
        <Metric l="Leerstand MFH" v={`${kennzahlen.leerstandMehrfamilienhaeuserPercent}%`} hint="Wohnungsleerstände im Verhältnis zum Bestand." />
      ) : null}
      {kennzahlen.angebotsquoteMietwohnungenPercent !== undefined ? <Metric l="Angebotsquote Mietwohnungen" v={`${kennzahlen.angebotsquoteMietwohnungenPercent}%`} /> : null}
      {kennzahlen.mietePreisVeraenderung3JahrePercent !== undefined ? <Metric l="Mietpreis-Veränderung 3J" v={`${kennzahlen.mietePreisVeraenderung3JahrePercent}%`} /> : null}
      {kennzahlen.eigentumswohnungPreisVeraenderung3JahrePercent !== undefined ? (
        <Metric l="EW-Preis-Veränderung 3J" v={`${kennzahlen.eigentumswohnungPreisVeraenderung3JahrePercent}%`} />
      ) : null}
      {kennzahlen.einfamilienhausPreisVeraenderung3JahrePercent !== undefined ? (
        <Metric l="EFH-Preis-Veränderung 3J" v={`${kennzahlen.einfamilienhausPreisVeraenderung3JahrePercent}%`} />
      ) : null}
      {kennzahlen.steuerbelastungSingle60kPercent !== undefined ? <Metric l="Steuerbelastung Single (60k)" v={`${kennzahlen.steuerbelastungSingle60kPercent}%`} /> : null}
      {kennzahlen.steuerbelastungPaar120kPercent !== undefined ? <Metric l="Steuerbelastung Paar (120k)" v={`${kennzahlen.steuerbelastungPaar120kPercent}%`} /> : null}
      {kennzahlen.mietwohnungsbestand !== undefined ? <Metric l="Mietwohnungsbestand" v={formatChf(kennzahlen.mietwohnungsbestand)} /> : null}
      {kennzahlen.eigentumswohnungsbestand !== undefined ? <Metric l="Eigentumswohnungsbestand" v={formatChf(kennzahlen.eigentumswohnungsbestand)} /> : null}
      {kennzahlen.einfamilienhausbestand !== undefined ? <Metric l="Einfamilienhausbestand" v={formatChf(kennzahlen.einfamilienhausbestand)} /> : null}
      {kennzahlen.neuErstellteWohnungenProJahr !== undefined ? <Metric l="Neu erstellte Wohnungen p.a." v={formatChf(kennzahlen.neuErstellteWohnungenProJahr)} /> : null}
    </div>
  );
}

/**
 * Umschaltung zwischen Gemeinde- und Kanton-Kennzahlen (Rückmeldung: "kannst du hier
 * auch eine Übersicht dito Wohlen für den Kanton Aargau hinzufügen... am besten eine
 * kleine Navigation einbauen Stadt resp. Kanton") — beide Ebenen stammen aus derselben
 * Kennziffern-Tabelle desselben Reports (siehe regionExtraction.ts), nur die
 * Kanton-Spalte statt der Gemeinde-Spalte. Der Kanton-Tab erscheint nur, wenn der
 * Report tatsächlich Kanton-Werte hergab (kein Platzhalter-Tab ohne Daten).
 */
export function RegionKennzahlenView({
  gemeindeLabel,
  kantonLabel,
  gemeindeKennzahlen,
  kantonKennzahlen,
}: {
  gemeindeLabel: string;
  kantonLabel: string;
  gemeindeKennzahlen: RegionKennzahlen;
  kantonKennzahlen: RegionKennzahlen | undefined;
}) {
  const [view, setView] = useState<"GEMEINDE" | "KANTON">("GEMEINDE");

  if (!kantonKennzahlen) return <KennzahlenGrid kennzahlen={gemeindeKennzahlen} />;

  return (
    <>
      <div className="chipselect" style={{ marginBottom: ".8rem" }} role="tablist" aria-label="Gemeinde oder Kanton">
        {(["GEMEINDE", "KANTON"] as const).map((v) => (
          <button key={v} type="button" role="tab" aria-selected={view === v} className={view === v ? "selected" : undefined} onClick={() => setView(v)}>
            {v === "GEMEINDE" ? gemeindeLabel : kantonLabel}
          </button>
        ))}
      </div>
      <KennzahlenGrid kennzahlen={view === "GEMEINDE" ? gemeindeKennzahlen : kantonKennzahlen} />
    </>
  );
}
