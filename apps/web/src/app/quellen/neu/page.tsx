import type { Metadata } from "next";
import { SideNav } from "@/components/SideNav";
import { NewBestandswohnungForm } from "@/components/quellen/NewBestandswohnungForm";

export const metadata: Metadata = { title: "Neue Bestandswohnung — SIPIS LandFinder" };

export default function NeueBestandswohnungPage() {
  return (
    <div className="shell">
      <SideNav current="quellen" />
      <main className="main">
        <div className="pagehead">
          <h1>Neue Bestandswohnung</h1>
        </div>
        <NewBestandswohnungForm />
      </main>
    </div>
  );
}
