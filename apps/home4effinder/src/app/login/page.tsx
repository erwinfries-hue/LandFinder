import type { Metadata } from "next";
import { Suspense } from "react";
import { Panel } from "@landfinder/ui";
import { ContourBackdrop } from "@/components/ContourBackdrop";
import { LoginForm } from "@/components/LoginForm";

export const metadata: Metadata = {
  title: "Anmeldung — HOME4efFINDER",
};

export default function LoginPage() {
  return (
    <div className="login-screen">
      <ContourBackdrop />
      <div className="login-grid">
        <div className="brandblock">
          <div className="word">HOME4efFINDER</div>
          <h1>
            Home<em>4ef</em>Finder
          </h1>
          <p className="lede">
            Privates Due-Diligence- und Renditeinstrument für bestehende Eigentumswohnungen (Buy-to-let) in der
            Schweiz.
          </p>
        </div>

        <Panel className="loginpanel">
          <div className="eyebrow">Anmeldung</div>
          <h2>Willkommen zurück</h2>
          <div style={{ height: "1.4rem" }} />
          <Suspense fallback={null}>
            <LoginForm />
          </Suspense>
        </Panel>
      </div>
      <p className="disclaimer">
        HOME4efFINDER dient der internen Vorprüfung. Ersetzt keine verbindliche juristische Prüfung, Steuerberatung,
        Bankzusage oder Verkehrswertschätzung.
      </p>
    </div>
  );
}
