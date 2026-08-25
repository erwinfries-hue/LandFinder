import type { AmortisationModus, RenovationPosition, Vermietungsmodell } from "@landfinder/financial-engine";

/**
 * Baut den Request-Body für `POST /api/properties/[id]/bestandsrendite` aus den rohen
 * Formulardaten von `BestandsrenditeFactsFields` — gemeinsam genutzt von
 * `BestandsrenditeVertiefungForm` (Objekt-Bearbeiten-Seite) und `PropertyCreateForm`
 * (kombinierter Neu-Erfassen-Flow), damit beide garantiert dieselben Feldnamen/-pfade
 * gleich interpretieren.
 */
export function buildBestandsrenditeFactsFromFormData(
  form: FormData,
  vermietungsmodell: Vermietungsmodell,
  renovationPositionen: RenovationPosition[],
): Record<string, unknown> {
  const num = (key: string): number | undefined => {
    const raw = form.get(key);
    if (typeof raw !== "string" || raw === "") return undefined;
    const value = Number(raw);
    return Number.isFinite(value) ? value : undefined;
  };
  const req = (key: string): number => num(key) ?? 0;

  // Paket 1 (unmöbliert) und Paket 2 (möbliert) werden im Formular je mit ihrer eigenen
  // "erwartete Miete" erfasst (siehe BestandsrenditeFactsFields.tsx) — gespeichert wird
  // weiterhin intern als Mietaufschlag (mietPremiumChfPerMonth), damit die Rechenformeln
  // (calculateJahresertrag & Co.) unverändert bleiben. Kein Aufschlag ohne erfasste
  // Möbliert-Miete oder falls sie unter der unmöblierten Miete läge (kein negativer Wert).
  const wohnungsMieteChfPerMonth = req("wohnungsMieteChfPerMonth");
  const moeblierteMieteChfPerMonth = num("moeblierteMieteChfPerMonth");
  const mietPremiumChfPerMonth = moeblierteMieteChfPerMonth !== undefined ? Math.max(0, moeblierteMieteChfPerMonth - wohnungsMieteChfPerMonth) : 0;

  return {
    zimmerzahl: num("zimmerzahl"),
    baujahr: num("baujahr"),
    parkplatzKaufpreisChf: req("parkplatzKaufpreisChf"),
    parkplatzImKaufpreisEnthalten: form.get("parkplatzImKaufpreisEnthalten") === "on",
    garagenplatzKaufpreisChf: req("garagenplatzKaufpreisChf"),
    garagenplatzImKaufpreisEnthalten: form.get("garagenplatzImKaufpreisEnthalten") === "on",
    hobbyraumKaufpreisChf: req("hobbyraumKaufpreisChf"),
    hobbyraumImKaufpreisEnthalten: form.get("hobbyraumImKaufpreisEnthalten") === "on",
    stweg: {
      wertquotePromille: num("wertquotePromille"),
      erneuerungsfondsSaldoChf: num("erneuerungsfondsSaldoChf"),
      erneuerungsfondsWohnungsanteilChf: num("erneuerungsfondsWohnungsanteilChf"),
      erneuerungsfondsZielwertChf: num("erneuerungsfondsZielwertChf"),
      naechsteGrossaSanierungGeplant: form.get("naechsteGrossaSanierungGeplant") === "on",
      naechsteGrossaSanierungNotes: String(form.get("naechsteGrossaSanierungNotes") ?? "") || undefined,
      sanierungsstauNotes: String(form.get("sanierungsstauNotes") ?? "") || undefined,
      offeneBeschluesseCount: num("offeneBeschluesseCount"),
      beschlussrisikenNotes: String(form.get("beschlussrisikenNotes") ?? "") || undefined,
      quelle: String(form.get("quelle") ?? "") || undefined,
    },
    nebenkosten: {
      handaenderungssteuerPercent: num("handaenderungssteuerPercent"),
      notariatGrundbuchPercent: num("notariatGrundbuchPercent"),
      maklerprovisionPercent: num("maklerprovisionPercent"),
    },
    renovation: {
      initialRenovationCostChf: req("initialRenovationCostChf"),
      positionen: renovationPositionen,
      mieteVorRenovationChfPerMonth: num("mieteVorRenovationChfPerMonth"),
      mieteNachRenovationChfPerMonth: num("mieteNachRenovationChfPerMonth"),
    },
    moeblierung: {
      initialCostChf: req("moeblierungInitialCostChf"),
      mietPremiumChfPerMonth,
      jaehrlicherErsatzsatzPercent: num("jaehrlicherErsatzsatzPercent"),
      nutzungsdauerJahre: num("moeblierungNutzungsdauerJahre"),
      kostensteigerungPercentPerYear: num("moeblierungKostensteigerungPercentPerYear"),
    },
    miete: {
      wohnungsMieteChfPerMonth,
      parkplatzMieteChfPerMonth: req("parkplatzMieteChfPerMonth"),
      garagenplatzMieteChfPerMonth: req("garagenplatzMieteChfPerMonth"),
      hobbyraumMieteChfPerMonth: req("hobbyraumMieteChfPerMonth"),
      sonstigeEinnahmenChfPerYear: req("sonstigeEinnahmenChfPerYear"),
      vermietungsmodell,
      leerstandPercent: vermietungsmodell !== "SHORT_STAY" ? num("leerstandPercent") : undefined,
      auslastungPercent: vermietungsmodell === "SHORT_STAY" ? num("auslastungPercent") : undefined,
    },
    betriebskosten: {
      stwegAkontobeitragChfPerYear: req("stwegAkontobeitragChfPerYear"),
      eigentuemerkostenChfPerYear: req("eigentuemerkostenChfPerYear"),
      vermietungskostenChfPerYear: req("vermietungskostenChfPerYear"),
      reinigungServiceChfPerYear: req("reinigungServiceChfPerYear"),
    },
    reserven: {
      reparaturChfPerYear: num("reparaturChfPerYear"),
      reparaturPercentOfKaufpreis: num("reparaturPercentOfKaufpreis"),
      leerstandChfPerYear: num("leerstandReserveChfPerYear"),
      leerstandPercentOfKaufpreis: num("leerstandReservePercentOfKaufpreis"),
    },
    hypothek: {
      ersteHypothek: {
        belehnungPercent: req("ersteHypothekBelehnungPercent"),
        amortisation: {
          modus: (form.get("ersteHypothekAmortisationModus") as AmortisationModus) ?? "PROZENT_PRO_JAHR",
          prozentProJahr: num("ersteHypothekAmortisationProzentProJahr"),
          dauerJahre: num("ersteHypothekAmortisationDauerJahre"),
        },
      },
      zweiteHypothek: {
        belehnungPercent: req("zweiteHypothekBelehnungPercent"),
        amortisation: {
          modus: (form.get("zweiteHypothekAmortisationModus") as AmortisationModus) ?? "DAUER_JAHRE",
          prozentProJahr: num("zweiteHypothekAmortisationProzentProJahr"),
          dauerJahre: num("zweiteHypothekAmortisationDauerJahre"),
        },
      },
      interestRatePercent: req("interestRatePercent"),
    },
    kalkulatorischerSteuersatzPercent: num("kalkulatorischerSteuersatzPercent"),
    eroeffnungsangebotChf: num("eroeffnungsangebotChf"),
    mehrjahresmodell: {
      holdingPeriodYears: num("holdingPeriodYears"),
      mietsteigerungPercentPerYear: num("mietsteigerungPercentPerYear"),
      kosteninflationPercentPerYear: num("kosteninflationPercentPerYear"),
      wertsteigerungPercentPerYear: num("wertsteigerungPercentPerYear"),
      sellingCostPercent: num("sellingCostPercent"),
      grundstueckgewinnsteuerPercent: num("grundstueckgewinnsteuerPercent"),
    },
    notes: String(form.get("notes") ?? "") || undefined,
  };
}
