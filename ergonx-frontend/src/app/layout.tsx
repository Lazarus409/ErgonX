import type { Metadata } from "next";
import "./globals.css";
import AuthProvider from "@/components/guards/AuthProvider";
import InstitutionProvider from "@/components/context/InstitutionContext";
import ServiceWorkerRegistration from "@/components/pwa/ServiceWorkerRegistration";
import ThemeProvider from "@/components/context/ThemeProvider";
import ToastProvider from "@/components/ui/ToastProvider";

export const metadata: Metadata = {
  title: "ErgonX HR ERP",
  description: "Modular, institution-aware HR ERP system.",
  applicationName: "ErgonX",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: "/ergonx-logo.png",
  },
};

export const viewport = {
  themeColor: "#020617",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
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
