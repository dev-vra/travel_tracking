# Arquitetura — GeoMatrícula

Mapa técnico da plataforma. Esta fase (F1) entrega a **fatia vertical do MVP
unitário**; os demais módulos têm contrato previsto no modelo de dados.

## Módulos (M1–M10)

| Módulo | Nome | Status nesta fase | Onde no código |
|--------|------|-------------------|----------------|
| M1 | Ingestão & OCR Multimodal | ✅ porta + adapter mock | `apps/api/src/modules/ingest` |
| M2 | Parser Registral | ✅ implementado | `apps/api/src/modules/parser` |
| M3 | Interpretação Jurídica | ✅ implementado | `apps/api/src/modules/juridical` |
| M4 | Inteligência Espacial / GIS | 🟡 coluna PostGIS + seed de ponto | `Imovel.geom`, `prisma/seed.ts` |
| M5 | Risco & Score | ✅ implementado (3 índices) | `apps/api/src/modules/score` |
| M6 | Geração de Artefatos | ✅ dossiê (resumo+JSON+markdown) | `apps/api/src/modules/dossier` |
| M7 | Acervo & Dashboards | 🔜 modelo `Acervo` previsto | schema |
| M8 | Motor Normativo | 🔜 modelo `RegraLocal` previsto | schema |
| M9 | Integrações & API | 🟡 API REST do fluxo unitário | `apps/api/src/modules/analysis` |
| M10 | Admin / LGPD / Auditoria | 🟡 `AuditLog` + disclaimer | schema + dossiê |

Legenda: ✅ implementado · 🟡 parcial/fundação · 🔜 fase seguinte.

## Pipeline unitário (M1 → M6)

```
POST /api/analises  →  Matricula(RECEBIDA)  →  fila BullMQ
   AnalysisProcessor → AnalysisService.processar:
      M1 OcrPort.extrair        (texto normalizado)
      M2 ParserService.parse    (MatriculaParse: atos, imóvel, qualificação)
      M3 JuridicalService       (titular atual, ônus líquidos, disponibilidade)
      M5 ScoreService           (Negociabilidade, Regularidade, Risco de Litígio)
      M6 DossierService         (resumo + dossiê estruturado + markdown)
   → persiste tudo (transação) → Matricula(CONCLUIDA)
GET /api/analises/:id  →  resultado completo (web faz polling)
```

Processamento assíncrono por filas (§9): unitário em segundos; o mesmo
`AnalysisService.processar` serve de base para o lote (M7) via Batch Inference.

## Modelo de dados (§12)

Implementado em `apps/api/prisma/schema.prisma`:

`Matricula`, `Imovel` (com `geom geometry(Geometry,4326)`), `Proprietario`,
`AtoRegistral` (R-/Av-, natureza semântica, cancelamento), `Onus`, `Score`
(índice, valor, faixa, drivers), `Dossie`, `AuditLog`, `Acervo` (M7),
`RegraLocal` (M8 — regra como dado).

A camada espacial usa a extensão **PostGIS** (habilitada via
`previewFeatures = ["postgresqlExtensions"]`). O campo `geom` é `Unsupported`
no Prisma Client e manipulado por SQL bruto / GDAL.

## Metodologia de score (§6)

Cada índice é 0–100, com faixa semáforo (🟢≥70, 🟡40–69, 🔴<40) e **drivers
explicáveis** `{ fator, pesoMax, pontos, nota }`. A rubrica de Negociabilidade
segue os pesos do §6 (ônus 30, indisponibilidade 20, titularidade 15, cláusula
10, outorga 10, geo 10, averbações 5). Pesos serão parametrizáveis por segmento.

> **Disclaimer (§13):** decisão-suporte/inteligência. Não substitui certidão
> oficial nem qualificação registral.

## Próximas fases

- **F2 (Geo + Score):** M4 completo — plotagem de poligonal, cruzamento
  CAR/SIGEF/zoneamento, divergência de área, índice de conformidade geo.
- **F3 (Acervo + PPP):** M7 (lote, heatmaps, clusters) + M8 (motor normativo
  com RAG via pgvector).
- **F4 (Plataforma):** M9 (exportações GeoJSON/SHP/WMS, SREI) + M10 (RBAC,
  gov.br, retenção).
