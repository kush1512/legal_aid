import type { Metadata, Viewport } from "next";
import "./globals.css";
import { AppProvider } from "@/components/AppProvider";
import { AppShell } from "@/components/AppShell";

export const metadata: Metadata = {
  title: { default: "Legal Aid — First Aid for Legal Advice", template: "%s · Legal Aid" },
  description: "Understand your legal problem, know your rights, prepare documents and find verified lawyers. Private by default.",
};
export const viewport: Viewport = { themeColor: "#142D4E", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AppProvider>
          <AppShell>{children}</AppShell>
        </AppProvider>
      </body>
    </html>
  );
}
