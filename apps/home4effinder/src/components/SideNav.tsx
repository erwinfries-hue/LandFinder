import Link from "next/link";
import { Icon, type IconName } from "@landfinder/ui";
import { LogoutButton } from "./LogoutButton";

const items: { href: string; label: string; icon: IconName; key: string }[] = [
  { href: "/", label: "Objekte", icon: "plot", key: "objekte" },
  { href: "/neu", label: "Neu erfassen", icon: "grid", key: "neu" },
  { href: "/vergleich", label: "Vergleich", icon: "scale", key: "vergleich" },
];

/**
 * Mobile Navigation ohne JavaScript: eine versteckte Checkbox + zwei <label>-Elemente
 * (Burger-Button, Backdrop) steuern per CSS-Sibling-Selektor (`:checked ~ .side`), ob
 * `.side` als Overlay-Drawer eingeblendet wird (siehe globals.css, wiederverwendet aus
 * LandFinder — dieselbe Design-Sprache, siehe apps/home4effinder/README.md).
 */
export function SideNav({ current }: { current: string }) {
  return (
    <>
      <input type="checkbox" id="mobilenav-toggle" className="mobilenav-toggle" />
      <label htmlFor="mobilenav-toggle" className="mobilenav-burger">
        <Icon name="grid" width={18} /> Menü
      </label>
      <label htmlFor="mobilenav-toggle" className="mobilenav-backdrop" aria-hidden="true" />
      <aside className="side">
        <div className="side-headrow">
          <div>
            <div className="word">HOME</div>
            <div className="word2">
              <span style={{ fontStyle: "italic", color: "var(--accent)" }}>4ef</span>Finder
            </div>
          </div>
          <label htmlFor="mobilenav-toggle" className="mobilenav-close" aria-label="Menü schliessen">
            ✕
          </label>
        </div>
        <nav className="nav">
          {items.map((item) => (
            <Link key={item.key} href={item.href} className={item.key === current ? "current" : undefined} title={item.label}>
              <Icon name={item.icon} /> <span className="label">{item.label}</span>
            </Link>
          ))}
        </nav>
        <div className="profile">
          erwin.fries@gmx.ch
          <br />
          <LogoutButton />
        </div>
      </aside>
    </>
  );
}
