import './globals.css';
import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'GeoMatrícula — Inteligência Territorial e Registral',
  description:
    'Transforme matrículas em dado estruturado, georreferenciado, com leitura jurídica e score de risco.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>
        <header className="border-b border-terra-700/10 bg-white">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
            <Link href="/" className="flex items-center gap-2">
              <span className="grid h-8 w-8 place-items-center rounded-md bg-terra-700 text-white">
                ◈
              </span>
              <span className="text-lg font-semibold text-terra-900">
                GeoMatrícula
              </span>
              <span className="rounded bg-terra-50 px-1.5 py-0.5 text-xs text-terra-700">
                v0.1
              </span>
            </Link>
            <span className="text-sm text-slate-500">Decisão-suporte · não substitui certidão</span>
          </div>
        </header>
        <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
        <footer className="mx-auto max-w-6xl px-4 py-8 text-xs text-slate-400">
          GeoMatrícula — Plataforma de Inteligência Territorial e Registral. MVP unitário (F1).
        </footer>
      </body>
    </html>
  );
}
