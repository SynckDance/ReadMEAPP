import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ReadMEAPP",
  description: "A research reader with a Desk and a Knowledge Bucket.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="font-serif">{children}</body>
    </html>
  );
}
