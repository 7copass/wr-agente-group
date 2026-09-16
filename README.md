# Alex — agente de WhatsApp da WR Representações

Atende e qualifica leads de consórcio pelo Chatwoot. Roda como funções na Vercel.
Design completo em `docs/superpowers/specs/2026-09-16-agente-alex-design.md`.

## Local

```bash
npm install
cp .env.example .env   # preencher
npm test
npm run simular -- "oi, quero saber da strada" "quanto fica a parcela?"
npm run dev            # servidor em http://localhost:3000/api/health
```

## Deploy na Vercel

1. Suba o repositório e importe na Vercel. Framework: **Other**. Sem build command.
2. Em *Settings → Environment Variables*, cadastre todas as variáveis do `.env.example`
   (`CHATWOOT_BOT_TOKEN` pode ficar vazio no primeiro deploy).
3. Faça o deploy e confira `https://SEU-PROJETO.vercel.app/api/health`.
4. Com a URL em mãos, crie o bot e o webhook:
   ```bash
   WEBHOOK_URL=https://SEU-PROJETO.vercel.app npm run setup:chatwoot
   ```
   O script cria atributos, etiquetas, o bot **Alex** e um **webhook da conta** (`message_created`),
   e imprime o token do bot.
5. Na Vercel, cadastre `CHATWOOT_BOT_TOKEN` com esse token e `CHATWOOT_INBOX_IDS`, e faça redeploy.
6. `/api/health` deve mostrar `"botConfigurado": true`.

**Não ligue o bot Alex em nenhuma inbox.** Inbox com bot faz o Chatwoot criar toda conversa
nova como *pendente*, e os leads reais somem da tela dos vendedores. O Alex recebe os eventos
pelo webhook da conta e envia com o token do bot, sem precisar estar ligado.

### Limites da Vercel que importam aqui

- Cada mensagem é uma execução isolada. O agente não guarda nada em memória: o estado
  fica nos atributos da conversa no Chatwoot.
- Rodízio de vendedores não é justo entre execuções — precisa de banco quando houver mais de um.
- Relógios de SLA e follow-up (ainda não construídos) vão precisar de Vercel Cron. No plano
  Hobby o cron roda só uma vez por dia; para prazos de minutos é preciso o plano Pro.

## Modo teste

- `ALLOWED_NUMBERS` — o Alex só responde esses números. Aceita com ou sem +55 e nono dígito.
  Conversas de outros números não são tocadas: nem atributo, nem etiqueta, nem mensagem.
- `/reiniciar` — enviado por um número da allowlist, zera a qualificação e recomeça o teste.
- `DRY_RUN=true` — processa tudo, mas só loga a resposta.

## Onde mexer sem programar

| Arquivo | O que tem |
|---|---|
| `config/ofertas.yaml` | a única tabela de valores que o Alex pode citar |
| `config/faq.yaml` | dados da empresa e base de conhecimento |
| `config/persona.yaml` | nome, tom, primeiras mensagens |
| `config/limites.yaml` | proibições, frase de crédito, frases bloqueadas |
| `config/vendedores.yaml` | quem recebe o lead, expediente, follow-up |

Campos marcados «a confirmar» nunca chegam ao cliente: o Alex escala.
Mudou um YAML? Commit e push: a Vercel publica sozinha.
