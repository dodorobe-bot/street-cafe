import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "KAFE RADAR — Uji Minat Menu",
  description: "Uji minat pelanggan sebelum mengeluarkan biaya promosi."
};
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="id"><body>{children}</body></html>;
}