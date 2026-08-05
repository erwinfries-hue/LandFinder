import Link from "next/link";
import { Icon, type IconName } from "@landfinder/ui";
import { demoObjekte } from "@/lib/demo-data";

const items: { href: string; label: string; icon: IconName; key: string }[] = [
  { href: "/", label: "Übersicht", icon: "grid", key: "uebersicht" },
  { href: "/objekte", label: "Objekte", icon: "plot", key: "objekte" },
  { href: "/vergleich", label: "Vergleich", icon: "scale", key: "vergleich" },
  { href: "/suchprofil", label: "Suchprofil", icon: "doc", key: "suchprofil" },
  { href: "/quellen", label: "Quellen", icon: "mail", key: "quellen" },
];

/**
 * `activeSlug` wird nur von der Objekt-Detailseite übergeben, um den Eintrag der
 * aktuell offenen Liegenschaft in der aufklappbaren Liste hervorzuheben.
 */
export function SideNav({ current, activeSlug }: { current: string; activeSlug?: string }) {
  return (
    <aside className="side">
      <div>
        <div className="word">SIPIS</div>
        <div className="word2">LandFinder</div>
      </div>
      <nav className="nav">
        {items.map((item) =>
          item.key === "objekte" ? (
            <details key={item.key} className="navobjekte" open={current === "objekte" ? true : undefined}>
              <summary>
                <Link href={item.href} className={item.key === current ? "current" : undefined}>
                  <Icon name={item.icon} /> {item.label}
                </Link>
              </summary>
              <div className="navobjekte-list">
                {demoObjekte.map((o) => (
                  <Link
                    key={o.slug}
                    href={`/objekte/${o.slug}`}
                    className={o.slug === activeSlug ? "current" : undefined}
                  >
                    <span className="t">
                      {o.adresse}, {o.ort} {o.kanton}
                    </span>
                    <span className="s mono">{o.score}</span>
                  </Link>
                ))}
              </div>
            </details>
          ) : (
            <Link key={item.key} href={item.href} className={item.key === current ? "current" : undefined}>
              <Icon name={item.icon} /> {item.label}
            </Link>
          )
        )}
      </nav>
      <div className="profile">
        Erwin Fries
        <br />
        erwin.fries@gmx.ch
      </div>
    </aside>
  );
}
