import { describe, it, expect } from "vitest";
import { buildSellerQuestionsEmailDraft, buildMailtoUrl } from "./sellerQuestionsEmail";

describe("buildSellerQuestionsEmailDraft", () => {
  it("nummeriert die Fragen und nennt das Objekt in Betreff und Text", () => {
    const draft = buildSellerQuestionsEmailDraft(
      [{ question: "Bitte bestätigen Sie den Erneuerungsfonds-Saldo." }, { question: "Gehört Parkplatz Nr. 5 zum Kaufgegenstand?" }],
      "Obere Haldenstrasse 42, 5610 Wohlen",
    );
    expect(draft.subject).toBe("Rückfragen zu Obere Haldenstrasse 42, 5610 Wohlen");
    expect(draft.body).toContain("Obere Haldenstrasse 42, 5610 Wohlen");
    expect(draft.body).toContain("1. Bitte bestätigen Sie den Erneuerungsfonds-Saldo.");
    expect(draft.body).toContain("2. Gehört Parkplatz Nr. 5 zum Kaufgegenstand?");
  });

  it("erzeugt einen sinnvollen Text auch ohne Fragen", () => {
    const draft = buildSellerQuestionsEmailDraft([], "Musterstrasse 1");
    expect(draft.subject).toBe("Rückfragen zu Musterstrasse 1");
    expect(draft.body).toContain("Musterstrasse 1");
  });
});

describe("buildMailtoUrl", () => {
  it("kodiert Betreff/Text per Prozent-Kodierung (Leerzeichen als %20, nicht als '+')", () => {
    const url = buildMailtoUrl({ subject: "Zwei Wörter", body: "Zeile eins\n\nZeile zwei" });
    expect(url).toContain("subject=Zwei%20W%C3%B6rter");
    expect(url).not.toContain("+");
  });

  it("lässt die Empfängeradresse unkodiert, damit '@' erhalten bleibt", () => {
    const url = buildMailtoUrl({ subject: "x", body: "y" }, "makler@beispiel.ch");
    expect(url.startsWith("mailto:makler@beispiel.ch?")).toBe(true);
  });

  it("funktioniert ohne Empfängeradresse (Nutzer trägt sie im Mailprogramm selbst ein)", () => {
    const url = buildMailtoUrl({ subject: "x", body: "y" });
    expect(url.startsWith("mailto:?")).toBe(true);
  });
});
