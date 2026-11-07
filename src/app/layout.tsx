
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Sheetly — Spreadsheet Workspace",
  description: "A modern, keyboard-first spreadsheet application.",
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
