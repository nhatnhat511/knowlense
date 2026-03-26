import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Knowlense",
  description: "Knowlense helps TPT sellers audit listings, find keyword gaps, and turn store data into action."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
