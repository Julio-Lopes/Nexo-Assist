import type { Metadata } from "next";
import { IBM_Plex_Mono, Newsreader, Schibsted_Grotesk } from "next/font/google";
import type { ReactNode } from "react";
import "./globals.css";
import { Providers } from "./providers";

const display = Newsreader({ subsets: ["latin"], variable: "--font-newsreader", display: "swap" });
const ui = Schibsted_Grotesk({ subsets: ["latin"], variable: "--font-schibsted", display: "swap" });
const data = IBM_Plex_Mono({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-plex-mono", display: "swap" });

export const metadata: Metadata = {
  title: { default: "Nexo Assist", template: "%s · Nexo Assist" },
  description: "Service desk de TI da Nexo",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR" className={`${display.variable} ${ui.variable} ${data.variable}`}>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}