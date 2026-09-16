import { env } from './env.js';
import { foraDoExpediente } from './expediente.js';
import { problemaNoSegredo } from './segredo.js';

export function saude() {
  const formato = (v: string) => problemaNoSegredo(v) ?? 'ok';
  return {
    ok: true,
    botConfigurado: Boolean(env.chatwoot.botToken),
    dryRun: env.dryRun,
    allowlist: env.allowlist.length ? `${env.allowlist.length} número(s)` : 'aberta',
    foraDoExpediente: foraDoExpediente(),
    modelo: env.openai.model,
    // Só o formato, nunca o valor.
    chaves: {
      OPENAI_API_KEY: formato(env.openai.apiKey),
      CHATWOOT_API_TOKEN: formato(env.chatwoot.apiToken),
      CHATWOOT_BOT_TOKEN: formato(env.chatwoot.botToken),
      WEBHOOK_SECRET: formato(env.webhookSecret),
    },
  };
}
