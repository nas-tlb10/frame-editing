import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Frame",
  description: "Montage vidéo automatisé : une vidéo parlée, un style, un MP4.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
