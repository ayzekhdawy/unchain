import type { Metadata } from "next";
import { Schibsted_Grotesk, Source_Serif_4 } from "next/font/google";
import "./globals.css";

const grotesk = Schibsted_Grotesk({
  subsets: ["latin", "latin-ext"],
  variable: "--font-ui"
});

const serif = Source_Serif_4({
  subsets: ["latin", "latin-ext"],
  variable: "--font-read"
});

export const metadata: Metadata = {
  title: "Unchain",
  description: "Türkçe kitabı telefonda sese çevirir. Metin ve ses cihazdan çıkmaz.",
  metadataBase: new URL("https://unchain.noniux.com")
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr" className={`${grotesk.variable} ${serif.variable}`}>
      <body>{children}</body>
    </html>
  );
}
