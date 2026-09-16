/** Servidor local para desenvolvimento. Em produção quem atende são as funções de api/ na Vercel. */
import express from 'express';
import { env } from './env.js';
import { autorizado, tratarEvento } from './webhook.js';
import { saude } from './saude.js';
import { log } from './log.js';

const app = express();
app.use(express.json({ limit: '2mb' }));

app.get('/api/health', (_req, res) => {
  res.json(saude());
});

app.post('/api/webhook', (req, res) => {
  if (!autorizado(String(req.query.token ?? ''))) {
    res.status(401).json({ ok: false });
    return;
  }
  res.json({ ok: true });
  tratarEvento(req.body as Record<string, any>).catch((e) => log.error('falha ao tratar evento', e));
});

app.listen(env.port, () => {
  log.info(`Alex ouvindo na porta ${env.port}`);
  if (env.allowlist.length) log.info(`modo teste: só responde ${env.allowlist.length} número(s)`);
  if (!env.chatwoot.botToken) log.warn('CHATWOOT_BOT_TOKEN ausente: o Alex não consegue enviar mensagens');
  if (env.dryRun) log.warn('DRY_RUN ligado: nada é enviado ao cliente');
});
