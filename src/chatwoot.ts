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

export const chatwoot = {
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

  gravarAtributos: (id: number, atributos: Record<string, unknown>) =>
    call(`/conversations/${id}/custom_attributes`, {
      method: 'POST',
      body: JSON.stringify({ custom_attributes: atributos }),
    }),

  aplicarEtiquetas: (id: number, etiquetas: string[]) =>
    call(`/conversations/${id}/labels`, { method: 'POST', body: JSON.stringify({ labels: etiquetas }) }),

  /** Com bot na inbox a conversa nasce "pendente" e fica escondida dos vendedores até ser aberta. */
  abrirConversa: (id: number) =>
    call(`/conversations/${id}/toggle_status`, { method: 'POST', body: JSON.stringify({ status: 'open' }) }),

  atribuir: (id: number, assigneeId: number) =>
    call(`/conversations/${id}/assignments`, { method: 'POST', body: JSON.stringify({ assignee_id: assigneeId }) }),
};
