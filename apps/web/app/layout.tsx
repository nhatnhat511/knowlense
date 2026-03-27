import "./globals.css";
import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";

const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-sans"
});

export const metadata: Metadata = {
  title: "Knowlense",
  description: "Knowlense helps TPT sellers audit listings, find keyword gaps, and turn store data into action."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${plusJakartaSans.variable}`}>
        <div id="main-content">{children}</div>
      </body>
    </html>
  );
}
