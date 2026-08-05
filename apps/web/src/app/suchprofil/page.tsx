import { SideNav } from "@/components/SideNav";
import { SuchprofilWizard } from "@/components/suchprofil/SuchprofilWizard";

export default function SuchprofilPage() {
  return (
    <div className="shell">
      <SideNav current="suchprofil" />
      <main className="main">
        <div className="pagehead">
          <h1>Suchprofil</h1>
        </div>
        <SuchprofilWizard />
      </main>
    </div>
  );
}
