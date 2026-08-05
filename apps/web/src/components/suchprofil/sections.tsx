"use client";

import type { ReactNode } from "react";
import type {
  SearchProfileRegions,
  SearchProfileBudget,
  SearchProfileObjektart,
  SearchProfileGrundstueck,
  SearchProfileProjektziel,
  SearchProfileEigennutzung,
  SearchProfileMarktannahmen,
  SearchProfileBaukosten,
  SearchProfileFinanzierung,
  SearchProfileRenditeziele,
  SearchProfileRisiken,
  SearchProfileAlerts,
  SearchProfileQuellen,
  BaurechtPolicy,
} from "@landfinder/domain";
import { AVAILABLE_CANTONS } from "@/lib/searchProfile";
import { NumberField, TextField, CheckboxField, SelectField, ChipMultiSelect } from "./fields";

function Lede({ children }: { children: ReactNode }) {
  return <p className="lede">{children}</p>;
}

export function RegionenSection({ value, onChange }: { value: SearchProfileRegions; onChange: (v: SearchProfileRegions) => void }) {
  return (
    <div>
      <h2>Regionen</h2>
      <Lede>Wo soll gesucht werden? Weitere Kantone lassen sich in `config/regions.json` ergänzen, ohne Code zu ändern.</Lede>
      <div className="fieldgrid">
        <ChipMultiSelect
          label="Kantone"
          help="Vorausgewählt gemäss Abschnitt 1.1: ZH, ZG, SZ, AG, LU, OW, NW."
          options={AVAILABLE_CANTONS.map((c) => ({ value: c.code, label: `${c.name} (${c.code})` }))}
          selected={value.cantons}
          onToggle={(code) =>
            onChange({ ...value, cantons: value.cantons.includes(code) ? value.cantons.filter((c) => c !== code) : [...value.cantons, code] })
          }
        />
        <TextField
          label="Referenzadresse"
          help="Optional — Ausgangspunkt für Radius/Fahrzeit."
          value={value.referenceAddress}
          onChange={(v) => onChange({ ...value, referenceAddress: v })}
        />
        <NumberField
          label="Radius"
          unit="km"
          help="Optional — maximaler Abstand von der Referenzadresse."
          value={value.radiusKm}
          onChange={(v) => onChange({ ...value, radiusKm: v })}
        />
        <NumberField
          label="Maximale Fahrzeit"
          unit="Min."
          value={value.maxTravelTimeMinutes}
          onChange={(v) => onChange({ ...value, maxTravelTimeMinutes: v })}
        />
        <SelectField
          label="Minimale ÖV-Güteklasse"
          help="A = sehr gut erschlossen, D = schlecht erschlossen."
          value={value.minOevGueteklasse ?? ""}
          onChange={(v) => onChange({ ...value, minOevGueteklasse: (v || undefined) as SearchProfileRegions["minOevGueteklasse"] })}
          options={[
            { value: "", label: "Keine Anforderung" },
            { value: "A", label: "A" },
            { value: "B", label: "B" },
            { value: "C", label: "C" },
            { value: "D", label: "D" },
          ]}
        />
      </div>
    </div>
  );
}

