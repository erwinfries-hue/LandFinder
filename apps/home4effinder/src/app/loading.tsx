import { SideNav } from "@/components/SideNav";

/** Siehe objekte/[id]/loading.tsx — derselbe Grund (Mauszeiger bleibt sonst auf "Sanduhr"). */
export default function Loading() {
  return (
    <div className="shell">
      <SideNav current="objekte" />
      <main className="main">
        <div style={{ display: "flex", alignItems: "center", gap: ".6rem", padding: "2rem 0", color: "var(--ink-soft)", fontSize: ".875rem" }}>
          <span className="spinner" aria-hidden="true" />
          Lädt…
        </div>
      </main>
    </div>
  );
}
