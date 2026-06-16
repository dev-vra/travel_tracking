import { Injectable } from '@nestjs/common';
import { NaturezaAto, TipoAto, TipoImovel, TipoPessoa } from '@prisma/client';
import {
  AtoParse,
  MatriculaParse,
  PessoaParse,
} from '../../domain/registral.types';

/**
 * M2 — Parser Registral.
 * Estrutura o texto bruto da matrícula/transcrição em campos:
 * cabeçalho, imóvel, qualificação e atos (R-/Av-) com natureza semântica.
 *
 * Implementação determinística (regex + dicionário). É o núcleo do fosso:
 * entende a semântica registral que um OCR genérico ignora.
 */
@Injectable()
export class ParserService {
  parse(texto: string): MatriculaParse {
    const numero = this.extrairNumero(texto);
    const { comarca, uf, cartorio } = this.extrairCartorio(texto);
    const imovel = this.extrairImovel(texto, uf);
    const proprietarioInicial = this.extrairProprietarioInicial(texto);
    const atos = this.extrairAtos(texto);

    return { numero, cartorio, comarca, uf, imovel, proprietarioInicial, atos };
  }

  // ---------- Cabeçalho ----------

  private extrairNumero(texto: string): string | undefined {
    const m = texto.match(/MATR[IÍ]CULA\s*(?:N[ºo°.]*)?\s*([\d.\-\/]+)/i);
    return m ? m[1].replace(/[.\s]+$/, '') : undefined;
  }

