import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Artist Alley Stock",
  description: "Track artist alley stock and profit",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
