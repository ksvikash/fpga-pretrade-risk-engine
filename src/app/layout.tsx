import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Bitcoin Fraud Monitor",
  description: "Temporal transaction risk scoring and investigation dashboard",
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