export function BudgetSection({ value, onChange }: { value: SearchProfileBudget; onChange: (v: SearchProfileBudget) => void }) {
  return (
    <div>
      <h2>Budget und Eigenkapital</h2>
      <Lede>Der finanzielle Rahmen, innerhalb dessen ein Objekt überhaupt in Frage kommt (Abschnitt 17, Hard Gates).</Lede>
      <div className="fieldgrid">
        <NumberField label="Maximales Eigenkapital" unit="CHF" value={value.maxEquityChf} onChange={(v) => onChange({ ...value, maxEquityChf: v ?? 0 })} />
        <NumberField
          label="Maximaler Grundstückspreis"
          unit="CHF"
          value={value.maxLandPriceChf}
          onChange={(v) => onChange({ ...value, maxLandPriceChf: v ?? 0 })}
        />
        <NumberField
          label="Maximales Gesamtprojektvolumen"
          unit="CHF"
          value={value.maxTotalProjectVolumeChf}
          onChange={(v) => onChange({ ...value, maxTotalProjectVolumeChf: v ?? 0 })}
        />
        <NumberField
          label="Liquiditätsreserve"
          unit="CHF"
          value={value.liquidityReserveChf}
          onChange={(v) => onChange({ ...value, liquidityReserveChf: v })}
        />
        <NumberField
          label="Fremdfinanzierungsanteil Ziel"
          unit="%"
          value={value.debtRatioTargetPercent}
          onChange={(v) => onChange({ ...value, debtRatioTargetPercent: v })}
        />
        <NumberField
          label="Projektlaufzeit"
          unit="Monate"
          value={value.projectDurationMonths}
          onChange={(v) => onChange({ ...value, projectDurationMonths: v })}
        />
        <CheckboxField
          label="Negative Anlaufphase zulässig"
          checked={value.negativeRampUpAllowed}
          onChange={(v) => onChange({ ...value, negativeRampUpAllowed: v })}
        />
      </div>
    </div>
  );
}

export function ObjektartSection({ value, onChange }: { value: SearchProfileObjektart; onChange: (v: SearchProfileObjektart) => void }) {
  return (
    <div>
      <h2>Objektart</h2>
      <Lede>Nur unbebautes Bauland und Grundstücke mit Abbruchobjekt sind im MVP vorgesehen (Abschnitt 1.3).</Lede>
      <div className="fieldgrid">
        <CheckboxField label="Unbebautes Bauland" checked={value.baulandEnabled} onChange={(v) => onChange({ ...value, baulandEnabled: v })} />
        <CheckboxField
          label="Grundstück mit Abbruchobjekt"
          checked={value.abbruchobjektEnabled}
          onChange={(v) => onChange({ ...value, abbruchobjektEnabled: v })}
        />
        <SelectField<BaurechtPolicy>
          label="Baurecht"
          help="Ausschluss = Hard Gate, manuell prüfen = kein automatischer Ausschluss, zulassen = keine Einschränkung."
          value={value.baurecht}
          onChange={(v) => onChange({ ...value, baurecht: v })}
          options={[
            { value: "EXCLUDE", label: "Ausschliessen" },
            { value: "MANUAL_REVIEW", label: "Manuell prüfen" },
            { value: "ALLOW", label: "Zulassen" },
          ]}
        />
      </div>
    </div>
  );
}

export function GrundstueckSection({ value, onChange }: { value: SearchProfileGrundstueck; onChange: (v: SearchProfileGrundstueck) => void }) {
  return (
    <div>
      <h2>Grundstück</h2>
      <Lede>Physische Eigenschaften der Parzelle.</Lede>
      <div className="fieldgrid">
        <NumberField label="Minimale Fläche" unit="m²" value={value.minAreaM2} onChange={(v) => onChange({ ...value, minAreaM2: v })} />
        <NumberField label="Maximale Fläche" unit="m²" value={value.maxAreaM2} onChange={(v) => onChange({ ...value, maxAreaM2: v })} />
        <NumberField
          label="Maximaler Preis/m²"
          unit="CHF"
          value={value.maxPricePerM2Chf}
          onChange={(v) => onChange({ ...value, maxPricePerM2Chf: v })}
        />
        <CheckboxField
          label="Erschliessung erforderlich"
          checked={value.erschliessungRequired}
          onChange={(v) => onChange({ ...value, erschliessungRequired: v })}
        />
        <CheckboxField label="Hanglage zulässig" checked={value.hanglageAllowed} onChange={(v) => onChange({ ...value, hanglageAllowed: v })} />
        <CheckboxField label="Zufahrt erforderlich" checked={value.zufahrtRequired} onChange={(v) => onChange({ ...value, zufahrtRequired: v })} />
        <CheckboxField label="Altlasten zulässig" checked={value.altlastenAllowed} onChange={(v) => onChange({ ...value, altlastenAllowed: v })} />
        <CheckboxField
          label="Naturgefahr zulässig"
          checked={value.naturgefahrAllowed}
          onChange={(v) => onChange({ ...value, naturgefahrAllowed: v })}
        />
        <NumberField label="Mindestbreite" unit="m" value={value.minWidthM} onChange={(v) => onChange({ ...value, minWidthM: v })} />
        <NumberField label="Mindesttiefe" unit="m" value={value.minDepthM} onChange={(v) => onChange({ ...value, minDepthM: v })} />
      </div>
    </div>
  );
}

