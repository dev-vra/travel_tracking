# GeoMatrícula — Plataforma de Inteligência Territorial e Registral

> Jogue qualquer matrícula, por pior que esteja escaneada, e receba o imóvel
> plotado no mapa, o titular de hoje, os ônus, um **Score de Negociabilidade** e
> o dossiê pronto — unitário ou em acervo de milhares.

GeoMatrícula transforma a matrícula/transcrição imobiliária em **dado
estruturado, georreferenciado, com leitura jurídica e score de risco**.

Este repositório contém a **fatia vertical do MVP unitário** (Fase F1 do
roadmap): o fluxo ponta-a-ponta de análise de uma matrícula.

```
Upload → OCR (M1) → Parser registral (M2) → Interpretação jurídica (M3)
       → Score & risco (M5) → Dossiê (M6)
```

A camada espacial (M4), motor normativo (M8) e acervo em lote (M7) têm seus
contratos previstos no schema de dados, mas a implementação completa pertence
às fases seguintes.

## Arquitetura

Monorepo com workspaces npm:

| Caminho      | Descrição                                                                 |
|--------------|---------------------------------------------------------------------------|
| `apps/api`   | Backend **NestJS** + Prisma + PostGIS + BullMQ. Pipeline de análise.      |
| `apps/web`   | Frontend **Next.js** (App Router) + Tailwind. Upload e tela de resultado. |
| `docker-compose.yml` | PostgreSQL+PostGIS e Redis para desenvolvimento local.            |

### Decisões desta fase

- **PostGIS e Redis reais** via Docker.
- **AWS Bedrock mockado** atrás de uma porta (`OcrPort`): roda sem credenciais.
  Troca para o provider real definindo `OCR_PROVIDER=bedrock`.
- Lógica de negócio (parser, motor jurídico, score) é **determinística e real** —
  é o fosso do produto, não mock.

## Como rodar

Pré-requisitos: Node 20+, Docker.

```bash
# 1. Subir infraestrutura (Postgres+PostGIS, Redis)
cp .env.example .env
cp apps/api/.env.example apps/api/.env   # ajuste se necessário
npm run infra:up

# 2. Instalar dependências
npm install

# 3. Preparar banco (migrations PostGIS + seed de exemplo)
npm run db:setup
npm run db:seed

# 4. Rodar API e Web
npm run dev:api    # http://localhost:3333
npm run dev:web    # http://localhost:3000
```

Abra http://localhost:3000, cole o texto de uma matrícula (ou use o exemplo
pré-carregado) e veja a análise completa: titular atual, ônus ativos, scores
explicáveis e dossiê.

## Módulos do produto (visão completa)

Ver [`docs/ARQUITETURA.md`](docs/ARQUITETURA.md) para o mapa dos 10 módulos
(M1–M10), modelo de dados e roadmap.

## Convenções

- PT-BR em código e documentação.
- TypeScript estrito.
- Commits semânticos.
- **Disclaimer:** decisão-suporte/inteligência — não substitui certidão oficial
  nem qualificação registral.
