import type { Metadata } from "next";
import { IconSprite } from "@landfinder/ui";
import { fontDisplay, fontBody, fontMono } from "@/fonts";
import "./globals.css";

export const metadata: Metadata = {
  title: "HOME4efFINDER",
  description: "Privates Due-Diligence- und Renditeinstrument für bestehende Eigentumswohnungen (Buy-to-let) in der Schweiz.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="de" className={`${fontDisplay.variable} ${fontBody.variable} ${fontMono.variable}`}>
      <body>
        <IconSprite />
        {children}
      </body>
    </html>
  );
}
