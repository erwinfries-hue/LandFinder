import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { Panel, Chip, ListingLink } from "@landfinder/ui";
import { SideNav } from "@/components/SideNav";
import { Metric } from "@/components/objekte/MetricPrimitives";
import { formatChf } from "@/lib/demo-data";
import { getListingById, listingStatus, objectTypeLabel, formatDateTime } from "@/lib/listings";
import { getPersistedSearchProfile } from "@/lib/searchProfile";
import { prescreenListing, type PrescreenRuleStatus } from "@/lib/listingPrescreen";

const RULE_STATUS_CHIP: Record<PrescreenRuleStatus, { label: string; tone: "good" | "bad" | "neutral" }> = {
  PASSED: { label: "Erfüllt", tone: "good" },
  FAILED: { label: "Nicht erfüllt", tone: "bad" },
  INSUFFICIENT_DATA: { label: "Zu wenig Daten", tone: "neutral" },
};

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const listing = await getListingById(id);
  const label = listing ? listing.title || listing.address_text || "Inserat" : "Inserat";
  return { title: `${label} — SIPIS LandFinder` };
}

/**
 * Detailansicht eines einzelnen extrahierten Inserats (Stufe 2) — Gegenstück zur
 * Übersichtstabelle unter /quellen. Der Link zum Original-Inserat ist auch hier
 * als aktiver Link vorhanden, nicht nur in der Übersicht.
 */
export default async function QuellenDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const listing = await getListingById(id);

  if (listing === undefined) {
    return (
      <div className="shell">
        <SideNav current="quellen" />
        <main className="main">
          <div className="pagehead">
            <h1>Inserat</h1>
          </div>
          <Panel style={{ padding: "1.4rem 1.6rem" }}>
            <p style={{ color: "var(--ink-soft)", fontSize: ".875rem" }}>
              Supabase ist nicht konfiguriert (<code>NEXT_PUBLIC_SUPABASE_URL</code> /{" "}
              <code>SUPABASE_SERVICE_ROLE_KEY</code> fehlen).
            </p>
          </Panel>
        </main>
      </div>
    );
  }
  if (!listing) notFound();

  const searchProfile = await getPersistedSearchProfile();
  const prescreen = prescreenListing(listing, searchProfile);

  const st = listingStatus(listing.ingestion_status);
  const extractionMethod = typeof listing.extraction?.method === "string" ? listing.extraction.method : undefined;
  const extractionConfidence =
    typeof listing.extraction?.confidence === "number" ? listing.extraction.confidence : undefined;

  return (
    <div className="shell">
      <SideNav current="quellen" />
      <main className="main">
        <Panel className="dethead">
          <div className="eyebrow">
            Inserat · {objectTypeLabel(listing.object_type)} · {listing.source}
          </div>
          <div className="dethead-top">
            <div>
              <div style={{ display: "flex", alignItems: "baseline", gap: ".9rem", flexWrap: "wrap" }}>
                <h1>{listing.title || listing.address_text || "Ohne Titel"}</h1>
                <ListingLink url={listing.canonical_url} label="Original-Inserat öffnen" />
              </div>
              {listing.description ? <p className="lede lede-line">{listing.description}</p> : null}
            </div>
            <Chip tone={st.tone}>{st.label}</Chip>
          </div>

          <div className="metricgrid">
            <Metric l="Kanton" v={listing.canton ?? "—"} />
            <Metric l="Adresse" v={listing.address_text ?? "—"} />
            <Metric l="Preis" v={listing.asking_price_chf != null ? `CHF ${formatChf(listing.asking_price_chf)}` : "—"} />
            <Metric
              l="Parzellenfläche"
              v={listing.parcel_area_m2 != null ? `${formatChf(listing.parcel_area_m2)} m²` : "—"}
            />
            <Metric l="Bekannte Zone" v={listing.known_zone ?? "—"} />
            <Metric
              l="Bestehendes Gebäude"
              v={listing.existing_building === null ? "—" : listing.existing_building ? "Ja" : "Nein"}
            />
            <Metric l="Erstmals erfasst" v={formatDateTime(listing.first_seen_at)} />
            <Metric l="Zuletzt gesehen" v={formatDateTime(listing.last_seen_at)} />
          </div>
        </Panel>

        <Panel style={{ padding: "1.4rem 1.6rem", marginTop: "1.6rem" }}>
          <div className="eyebrow">Vorprüfung gegen aktuelles Suchprofil</div>
          <p style={{ color: "var(--ink-soft)", fontSize: ".8125rem", margin: "0.4rem 0 1rem" }}>
            Nur die vier Kriterien, die sich ehrlich aus dem Inserat beurteilen lassen — keine volle Score/Empfehlung
            wie bei Cham, dafür fehlen Ausnützungsziffer, Zonenverifikation und Koordinaten.
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: ".6rem" }}>
            {prescreen.rules.map((rule) => {
              const chip = RULE_STATUS_CHIP[rule.status];
              return (
                <div key={rule.key} style={{ display: "flex", alignItems: "baseline", gap: ".7rem", flexWrap: "wrap" }}>
                  <Chip tone={chip.tone}>{chip.label}</Chip>
                  <strong style={{ fontSize: ".8125rem" }}>{rule.label}</strong>
                  <span style={{ color: "var(--ink-faint)", fontSize: ".78rem" }}>{rule.evidence}</span>
                </div>
              );
            })}
          </div>
        </Panel>

        <Panel style={{ padding: "1.4rem 1.6rem", marginTop: "1.6rem" }}>
          <div className="eyebrow">Extraktion (Stufe 2)</div>
          <p style={{ color: "var(--ink-soft)", fontSize: ".8125rem", margin: "0.4rem 0 0" }}>
            Methode: {extractionMethod ?? "—"}
            {extractionConfidence !== undefined ? ` · Konfidenz ${extractionConfidence}` : ""} — jeder Wert stammt
            direkt aus dem Original-Inserat, nichts wurde geschätzt oder ergänzt.
          </p>
          {listing.last_fetch_at ? (
            <p style={{ color: "var(--ink-faint)", fontSize: ".78rem", margin: "0.6rem 0 0" }}>
              Letzter Abrufversuch: {formatDateTime(listing.last_fetch_at)}
              {listing.last_fetch_http_status != null ? ` · HTTP ${listing.last_fetch_http_status}` : " · keine HTTP-Antwort (Timeout/Netzwerkfehler)"}
            </p>
          ) : null}
        </Panel>

        <p style={{ marginTop: "1.2rem" }}>
          <Link href="/quellen" className="maplink">
            ← Zurück zur Übersicht
          </Link>
        </p>
      </main>
    </div>
  );
}