  private extrairCartorio(texto: string): {
    comarca?: string;
    uf?: string;
    cartorio?: string;
  } {
    const cartLine = texto.match(/(CART[ÓO]RIO[^\n]+|[\dº]+\s*OF[ÍI]CIO[^\n]+)/i);
    const cartorio = cartLine ? cartLine[1].trim() : undefined;
    const com = texto.match(/COMARCA\s+DE\s+([A-Za-zÀ-ú .']+?)\s*[-–]\s*([A-Z]{2})/i);
    return {
      cartorio,
      comarca: com ? com[1].trim() : undefined,
      uf: com ? com[2].toUpperCase() : undefined,
    };
  }

  // ---------- Imóvel ----------

  private extrairImovel(texto: string, ufCabecalho?: string) {
    const descricao = this.extrairDescricaoImovel(texto);
    const areaM2 = this.extrairArea(texto);
    const municipioMatch =
      texto.match(/munic[íi]pio\s+de\s+([A-Za-zÀ-ú .']+?)\s*[-–\/,]\s*([A-Z]{2})/i) ??
      texto.match(/em\s+([A-Za-zÀ-ú .']+?)\s*[-–]\s*([A-Z]{2})/i);
    const tipo = this.classificarTipoImovel(texto);
    const logradouro = this.extrairLogradouro(texto);

    return {
      tipo,
      descricao,
      areaM2,
      logradouro,
      municipio: municipioMatch ? municipioMatch[1].trim() : undefined,
      uf: municipioMatch ? municipioMatch[2].toUpperCase() : ufCabecalho,
    };
  }

  private extrairDescricaoImovel(texto: string): string | undefined {
    const m = texto.match(/IM[ÓO]VEL\s*:?\s*([\s\S]+?)(?:\n\s*\n|PROPRIET|R[.\-]\s?1\b)/i);
    if (!m) return undefined;
    return m[1].replace(/\s+/g, ' ').trim().slice(0, 1200);
  }

  private extrairArea(texto: string): number | undefined {
    // captura "área de 360,00 m²" / "área total de 12,5000 ha"
    const ha = texto.match(/[áa]rea[^.\n]*?de\s+([\d.,]+)\s*(?:ha|hectares)/i);
    if (ha) return this.numeroBr(ha[1]) * 10000;
    const m2 = texto.match(/[áa]rea[^.\n]*?de\s+([\d.,]+)\s*m[²2]/i);
    if (m2) return this.numeroBr(m2[1]);
    return undefined;
  }

  private extrairLogradouro(texto: string): string | undefined {
    const m = texto.match(
      /\b(Rua|Avenida|Av\.|Travessa|Alameda|Estrada|Rodovia)\s+[A-Za-zÀ-ú0-9 .,ºn°-]+/i,
    );
    return m ? m[0].replace(/\s+/g, ' ').trim().slice(0, 200) : undefined;
  }

  private classificarTipoImovel(texto: string): TipoImovel {
    const t = texto.toLowerCase();
    const rural = /(fazenda|s[íi]tio|ch[áa]cara|gleba|im[óo]vel rural|matr[íi]cula rural|incra|ccir|sigef|hectare|\bha\b)/.test(
      t,
    );
    const urbano = /(lote|quadra|apartamento|casa|loteamento|im[óo]vel urbano|iptu|bairro)/.test(
      t,
    );
    if (rural && !urbano) return TipoImovel.RURAL;
    if (urbano && !rural) return TipoImovel.URBANO;
    if (rural && urbano) return TipoImovel.URBANO;
    return TipoImovel.NAO_IDENTIFICADO;
  }

  // ---------- Qualificação inicial ----------

  private extrairProprietarioInicial(texto: string): PessoaParse[] {
    const m = texto.match(/PROPRIET[ÁA]RIO[S]?\s*:?\s*([\s\S]+?)(?:\n\s*\n|R[.\-]\s?1\b)/i);
    if (!m) return [];
    return this.extrairPessoas(m[1]);
  }

  // ---------- Atos (R- / Av-) ----------

  private extrairAtos(texto: string): AtoParse[] {
    // Localiza cada cabeçalho de ato: R-1, R.1-12.345, Av-3, AV.5/12.345...
    const headerRe =
      /(?:^|\n)\s*((R|AV)[.\-]?\s?(\d+))(?:[.\-\/][\d.]+)?\s*[-–—]?\s*/gim;
    const marcadores: { code: string; prefixo: string; ordem: number; idx: number }[] =
      [];
    let mh: RegExpExecArray | null;
    while ((mh = headerRe.exec(texto)) !== null) {
      marcadores.push({
        code: mh[1],
        prefixo: mh[2].toUpperCase(),
        ordem: Number(mh[3]),
        idx: mh.index + (mh[0].length - mh[0].trimStart().length),
      });
    }

    const atos: AtoParse[] = [];
    for (let i = 0; i < marcadores.length; i++) {
      const atual = marcadores[i];
      const fim = i + 1 < marcadores.length ? marcadores[i + 1].idx : texto.length;
      const bloco = texto.slice(atual.idx, fim).trim();
      const conteudo = bloco.replace(/\s+/g, ' ').trim();
      const tipo = atual.prefixo === 'AV' ? TipoAto.AVERBACAO : TipoAto.REGISTRO;
      const natureza = this.classificarNatureza(conteudo, atual.ordem);
      const codigo = `${atual.prefixo === 'AV' ? 'Av' : 'R'}-${atual.ordem}`;

      atos.push({
        tipo,
        ordem: atual.ordem,
        codigo,
        natureza,
        data: this.extrairData(conteudo),
        conteudo: conteudo.slice(0, 2000),
        pessoas: this.extrairPartesDoAto(conteudo, natureza),
        cancelaCodigo:
          natureza === NaturezaAto.CANCELAMENTO
            ? this.extrairCodigoCancelado(conteudo)
            : undefined,
        credor: this.ehOnus(natureza) ? this.extrairCredor(conteudo) : undefined,
        valor: this.ehOnus(natureza) ? this.extrairValor(conteudo) : undefined,
      });
    }

    // ordena por número de ato e tipo (R antes de Av de mesma ordem não ocorre na prática)
    return atos.sort((a, b) => a.ordem - b.ordem);
  }

  private classificarNatureza(conteudo: string, ordem: number): NaturezaAto {
    const t = conteudo.toLowerCase();
    if (/(cancelamento|cancela|baixa|extin[çc][ãa]o|libera[çc][ãa]o)/.test(t))
      return NaturezaAto.CANCELAMENTO;
    if (/(compra\s+e\s+venda|compra e venda|venda e compra|por venda)/.test(t))
      return NaturezaAto.COMPRA_VENDA;
    if (/doa[çc][ãa]o/.test(t)) return NaturezaAto.DOACAO;
    if (/(partilha|heran[çc]a|invent[áa]rio|formal de partilha|causa mortis)/.test(t))
      return NaturezaAto.HERANCA_PARTILHA;
    if (/permuta/.test(t)) return NaturezaAto.PERMUTA;
    if (/integraliza[çc][ãa]o|confer[êe]ncia de bens/.test(t))
      return NaturezaAto.INTEGRALIZACAO;
    if (/aliena[çc][ãa]o\s+fiduci[áa]ria/.test(t))
      return NaturezaAto.ALIENACAO_FIDUCIARIA;
    if (/hipoteca/.test(t)) return NaturezaAto.HIPOTECA;
    if (/penhora/.test(t)) return NaturezaAto.PENHORA;
    if (/arresto|sequestro/.test(t)) return NaturezaAto.ARRESTO;
    if (/indisponibilidade/.test(t)) return NaturezaAto.INDISPONIBILIDADE;
    if (/usufruto/.test(t)) return NaturezaAto.USUFRUTO;
    if (/(inalienabilidade|incomunicabilidade|impenhorabilidade|cl[áa]usula)/.test(t))
      return NaturezaAto.CLAUSULA_RESTRITIVA;
    if (/(constru[çc][ãa]o|edifica[çc][ãa]o|habite-se|averba[çc][ãa]o de [áa]rea constru)/.test(t))
      return NaturezaAto.CONSTRUCAO;
    if (/(georreferenc|geo-referenc|memorial descritivo|incra|sigef)/.test(t))
      return NaturezaAto.GEORREFERENCIAMENTO;
    if (/retifica[çc][ãa]o/.test(t)) return NaturezaAto.RETIFICACAO;
    if (/(abre a matr[íi]cula|abertura de matr[íi]cula|matr[íi]cula aberta|transcri[çc][ãa]o)/.test(t))
      return NaturezaAto.ABERTURA;
    if (ordem === 1) return NaturezaAto.ABERTURA;
    return NaturezaAto.OUTRO;
  }

  private ehOnus(n: NaturezaAto): boolean {
    const onus: NaturezaAto[] = [
      NaturezaAto.HIPOTECA,
      NaturezaAto.ALIENACAO_FIDUCIARIA,
      NaturezaAto.PENHORA,
      NaturezaAto.ARRESTO,
      NaturezaAto.USUFRUTO,
      NaturezaAto.INDISPONIBILIDADE,
      NaturezaAto.CLAUSULA_RESTRITIVA,
    ];
    return onus.includes(n);
  }

  private extrairData(conteudo: string): Date | undefined {
    const m = conteudo.match(/(\d{2})\/(\d{2})\/(\d{4})/);
    if (!m) return undefined;
    const d = new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
    return isNaN(d.getTime()) ? undefined : d;
  }

  private extrairCodigoCancelado(conteudo: string): string | undefined {
    const m = conteudo.match(/\b(R|AV)[.\-]?\s?(\d+)\b/i);
    // ignora o próprio código no início — busca a partir do segundo match
    const all = [...conteudo.matchAll(/\b(R|AV)[.\-]?\s?(\d+)\b/gi)];
    const alvo = all.length > 1 ? all[1] : (m ? [m[0], m[1], m[2]] as any : null);
    if (!alvo) return undefined;
    const pref = String(alvo[1]).toUpperCase() === 'AV' ? 'Av' : 'R';
    return `${pref}-${alvo[2]}`;
  }

  private extrairCredor(conteudo: string): string | undefined {
    const m = conteudo.match(
      /em\s+favor\s+d[eoa]s?\s+([A-Za-zÀ-ú0-9 .\/&-]+?)(?:[.,]|\s+no valor|\s+inscrit|\s+CNPJ|$)/i,
    );
    if (m) return m[1].trim().slice(0, 160);
    const c = conteudo.match(/credor[a]?\s*:?\s*([A-Za-zÀ-ú0-9 .\/&-]+?)(?:[.,]|$)/i);
    return c ? c[1].trim().slice(0, 160) : undefined;
  }

  private extrairValor(conteudo: string): number | undefined {
    const m = conteudo.match(/R\$\s*([\d.]+,\d{2})/);
    return m ? this.numeroBr(m[1]) : undefined;
  }

  // ---------- Pessoas ----------

  private extrairPartesDoAto(conteudo: string, natureza: NaturezaAto): PessoaParse[] {
    // foco: adquirentes em transmissões (definem o titular atual no M3)
    const transmissoes: NaturezaAto[] = [
      NaturezaAto.COMPRA_VENDA,
      NaturezaAto.DOACAO,
      NaturezaAto.HERANCA_PARTILHA,
      NaturezaAto.PERMUTA,
      NaturezaAto.INTEGRALIZACAO,
      NaturezaAto.ABERTURA,
    ];
    const transmissao = transmissoes.includes(natureza);
    if (!transmissao) return [];

    const adq = conteudo.match(
      /(?:adquirente|comprador|donat[áa]rio|herdeiro|propriet[áa]rio|titular)[s]?\s*:?\s*([\s\S]+?)(?:vendedor|transmitente|doador|inventariado|\.|$)/i,
    );
    const fonte = adq ? adq[1] : conteudo;
    const pessoas = this.extrairPessoas(fonte);
    return pessoas.length > 0 ? pessoas : this.extrairPessoas(conteudo);
  }

  private extrairPessoas(trecho: string): PessoaParse[] {
    const pessoas: PessoaParse[] = [];
    const vistos = new Set<string>();

    // Nomes em CAIXA ALTA (padrão de qualificação registral)
    const nomeRe =
      /\b([A-ZÀ-Ú][A-ZÀ-Ú]+(?:\s+(?:DA|DE|DO|DAS|DOS|E|&)?\s*[A-ZÀ-Ú][A-ZÀ-Ú./]+){1,6})\b/g;
    let m: RegExpExecArray | null;
    while ((m = nomeRe.exec(trecho)) !== null) {
      const nome = m[1].replace(/\s+/g, ' ').trim();
      if (this.ehRuido(nome) || vistos.has(nome)) continue;
      vistos.add(nome);

      const janela = trecho.slice(m.index, m.index + 220);
      const cnpj = janela.match(/\b\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}\b/);
      const cpf = janela.match(/\b\d{3}\.\d{3}\.\d{3}-\d{2}\b/);
      const tipoPessoa =
        cnpj || /\b(S\/A|S\.A|LTDA|EIRELI|EPP|ME|COMPANHIA|BANCO)\b/i.test(nome)
          ? TipoPessoa.JURIDICA
          : TipoPessoa.FISICA;
      const estado = janela.match(
        /\b(solteir[oa]|casad[oa]|divorciad[oa]|vi[úu]v[oa]|separad[oa])\b/i,
      );

      pessoas.push({
        nome,
        documento: cnpj ? cnpj[0] : cpf ? cpf[0] : undefined,
        tipoPessoa,
        estadoCivil: estado ? estado[1].toLowerCase() : undefined,
      });
      if (pessoas.length >= 6) break;
    }
    return pessoas;
  }

  /** Filtra falsos positivos comuns em maiúsculas. */
  private ehRuido(nome: string): boolean {
    const ruidos =
      /^(REGISTRO|AVERBA|MATR[ÍI]CULA|COMARCA|CART[ÓO]RIO|IM[ÓO]VEL|PROPRIET|COMPRA|VENDA|HIPOTECA|PENHORA|REGISTRO GERAL|REP[ÚU]BLICA|FEDERATIVA|BRASIL|OF[ÍI]CIO|LIVRO|RUA|AVENIDA|QUADRA|LOTE|BAIRRO|ESTADO)/;
    return ruidos.test(nome) || nome.length < 5;
  }

  // ---------- util ----------

  /** Converte número no formato brasileiro ("1.234,56") para Number. */
  private numeroBr(s: string): number {
    return Number(s.replace(/\./g, '').replace(',', '.'));
  }
}
