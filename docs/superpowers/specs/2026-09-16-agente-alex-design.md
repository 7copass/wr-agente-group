# Agente Alex — design

Agente de IA que atende e qualifica leads de consórcio no WhatsApp da WR Representações
(representante Fiat Consórcio, Santarém/PA). Fonte dos requisitos: briefing de 19/08/2026
(Google Doc `1c4pOJrjV5DoMTSBD1klj7RBSWDo6e_6gB-6M8n-vy9U`). Este documento registra as
decisões tomadas sobre ele e onde o briefing foi corrigido.

## Objetivo

Nenhum lead fica sem resposta, a qualquer hora, e o vendedor só recebe lead qualificado,
com resumo, etiqueta e atributos preenchidos.

## Arquitetura

```
WhatsApp ─ Evolution API (ou QuePasa) ─ Chatwoot ─ webhook ─► serviço Alex (Node/TS)
                                           ▲                        │
                                           └──── API do Chatwoot ◄──┤
                                                                    └─► OpenAI
```

- O serviço roda na Vercel, como funções (`api/webhook.ts`, `api/health.ts`).
- **Eventos chegam por webhook da conta, não por bot ligado à inbox.** Inbox com bot faz o
  Chatwoot criar conversas como pendentes, o que esconderia leads reais dos vendedores
  (hoje a inbox 43 tem 878 abertas e 1 pendente). O bot Alex existe só para dar identidade e
  token de envio; tokens de bot enviam sem estar ligados (o bot 25 já faz isso na 43).
- Cada evento é uma execução isolada. O debounce não usa memória: a execução espera
  `DEBOUNCE_MS` e só responde se a mensagem que a disparou ainda for a última do cliente.
- O trabalho continua depois do 200 ao Chatwoot via `waitUntil`.
- O webhook exige `?token=WEBHOOK_SECRET`. O telefone da allowlist vem da API, não do corpo do evento.
- O código só fala com o Chatwoot. O gateway de WhatsApp é trocável sem mexer no agente.
- **Sem banco de dados.** O estado de cada conversa vive nos atributos personalizados da
  própria conversa. Limite aceito: relatório histórico e funil ficam para quando entrar Postgres.
- Sem n8n.

## Módulos

| Arquivo | Responsabilidade |
|---|---|
| `src/env.ts` | variáveis de ambiente |
| `src/config.ts` | carrega os YAML de `config/` — o que o comercial edita sem tocar em código |
| `src/chatwoot.ts` | cliente da API do Chatwoot |
| `src/state.ts` | estado da conversa a partir dos atributos; campos obrigatórios do handoff |
| `src/brain.ts` | monta o prompt e chama o modelo; saída em JSON |
| `src/guardrails.ts` | conferência determinística antes de enviar |
| `src/handoff.ts` | resumo em nota privada, status e atribuição |
| `src/expediente.ts` | horário local de Santarém (a inbox está em UTC) |
| `src/webhook.ts` | orquestra: autenticação, filtro, debounce sem estado, modelo, guardrail, envio |
| `src/historico.ts` | converte mensagens do Chatwoot em turnos; `/reiniciar` |
| `src/notificacao.ts` | avisa o vendedor por WhatsApp quando um lead é qualificado |
| `src/telefone.ts` | comparação de números BR (+55 e nono dígito) para a allowlist |
| `api/` | funções da Vercel |
| `src/index.ts` | servidor local só para desenvolvimento |

## Decisões

1. **Valores.** Só os da tabela de `config/ofertas.yaml`, sempre como simulação. Resolve o
   conflito do briefing (3.2 proibia; 4.3, 7.1 e 8.2 usavam valores). O guardrail confere
   cada R$, "mil", "%" e "Nx" contra a tabela. Valores que o próprio cliente citou podem ser
   repetidos. Violação: a mensagem não sai, vai nota privada com o motivo, o cliente recebe
   aviso de repasse e a conversa escala.
2. **Atribuição.** A conversa nasce sem dono; o Alex atribui só no handoff. Substitui a
   automação 26 `ramdom-conversa-criada` (desligar quando entrar em produção).
3. **Estoque.** A WR não tem estoque. A seção 8.5 foi reescrita como redirecionamento: o
   veículo se escolhe na concessionária após a contemplação.
4. **Mídia recebida.** Áudio transcrito e imagem lida; imagem de documento não é lida e escala.
5. **Pós-handoff.** Retaguarda com SLA: 5 min sem vendedor redistribui, 10 min o Alex reassume.
   Fora do expediente não há transferência: qualifica e deixa pronto.
