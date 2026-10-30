import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ThinkTime — get paid for the ads you see while AI thinks",
  description: "A Chrome extension that pays you, on Monad, for the sponsored cards you see while ChatGPT, Claude or Gemini generate.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="antialiased font-sans">{children}</body>
    </html>
  );
}
