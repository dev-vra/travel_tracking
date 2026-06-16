/**
 * Seed do GeoMatrícula: processa matrículas de exemplo pelo pipeline real
 * (M2 → M3 → M5 → M6) e popula o banco, inclusive geometria PostGIS (M4).
 *
 * Roda fora do contexto Nest, instanciando os serviços diretamente.
 */
import { PrismaClient, Prisma, StatusMatricula } from '@prisma/client';
import { ParserService } from '../src/modules/parser/parser.service';
import { JuridicalService } from '../src/modules/juridical/juridical.service';
import { ScoreService } from '../src/modules/score/score.service';
import { DossierService } from '../src/modules/dossier/dossier.service';

const prisma = new PrismaClient();
const parser = new ParserService();
const juridical = new JuridicalService();
const score = new ScoreService();
const dossier = new DossierService();

const MATRICULA_URBANA_LIMPA = `
CARTÓRIO DE REGISTRO DE IMÓVEIS DA COMARCA DE CUIABÁ - MT
MATRÍCULA Nº 12.345

IMÓVEL: Lote 15 da Quadra 22, situado na Rua das Acácias, nº 100, Bairro Jardim Primavera, no município de Cuiabá - MT, com área de 360,00 m², confrontando-se pela frente com a Rua das Acácias; pelo lado direito com o lote 14; pelo lado esquerdo com o lote 16; e pelos fundos com o lote 30.

PROPRIETÁRIO: JOÃO DA SILVA, brasileiro, solteiro, empresário, portador do CPF 123.456.789-00.

R-1-12.345 - REGISTRO - Em 10/03/2005. ABERTURA DE MATRÍCULA por COMPRA E VENDA. Adquirente: JOÃO DA SILVA, CPF 123.456.789-00. Transmitente: LOTEADORA PRIMAVERA LTDA.

Av-2-12.345 - AVERBAÇÃO - Em 20/01/2015. CONSTRUÇÃO de uma edificação residencial com 180,00 m² de área construída, conforme habite-se expedido pela Prefeitura.

R-3-12.345 - REGISTRO - Em 05/05/2018. COMPRA E VENDA. Vendedor: JOÃO DA SILVA. Adquirente: MARIA OLIVEIRA SANTOS, brasileira, casada, professora, CPF 987.654.321-00.
`;

const MATRICULA_RURAL_ONUS = `
CARTÓRIO DE REGISTRO DE IMÓVEIS DA COMARCA DE RONDONÓPOLIS - MT
MATRÍCULA Nº 9.876

IMÓVEL: Imóvel rural denominado Fazenda Boa Esperança, situado no município de Rondonópolis - MT, com área de 250,0000 ha, objeto de georreferenciamento certificado pelo INCRA sob código SIGEF.

PROPRIETÁRIO: AGROPECUÁRIA BOA ESPERANÇA LTDA, CNPJ 12.345.678/0001-90.

R-1-9.876 - REGISTRO - Em 12/07/2001. ABERTURA por COMPRA E VENDA. Adquirente: AGROPECUÁRIA BOA ESPERANÇA LTDA, CNPJ 12.345.678/0001-90.

R-2-9.876 - REGISTRO - Em 03/02/2010. HIPOTECA em favor do BANCO RURAL S/A, no valor de R$ 1.500.000,00.

Av-3-9.876 - AVERBAÇÃO - Em 18/09/2012. GEORREFERENCIAMENTO certificado pelo INCRA, com memorial descritivo.

Av-4-9.876 - AVERBAÇÃO - Em 22/06/2018. CANCELAMENTO da hipoteca constante do R-2, por quitação integral da dívida.

R-5-9.876 - REGISTRO - Em 15/03/2021. PENHORA em favor da Fazenda Pública Estadual, nos autos da execução fiscal nº 0001234-55.
`;

async function processar(texto: string, geom?: { lng: number; lat: number }) {
  const parse = parser.parse(texto);
  const estado = juridical.interpretar(parse);
  const scores = score.calcular(parse, estado);
  const dossie = dossier.gerar(parse, estado, scores);

  const matricula = await prisma.matricula.create({
    data: {
      textoBruto: texto.trim(),
      numero: parse.numero,
      cartorio: parse.cartorio,
      comarca: parse.comarca,
      uf: parse.uf,
      status: StatusMatricula.CONCLUIDA,
      imovel: {
        create: {
          tipo: parse.imovel.tipo,
          descricao: parse.imovel.descricao,
          areaM2: parse.imovel.areaM2,
          logradouro: parse.imovel.logradouro,
          municipio: parse.imovel.municipio,
          uf: parse.imovel.uf,
        },
      },
      proprietarios: {
        create: estado.titularesAtuais.map((t) => ({
          nome: t.nome,
          documento: t.documento,
          tipoPessoa: t.tipoPessoa,
          estadoCivil: t.estadoCivil,
          atual: true,
          origemAto: t.origemAto,
        })),
      },
      atos: {
        create: parse.atos.map((a) => ({
          tipo: a.tipo,
          ordem: a.ordem,
          codigo: a.codigo,
          natureza: a.natureza,
          data: a.data,
          conteudo: a.conteudo,
          cancelaCodigo: a.cancelaCodigo,
        })),
      },
      onus: {
        create: estado.onus.map((o) => ({
          tipo: o.tipo,
          ativo: o.ativo,
          credor: o.credor,
          valor: o.valor,
          origemAto: o.origemAto,
        })),
      },
      scores: {
        create: scores.map((s) => ({
          indice: s.indice,
          valor: s.valor,
          faixa: s.faixa,
          drivers: s.drivers as unknown as Prisma.InputJsonValue,
        })),
      },
      dossie: {
        create: {
          resumo: dossie.resumo,
          conteudo: dossie.conteudo as Prisma.InputJsonValue,
          markdown: dossie.markdown,
        },
      },
    },
    include: { imovel: true },
  });

  // M4 — demonstra a camada PostGIS gravando um ponto (raw SQL, pois geom é Unsupported)
  if (geom && matricula.imovel) {
    await prisma.$executeRaw`
      UPDATE "Imovel"
      SET geom = ST_SetSRID(ST_MakePoint(${geom.lng}, ${geom.lat}), 4326)
      WHERE id = ${matricula.imovel.id}`;
  }

  console.log(
    `✓ ${parse.numero ?? 's/nº'} — titular: ${estado.titularesAtuais
      .map((t) => t.nome)
      .join(', ') || '—'} | Negociabilidade: ${
      scores.find((s) => s.indice === 'NEGOCIABILIDADE')?.valor
    }`,
  );
}

async function main() {
  console.log('Limpando dados existentes...');
  await prisma.auditLog.deleteMany();
  await prisma.matricula.deleteMany();

  console.log('Processando matrículas de exemplo...');
  await processar(MATRICULA_URBANA_LIMPA, { lng: -56.0949, lat: -15.601 });
  await processar(MATRICULA_RURAL_ONUS, { lng: -54.6356, lat: -16.4673 });

  console.log('Seed concluído.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