export function ProjektzielSection({ value, onChange }: { value: SearchProfileProjektziel; onChange: (v: SearchProfileProjektziel) => void }) {
  return (
    <div>
      <h2>Projektziel</h2>
      <Lede>Zielbild für das zu realisierende Mehrfamilienhaus.</Lede>
      <div className="fieldgrid">
        <NumberField label="Minimale Wohnungen" value={value.minUnits} onChange={(v) => onChange({ ...value, minUnits: v })} />
        <NumberField label="Maximale Wohnungen" value={value.maxUnits} onChange={(v) => onChange({ ...value, maxUnits: v })} />
        <NumberField label="Minimale Nettowohnfläche" unit="m²" value={value.minNraM2} onChange={(v) => onChange({ ...value, minNraM2: v })} />
        <NumberField label="Maximale Nettowohnfläche" unit="m²" value={value.maxNraM2} onChange={(v) => onChange({ ...value, maxNraM2: v })} />
        <CheckboxField label="Parkplätze" checked={value.parkingRequired} onChange={(v) => onChange({ ...value, parkingRequired: v })} />
        <CheckboxField label="Lift" checked={value.liftRequired} onChange={(v) => onChange({ ...value, liftRequired: v })} />
        <CheckboxField
          label="Barrierefreiheit"
          checked={value.accessibilityRequired}
          onChange={(v) => onChange({ ...value, accessibilityRequired: v })}
        />
        <CheckboxField
          label="Balkone/Terrassen"
          checked={value.balconiesRequired}
          onChange={(v) => onChange({ ...value, balconiesRequired: v })}
        />
        <TextField label="Energiestandard" value={value.energyStandard} onChange={(v) => onChange({ ...value, energyStandard: v })} />
        <TextField label="Bauweise" value={value.constructionType} onChange={(v) => onChange({ ...value, constructionType: v })} />
      </div>
    </div>
  );
}

export function EigennutzungSection({ value, onChange }: { value: SearchProfileEigennutzung; onChange: (v: SearchProfileEigennutzung) => void }) {
  return (
    <div>
      <h2>Eigennutzung</h2>
      <Lede>Cashflow und kalkulatorischer Wohnnutzen werden nie vermischt (Abschnitt 10).</Lede>
      <div className="fieldgrid">
        <CheckboxField label="Eigennutzung geplant" checked={value.enabled} onChange={(v) => onChange({ ...value, enabled: v })} />
        <NumberField label="Anzahl Einheiten" value={value.unitCount} onChange={(v) => onChange({ ...value, unitCount: v })} />
        <NumberField label="Zielgrösse" unit="m²" value={value.targetSizeM2} onChange={(v) => onChange({ ...value, targetSizeM2: v })} />
        <NumberField label="Zimmerzahl" value={value.roomCount} onChange={(v) => onChange({ ...value, roomCount: v })} />
        <TextField label="Lage im Gebäude" value={value.positionInBuilding} onChange={(v) => onChange({ ...value, positionInBuilding: v })} />
        <NumberField
          label="Kalkulatorische Marktmiete"
          unit="CHF/m²/Mt."
          value={value.imputedMarketRentChfPerM2Month}
          onChange={(v) => onChange({ ...value, imputedMarketRentChfPerM2Month: v })}
        />
        <NumberField
          label="Maximaler Flächenanteil"
          unit="%"
          value={value.maxAreaSharePercent}
          onChange={(v) => onChange({ ...value, maxAreaSharePercent: v })}
        />
        <NumberField
          label="Maximaler Kapitalanteil"
          unit="%"
          value={value.maxCapitalSharePercent}
          onChange={(v) => onChange({ ...value, maxCapitalSharePercent: v })}
        />
      </div>
    </div>
  );
}

