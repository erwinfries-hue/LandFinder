"use client";

import { Chip, ListingLink, SortableTable, type Column } from "@landfinder/ui";
import { formatDateTime, type InboundAlertRow } from "@/lib/listings";

/** Client-Komponente wegen sortValue/render-Funktionen in den Spalten (siehe RankingTable.tsx). */
export function QuellenMailsTable({ rows }: { rows: InboundAlertRow[] }) {
  const columns: Column<InboundAlertRow>[] = [
    {
      key: "empfangen",
      header: "Empfangen",
      align: "left",
      sortValue: (a) => a.received_at,
      render: (a) => <span className="mono">{formatDateTime(a.received_at)}</span>,
    },
    {
      key: "von",
      header: "Von",
      align: "left",
      sortValue: (a) => a.from_address.toLowerCase(),
      render: (a) => a.from_address,
    },
    {
      key: "betreff",
      header: "Betreff",
      align: "left",
      sortValue: (a) => a.subject.toLowerCase(),
      render: (a) => a.subject,
    },
    {
      key: "verarbeitet",
      header: "Verarbeitet",
      align: "left",
      sortValue: (a) => (a.processed ? 1 : 0),
      render: (a) => <Chip tone={a.processed ? "good" : "neutral"}>{a.processed ? "Verarbeitet" : "Ausstehend"}</Chip>,
    },
    {
      key: "links",
      header: "Links im Inserat",
      align: "left",
      sortValue: (a) => a.listing_links.length,
      render: (a) =>
        a.listing_links.length === 0 ? (
          <span style={{ color: "var(--ink-faint)" }}>—</span>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: ".25rem" }}>
            {a.listing_links.map((url, i) => (
              <ListingLink key={url} url={url} label={`Link ${i + 1}`} />
            ))}
          </div>
        ),
    },
  ];

  return <SortableTable columns={columns} rows={rows} rowKey={(a) => a.id} />;
}
