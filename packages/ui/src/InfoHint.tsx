/**
 * Kleines "ⓘ"-Symbol mit eigenem, gestyltem Tooltip (CSS `::after` aus `data-tip`,
 * siehe globals.css `.infoicon`) statt dem nativen `title`-Attribut — das erscheint
 * auf Touch-Geräten gar nicht (kein Hover) und ist auf Desktop winzig/verzögert.
 * `tabIndex` + `:focus` in der CSS-Regel machen den Tooltip per Tastatur UND per Tap
 * (Fokus bei Touch) erreichbar, ganz ohne eigenes JS. `aria-label` statt `title` für
 * Screenreader, damit kein doppelter/nativer Tooltip zusätzlich aufploppt.
 */
export function InfoHint({ text }: { text: string }) {
  return (
    <span className="infoicon" data-tip={text} aria-label={text} tabIndex={0}>
      ⓘ
    </span>
  );
}
