import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Marco Advisor",
  description: "Upload-first travel intelligence for private trips."
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