export function MarktannahmenSection({ value, onChange }: { value: SearchProfileMarktannahmen; onChange: (v: SearchProfileMarktannahmen) => void }) {
  return (
    <div>
      <h2>Marktannahmen</h2>
      <Lede>Fliessen direkt in Ertrag und Finanzierung ein (Abschnitt 12) — Schweizer Richtwerte als Startpunkt.</Lede>
      <div className="fieldgrid">
        <NumberField
          label="Nettomiete"
          unit="CHF/m²/Mt."
          value={value.netRentChfPerM2Month}
          onChange={(v) => onChange({ ...value, netRentChfPerM2Month: v ?? 0 })}
        />
        <NumberField
          label="Parkplatzmiete"
          unit="CHF/Mt."
          value={value.parkingRentChfPerMonth}
          onChange={(v) => onChange({ ...value, parkingRentChfPerMonth: v })}
        />
        <NumberField label="Leerstand" unit="%" value={value.vacancyRatePercent} onChange={(v) => onChange({ ...value, vacancyRatePercent: v ?? 0 })} />
        <NumberField
          label="Mietausfall"
          unit="%"
          value={value.collectionLossRatePercent}
          onChange={(v) => onChange({ ...value, collectionLossRatePercent: v ?? 0 })}
        />
        <NumberField
          label="Verwaltung"
          unit="%"
          value={value.managementCostPercent}
          onChange={(v) => onChange({ ...value, managementCostPercent: v ?? 0 })}
        />
        <NumberField
          label="Unterhalt"
          unit="%"
          value={value.maintenanceCostPercent}
          onChange={(v) => onChange({ ...value, maintenanceCostPercent: v ?? 0 })}
        />
        <NumberField
          label="Nicht umlagefähige Kosten"
          unit="%"
          value={value.nonRecoverableCostPercent}
          onChange={(v) => onChange({ ...value, nonRecoverableCostPercent: v ?? 0 })}
        />
        <NumberField
          label="Capex-Reserve"
          unit="%"
          value={value.capexReservePercent}
          onChange={(v) => onChange({ ...value, capexReservePercent: v ?? 0 })}
        />
        <NumberField
          label="Exit-Kapitalisierungssatz"
          unit="%"
          value={value.exitCapRatePercent}
          onChange={(v) => onChange({ ...value, exitCapRatePercent: v ?? 0 })}
        />
      </div>
    </div>
  );
}

export function BaukostenSection({ value, onChange }: { value: SearchProfileBaukosten; onChange: (v: SearchProfileBaukosten) => void }) {
  return (
    <div>
      <h2>Baukosten</h2>
      <Lede>Die Prozentsätze (Honorare bis Erstvermietung) verstehen sich als Anteil der Gebäudekosten (Abschnitt 11).</Lede>
      <div className="fieldgrid">
        <SelectField
          label="Kostenbasis"
          value={value.costBasis}
          onChange={(v) => onChange({ ...value, costBasis: v as SearchProfileBaukosten["costBasis"] })}
          options={[
            { value: "GFA", label: "Geschossfläche (GFA)" },
            { value: "NRA", label: "Nettowohnfläche (NRA)" },
          ]}
        />
        <NumberField
          label="Gebäudekosten"
          unit="CHF/m²"
          value={value.buildingCostChfPerM2}
          onChange={(v) => onChange({ ...value, buildingCostChfPerM2: v ?? 0 })}
        />
        <NumberField
          label="Abbruch"
          unit="CHF/m²"
          value={value.demolitionCostChfPerM2}
          onChange={(v) => onChange({ ...value, demolitionCostChfPerM2: v })}
        />
        <NumberField label="Erschliessung" unit="CHF" value={value.erschliessungCostChf} onChange={(v) => onChange({ ...value, erschliessungCostChf: v })} />
        <NumberField label="Umgebung" unit="CHF" value={value.umgebungCostChf} onChange={(v) => onChange({ ...value, umgebungCostChf: v })} />
        <NumberField label="Werkanschlüsse" unit="CHF" value={value.werkanschlussCostChf} onChange={(v) => onChange({ ...value, werkanschlussCostChf: v })} />
        <NumberField
          label="Parkierung"
          unit="CHF/Platz"
          value={value.parkingCostPerSpotChf}
          onChange={(v) => onChange({ ...value, parkingCostPerSpotChf: v })}
        />
        <NumberField label="Honorare" unit="%" value={value.feesPercent} onChange={(v) => onChange({ ...value, feesPercent: v ?? 0 })} />
        <NumberField label="Bewilligungen" unit="%" value={value.permitsPercent} onChange={(v) => onChange({ ...value, permitsPercent: v ?? 0 })} />
        <NumberField label="Reserve" unit="%" value={value.contingencyPercent} onChange={(v) => onChange({ ...value, contingencyPercent: v ?? 0 })} />
        <NumberField
          label="Baufinanzierung"
          unit="%"
          value={value.constructionFinancingPercent}
          onChange={(v) => onChange({ ...value, constructionFinancingPercent: v ?? 0 })}
        />
        <NumberField
          label="Erstvermietung"
          unit="%"
          value={value.initialLeasingCostPercent}
          onChange={(v) => onChange({ ...value, initialLeasingCostPercent: v ?? 0 })}
        />
      </div>
    </div>
  );
}

