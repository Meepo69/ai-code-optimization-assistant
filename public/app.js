const chat = document.querySelector('#chat');
const form = document.querySelector('#composer');
const textarea = document.querySelector('#message');
const send = document.querySelector('#send');
const welcome = document.querySelector('#welcome');
function addMessage(role, content) {
  if (welcome) welcome.hidden = true;
  const bubble = document.createElement('article');
  bubble.className = `bubble ${role}`;
  const who = document.createElement('div');
  who.className = 'who';
  who.textContent = role === 'user' ? 'YOU' : 'CODEPILOT';
  const text = document.createElement('div');
  text.textContent = content; // Treat model output as text, never execute model-provided HTML.
  bubble.append(who, text);
  chat.append(bubble);
  chat.scrollTop = chat.scrollHeight;
  return text;
}
async function api(path, options = {}) {
  const response = await fetch(path, { credentials: 'same-origin', ...options });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `Request failed (${response.status})`);
  return data;
}
async function load() {
  try {
    const data = await api('/api/history');
    for (const msg of data.messages) addMessage(msg.role, msg.content);
  } catch (error) { addMessage('assistant', `Could not load saved conversation: ${error.message}`); }
}
async function submit(message) {
  addMessage('user', message);
  textarea.value = '';
  send.disabled = true;
  const reply = addMessage('assistant', 'Analyzing…');
  try {
    const data = await api('/api/chat', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ message }) });
    reply.textContent = data.response;
  } catch (error) { reply.textContent = `Error: ${error.message}`; }
  finally { send.disabled = false; textarea.focus(); }
}
form.addEventListener('submit', e => { e.preventDefault(); const value = textarea.value.trim(); if (value && !send.disabled) submit(value); });
textarea.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); form.requestSubmit(); } });
document.querySelector('#newChat').addEventListener('click', async () => {
  if (!confirm('Clear this session’s saved conversation?')) return;
  try { await api('/api/reset', { method: 'POST' }); chat.replaceChildren(); const w = document.createElement('div'); w.className = 'welcome'; w.innerHTML = '<h2>New conversation</h2><p>Ask about your code or performance bottlenecks.</p>'; chat.append(w); } catch (error) { alert(error.message); }
});
for (const suggestion of document.querySelectorAll('.suggest')) suggestion.addEventListener('click', () => { textarea.value = suggestion.dataset.prompt; textarea.focus(); });
load();
