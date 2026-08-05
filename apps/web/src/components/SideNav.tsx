import Link from "next/link";
import { Icon, type IconName } from "@landfinder/ui";

const items: { href: string; label: string; icon: IconName; key: string }[] = [
  { href: "/", label: "Übersicht", icon: "grid", key: "uebersicht" },
  { href: "/objekte", label: "Objekte", icon: "plot", key: "objekte" },
  { href: "/vergleich", label: "Vergleich", icon: "scale", key: "vergleich" },
  { href: "/suchprofil", label: "Suchprofil", icon: "doc", key: "suchprofil" },
  { href: "/quellen", label: "Quellen", icon: "mail", key: "quellen" },
];

export function SideNav({ current }: { current: string }) {
  return (
    <aside className="side">
      <div>
        <div className="word">SIPIS</div>
        <div className="word2">LandFinder</div>
      </div>
      <nav className="nav">
        {items.map((item) => (
          <Link key={item.key} href={item.href} className={item.key === current ? "current" : undefined}>
            <Icon name={item.icon} /> {item.label}
          </Link>
        ))}
      </nav>
      <div className="profile">
        Erwin Fries
        <br />
        erwin.fries@gmx.ch
      </div>
    </aside>
  );
}
