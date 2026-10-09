const MODEL = '@cf/meta/llama-3.3-70b-instruct-fp8-fast';
const SYSTEM = `You are CodePilot, an expert performance engineering assistant. Analyze Python, C++ and CUDA code. Be precise about algorithmic complexity, allocations, cache locality, parallelism, data layout and trade-offs. Differentiate measured results from hypotheses. Never claim to have compiled, profiled, run or benchmark submitted code. When making an optimization suggestion, show a concrete, readable example and explain why it might help. If a security issue is visible, note it. Be succinct and use Markdown.`;
const MAX_MESSAGE = 12000;
const MAX_HISTORY = 12;
const json = (payload, status = 200, headers = {}) => new Response(JSON.stringify(payload), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...headers } });
const error = (message, status) => json({ error: message }, status);
const sessionIdValid = value => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f-]{27,36}$/i.test(value) && value.length === 36;
const cookieValue = request => (request.headers.get('cookie') || '').split(';').map(x => x.trim()).find(x => x.startsWith('codecoach='))?.slice('codecoach='.length);
function sessionCookie(id, request) {
  const secure = new URL(request.url).protocol === 'https:' ? '; Secure' : '';
  return `codecoach=${id}; HttpOnly; SameSite=Lax; Path=/; Max-Age=2592000${secure}`;
}
async function session(request, env) {
  let id = cookieValue(request);
  let isNew = !sessionIdValid(id);
  if (!isNew) {
    const existing = await env.DB.prepare('SELECT id FROM sessions WHERE id = ?').bind(id).first();
    if (!existing) isNew = true;
  }
  if (isNew) {
    id = crypto.randomUUID();
    await env.DB.prepare('INSERT INTO sessions (id) VALUES (?)').bind(id).run();
  }
  return { id, cookie: isNew ? sessionCookie(id, request) : null };
}
function withCookie(response, cookie) {
  if (cookie) response.headers.set('set-cookie', cookie);
  return response;
}
function asChat(response) {
  if (typeof response?.response === 'string') return response.response;
  if (typeof response?.result?.response === 'string') return response.result.response;
  return null;
}
export async function handleApi(request, env) {
  const url = new URL(request.url);
  if (request.method === 'GET' && url.pathname === '/api/health') return json({ ok: true, model: MODEL });
  if (!env.DB || !env.AI) return error('Cloudflare AI and D1 bindings are required.', 503);
  if (request.method === 'GET' && url.pathname === '/api/history') {
    const s = await session(request, env);
    const result = await env.DB.prepare('SELECT role, content, created_at FROM messages WHERE session_id = ? ORDER BY created_at ASC, rowid ASC LIMIT 100').bind(s.id).all();
    return withCookie(json({ messages: result.results || [] }), s.cookie);
  }
  if (request.method === 'POST' && url.pathname === '/api/reset') {
    const s = await session(request, env);
    await env.DB.prepare('DELETE FROM messages WHERE session_id = ?').bind(s.id).run();
    return withCookie(json({ ok: true }), s.cookie);
  }
  if (request.method === 'POST' && url.pathname === '/api/chat') {
    if (!(request.headers.get('content-type') || '').includes('application/json')) return error('Expected application/json.', 415);
    const len = Number(request.headers.get('content-length') || 0);
    if (len > 16000) return error('Request too large.', 413);
    let body;
    try { body = await request.json(); } catch { return error('Invalid JSON.', 400); }
    const message = body?.message;
    if (typeof message !== 'string' || !message.trim() || message.length > MAX_MESSAGE) return error(`Message must be between 1 and ${MAX_MESSAGE} characters.`, 400);
    const s = await session(request, env);
    const rows = await env.DB.prepare('SELECT role, content FROM messages WHERE session_id = ? ORDER BY created_at DESC, rowid DESC LIMIT ?').bind(s.id, MAX_HISTORY).all();
    const history = (rows.results || []).reverse().map(({ role, content }) => ({ role, content }));
    let response;
    try {
      const result = await env.AI.run(MODEL, { messages: [{ role: 'system', content: SYSTEM }, ...history, { role: 'user', content: message.trim() }], max_tokens: 1100 });
      response = asChat(result);
      if (!response) throw new Error('Model returned no text');
    } catch (e) {
      console.error('Workers AI failure', String(e));
      return withCookie(error('AI request failed. Check Workers AI availability and logs.', 502), s.cookie);
    }
    await env.DB.batch([
      env.DB.prepare('INSERT INTO messages (id, session_id, role, content) VALUES (?, ?, ?, ?)').bind(crypto.randomUUID(), s.id, 'user', message.trim()),
      env.DB.prepare('INSERT INTO messages (id, session_id, role, content) VALUES (?, ?, ?, ?)').bind(crypto.randomUUID(), s.id, 'assistant', response),
      env.DB.prepare('UPDATE sessions SET updated_at = CURRENT_TIMESTAMP WHERE id = ?').bind(s.id)
    ]);
    return withCookie(json({ response }), s.cookie);
  }
  return error('Not found', 404);
}
export default {
  async fetch(request, env) {
    const path = new URL(request.url).pathname;
    if (path.startsWith('/api/')) {
      try { return await handleApi(request, env); }
      catch (e) { console.error('API error', String(e)); return error('Unexpected server error.', 500); }
    }
    return env.ASSETS.fetch(request);
  }
};
