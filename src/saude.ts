import { env } from './env.js';
import { foraDoExpediente } from './expediente.js';

export function saude() {
  return {
    ok: true,
    botConfigurado: Boolean(env.chatwoot.botToken),
    dryRun: env.dryRun,
    allowlist: env.allowlist.length ? `${env.allowlist.length} número(s)` : 'aberta',
    foraDoExpediente: foraDoExpediente(),
  };
}