export function FinanzierungSection({ value, onChange }: { value: SearchProfileFinanzierung; onChange: (v: SearchProfileFinanzierung) => void }) {
  return (
    <div>
      <h2>Finanzierung</h2>
      <Lede>Fremdkapitalkonditionen für Base und Stress (Abschnitt 12, 14).</Lede>
      <div className="fieldgrid">
        <NumberField label="Loan-to-Cost" unit="%" value={value.loanToCostPercent} onChange={(v) => onChange({ ...value, loanToCostPercent: v ?? 0 })} />
        <NumberField
          label="Zinssatz Base"
          unit="%"
          value={value.interestRateBasePercent}
          onChange={(v) => onChange({ ...value, interestRateBasePercent: v ?? 0 })}
        />
        <NumberField
          label="Zinssatz Stress"
          unit="%"
          value={value.interestRateStressPercent}
          onChange={(v) => onChange({ ...value, interestRateStressPercent: v ?? 0 })}
        />
        <NumberField
          label="Amortisation"
          unit="%"
          value={value.amortizationPercent}
          onChange={(v) => onChange({ ...value, amortizationPercent: v ?? 0 })}
        />
      </div>
    </div>
  );
}

export function RenditezieleSection({ value, onChange }: { value: SearchProfileRenditeziele; onChange: (v: SearchProfileRenditeziele) => void }) {
  return (
    <div>
      <h2>Renditeziele</h2>
      <Lede>Mindestanforderungen, die ein Projekt wirtschaftlich erfüllen muss.</Lede>
      <div className="fieldgrid">
        <NumberField label="Mindest-DSCR" value={value.minDscr} onChange={(v) => onChange({ ...value, minDscr: v ?? 0 })} />
        <NumberField
          label="Mindest-Cash-on-Cash"
          unit="%"
          value={value.minCashOnCashPercent}
          onChange={(v) => onChange({ ...value, minCashOnCashPercent: v ?? 0 })}
        />
        <NumberField
          label="Mindest-Yield-on-Cost"
          unit="%"
          value={value.minYieldOnCostPercent}
          onChange={(v) => onChange({ ...value, minYieldOnCostPercent: v ?? 0 })}
        />
        <NumberField label="Zielmarge" unit="%" value={value.targetMarginPercent} onChange={(v) => onChange({ ...value, targetMarginPercent: v ?? 0 })} />
      </div>
    </div>
  );
}

