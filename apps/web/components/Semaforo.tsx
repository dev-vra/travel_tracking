import { Faixa } from '@/lib/types';

const estilos: Record<Faixa, { bg: string; texto: string; emoji: string }> = {
  VERDE: { bg: 'bg-emerald-100 text-emerald-800', texto: 'text-emerald-700', emoji: '🟢' },
  AMARELO: { bg: 'bg-amber-100 text-amber-800', texto: 'text-amber-700', emoji: '🟡' },
  VERMELHO: { bg: 'bg-rose-100 text-rose-800', texto: 'text-rose-700', emoji: '🔴' },
};

export function SemaforoBadge({ faixa }: { faixa: Faixa }) {
  const e = estilos[faixa];
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${e.bg}`}>
      {e.emoji} {faixa}
    </span>
  );
}

export function corFaixa(faixa: Faixa) {
  return estilos[faixa];
}
