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
  // weiterhin intern als Mietaufschlag (mietPremium{Langzeit,Mittelzeit,Kurzzeit}
  // ChfPerMonth), damit die Rechenformeln (calculateJahresertrag & Co.) unverändert
  // bleiben. Kein Aufschlag ohne erfasste Möbliert-Miete oder falls sie unter der
  // unmöblierten Miete läge (kein negativer Wert). Alle drei Dauer-Varianten teilen sich
  // EINEN granularen Kostenblock (`moebliertBetriebskosten`), nur die Mietaufschläge
  // unterscheiden sich je Variante (SIPIS Furnished-Rental-Modul v1.1).
  const wohnungsMieteChfPerMonth = req("wohnungsMieteChfPerMonth");
  const mietPremiumChfPerMonth = (moeblierteMieteFeldName: string): number => {
    const moeblierteMieteChfPerMonth = num(moeblierteMieteFeldName);
    return moeblierteMieteChfPerMonth !== undefined ? Math.max(0, moeblierteMieteChfPerMonth - wohnungsMieteChfPerMonth) : 0;
  };

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
    reparatur: {
      jaehrlichUnmoebliertChf: req("reparaturJaehrlichUnmoebliertChf"),
    },
    moeblierung: {
      initialCostChf: req("moeblierungInitialCostChf"),
      nutzungsdauerJahre: num("moeblierungNutzungsdauerJahre"),
      kostensteigerungPercentPerYear: num("moeblierungKostensteigerungPercentPerYear"),
      haushaltinventarInitialCostChf: req("haushaltinventarInitialCostChf"),
      haushaltinventarNutzungsdauerJahre: num("haushaltinventarNutzungsdauerJahre"),
      mietPremiumLangzeitChfPerMonth: mietPremiumChfPerMonth("moeblierteMieteLangzeitChfPerMonth"),
      mietPremiumMittelzeitChfPerMonth: mietPremiumChfPerMonth("moeblierteMieteMittelzeitChfPerMonth"),
      mietPremiumKurzzeitChfPerMonth: mietPremiumChfPerMonth("moeblierteMieteKurzzeitChfPerMonth"),
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
      stwegAkontobeitragUeberwaelzbarChfPerYear: req("stwegAkontobeitragUeberwaelzbarChfPerYear"),
      eigentuemerkostenChfPerYear: req("eigentuemerkostenChfPerYear"),
      vermietungskostenChfPerYear: req("vermietungskostenChfPerYear"),
      reinigungServiceUnmoebliertChfPerYear: req("reinigungServiceUnmoebliertChfPerYear"),
    },
    moebliertBetriebskosten: {
      internetChfPerMonth: req("internetChfPerMonth"),
      kabelTvChfPerMonth: req("kabelTvChfPerMonth"),
      streamingChfPerMonth: req("streamingChfPerMonth"),
      stromChfPerMonth: req("stromChfPerMonth"),
      abfallChfPerMonth: req("abfallChfPerMonth"),
      mieterwechselProJahr: req("mieterwechselProJahr"),
      reinigungProWechselChf: req("reinigungProWechselChf"),
      waescheProWechselChf: req("waescheProWechselChf"),
      inseratProWechselChf: req("inseratProWechselChf"),
      verbrauchsmaterialChfPerMonth: req("verbrauchsmaterialChfPerMonth"),
      kleinreparaturenChfPerMonth: req("kleinreparaturenChfPerMonth"),
      hausratversicherungChfPerMonth: req("hausratversicherungChfPerMonth"),
      schadenreserveChfPerMonth: req("schadenreserveChfPerMonth"),
      verwaltungsgebuehrPercent: req("verwaltungsgebuehrPercent"),
      plattformgebuehrPercent: req("plattformgebuehrPercent"),
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
    openingBidFaktoren: {
      tageAmMarkt: num("tageAmMarkt"),
      preisreduktionenAnzahl: num("preisreduktionenAnzahl"),
      verkaeufermotivation: String(form.get("verkaeufermotivation") ?? "") || undefined,
      konkurrenzsituation: String(form.get("konkurrenzsituation") ?? "") || undefined,
      capexRisikoStufe: String(form.get("capexRisikoStufe") ?? "") || undefined,
      dokumentationsluecken: String(form.get("dokumentationsluecken") ?? "") || undefined,
      vermietungsstatus: String(form.get("vermietungsstatus") ?? "") || undefined,
    },
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
