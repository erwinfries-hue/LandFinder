"use client";

import Link from "next/link";
import { Chip, ListingLink, InfoHint, SortableTable, type Column } from "@landfinder/ui";
import type { SearchProfile } from "@landfinder/domain";
import { formatChf } from "@/lib/demo-data";
import { listingStatus, objectTypeLabel, formatDateTime, type ListingRow } from "@/lib/listings";
import { prescreenListing, type PrescreenStatus } from "@/lib/listingPrescreen";

/** `shortLabel` (max. 4 Zeichen) für die Tabellenspalte (schmal), `label` als voller Begriff für den Hover-Text. */
const PRESCREEN_STATUS_CHIP: Record<PrescreenStatus, { label: string; shortLabel: string; tone: "good" | "bad" | "neutral" }> = {
  PASSED: { label: "Passt", shortLabel: "Ja", tone: "good" },
  REJECTED: { label: "Ausserhalb", shortLabel: "Nein", tone: "bad" },
  INSUFFICIENT_DATA: { label: "Zu wenig Daten", shortLabel: "?", tone: "neutral" },
};

/** Client-Komponente wegen sortValue/render-Funktionen in den Spalten (siehe RankingTable.tsx). */
export function QuellenListingsTable({ rows, searchProfile }: { rows: ListingRow[]; searchProfile: SearchProfile }) {
  const columns: Column<ListingRow>[] = [
    {
      key: "inserat",
      header: "Inserat",
      align: "left",
      sortValue: (l) => (l.title || l.address_text || "").toLowerCase(),
      render: (l) => (
        <Link href={`/quellen/${l.id}`} className="objcell" style={{ display: "block" }} title={l.title || l.address_text || "Ohne Titel"}>
          <div className="m">{l.title || l.address_text || "Ohne Titel"}</div>
          <div className="g">
            {l.source}
            {l.object_type ? ` - ${objectTypeLabel(l.object_type)}` : ""}
          </div>
        </Link>
      ),
    },
    {
      key: "standort",
      header: "Standort",
      align: "left",
      sortValue: (l) => (l.address_text ?? "").toLowerCase(),
      render: (l) => l.address_text ?? "—",
    },
    {
      key: "kanton",
      header: "Kanton",
      align: "left",
      sortValue: (l) => l.canton ?? "",
      render: (l) => <span className="mono">{l.canton ?? "—"}</span>,
    },
    {
      key: "preis",
      header: "Preis",
      sortValue: (l) => l.asking_price_chf ?? -1,
      render: (l) => <span className="num mono">{l.asking_price_chf != null ? `CHF ${formatChf(l.asking_price_chf)}` : "—"}</span>,
    },
    {
      key: "flaeche",
      header: "Fläche",
      sortValue: (l) => l.parcel_area_m2 ?? -1,
      render: (l) => <span className="num mono">{l.parcel_area_m2 != null ? `${formatChf(l.parcel_area_m2)} m²` : "—"}</span>,
    },
    {
      key: "status",
      header: "Status",
      align: "left",
      sortValue: (l) => listingStatus(l.ingestion_status).label,
      render: (l) => {
        const st = listingStatus(l.ingestion_status);
        return (
          <Chip tone={st.tone} title={st.label}>
            {st.shortLabel}
          </Chip>
        );
      },
    },
    {
      key: "suchprofil",
      header: (
        <>
          Suchprofil{" "}
          <InfoHint text="Automatische Vorprüfung: Kanton, Objektart, Preis-Obergrenze, Preis/m²-Obergrenze, Flächen-Spanne — keine volle Score/Empfehlung, dafür fehlen Zonendaten." />
        </>
      ),
      align: "left",
      sortValue: (l) => prescreenListing(l, searchProfile).status,
      render: (l) => {
        const chip = PRESCREEN_STATUS_CHIP[prescreenListing(l, searchProfile).status];
        return (
          <Link href={`/quellen/${l.id}`}>
            <Chip tone={chip.tone} title={chip.label}>
              {chip.shortLabel}
            </Chip>
          </Link>
        );
      },
    },
    {
      key: "zuletztGesehen",
      header: "Zuletzt gesehen",
      sortValue: (l) => l.last_seen_at,
      render: (l) => <span className="num mono">{formatDateTime(l.last_seen_at)}</span>,
    },
    {
      key: "original",
      header: "Original",
      sortValue: () => 0,
      render: (l) => <ListingLink url={l.canonical_url} label="Öffnen" />,
    },
  ];

  return <SortableTable columns={columns} rows={rows} rowKey={(l) => l.id} wrapClassName="twrap scroll-y" />;
}
