/**
 * Conversa com o Alex no terminal, sem Chatwoot e sem WhatsApp.
 * Mostra a resposta, os campos capturados e se o guardrail barraria.
 *   npm run simular -- "oi, quero saber da strada" "quanto fica a parcela?"
 */
import { responder, type Turno } from '../src/brain.js';
import { verificarSaida, valoresCitadosPelo } from '../src/guardrails.js';
import { ofertas, limites } from '../src/config.js';
import { prontoParaHandoff, type Estado } from '../src/state.js';

const falas = process.argv.slice(2);
if (!falas.length) {
  console.error('passe as mensagens do cliente como argumentos');
  process.exit(1);
}

const historico: Turno[] = [];
let estado: Estado = {};

for (const fala of falas) {
  historico.push({ autor: 'cliente', texto: fala });
  const r = await responder(historico, estado, false);
  estado = { ...estado, ...(r.campos as Estado) };

  const extras = historico.filter((t) => t.autor === 'cliente').flatMap((t) => valoresCitadosPelo(t.texto));
  const v = verificarSaida(r.resposta, ofertas, limites, extras);

  console.log(`\n👤 ${fala}`);
  console.log(`🤖 ${r.resposta}`);
  console.log(`   campos: ${JSON.stringify(r.campos)}  etiqueta: ${r.etiqueta ?? '-'}`);
  if (r.escalar) console.log(`   ⤴ escalar: ${r.escalar.motivo}`);
  if (!v.ok) console.log(`   ⛔ GUARDRAIL BARRARIA: ${v.motivo}`);
  if (prontoParaHandoff(estado)) console.log('   ✅ pronto para handoff');

  historico.push({ autor: 'alex', texto: r.resposta });
}
