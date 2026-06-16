import { Score } from '@/lib/types';
import { SemaforoBadge, corFaixa } from './Semaforo';

const rotulos: Record<Score['indice'], string> = {
  NEGOCIABILIDADE: 'Score de Negociabilidade',
  REGULARIDADE_REGISTRAL: 'Regularidade Registral',
  RISCO_LITIGIO: 'Risco de Litígio',
};

export function ScoreCard({ score }: { score: Score }) {
  const c = corFaixa(score.faixa);
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-700">{rotulos[score.indice]}</h3>
        <SemaforoBadge faixa={score.faixa} />
      </div>
      <div className={`mt-1 text-3xl font-bold ${c.texto}`}>
        {score.valor}
        <span className="text-base font-normal text-slate-400">/100</span>
      </div>
      <ul className="mt-3 space-y-1.5">
        {score.drivers.map((d, i) => (
          <li key={i} className="text-xs">
            <div className="flex items-center justify-between gap-2">
              <span className="text-slate-600">{d.fator}</span>
              <span className="shrink-0 font-medium text-slate-500">
                {d.pontos}/{d.pesoMax}
              </span>
            </div>
            <p className="text-slate-400">{d.nota}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
