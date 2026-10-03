import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Colher Dados",
  description: "Coleta de telemetria para atendimento.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
