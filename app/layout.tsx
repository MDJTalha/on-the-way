import type { Metadata } from "next";
import { PwaRegister } from "./pwa-register";
import "./globals.css";

export const metadata: Metadata = {
  title: "On the Way - Mobility for your city",
  description: "An independent mobility platform, starting in Lahore, Pakistan.",
  applicationName: "On the Way",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "On the Way" },
  icons: { icon: "/favicon.svg" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body><PwaRegister />{children}</body>
    </html>
  );
}
