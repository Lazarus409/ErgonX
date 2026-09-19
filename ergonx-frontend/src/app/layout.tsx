import type { Metadata } from "next";
import "./globals.css";
import AuthProvider from "@/components/guards/AuthProvider";
import InstitutionProvider from "@/components/context/InstitutionContext";

export const metadata: Metadata = {
  title: "ErgonX HR ERP",
  description: "Modular, institution-aware HR ERP system.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>
          <InstitutionProvider>
            {children}
          </InstitutionProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
