import { env } from './env.js';

export interface CwAttachment { file_type: string; data_url: string }

export interface CwMessage {
  id: number;
  content: string | null;
  message_type: string | number;
  private?: boolean;
  created_at?: number;
  sender?: { type?: string; id?: number; name?: string };
  attachments?: CwAttachment[];
}

export interface CwConversation {
  id: number;
  inbox_id: number;
  status: string;
  assignee_id?: number | null;
  custom_attributes?: Record<string, unknown>;
  additional_attributes?: Record<string, unknown>;
  meta?: { sender?: { id: number; name?: string; phone_number?: string } };
}

class ChatwootError extends Error {
  constructor(status: number, body: string, url: string) {
    super(`Chatwoot respondeu ${status} em ${url}: ${body.slice(0, 300)}`);
  }
}

async function call<T>(pathname: string, init: RequestInit = {}, token = env.chatwoot.apiToken): Promise<T> {
  const url = `${env.chatwoot.url}/api/v1/accounts/${env.chatwoot.accountId}${pathname}`;
  const res = await fetch(url, {
    ...init,
    headers: { 'content-type': 'application/json', api_access_token: token, ...(init.headers ?? {}) },
  });
  const body = await res.text();
  if (!res.ok) throw new ChatwootError(res.status, body, url);
  return (body ? JSON.parse(body) : undefined) as T;
}

/**
 * Mensagens precisam sair pelo token do bot. Se saíssem pelo token de um usuário, o próprio
 * Alex seria confundido com um humano assumindo a conversa e se silenciaria.
 */
function tokenDoBot(): string {
  if (!env.chatwoot.botToken) throw new Error('CHATWOOT_BOT_TOKEN ausente: rode o setup:chatwoot e configure o token do bot Alex');
  return env.chatwoot.botToken;
}

/** Descobre o id do nosso próprio agent_bot cruzando o token configurado com os bots da conta. */
let idBotCache: number | null | undefined;

export const chatwoot = {
  /**
   * Sem isto não dá para distinguir uma mensagem nossa de uma mensagem publicada com o token
   * de outro bot (é assim que chegam as respostas que o vendedor digita no celular).
   */
  identificarBot: async (): Promise<number | null> => {
    if (idBotCache !== undefined) return idBotCache;
    try {
      const bots = await call<{ id: number; access_token?: string }[]>('/agent_bots');
      idBotCache = bots.find((b) => b.access_token && b.access_token === env.chatwoot.botToken)?.id ?? null;
    } catch {
      idBotCache = null;
    }
    return idBotCache;
  },

  obterConversa: (id: number) => call<CwConversation>(`/conversations/${id}`),

  listarMensagens: (id: number) =>
    call<{ payload: CwMessage[] }>(`/conversations/${id}/messages`).then((r) => r.payload ?? []),

  enviarMensagem: (id: number, conteudo: string) =>
    call<CwMessage>(
      `/conversations/${id}/messages`,
      { method: 'POST', body: JSON.stringify({ content: conteudo, message_type: 'outgoing', private: false }) },
      tokenDoBot(),
    ),

  enviarNotaPrivada: (id: number, conteudo: string) =>
    call<CwMessage>(
      `/conversations/${id}/messages`,
      { method: 'POST', body: JSON.stringify({ content: conteudo, message_type: 'outgoing', private: true }) },
      tokenDoBot(),
    ),

  /**
   * O endpoint de custom_attributes do Chatwoot SUBSTITUI o objeto inteiro a cada chamada —
   * não soma. Por isso lê o estado atual antes de gravar, para nunca apagar um campo que uma
   * chamada anterior (ou outro sistema) já tinha gravado.
   */
  gravarAtributos: async (id: number, atributos: Record<string, unknown>) => {
    const atual = await call<CwConversation>(`/conversations/${id}`);
    const mesclado = { ...(atual.custom_attributes ?? {}), ...atributos };
    return call(`/conversations/${id}/custom_attributes`, {
      method: 'POST',
      body: JSON.stringify({ custom_attributes: mesclado }),
    });
  },

  // O Chatwoot SUBSTITUI a lista inteira a cada chamada; use src/etiquetas.ts para não apagar
  // etiquetas de outra origem ao adicionar ou remover só uma.
  aplicarEtiquetas: (id: number, etiquetas: string[]) =>
    call(`/conversations/${id}/labels`, { method: 'POST', body: JSON.stringify({ labels: etiquetas }) }),

  listarEtiquetas: (id: number) =>
    call<{ payload: string[] }>(`/conversations/${id}/labels`).then((r) => r.payload ?? []),

  /** Com bot na inbox a conversa nasce "pendente" e fica escondida dos vendedores até ser aberta. */
  abrirConversa: (id: number) =>
    call(`/conversations/${id}/toggle_status`, { method: 'POST', body: JSON.stringify({ status: 'open' }) }),

  atribuir: (id: number, assigneeId: number) =>
    call(`/conversations/${id}/assignments`, { method: 'POST', body: JSON.stringify({ assignee_id: assigneeId }) }),

  /** Busca por telefone/identificador. Usado para achar a conversa de WhatsApp de um número interno. */
  buscarContatos: (consulta: string) =>
    call<{ payload: { id: number; phone_number?: string; identifier?: string }[] }>(
      `/contacts/search?q=${encodeURIComponent(consulta)}`,
    ).then((r) => r.payload ?? []),

  listarConversasDoContato: (contatoId: number) =>
    call<{ payload: { id: number; inbox_id: number; status: string; created_at: number }[] }>(
      `/contacts/${contatoId}/conversations`,
    ).then((r) => r.payload ?? []),
};