export function RisikenSection({ value, onChange }: { value: SearchProfileRisiken; onChange: (v: SearchProfileRisiken) => void }) {
  return (
    <div>
      <h2>Risiken und Ausschlüsse</h2>
      <Lede>Was führt zu einem Hard Gate (Abschnitt 17)?</Lede>
      <div className="fieldgrid">
        <CheckboxField
          label="Altlasten ausschliessen"
          checked={value.excludedContamination}
          onChange={(v) => onChange({ ...value, excludedContamination: v })}
        />
        <CheckboxField
          label="Naturgefahren ausschliessen"
          checked={value.excludedNaturalHazards}
          onChange={(v) => onChange({ ...value, excludedNaturalHazards: v })}
        />
      </div>
    </div>
  );
}

export function AlertsSection({ value, onChange }: { value: SearchProfileAlerts; onChange: (v: SearchProfileAlerts) => void }) {
  return (
    <div>
      <h2>Alerts und Empfänger</h2>
      <Lede>Steuert, wann eine Sofort-E-Mail versendet wird (Abschnitt 21).</Lede>
      <div className="fieldgrid">
        <NumberField label="Schwelle A" unit="Punkte" value={value.thresholdA} onChange={(v) => onChange({ ...value, thresholdA: v ?? 0 })} />
        <NumberField label="Schwelle B" unit="Punkte" value={value.thresholdB} onChange={(v) => onChange({ ...value, thresholdB: v ?? 0 })} />
        <NumberField
          label="Mindest-Datenvertrauen"
          unit="Punkte"
          value={value.minDataConfidence}
          onChange={(v) => onChange({ ...value, minDataConfidence: v ?? 0 })}
        />
        <CheckboxField label="Potenzial-A aktiv" checked={value.potentialAEnabled} onChange={(v) => onChange({ ...value, potentialAEnabled: v })} />
        <TextField
          label="Empfänger"
          help="Kommagetrennt."
          value={value.recipients.join(", ")}
          onChange={(v) => onChange({ ...value, recipients: v.split(",").map((s) => s.trim()).filter(Boolean) })}
        />
        <TextField label="Digest-Zeit" help="HH:mm" value={value.digestTime} onChange={(v) => onChange({ ...value, digestTime: v })} />
        <NumberField
          label="Preisreduktion ab"
          unit="%"
          value={value.priceDropThresholdPercent}
          onChange={(v) => onChange({ ...value, priceDropThresholdPercent: v ?? 0 })}
        />
        <NumberField
          label="Max. Sofort-E-Mails/Tag"
          value={value.maxImmediateEmailsPerDay}
          onChange={(v) => onChange({ ...value, maxImmediateEmailsPerDay: v ?? 0 })}
        />
      </div>
    </div>
  );
}

export function QuellenSection({ value, onChange }: { value: SearchProfileQuellen; onChange: (v: SearchProfileQuellen) => void }) {
  return (
    <div>
      <h2>Quellen</h2>
      <Lede>
        Direkte Portaladapter (Phase 2, noch nicht angebunden — siehe <code>docs/OPEN_DECISIONS.md</code>, Punkt A) und
        weitere Datenquellen.
      </Lede>
      <div className="fieldgrid">
        <CheckboxField label="Homegate" checked={value.homegate} onChange={(v) => onChange({ ...value, homegate: v })} />
        <CheckboxField label="ImmoScout24" checked={value.immoscout24} onChange={(v) => onChange({ ...value, immoscout24: v })} />
        <CheckboxField label="newhome" checked={value.newhome} onChange={(v) => onChange({ ...value, newhome: v })} />
        <CheckboxField label="IMAP (E-Mail-Import)" checked={value.imapEnabled} onChange={(v) => onChange({ ...value, imapEnabled: v })} />
        <CheckboxField label="SMTP (Alert-Versand)" checked={value.smtpEnabled} onChange={(v) => onChange({ ...value, smtpEnabled: v })} />
        <CheckboxField label="Wüest Partner" checked={value.wuestEnabled} onChange={(v) => onChange({ ...value, wuestEnabled: v })} />
        <CheckboxField label="LLM-Anbindung" checked={value.llmEnabled} onChange={(v) => onChange({ ...value, llmEnabled: v })} />
      </div>
    </div>
  );
}
