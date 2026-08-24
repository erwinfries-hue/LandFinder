/**
 * Sprungmarken-Navigation für die Objekt-Detailseite — die Seite kann mit Bestandsrendite,
 * Verhandlungskorridor, Value-Add und Due-Diligence-Funden sehr lang werden, gerade auf dem
 * Handy war ohne diese Navigation viel manuelles Scrollen nötig. `links` wird von der
 * Detailseite gebaut und enthält nur Anker, die auf der aktuellen Seite tatsächlich
 * existieren (z.B. kein "Verhandlungskorridor"-Link, wenn dafür keine Bisektionslösung
 * gefunden wurde).
 */
export function ObjectSectionNav({ links }: { links: { href: string; label: string }[] }) {
  if (links.length === 0) return null;
  return (
    <nav className="section-nav" aria-label="Abschnitte auf dieser Seite">
      {links.map((l) => (
        <a key={l.href} href={l.href}>
          {l.label}
        </a>
      ))}
    </nav>
  );
}
