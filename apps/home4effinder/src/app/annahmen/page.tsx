import type { Metadata } from "next";
import { SideNav } from "@/components/SideNav";
import { AnnahmenForm } from "@/components/AnnahmenForm";
import { getParameterOverrides } from "@/lib/parameterOverrides";

export const metadata: Metadata = { title: "Annahmen — HOME4efFINDER" };
export const dynamic = "force-dynamic";

export default async function AnnahmenPage() {
  const overrides = await getParameterOverrides();
  return (
    <div className="shell">
      <SideNav current="annahmen" />
      <main className="main">
        <div className="pagehead">
          <h1>Annahmen</h1>
        </div>
        <AnnahmenForm overrides={overrides} />
      </main>
    </div>
  );
}
