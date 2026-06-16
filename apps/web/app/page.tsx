'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';
import { AnaliseResumo } from '@/lib/types';
import { SemaforoBadge } from '@/components/Semaforo';

const EXEMPLO = `CARTÓRIO DE REGISTRO DE IMÓVEIS DA COMARCA DE CUIABÁ - MT
MATRÍCULA Nº 12.345

IMÓVEL: Lote 15 da Quadra 22, situado na Rua das Acácias, nº 100, Bairro Jardim Primavera, no município de Cuiabá - MT, com área de 360,00 m², confrontando-se pela frente com a Rua das Acácias.

PROPRIETÁRIO: JOÃO DA SILVA, brasileiro, solteiro, empresário, portador do CPF 123.456.789-00.

R-1-12.345 - REGISTRO - Em 10/03/2005. ABERTURA DE MATRÍCULA por COMPRA E VENDA. Adquirente: JOÃO DA SILVA, CPF 123.456.789-00.

Av-2-12.345 - AVERBAÇÃO - Em 20/01/2015. CONSTRUÇÃO de edificação residencial com 180,00 m², conforme habite-se.

R-3-12.345 - REGISTRO - Em 05/05/2018. COMPRA E VENDA. Vendedor: JOÃO DA SILVA. Adquirente: MARIA OLIVEIRA SANTOS, brasileira, casada, CPF 987.654.321-00.`;

export default function Home() {
  const router = useRouter();
  const [texto, setTexto] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [recentes, setRecentes] = useState<AnaliseResumo[]>([]);

  useEffect(() => {
    api.listar().then(setRecentes).catch(() => undefined);
  }, []);

  async function enviar() {
    setErro(null);
    setEnviando(true);
    try {
      const { id } = await api.criarAnalise(texto);
      router.push(`/analises/${id}`);
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Falha ao enviar.');
      setEnviando(false);
    }
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[1.4fr_1fr]">
      <section>
        <h1 className="text-2xl font-bold text-terra-900">Analisar matrícula</h1>
        <p className="mt-1 text-sm text-slate-500">
          Cole o texto da matrícula/transcrição. O pipeline extrai os atos, resolve o
          titular atual, os ônus, e calcula os scores explicáveis.
        </p>

        <textarea
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder="Cole aqui o texto da matrícula..."
          className="mt-4 h-72 w-full resize-y rounded-xl border border-slate-300 bg-white p-3 font-mono text-sm outline-none focus:border-terra-600"
        />

        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button
            onClick={enviar}
            disabled={enviando || texto.trim().length < 20}
            className="rounded-lg bg-terra-700 px-4 py-2 text-sm font-medium text-white hover:bg-terra-900 disabled:opacity-40"
          >
            {enviando ? 'Processando…' : 'Analisar'}
          </button>
          <button
            onClick={() => setTexto(EXEMPLO)}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-600 hover:bg-white"
          >
            Usar exemplo
          </button>
          {erro && <span className="text-sm text-rose-600">{erro}</span>}
        </div>
      </section>

      <section>
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
          Análises recentes
        </h2>
        <ul className="mt-3 space-y-2">
          {recentes.length === 0 && (
            <li className="rounded-lg border border-dashed border-slate-300 p-4 text-sm text-slate-400">
              Nenhuma análise ainda. Rode o seed (`npm run db:seed`) ou envie uma matrícula.
            </li>
          )}
          {recentes.map((r) => {
            const neg = r.scores.find((s) => s.indice === 'NEGOCIABILIDADE');
            return (
              <li key={r.id}>
                <Link
                  href={`/analises/${r.id}`}
                  className="block rounded-lg border border-slate-200 bg-white p-3 hover:border-terra-600"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-terra-900">
                      Matrícula {r.numero ?? 's/nº'}
                    </span>
                    {neg && <SemaforoBadge faixa={neg.faixa} />}
                  </div>
                  <div className="mt-0.5 text-xs text-slate-500">
                    {r.comarca ?? '—'}/{r.uf ?? '—'} · {r.status}
                    {neg && ` · Negociabilidade ${neg.valor}`}
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
