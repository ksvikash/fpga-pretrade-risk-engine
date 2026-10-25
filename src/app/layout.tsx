import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ApexGate Risk Monitor",
  description: "ApexGate dual-plane crypto risk gateway monitoring dashboard",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
