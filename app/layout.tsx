import type { Metadata } from "next";
import { Alef } from "next/font/google";
import "./globals.css";

const alef = Alef({
  weight: ["400", "700"],
  subsets: ["hebrew", "latin"],
  display: "swap",
  variable: "--font-alef",
});

export const metadata: Metadata = {
  title: "שכבת ח׳ — בן גוריון הרצליה",
  description: "אתר שכבת ח׳ בבית ספר בן גוריון הרצליה",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "אתר כיתה",
  },
  icons: {
    icon: "/school-logo.png",
    apple: "/school-logo.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="he" dir="rtl" className={`${alef.variable} ${alef.className} h-full dark`}>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  const savedTheme = localStorage.getItem('theme');
                  if (savedTheme === 'light' || (!savedTheme && window.matchMedia('(prefers-color-scheme: light)').matches)) {
                    document.documentElement.classList.remove('dark');
                  } else {
                    document.documentElement.classList.add('dark');
                  }
                } catch (e) {}
              })()
            `,
          }}
        />
      </head>
      <body className={`${alef.className} min-h-full font-sans antialiased`}>{children}</body>
    </html>
  );
}
