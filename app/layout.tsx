import "./globals.css";
import type { ReactNode } from "react";

export const metadata = {
  title: "Informe de Propiedades - Veiren",
  description: "Panel interno de seguimiento de propiedades (NAI)",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
