import { createClient } from '@/utils/supabase/server';
import { buildChatSchema, buildChatPrompt, chatSanitize, toGeminiSchema } from '@/lib/chatLLM';

// The chatbots' shared brain. One stateless Gemini call per message — the
// client sends the page's system prompt, live data snapshot and transcript;
// the server enforces the JSON shape and filters unknown action types.
// The Gemini key lives only here, server-side.
export async function POST(request) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth?.user) {
    return Response.json({ error: 'Not signed in.' }, { status: 401 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Bad request body.' }, { status: 400 });
  }

  const systemPrompt = typeof body?.systemPrompt === 'string' ? body.systemPrompt : '';
  const actionTypes = Array.isArray(body?.actionTypes)
    ? body.actionTypes.filter((t) => typeof t === 'string' && t.length < 64).slice(0, 32)
    : [];
  let context = body?.context;
  if (context && typeof context === 'object') {
    context = JSON.parse(JSON.stringify(context).slice(0, 20000));
  } else {
    context = {};
  }
  const transcript = typeof body?.transcript === 'string' ? body.transcript.slice(0, 6000) : '';

  if (!systemPrompt || !actionTypes.length) {
    return Response.json({ error: 'Bad request body.' }, { status: 400 });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'your-gemini-api-key') {
    return Response.json({ error: 'Assistant is not configured (GEMINI_API_KEY).' }, { status: 503 });
  }

  const model = process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite';
  // Primary model first, then fallbacks — the lite tier flaps under load (503s).
  const candidateModels = [...new Set([model, 'gemini-3.6-flash', 'gemini-3.1-flash-lite'])];
  const requestBody = JSON.stringify({
    contents: [
      {
        role: 'user',
        parts: [{ text: buildChatPrompt({ systemPrompt, context, transcript }) }],
      },
    ],
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: toGeminiSchema(buildChatSchema(actionTypes)),
    },
  });

  let data;
  let lastError = null;
  try {
    for (const candidate of candidateModels) {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${candidate}:generateContent`;
      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
          body: requestBody,
        });
        if (response.ok) {
          data = await response.json();
          break;
        }
        const message = await response.text().catch(() => '');
        lastError = new Error(`Gemini ${response.status} ${message.slice(0, 200)}`);
        // Only capacity errors are worth retrying on another model.
        if (response.status !== 503 && response.status !== 429) break;
        await new Promise((resolve) => setTimeout(resolve, 800));
      } catch (error) {
        lastError = error;
      }
    }
    if (!data) throw lastError || new Error('Gemini call failed');
  } catch (error) {
    console.error('chat: llm call failed', error?.message || error);
    return Response.json({ error: 'The assistant is unavailable. Try again.' }, { status: 502 });
  }

  const raw = data?.candidates?.[0]?.content?.parts
    ?.map((part) => part?.text || '')
    .join('');
  let parsed = {};
  try {
    parsed = JSON.parse(raw || '{}');
  } catch {
    return Response.json({ error: 'The assistant returned unreadable output.' }, { status: 502 });
  }

  return Response.json(chatSanitize(parsed, actionTypes));
}
