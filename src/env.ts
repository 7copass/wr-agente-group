import 'dotenv/config';
import { limparSegredo } from './segredo.js';

function req(k: string): string {
  const v = process.env[k];
  if (!v) throw new Error(`Variável de ambiente ausente: ${k}`);
  return v;
}
const opt = (k: string, d = '') => process.env[k] ?? d;
const segredo = (k: string) => limparSegredo(req(k));
const list = (k: string) => opt(k).split(',').map((s) => s.trim()).filter(Boolean);

export const env = {
  port: Number(opt('PORT', '3000')),
  debounceMs: Number(opt('DEBOUNCE_MS', '10000')),
  dryRun: opt('DRY_RUN', 'false') === 'true',
  /** Vazio = atende todo mundo. Preenchido = modo teste, só responde estes números. */
  allowlist: list('ALLOWED_NUMBERS'),
  /** Vai na URL do webhook (?token=). Sem ele, qualquer um na internet poderia acionar o Alex. */
  webhookSecret: segredo('WEBHOOK_SECRET'),
  chatwoot: {
    url: req('CHATWOOT_URL').replace(/\/+$/, ''),
    accountId: req('CHATWOOT_ACCOUNT_ID'),
    apiToken: segredo('CHATWOOT_API_TOKEN'),
    botToken: limparSegredo(opt('CHATWOOT_BOT_TOKEN')),
    inboxIds: list('CHATWOOT_INBOX_IDS'),
  },
  openai: { apiKey: segredo('OPENAI_API_KEY'), model: opt('OPENAI_MODEL', 'gpt-4.1').trim() },
};
