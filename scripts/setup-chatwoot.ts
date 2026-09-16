/**
 * Prepara a conta do Chatwoot para o Alex. Idempotente: pode rodar quantas vezes quiser.
 *   npm run setup:chatwoot
 * Com WEBHOOK_URL definido, também cria o bot Alex (sem inbox) e o webhook da conta.
 */
import { env } from '../src/env.js';

const base = `${env.chatwoot.url}/api/v1/accounts/${env.chatwoot.accountId}`;
const headers = { 'content-type': 'application/json', api_access_token: env.chatwoot.apiToken };

async function api<T>(caminho: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${base}${caminho}`, { ...init, headers: { ...headers, ...(init.headers ?? {}) } });
  const corpo = await res.text();
  if (!res.ok) throw new Error(`${res.status} em ${caminho}: ${corpo.slice(0, 200)}`);
  return (corpo ? JSON.parse(corpo) : undefined) as T;
}

const ATRIBUTOS = [
  ['veiculo_interesse', 'Veículo de interesse', 'text'],
  ['modalidade', 'Modalidade', 'text'],
  ['cidade', 'Cidade', 'text'],
  ['faixa_parcela', 'Faixa de parcela', 'text'],
  ['tem_entrada', 'Entrada / lance', 'text'],
  ['uso_veiculo', 'Uso do veículo', 'text'],
  ['melhor_horario', 'Melhor horário de contato', 'text'],
  ['nome', 'Nome informado', 'text'],
  ['observacoes', 'Observações', 'text'],
  ['score_qualificacao', 'Score de qualificação', 'number'],
  ['origem_anuncio', 'Origem do anúncio (SourceID)', 'text'],
  ['status_agente', 'Status do agente', 'text'],
] as const;

const ETIQUETAS_NOVAS = [
  ['sem_interesse', 'Cliente disse claramente que não tem interesse', '#9C4837'],
  ['aguardando_cliente', 'Cliente ficou de retornar ou enviar informação', '#E0D800'],
  ['duvida_credito', 'Cliente com dúvida sobre aprovação ou análise', '#6E82D0'],
] as const;

async function main() {
  const existentes = await api<{ attribute_key: string }[]>(
    '/custom_attribute_definitions?attribute_model=conversation_attribute',
  );
  const jaTem = new Set(existentes.map((a) => a.attribute_key));

  for (const [chave, nome, tipo] of ATRIBUTOS) {
    if (jaTem.has(chave)) {
      console.log(`atributo ${chave}: já existe`);
      continue;
    }
    await api('/custom_attribute_definitions', {
      method: 'POST',
      body: JSON.stringify({
        attribute_display_name: nome,
        attribute_display_type: tipo,
        attribute_key: chave,
        attribute_model: 'conversation_attribute',
        attribute_description: 'Preenchido pelo agente Alex',
      }),
    });
    console.log(`atributo ${chave}: criado`);
  }

  const etiquetas = await api<{ payload: { title: string }[] }>('/labels');
  const titulos = new Set(etiquetas.payload.map((l) => l.title));
  for (const [titulo, descricao, cor] of ETIQUETAS_NOVAS) {
    if (titulos.has(titulo)) {
      console.log(`etiqueta ${titulo}: já existe`);
      continue;
    }
    await api('/labels', {
      method: 'POST',
      body: JSON.stringify({ title: titulo, description: descricao, color: cor, show_on_sidebar: true }),
    });
    console.log(`etiqueta ${titulo}: criada`);
  }

  const base = process.env.WEBHOOK_URL?.replace(/\/+$/, '');
  if (!base) {
    console.log('WEBHOOK_URL não definido: bot e webhook não foram configurados');
  } else {
    // Bot Alex: só a identidade e o token para enviar mensagens.
    // NÃO é ligado a nenhuma inbox. Inbox com bot faz o Chatwoot criar toda conversa nova
    // como "pendente", escondendo leads reais dos vendedores. Nunca mexer no bot 25.
    type Bot = { id: number; name: string; access_token?: string };
    const bots = await api<Bot[]>('/agent_bots');
    let alex = bots.find((b) => b.name === 'Alex');
    if (!alex) {
      alex = await api<Bot>('/agent_bots', {
        method: 'POST',
        body: JSON.stringify({ name: 'Alex', description: 'Assistente virtual WR Representações' }),
      });
      console.log(`agent_bot Alex (${alex.id}): criado, sem inbox`);
    } else {
      console.log(`agent_bot Alex (${alex.id}): já existe`);
    }
    if (alex.access_token) console.log(`CHATWOOT_BOT_TOKEN=${alex.access_token}`);

    // Eventos chegam por webhook da conta, que não altera o comportamento das conversas.
    const inbox = env.chatwoot.inboxIds.length === 1 ? Number(env.chatwoot.inboxIds[0]) : undefined;
    const url = `${base}/api/webhook?token=${env.webhookSecret}`;
    const corpo = JSON.stringify({ webhook: { url, subscriptions: ['message_created'], ...(inbox ? { inbox_id: inbox } : {}) } });
    type Webhook = { id: number; url: string };
    const { payload } = await api<{ payload: { webhooks: Webhook[] } }>('/webhooks');
    const existente = payload.webhooks.find((w) => w.url.startsWith(`${base}/api/webhook`));
    if (existente) {
      await api(`/webhooks/${existente.id}`, { method: 'PATCH', body: corpo });
      console.log(`webhook ${existente.id}: atualizado para ${base}/api/webhook (message_created${inbox ? `, inbox ${inbox}` : ''})`);
    } else {
      const criado = await api<Webhook | { payload: Webhook }>('/webhooks', { method: 'POST', body: corpo });
      const id = 'payload' in criado ? criado.payload.id : criado.id;
      console.log(`webhook ${id}: criado para ${base}/api/webhook (message_created${inbox ? `, inbox ${inbox}` : ''})`);
    }
  }

  console.log('\nPendências que este script NÃO faz sozinho, para não mexer na produção:');
  console.log('- mudar o fuso da inbox 43 de UTC para America/Sao_Paulo');
  console.log('- desligar a automação 26 "ramdom-conversa-criada" quando o Alex passar a atribuir no handoff');
  console.log('- trocar a mensagem de ausência da inbox');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
