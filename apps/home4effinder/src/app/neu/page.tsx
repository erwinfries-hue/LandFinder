import type { Metadata } from "next";
import { SideNav } from "@/components/SideNav";
import { PropertyCreateForm } from "@/components/PropertyCreateForm";

export const metadata: Metadata = { title: "Neu erfassen — HOME4efFINDER" };

export default function NeuPage() {
  return (
    <div className="shell">
      <SideNav current="neu" />
      <main className="main">
        <div className="pagehead">
          <h1>Neue Bestandswohnung erfassen</h1>
        </div>
        <PropertyCreateForm />
      </main>
    </div>
  );
}
