import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import AuthProvider from "@/components/guards/AuthProvider";
import InstitutionProvider from "@/components/context/InstitutionContext";
import ServiceWorkerRegistration from "@/components/pwa/ServiceWorkerRegistration";
import ThemeProvider, { THEME_INIT_SCRIPT } from "@/components/context/ThemeProvider";
import ToastProvider from "@/components/ui/ToastProvider";

const brandFont = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-brand",
  display: "swap",
});

export const metadata: Metadata = {
  title: "ErgonX — Workforce & Financial Management",
  description: "Modular, institution-aware workforce and financial management.",
  applicationName: "ErgonX",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/brand/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/brand/favicon-48.png", sizes: "48x48", type: "image/png" },
      { url: "/brand/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: [{ url: "/brand/apple-touch-icon.png", sizes: "180x180" }],
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#0f2345" },
    { media: "(prefers-color-scheme: dark)", color: "#07132a" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={brandFont.variable} suppressHydrationWarning>
      <head>
        {/* Applies the saved theme before first paint to avoid a light flash. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body>
        <ServiceWorkerRegistration />
        <ThemeProvider>
          <ToastProvider>
            <AuthProvider>
              <InstitutionProvider>{children}</InstitutionProvider>
            </AuthProvider>
          </ToastProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
