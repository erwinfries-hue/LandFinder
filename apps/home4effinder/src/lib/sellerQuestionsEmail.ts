import type { DueDiligenceSellerQuestion } from "@landfinder/domain";

/**
 * E-Mail-Entwurf aus den Due-Diligence-Rückfragen (apps/home4effinder/docs/DECISIONS.md,
 * Produktvorgabe Abschnitt 8: "sollen später kopierbar bzw. idealerweise als
 * E-Mail-Entwurf exportierbar sein"). Bewusst kein eigener Mail-Versand (kein neuer
 * Vendor/keine neue Kostenstelle) — der fertige Text lässt sich kopieren, und ein
 * `mailto:`-Link öffnet ihn direkt im E-Mail-Programm des Nutzers als Entwurf.
 */
export interface EmailDraft {
  subject: string;
  body: string;
}

export function buildSellerQuestionsEmailDraft(questions: DueDiligenceSellerQuestion[], objectLabel: string): EmailDraft {
  const subject = `Rückfragen zu ${objectLabel}`;
  const intro = `Im Rahmen der Due-Diligence-Prüfung von ${objectLabel} ergeben sich folgende Rückfragen:`;
  const questionLines = questions.map((q, i) => `${i + 1}. ${q.question}`).join("\n\n");
  // Bewusst ohne Leerzeilen-Duplizierung bei questions=[] (questionLines dann ""),
  // auch wenn die UI diesen Fall aktuell gar nicht rendert (nur bei vorhandenen
  // Rückfragen aufgerufen) — die Funktion ist exportiert und soll auch für sich
  // allein ein sauberes Ergebnis liefern.
  const body = [intro, questionLines, "Besten Dank für die Rückmeldung."].filter(Boolean).join("\n\n");
  return { subject, body };
}

/**
 * `mailto:`-Link mit vorausgefülltem Betreff/Text — funktioniert ohne Backend, öffnet
 * das lokale E-Mail-Programm. Bewusst `encodeURIComponent` statt `URLSearchParams`
 * für Betreff/Text: RFC 6068 (mailto) erwartet Prozent-Kodierung, nicht die
 * Formular-Kodierung (`+` statt Leerzeichen), die `URLSearchParams` verwendet — sonst
 * erschienen im E-Mail-Programm wörtliche "+"-Zeichen statt Leerzeichen. Die
 * Empfängeradresse selbst wird nicht kodiert (ein enthaltenes "@" darf nicht zu
 * "%40" werden).
 */
export function buildMailtoUrl(draft: EmailDraft, recipient = ""): string {
  return `mailto:${recipient}?subject=${encodeURIComponent(draft.subject)}&body=${encodeURIComponent(draft.body)}`;
}
