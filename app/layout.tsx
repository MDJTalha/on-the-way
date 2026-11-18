import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Pi Mobility — Move Freely. Pay with Pi.",
  description: "A Pi-powered mobility marketplace connecting passengers and independent drivers.",
  applicationName: "Pi Mobility",
  icons: { icon: "/favicon.svg" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
