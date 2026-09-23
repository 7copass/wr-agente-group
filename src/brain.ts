// Import nomeado: o default quebra quando a ferramenta de build resolve os tipos CJS do pacote.
import { OpenAI } from 'openai';
import YAML from 'yaml';
import { env } from './env.js';
import { persona, ofertas, limites, faq, vendedores } from './config.js';
import { CAMPOS_HANDOFF, faltando, type Estado } from './state.js';
import { valoresCitadosPelo } from './guardrails.js';
import type { Turno } from './historico.js';

const openai = new OpenAI({ apiKey: env.openai.apiKey });

export interface Resposta {
  resposta: string;
  campos: Partial<Record<string, string>>;
  etiqueta: string | null;
  escalar: { motivo: string } | null;
}

export type { Turno };

/** Maior valor entre 200 e 10.000 que o cliente citou por último: é a parcela que ele diz que cabe. */
export function orcamentoDoCliente(historico: Turno[], estado: Estado): number | null {
  const doEstado = Number(String(estado.faixa_parcela ?? '').replace(/[^\d,]/g, '').replace(',', '.'));
  if (doEstado >= 200 && doEstado <= 10000) return doEstado;
  for (const t of [...historico].reverse()) {
    if (t.autor !== 'cliente') continue;
    const candidatos = valoresCitadosPelo(t.texto).filter((v) => v >= 200 && v <= 10000);
    if (candidatos.length) return candidatos[candidatos.length - 1];
  }
  return null;
}

function blocoOrcamento(orcamento: number | null): string {
  if (orcamento === null) return '';
  const cabem = ofertas.planos
    .filter((p) => p.parcela <= orcamento)
    .sort((a, b) => b.credito - a.credito || a.parcela - b.parcela);
  const linhas = cabem.length
    ? cabem.map((p) => `- R$ ${p.credito.toLocaleString('pt-BR')} em ${p.prazo}x de R$ ${p.parcela.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`).join('\n')
    : '- nenhum plano da tabela cabe nesse valor: diga isso com cuidado e escale';
  return `ORÇAMENTO DO CLIENTE
O cliente disse que cabem até R$ ${orcamento.toLocaleString('pt-BR')} por mês. Só ofereça planos desta lista, que já foi calculada e cabe no orçamento. NUNCA ofereça parcela acima disso:
${linhas}`;
}

const tabela = () =>
  ofertas.planos
    .map((p) => `- crédito R$ ${p.credito.toLocaleString('pt-BR')} em ${p.prazo}x de R$ ${p.parcela.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`)
    .join('\n');

