import fs from 'node:fs';
import path from 'node:path';
import YAML from 'yaml';

export interface Plano { credito: number; prazo: number; parcela: number }

export interface Ofertas {
  vigencia: string;
  piso_parcela: number | null;
  lance_embutido_max_pct: number;
  planos: Plano[];
  percentuais_permitidos: number[];
  campanhas_vigentes: string[];
}

export interface Limites {
  proibido: string[];
  frase_credito: string;
  frases_proibidas: string[];
}

export interface Persona {
  nome: string;
  apresenta_se_como: string;
  empresa: string;
  representa: string;
  cargo: string;
  tom: {
    tratamento: string;
    formalidade: string;
    emoji: string;
    max_caracteres: number;
    max_perguntas_por_mensagem: number;
  };
  evitar_frases: string[];
  perguntas_por_campo?: Record<string, string>;
  aviso_ia_curto: string;
  aviso_lgpd_completo: string;
  primeira_mensagem: { anuncio: string; organico: string };
}

export interface Vendedores {
  handoff: {
    responsavel_padrao: number;
    rodizio: number[];
    sla_redistribuir_min: number;
    sla_reassumir_min: number;
    /** Número que recebe WhatsApp quando um lead é qualificado. Vazio desliga a notificação. */
    notificar_numero?: string;
  };
  expediente: { timezone: string; dias_uteis: number[]; abre: string; fecha: string };
  followup: { janela_inicio: string; janela_fim: string; tentativas_min: number[] };
}

export interface Faq {
  empresa: Record<string, string>;
  categorias: { nome: string; itens: { pergunta: string; resposta: string }[] }[];
}

const dir = path.join(process.cwd(), 'config');
const load = <T>(name: string): T => YAML.parse(fs.readFileSync(path.join(dir, name), 'utf8')) as T;

export const persona = load<Persona>('persona.yaml');
export const ofertas = load<Ofertas>('ofertas.yaml');
export const limites = load<Limites>('limites.yaml');
export const vendedores = load<Vendedores>('vendedores.yaml');
export const faq = load<Faq>('faq.yaml');
