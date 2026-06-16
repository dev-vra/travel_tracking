'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { Analise } from '@/lib/types';
import { ScoreCard } from '@/components/ScoreCard';

export default function AnalisePage({ params }: { params: { id: string } }) {
  const [a, setA] = useState<Analise | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    let ativo = true;
    let timer: ReturnType<typeof setTimeout>;

    const buscar = async () => {
      try {
        const dados = await api.obter(params.id);
        if (!ativo) return;
        setA(dados);
        if (dados.status === 'RECEBIDA' || dados.status === 'PROCESSANDO') {
          timer = setTimeout(buscar, 1200);
        }
      } catch (e) {
        if (ativo) setErro(e instanceof Error ? e.message : 'Erro');
      }
    };
    buscar();
    return () => {
      ativo = false;
      clearTimeout(timer);
    };
  }, [params.id]);

  if (erro) return <Aviso texto={erro} />;
  if (!a) return <Aviso texto="Carregando…" />;

  if (a.status === 'RECEBIDA' || a.status === 'PROCESSANDO')
    return <Aviso texto="Processando a matrícula… (M1→M6)" pulsar />;

  if (a.status === 'ERRO')
    return <Aviso texto={`Falha no processamento: ${a.erro ?? 'erro desconhecido'}`} />;

  const titulares = a.proprietarios.filter((p) => p.atual);
  const onusAtivos = a.onus.filter((o) => o.ativo);

  return (
    <div className="space-y-6">
      <Link href="/" className="text-sm text-terra-700 hover:underline">
        ← Nova análise
      </Link>

      <header className="rounded-xl border border-slate-200 bg-white p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-terra-900">
              Matrícula {a.numero ?? 's/nº'}
            </h1>
            <p className="text-sm text-slate-500">
              {a.cartorio ?? '—'} · {a.comarca ?? '—'}/{a.uf ?? '—'}
            </p>
          </div>
          {a.imovel && (
            <div className="text-right text-sm text-slate-600">
              <div className="font-medium">{a.imovel.tipo}</div>
              {a.imovel.areaM2 != null && (
                <div>{a.imovel.areaM2.toLocaleString('pt-BR')} m²</div>
              )}
            </div>
          )}
        </div>
        {a.dossie && (
          <p className="mt-3 rounded-lg bg-terra-50 p-3 text-sm text-terra-900">
            {a.dossie.resumo}
          </p>
        )}
      </header>

      {/* Scores */}
      <section className="grid gap-4 md:grid-cols-3">
        {a.scores
          .slice()
          .sort((x, y) => x.indice.localeCompare(y.indice))
          .map((s) => (
            <ScoreCard key={s.id} score={s} />
          ))}
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Estado jurídico */}
        <section className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
            Estado jurídico
          </h2>
          <dl className="mt-3 space-y-2 text-sm">
            <Linha rotulo="Titular(es) atual(is)">
              {titulares.length
                ? titulares.map((t) => (
                    <span key={t.id} className="block">
                      {t.nome}
                      {t.documento && (
                        <span className="text-slate-400"> · {t.documento}</span>
                      )}
                      {t.origemAto && (
                        <span className="text-slate-400"> ({t.origemAto})</span>
                      )}
                    </span>
                  ))
                : '—'}
            </Linha>
            <Linha rotulo="Ônus ativos">
              {onusAtivos.length
                ? onusAtivos.map((o) => (
                    <span key={o.id} className="block">
                      {o.tipo} {o.credor && `— ${o.credor}`} ({o.origemAto})
                    </span>
                  ))
                : 'Nenhum'}
            </Linha>
          </dl>
        </section>

        {/* Cadeia / atos */}
        <section className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
            Atos registrais ({a.atos.length})
          </h2>
          <ol className="mt-3 space-y-2 text-sm">
            {a.atos.map((ato) => (
              <li key={ato.id} className="border-l-2 border-terra-600/30 pl-3">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-terra-900">{ato.codigo}</span>
                  <span className="rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-600">
                    {ato.natureza}
                  </span>
                  {ato.data && (
                    <span className="text-xs text-slate-400">
                      {new Date(ato.data).toLocaleDateString('pt-BR')}
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500 line-clamp-2">{ato.conteudo}</p>
              </li>
            ))}
          </ol>
        </section>
      </div>

      {/* Dossiê markdown */}
      {a.dossie && (
        <section className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
            Dossiê
          </h2>
          <pre className="mt-3 max-h-96 overflow-auto whitespace-pre-wrap rounded-lg bg-slate-50 p-4 text-xs text-slate-700">
            {a.dossie.markdown}
          </pre>
        </section>
      )}

      <p className="text-xs text-slate-400">
        Decisão-suporte/inteligência. Não substitui certidão oficial nem qualificação registral.
      </p>
    </div>
  );
}

function Linha({ rotulo, children }: { rotulo: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-slate-400">{rotulo}</dt>
      <dd className="text-slate-700">{children}</dd>
    </div>
  );
}

function Aviso({ texto, pulsar }: { texto: string; pulsar?: boolean }) {
  return (
    <div
      className={`rounded-xl border border-slate-200 bg-white p-8 text-center text-slate-500 ${
        pulsar ? 'animate-pulse' : ''
      }`}
    >
      {texto}
    </div>
  );
}
