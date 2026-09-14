import type { Metadata, Viewport } from "next";

import { PwaRegister } from "@/components/pwa-register";
import "./globals.css";

export const metadata: Metadata = {
  title: "Dawah Norge – Oppfølging",
  description: "Sikker intern registrering og oppfølging av nye muslimer i Dawah Norge.",
  applicationName: "Dawah Norge",
  manifest: "/manifest.webmanifest",
  robots: { index: false, follow: false },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
    apple: "/favicon.svg",
  },
};

export const viewport: Viewport = {
  themeColor: "#143f37",
  colorScheme: "light",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="nb">
      <body className="antialiased">
        {children}
        <PwaRegister />
      </body>
    </html>
  );
}
