import { Panel } from "@landfinder/ui";
import { SideNav } from "@/components/SideNav";

export function PlaceholderPage({ current, title, hinweis }: { current: string; title: string; hinweis: string }) {
  return (
    <div className="shell">
      <SideNav current={current} />
      <main className="main">
        <div className="pagehead">
          <h1>{title}</h1>
        </div>
        <Panel style={{ padding: "1.4rem 1.6rem" }}>
          <p style={{ color: "var(--ink-soft)", fontSize: ".875rem" }}>{hinweis}</p>
        </Panel>
      </main>
    </div>
  );
}