6. **Fora da região.** Atende todos, 100% remoto. `fora_da_cidade` serve para medir.
7. **Follow-up.** Só para quem já respondeu. ~2h, dia seguinte, +3d, encerra em +7d, entre
   8h e 20h. Sem reativação de base fria no MVP (risco de banimento com gateway não oficial).
8. **Identidade.** Alex, assistente virtual da WR Representações, representante Fiat Consórcio.
   Assume ser IA quando perguntado.
9. **Qualificação.** Handoff exige os 5 campos da seção 6.4: nome, cidade, veículo, parcela,
   entrada. O agente não pede renda, CPF, RG nem documento, e não pede ligação.
10. **Frase de crédito** reescrita para não afirmar que "não depende de score" — pendente
    de validação jurídica.
11. **Humano entrou.** Qualquer mensagem de um usuário do Chatwoot na conversa grava
    `status_agente = aguardando_humano` e o Alex para.
12. **Bot dedicado.** O agent_bot 25 já envia mensagens por outra integração; o Alex usa um bot próprio, criado pelo `setup:chatwoot`.
13. **Handoff abre a conversa.** Com bot na inbox a conversa nasce pendente e fica invisível aos vendedores; o repasse muda para aberta.
14. **Teste na inbox de produção (43)**, sem inbox separada, a pedido do usuário. A allowlist é
    verificada antes de qualquer escrita ou espera: conversas de outros números não são tocadas.
    `/reiniciar` zera a qualificação para repetir o teste. Números do usuário (91) e do Wallace (93). `ALLOWED_NUMBERS` restringe a quem o Alex responde,
    para não responder contatos pessoais.

## Configurações com placeholder

Enquanto estiverem «a confirmar», o guardrail impede o agente de usá-las e ele escala:

- endereço da loja (o briefing traz três versões)
- vigência da tabela de ofertas e piso de parcela; divergência 80k/80x (R$ 1.032,50 vs R$ 1.132,50)
- vendedores do rodízio (hoje só existem 3 usuários administradores na conta 12)

## Estado de implementação

| Etapa | Situação |
|---|---|
| Webhook, debounce, filtro de inbox e allowlist | feito |
| Prompt a partir da config, saída JSON | feito |
| Guardrail de valores, frases e placeholders | feito, com testes |
| Captura de campos em atributos e etiqueta | feito |
| Handoff com resumo, status e atribuição | feito |
| Silenciar quando humano assume | feito |
| Áudio e imagem | não feito |
| Relógio de SLA (redistribuir/reassumir) | não feito |
| Follow-up agendado | não feito |
| Notificação por WhatsApp ao vendedor no lead qualificado | feito (2026-09-23) |
| Primeira mensagem distinta para anúncio x orgânico | feito (detecta o texto padrão do anúncio) |
| Planos que cabem no orçamento calculados no código | feito |
| Aviso de repasse sem pergunta pendente e sem "só um momento" à noite | feito, com testes |
| Ajustes da inbox (fuso, ausência, automação 26) | não feito — manual, mexe em produção |

## Decisões (2026-09-23)

15. **Notificação de lead qualificado.** Assim que um lead atinge os 5 campos obrigatórios
    (não em qualquer escalonamento — só nesse caso), o Alex manda uma mensagem de WhatsApp
    com o resumo para `vendedores.yaml → handoff.notificar_numero`, pela mesma ponte que o
    Chatwoot já usa para falar com os clientes (hoje o quepasa) — sem integração nova, sem
    credencial nova. Ele reutiliza uma conversa já existente com esse número no Chatwoot; não
    cria conversa nova, porque não há como saber o identificador exato que a ponte usa para um
    contato novo sem arriscar mandar para o número errado.
16. **A inbox 43 já está aberta para todo mundo** (`ALLOWED_NUMBERS` vazio em produção) — assim
    encontrado, não uma mudança feita nesta sessão. Confirmado por evidência indireta: 10 das
    20 conversas mais recentes tiveram resposta do Alex no mesmo dia, com handoff correto para
    humano.

## Pendência não corrigida

Mensagem sem texto (só áudio ou imagem) não gera resposta: `turnoDe` descarta turnos com
`content` vazio, e o Alex fica em silêncio. Como a inbox já está recebendo tráfego real, isso
já pode estar acontecendo com clientes de verdade. Sinalizado para correção separada.

## Testes

`npm test` cobre o guardrail e os textos de repasse. `npm run simular -- "msg1" "msg2"` conversa com o Alex no terminal, sem Chatwoot. O restante é validado no número de teste com `ALLOWED_NUMBERS`.
