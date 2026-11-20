import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "On the Way — Move Freely. Pay with Pi.",
  description: "An independent, Pi-first mobility marketplace connecting passengers with local drivers.",
  applicationName: "On the Way",
  icons: { icon: "/favicon.svg" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}