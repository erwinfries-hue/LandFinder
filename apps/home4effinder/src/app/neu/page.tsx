import type { Metadata } from "next";
import { SideNav } from "@/components/SideNav";
import { PropertyCreateForm } from "@/components/PropertyCreateForm";
import { getParameterOverrides } from "@/lib/parameterOverrides";

export const metadata: Metadata = { title: "Neu erfassen — HOME4efFINDER" };
export const dynamic = "force-dynamic";

export default async function NeuPage() {
  const parameterOverrides = await getParameterOverrides();
  return (
    <div className="shell">
      <SideNav current="neu" />
      <main className="main">
        <div className="pagehead">
          <h1>Neue Bestandswohnung erfassen</h1>
        </div>
        <PropertyCreateForm parameterOverrides={parameterOverrides} />
      </main>
    </div>
  );
}
