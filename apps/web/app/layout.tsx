import "./globals.css";
import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import Script from "next/script";

const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-sans"
});

export const metadata: Metadata = {
  title: "Knowlense",
  description: "Knowlense helps TPT sellers audit listings, find keyword gaps, and turn store data into action.",
  icons: {
    icon: "/icon.svg",
    shortcut: "/icon.svg",
    apple: "/icon.svg"
  }
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${plusJakartaSans.variable}`}>
        <Script async src="https://www.googletagmanager.com/gtag/js?id=G-8FRPDTZV9Y" strategy="afterInteractive" />
        <Script id="google-analytics" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', 'G-8FRPDTZV9Y');
          `}
        </Script>
        <div id="main-content">{children}</div>
      </body>
    </html>
  );
}
