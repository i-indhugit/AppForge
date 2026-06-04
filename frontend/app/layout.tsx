import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AppForge AI — Natural Language to Application Compiler",
  description: "Compile natural language requirements into complete executable database, API, and UI schemas, with auto-repair and runtime generator.",
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
