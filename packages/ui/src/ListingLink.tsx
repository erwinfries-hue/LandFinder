import { Icon } from "./IconSprite";

/** Verlinkt auf das Original-Inserat beim Portal — für die Quellen-Übersicht und -Detailansicht. */
export function ListingLink({ url, label = "Inserat öffnen" }: { url: string; label?: string }) {
  return (
    <a className="maplink" href={url} target="_blank" rel="noopener noreferrer">
      <Icon name="extlink" width={14} />
      {label}
    </a>
  );
}
