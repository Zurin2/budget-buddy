// Budget Buddy's chat brain — prompt assembly, JSON schema and sanitizer.
// Server-side only: imported by /api/chat so the Gemini key never reaches the browser.

// Gemini responseSchema uses an OpenAPI subset with UPPERCASE types
// (same converter riff uses).
export function toGeminiSchema(schema) {
  const clone = (node) => {
    if (Array.isArray(node)) return node.map(clone);
    if (!node || typeof node !== 'object') return node;
    const out = { type: String(node.type || 'string').toUpperCase() };
    if (node.description) out.description = node.description;
    if (node.enum) out.enum = node.enum;
    if (node.required) out.required = node.required;
    if (node.items) out.items = clone(node.items);
    if (node.properties) {
      out.properties = Object.fromEntries(
        Object.entries(node.properties).map(([k, v]) => [k, clone(v)])
      );
      if (!out.propertyOrdering) out.propertyOrdering = Object.keys(node.properties);
    }
    return out;
  };
  return clone(schema);
}

// action_params is a superset covering every bot; params the current bot does
// not need are simply omitted by the model.
const ACTION_PARAMS_PROPERTIES = {
  category: { type: 'string', description: 'category name, as the user typed it' },
  from_category: { type: 'string', description: 'source category name' },
  to_category: { type: 'string', description: 'destination category name' },
  amount: { type: 'number', description: 'plain peso amount, no symbols' },
  cash_type: { type: 'string', enum: ['gcash', 'cash'] },
  from_cash_type: { type: 'string', enum: ['gcash', 'cash'] },
  to_cash_type: { type: 'string', enum: ['gcash', 'cash'] },
  note_id: { type: 'string', description: 'note id copied exactly from context' },
  content: { type: 'string', description: 'note text' },
  page: { type: 'string', description: 'page to navigate to' },
};

export function buildChatSchema(actionTypes) {
  return {
    type: 'object',
    properties: {
      reply: { type: 'string', description: 'what to say to the user, 1-3 sentences' },
      actions: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            action_type: { type: 'string', enum: actionTypes },
            action_params: {
              type: 'object',
              description:
                'Every parameter relevant to the action, fully filled. amount must be a number. Copy category/note words from the conversation when the latest message alone is incomplete.',
              properties: ACTION_PARAMS_PROPERTIES,
            },
          },
          required: ['action_type', 'action_params'],
        },
      },
    },
    required: ['reply', 'actions'],
  };
}

export function buildChatPrompt({ systemPrompt, context, transcript }) {
  return [
    systemPrompt,
    '\n\nCURRENT APP DATA (JSON):\n' + JSON.stringify(context ?? {}),
    '\n\nCONVERSATION:\n' + (transcript || ''),
    '\n\nReply in JSON: { "reply": string, "actions": [ { "action_type": ..., "action_params": { ... } } ] }. ' +
      'Only use the action types listed in your instructions.',
  ].join('');
}

// Guarantees a usable { reply, actions } even when the model drifts.
export function chatSanitize(parsed, actionTypes) {
  const allowed = new Set(actionTypes);
  const reply = typeof parsed?.reply === 'string' ? parsed.reply.trim() : '';

  const raw = Array.isArray(parsed?.actions) ? parsed.actions : [];
  const actions = raw
    .map((item) => {
      const type = typeof item?.action_type === 'string' ? item.action_type : '';
      const params = item?.action_params && typeof item.action_params === 'object' ? { ...item.action_params } : {};
      if (params.amount !== undefined) {
        const n = Number(params.amount);
        params.amount = Number.isFinite(n) ? n : params.amount;
      }
      return { action_type: type, action_params: params };
    })
    .filter((item) => item.action_type && allowed.has(item.action_type))
    .slice(0, 12);

  return { reply, actions };
}
