import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Spec Detective",
  description: "Agentic specification reconstruction with Explorer and Spec Detective",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
