/**
 * Kleines "ⓘ"-Symbol mit nativem Hover-Tooltip (`title`-Attribut) — erklärt, was ein
 * Wert bedeutet und/oder wie er berechnet wird. Ein Element pro Vorkommen, damit
 * Screenreader/Keyboard-Nutzer:innen den Text weiterhin über den Tab-Fokus + native
 * Tooltip-Mechanik erreichen (kein eigenes JS-Popover nötig).
 */
export function InfoHint({ text }: { text: string }) {
  return (
    <span className="infoicon" title={text} tabIndex={0}>
      ⓘ
    </span>
  );
}
