// Probe: what does Gemini actually return for the chat prompt + schema?
// Usage: node scripts/probe-chat.mjs
import fs from 'node:fs';
import { buildChatSchema, buildChatPrompt, chatSanitize } from '../src/lib/chatLLM.js';
import { HOME_BOT } from '../src/components/chat/botConfigs.js';

const env = {};
fs.readFileSync(new URL('../.env.local', import.meta.url), 'utf8').split(/\r?\n/).forEach((line) => {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m) env[m[1]] = m[2].trim();
});
const apiKey = env.GEMINI_API_KEY;

// riff's converter — uppercase OpenAPI types.
function toGeminiSchema(schema) {
  const clone = (node) => {
    if (Array.isArray(node)) return node.map(clone);
    if (!node || typeof node !== 'object') return node;
    const out = { type: String(node.type || 'string').toUpperCase() };
    if (node.description) out.description = node.description;
    if (node.enum) out.enum = node.enum;
    if (node.required) out.required = node.required;
    if (node.items) out.items = clone(node.items);
    if (node.properties) {
      out.properties = Object.fromEntries(Object.entries(node.properties).map(([k, v]) => [k, clone(v)]));
      if (!out.propertyOrdering) out.propertyOrdering = Object.keys(node.properties);
    }
    return out;
  };
  return clone(schema);
}

const context = {
  categories: [{ name: 'Food', gcash: 0, cash: 0 }],
  totals: { gcash: 0, cash: 0, total: 0 },
  budget_allocations: {},
  recent_actions: [],
};
const transcript = 'User: can you add 500 pesos in cash for the category of food';

const prompt = buildChatPrompt({ systemPrompt: HOME_BOT.systemPrompt, context, transcript });

async function call(model, schema) {
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { responseMimeType: 'application/json', responseSchema: schema },
    }),
  });
  const text = await res.text();
  if (!res.ok) return `HTTP ${res.status} ${text.slice(0, 200)}`;
  const data = JSON.parse(text);
  const raw = data?.candidates?.[0]?.content?.parts?.map((p) => p?.text || '').join('');
  return raw;
}

const model = process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite';
console.log('--- lowercase schema (what the route sends now) ---');
console.log(await call(model, buildChatSchema(HOME_BOT.actionTypes)));
console.log('--- uppercase schema (riff-style) ---');
console.log(await call(model, toGeminiSchema(buildChatSchema(HOME_BOT.actionTypes))));
