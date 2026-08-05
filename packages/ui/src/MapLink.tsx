import { Icon } from "./IconSprite";

/** Verlinkt eine Adresse auf Google Maps — für die Spalte "Lage" und die Objekt-Detailseite. */
export function MapLink({ address, label = "Lage" }: { address: string; label?: string }) {
  const href = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
  return (
    <a className="maplink" href={href} target="_blank" rel="noopener noreferrer">
      <Icon name="compass" width={14} />
      {label}
    </a>
  );
}