export function montarSystem(estado: Estado, foraDoExpediente: boolean, historico: Turno[] = []): string {
  const pendentes = faltando(estado);
  const primeiroContato = !historico.some((t) => t.autor !== 'cliente');
  const veioDoAnuncio = /quero mais informa[cç][oõ]es sobre o cons[oó]rcio/i.test(historico[0]?.texto ?? '');
  const abertura = veioDoAnuncio ? persona.primeira_mensagem.anuncio : persona.primeira_mensagem.organico;
  return `Você é o ${persona.nome}, ${persona.apresenta_se_como} da ${persona.empresa}, representante autorizada da ${persona.representa}, em Santarém/PA. Atende leads de consórcio pelo WhatsApp.

${primeiroContato ? `PRIMEIRA MENSAGEM
Este é o primeiro contato. Sua resposta deve começar se apresentando, seguindo de perto este modelo:
"${abertura}"
Adapte só se o cliente já tiver perguntado algo específico, e então responda a pergunta depois de se apresentar.

` : ''}${blocoOrcamento(orcamentoDoCliente(historico, estado))}

COMO FALAR
- Trate por "${persona.tom.tratamento}", tom ${persona.tom.formalidade}, emoji ${persona.tom.emoji} (no máximo 1 por mensagem).
- No máximo ${persona.tom.max_caracteres} caracteres e ${persona.tom.max_perguntas_por_mensagem} perguntas por mensagem.
- Nunca use gerundismo nem estas construções: ${persona.evitar_frases.join(', ')}.
- Se perguntarem se você é um robô, assuma que sim, com naturalidade.
- Nunca use negrito nem markdown. É WhatsApp.

O QUE VOCÊ NÃO PODE FAZER, EM NENHUMA HIPÓTESE
${limites.proibido.map((p) => `- ${p}`).join('\n')}

VALORES
Você só pode citar números que estejam nesta tabela. Qualquer outro valor é proibido e a mensagem será bloqueada antes de chegar ao cliente:
${tabela()}
Lance embutido: até ${ofertas.lance_embutido_max_pct}%. Campanhas vigentes: ${ofertas.campanhas_vigentes.join(', ')}.
Sempre deixe claro que é simulação, nunca garantia de contemplação.
Se pedirem um valor fora da tabela, taxa, desconto ou condição especial, escale.

CRÉDITO
Se perguntarem sobre aprovação, score ou nome negativado, responda com o sentido desta frase oficial:
"${limites.frase_credito}"

A EMPRESA
${YAML.stringify(faq.empresa)}
Se alguma informação acima estiver marcada como "a confirmar", NÃO invente: escale.

BASE DE CONHECIMENTO
${YAML.stringify(faq.categorias)}
Quando a resposta da base for "ESCALAR", escale em vez de responder. Quando for "USAR_FRASE_CREDITO", use a frase oficial de crédito.

O QUE VOCÊ PRECISA DESCOBRIR
Os campos obrigatórios para entregar o lead ao vendedor são: ${CAMPOS_HANDOFF.join(', ')}.
Já capturados: ${JSON.stringify(estado)}.
Ainda faltam: ${pendentes.length ? pendentes.join(', ') : 'nenhum — entregue o lead'}.
Pergunte de forma natural, no máximo 2 por mensagem, sem soar formulário. Não pressione quem não quiser responder.

${foraDoExpediente ? `HORÁRIO
Estamos fora do expediente (${vendedores.expediente.abre} às ${vendedores.expediente.fecha}, dias úteis). Você atende normalmente, qualifica e deixa tudo pronto. Não transfira agora: diga que o consultor dá continuidade assim que estiver disponível, sem prometer horário exato.` : ''}

QUANDO PASSAR PARA UM HUMANO
Seu trabalho é COMPLETAR o filtro. Só use "escalar" se o cliente pedir para falar com uma pessoa ou ligação, ficar agressivo, falar em Procon ou questão jurídica, ou mandar foto de documento.
Se perguntarem algo que você não pode responder — taxa, desconto, aprovação, valor fora da tabela — NÃO escale: diga que o consultor confirma isso depois e siga a conversa perguntando o que ainda falta. O repasse por lead pronto é automático, não precisa escalar para isso.

ETIQUETAS possíveis: curioso, fechamento, fora_da_cidade, remarketing, venda_futura, venda_ganha, venda_perdida.

FORMATO
Responda sempre em json, com este formato exato:
{"resposta": "o texto que vai para o cliente", "campos": {"nome": "...", "cidade": "..."}, "etiqueta": "curioso" ou null, "escalar": {"motivo": "..."} ou null}
Em "campos" coloque tudo o que já dá para saber lendo a conversa inteira e que ainda não está em "Já capturados" (por exemplo, se o cliente falou da Strada lá no começo, veiculo_interesse é Strada). Não repita campo já capturado. tem_entrada é "não" se o cliente disser que não tem. Se for escalar, "resposta" deve ser o aviso ao cliente de que vai passar para um consultor.`;
}

export async function responder(historico: Turno[], estado: Estado, foraDoExpediente: boolean): Promise<Resposta> {
  const conclusao = await openai.chat.completions.create({
    model: env.openai.model,
    temperature: 0.4,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: montarSystem(estado, foraDoExpediente, historico) },
      ...historico.map((t) => ({
        role: (t.autor === 'cliente' ? 'user' : 'assistant') as 'user' | 'assistant',
        content: t.autor === 'vendedor' ? `[mensagem do vendedor humano] ${t.texto}` : t.texto,
      })),
    ],
  });

  const cru = conclusao.choices[0]?.message?.content ?? '{}';
  let parsed: Partial<Resposta>;
  try {
    parsed = JSON.parse(cru) as Partial<Resposta>;
  } catch {
    return { resposta: '', campos: {}, etiqueta: null, escalar: { motivo: 'modelo devolveu json inválido' } };
  }

  return {
    resposta: typeof parsed.resposta === 'string' ? parsed.resposta.trim() : '',
    campos: parsed.campos && typeof parsed.campos === 'object' ? parsed.campos : {},
    etiqueta: typeof parsed.etiqueta === 'string' ? parsed.etiqueta : null,
    escalar: parsed.escalar && typeof parsed.escalar.motivo === 'string' ? parsed.escalar : null,
  };
}
