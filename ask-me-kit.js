const WEB_SCHEMES = new Set(['http:', 'https:', 'mailto:']);

export function safeDestination(value, allowedActions = new Set()) {
  let url;
  try { url = new URL(String(value)); } catch { return null; }
  if (WEB_SCHEMES.has(url.protocol)) return { kind: 'web', url: url.href };
  if (url.protocol === 'askme:' && url.hostname === 'action') {
    const action = url.pathname.replace(/^\/+|\/+$/g, '');
    if (allowedActions.has(action)) return { kind: 'action', action };
  }
  return null;
}

/** Parses a small, inert Markdown subset. It never returns or accepts HTML. */
export function parseSafeAnswer(source, allowedActions = new Set()) {
  const lines = String(source ?? '').replace(/\r\n/g, '\n').split('\n');
  const blocks = [];
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (!line) continue;
    const card = /^>\s*\[!(INFO|NOTE|TIP|WARNING)\]\s*(.*)$/i.exec(line.trim());
    if (card) {
      const content = [];
      while (lines[index + 1] && /^>/.test(lines[index + 1])) content.push(...parseInline(lines[++index].replace(/^>\s?/, ''), allowedActions));
      blocks.push({ type: 'card', tone: card[1].toLowerCase(), title: card[2] || card[1], content });
      continue;
    }
    const heading = /^(#{1,3})\s+(.*)$/.exec(line);
    const bullet = /^[-*]\s+(.*)$/.exec(line);
    const numbered = /^(\d+)\.\s+(.*)$/.exec(line);
    const code = /^```([\s\S]*)```$/.exec(line);
    const type = heading ? 'heading' : bullet ? 'bullet' : numbered ? 'numbered' : code ? 'code' : 'paragraph';
    const text = heading?.[2] ?? bullet?.[1] ?? numbered?.[2] ?? code?.[1] ?? line;
    blocks.push({ type, level: heading?.[1].length, number: numbered ? Number(numbered[1]) : undefined, content: parseInline(text, allowedActions) });
  }
  return blocks;
}

function parseInline(line, allowedActions) {
  const out = [];
  const pattern = /\[([^\]\n]+)\]\(([^)\s]+)\)|\*\*([^*\n]+)\*\*|`([^`\n]+)`|(https?:\/\/[^\s<]+)/g;
  let cursor = 0;
  for (const match of line.matchAll(pattern)) {
    if (match.index > cursor) out.push({ type: 'text', text: line.slice(cursor, match.index) });
    if (match[5]) {
      let raw = match[5], trailing = '';
      while (/[.,;:!?)]$/.test(raw)) { trailing = raw.slice(-1) + trailing; raw = raw.slice(0, -1); }
      const destination = safeDestination(raw, allowedActions);
      if (destination) {
        const host = new URL(destination.url).hostname.replace(/^www\./, '');
        out.push({ type: 'link', text: `${host} ↗`, destination });
      } else out.push({ type: 'text', text: raw });
      if (trailing) out.push({ type: 'text', text: trailing });
    } else if (match[1]) {
      const destination = safeDestination(match[2], allowedActions);
      out.push(destination ? { type: 'link', text: match[1], destination } : { type: 'text', text: match[0] });
    } else if (match[3]) out.push({ type: 'strong', text: match[3] });
    else out.push({ type: 'code', text: match[4] });
    cursor = match.index + match[0].length;
  }
  if (cursor < line.length) out.push({ type: 'text', text: line.slice(cursor) });
  return out;
}

export function chooseRandomComplex(catalog, random = Math.random) {
  const all = [...(catalog?.groups ?? []).flatMap((group) => group.prompts ?? []), ...(catalog?.edgeCases ?? []).slice(0, 15)];
  const complex = all.filter((prompt) => prompt.complex);
  const choices = complex.length ? complex : all;
  return choices.length ? choices[Math.floor(random() * choices.length)] : null;
}

const STYLE = `
.amk{--amk-accent:var(--accent,#2868b2);position:fixed;right:20px;bottom:20px;z-index:2147481900;width:min(390px,calc(100vw - 24px));min-width:min(300px,calc(100vw - 24px));max-width:min(620px,calc(100vw - 12px));max-height:calc(100vh - 24px);display:flex;flex-direction:column;color:var(--ink,#1f2933);background:var(--card,#fff);border:1px solid var(--line2,#d6dde6);border-radius:12px;box-shadow:0 14px 42px rgba(0,0,0,.22);font:13px/1.45 var(--font,-apple-system,BlinkMacSystemFont,"SF Pro Text",sans-serif);overflow:hidden}
.amk[hidden]{display:none}.amk-head,.amk-compose,.amk-controls{display:flex;align-items:center;gap:8px}.amk-head{padding:10px 12px;background:var(--headbg,#f4f6f9);border-bottom:1px solid var(--line2,#d6dde6)}.amk-head strong{flex:1}.amk button{font:inherit;cursor:pointer}.amk-icon{width:29px;height:29px;border:0;background:transparent;border-radius:7px}.amk-icon:hover,.amk-icon:focus{background:rgba(0,0,0,.07)}
.amk-body{min-height:86px;max-height:min(56vh,520px);overflow:auto;padding:10px;display:flex;flex-direction:column;gap:8px}.amk-empty{margin:auto;padding:25px;color:var(--mut,#687382);text-align:center;max-width:260px}.amk-msg{max-width:88%;padding:8px 10px;border-radius:10px;overflow-wrap:anywhere}.amk-msg.user{align-self:flex-end;background:color-mix(in srgb,var(--amk-accent) 16%,transparent)}.amk-msg.assistant{align-self:flex-start;background:var(--accentSoft,#edf2f7)}.amk-msg>*{margin:0 0 5px}.amk-msg>*:last-child{margin-bottom:0}.amk-msg pre,.amk-msg code{font-family:ui-monospace,SFMono-Regular,Menlo,monospace}.amk-msg pre{white-space:pre-wrap}.amk-action{border:0;padding:0;color:var(--amk-accent);background:transparent;text-decoration:underline}
.amk-card{border-left:3px solid var(--amk-accent);background:color-mix(in srgb,var(--amk-accent) 8%,var(--card,#fff));padding:8px 10px;border-radius:7px}.amk-card.warning{border-left-color:#b45309}.amk-card>strong{display:block;margin-bottom:4px}
.amk-foot{padding:9px 10px;border-top:1px solid var(--line2,#d6dde6);display:flex;flex-direction:column;gap:7px}.amk-compose textarea{flex:1;min-width:0;min-height:34px;max-height:132px;resize:none;overflow:auto;box-sizing:border-box;padding:7px 9px;border:1px solid var(--line2,#d6dde6);border-radius:8px;background:var(--card,#fff);color:inherit;font:inherit}.amk-send,.amk-voice{border:0;border-radius:8px;padding:8px 11px;background:var(--amk-accent);color:#fff;font-weight:650}.amk-send:disabled{opacity:.55}.amk-state{font-size:11px;color:var(--mut,#687382);flex:1}.amk-error{color:#b42318;font-size:11px}
.amk-prompts{position:relative}.amk-prompt-menu{position:fixed;z-index:2147481902;min-width:220px;padding:5px;background:var(--card,#fff);color:var(--ink,#1f2933);font:13px/1.45 var(--font,-apple-system,BlinkMacSystemFont,"SF Pro Text",sans-serif);border:1px solid var(--line2,#d6dde6);border-radius:9px;box-shadow:0 9px 26px rgba(0,0,0,.18)}.amk-prompt-menu[hidden]{display:none}.amk-prompt-menu button,.amk-prompt-menu details>summary{display:block;width:100%;box-sizing:border-box;padding:7px 9px;border:0;border-radius:6px;background:transparent;color:inherit;text-align:left;list-style:none;font:inherit}.amk-prompt-menu button:hover,.amk-prompt-menu button:focus,.amk-prompt-menu summary:hover{background:var(--accentSoft,#edf2f7)}.amk-prompt-menu details{position:relative}.amk-prompt-menu details>div{padding-left:10px;border-left:2px solid var(--line2,#d6dde6)}
.amk-prompt-menu.cascade details>div{position:absolute;left:calc(100% - 2px);top:-5px;min-width:220px;padding:5px;background:var(--card,#fff);border:1px solid var(--line2,#d6dde6);border-radius:9px;box-shadow:0 9px 26px rgba(0,0,0,.18)}.amk-prompt-menu.cascade details.flip>div{left:auto;right:calc(100% - 2px)}
.amk-resize{position:absolute;z-index:3;touch-action:none}.amk-resize.w{left:0;top:14px;bottom:14px;width:8px;cursor:ew-resize}.amk-resize.e{right:0;top:14px;bottom:14px;width:8px;cursor:ew-resize}.amk-resize.n{top:0;left:14px;right:14px;height:8px;cursor:ns-resize}.amk-resize.s{bottom:0;left:14px;right:14px;height:8px;cursor:ns-resize}.amk-resize.nw{left:0;top:0;width:16px;height:16px;cursor:nwse-resize}.amk-resize.ne{right:0;top:0;width:16px;height:16px;cursor:nesw-resize}.amk-resize.sw{left:0;bottom:0;width:16px;height:16px;cursor:nesw-resize}.amk-resize.se{right:0;bottom:0;width:18px;height:18px;cursor:nwse-resize}
.amk.compact{width:min(430px,calc(100vw - 24px))}.amk.compact .amk-body{max-height:38vh}.amk-fab{position:fixed;right:16px;bottom:16px;z-index:2147481899;width:52px;height:52px;border:0;border-radius:50%;background:var(--accent,#2868b2);color:#fff;box-shadow:0 6px 18px rgba(0,0,0,.24);font-size:20px}
@media(max-width:520px){.amk{right:6px;bottom:6px;width:calc(100vw - 12px);max-height:calc(100vh - 12px)}}
`;

/** Renders safe rich text into an existing host without replacing the host app's controller. */
export function renderSafeAnswer(host, source, { allowedActions = new Set(), actions = {} } = {}) {
  const doc = host.ownerDocument;
  host.replaceChildren();
  for (const block of parseSafeAnswer(source, allowedActions)) {
    const el = doc.createElement(block.type === 'heading' ? `h${block.level}` : block.type === 'bullet' || block.type === 'numbered' ? 'div' : block.type === 'code' ? 'pre' : block.type === 'card' ? 'aside' : 'p');
    if (block.type === 'card') { el.className = `amk-card ${block.tone}`; const title = doc.createElement('strong'); title.textContent = block.title; el.append(title); }
    if (block.type === 'bullet') el.append('• ');
    if (block.type === 'numbered') el.append(`${block.number}. `);
    for (const item of block.content) {
      if (item.type === 'text') el.append(item.text);
      else if (item.type === 'strong') { const strong = doc.createElement('strong'); strong.textContent = item.text; el.append(strong); }
      else if (item.type === 'code') { const code = doc.createElement('code'); code.textContent = item.text; el.append(code); }
      else if (item.destination.kind === 'web') {
        const a = doc.createElement('a'); a.textContent = item.text; a.href = item.destination.url; a.target = '_blank'; a.rel = 'noopener noreferrer'; el.append(a);
      } else {
        const button = doc.createElement('button'); button.type = 'button'; button.className = 'amk-action'; button.textContent = item.text;
        button.addEventListener('click', () => actions[item.destination.action]?.()); el.append(button);
      }
    }
    host.append(el);
  }
  return host;
}

/**
 * Headless question/answer state for apps that already have a mature panel or voice controller.
 * Callbacks receive inert text; use `renderSafeAnswer` for assistant output.
 */
export function createAskMeSession(options) {
  if (typeof options?.answer !== 'function' || typeof options.context !== 'function') throw new TypeError('answer and context are required');
  let busy = false, listening = false, destroyed = false;
  const state = (value) => { if (!destroyed) options.onState?.(value); };
  const message = (role, text) => { if (!destroyed) options.onMessage?.({ role, text }); };
  async function submit(value, { fromVoice = false, alreadyShown = false } = {}) {
    const text = String(value ?? '').trim();
    if (!text || busy || destroyed) return null;
    if (!alreadyShown) message('user', text);
    busy = true; state('answering');
    try {
      const context = await options.context();
      const result = await options.answer({ text, context, fromVoice });
      const answer = typeof result === 'string' ? result : result?.text ?? result?.answer;
      if (!answer) throw new Error('Ask Me returned no answer.');
      message('assistant', answer); state(listening ? 'listening' : 'ready');
      return answer;
    } catch (cause) {
      const error = cause instanceof Error ? cause : new Error('Ask Me is unavailable.');
      options.onError?.(error); state('unavailable');
      return null;
    } finally { busy = false; }
  }
  async function startVoice() {
    if (!options.voice?.start || listening || destroyed) return false;
    try {
      await options.voice.start((transcript) => submit(transcript, { fromVoice: true }));
      listening = true; state('listening'); return true;
    } catch (cause) { options.onError?.(cause instanceof Error ? cause : new Error('Voice is unavailable.')); state('unavailable'); return false; }
  }
  async function stopVoice() { if (listening) await options.voice?.stop?.(); listening = false; state('ready'); }
  return {
    submit, startVoice, stopVoice,
    get busy() { return busy; },
    get listening() { return listening; },
    destroy() { destroyed = true; options.voice?.stop?.(); },
  };
}

/**
 * Mounts the shared Ask Me shell.
 * Required options: `answer(request)` and `context()`.
 * The host owns auth, data, instructions, model, tools, retention, and every interface action.
 */
export function attachAskMe(options) {
  if (!options?.root || typeof options.answer !== 'function' || typeof options.context !== 'function') throw new TypeError('root, answer, and context are required');
  const root = options.root;
  const doc = root.ownerDocument;
  const win = doc.defaultView;
  if (!doc.getElementById('ask-me-kit-style')) { const style = doc.createElement('style'); style.id = 'ask-me-kit-style'; style.textContent = STYLE; doc.head.append(style); }
  const panel = doc.createElement('section'); panel.className = `amk${options.presentation === 'compact' ? ' compact' : ''}`; panel.hidden = options.open === false; panel.setAttribute('aria-label', options.title ?? 'Ask Me');
  const head = doc.createElement('header'); head.className = 'amk-head';
  const title = doc.createElement('strong'); title.textContent = options.title ?? 'Ask Me';
  const state = doc.createElement('span'); state.className = 'amk-state'; state.textContent = 'Ready';
  const prompts = doc.createElement('div'); prompts.className = 'amk-prompts';
  const promptButton = doc.createElement('button'); promptButton.type = 'button'; promptButton.className = 'amk-icon'; promptButton.textContent = '✦'; promptButton.title = 'Example questions'; promptButton.setAttribute('aria-label', 'Example questions');
  const promptMenu = doc.createElement('div'); promptMenu.className = 'amk-prompt-menu'; promptMenu.hidden = true;
  if (options.cascadingPrompts) promptMenu.classList.add('cascade');
  prompts.append(promptButton); doc.body.append(promptMenu);
  const close = doc.createElement('button'); close.type = 'button'; close.className = 'amk-icon'; close.textContent = '×'; close.setAttribute('aria-label', 'Close Ask Me');
  head.append(title, state, prompts, close);
  const body = doc.createElement('div'); body.className = 'amk-body';
  const empty = doc.createElement('div'); empty.className = 'amk-empty'; empty.textContent = options.emptyMessage ?? 'Ask a question about this app.'; body.append(empty);
  const foot = doc.createElement('footer'); foot.className = 'amk-foot';
  const form = doc.createElement('form'); form.className = 'amk-compose';
  const input = doc.createElement('textarea'); input.rows = 1; input.maxLength = options.maxQuestionLength ?? 2000; input.placeholder = options.placeholder ?? 'Ask a question'; input.setAttribute('aria-label', input.placeholder);
  const send = doc.createElement('button'); send.type = 'submit'; send.className = 'amk-send'; send.textContent = 'Send';
  form.append(input, send);
  const controls = doc.createElement('div'); controls.className = 'amk-controls';
  const error = doc.createElement('span'); error.className = 'amk-error'; error.setAttribute('role', 'status');
  controls.append(error);
  let voiceButton = null, listening = false;
  if (options.voice?.start) { voiceButton = doc.createElement('button'); voiceButton.type = 'button'; voiceButton.className = 'amk-voice'; voiceButton.textContent = 'Start voice'; controls.append(voiceButton); }
  foot.append(form, controls); panel.append(head, body, foot); root.append(panel);

  const allowedActions = new Set(Object.keys(options.actions ?? {}));
  function resizeInput() { input.style.height = 'auto'; input.style.height = `${Math.min(input.scrollHeight, 132)}px`; }
  function addMessage(role, text) {
    empty.remove(); const message = doc.createElement('article'); message.className = `amk-msg ${role}`;
    if (role === 'assistant') renderSafeAnswer(message, text, { allowedActions, actions: options.actions ?? {} }); else message.textContent = text;
    body.append(message); body.scrollTop = body.scrollHeight;
  }
  async function submit(text, fromVoice = false) {
    text = String(text ?? '').trim(); if (!text || send.disabled) return;
    addMessage('user', text); input.value = ''; resizeInput(); send.disabled = true; state.textContent = 'Answering…'; error.textContent = '';
    try {
      const context = await options.context();
      const result = await options.answer({ text, context, fromVoice });
      const answer = typeof result === 'string' ? result : result?.text ?? result?.answer;
      if (!answer) throw new Error('Ask Me returned no answer.');
      addMessage('assistant', answer); state.textContent = 'Ready';
    } catch (cause) { error.textContent = cause?.message ?? 'Ask Me is unavailable.'; state.textContent = 'Unavailable'; }
    finally { send.disabled = false; }
  }
  function usePrompt(prompt) { promptMenu.hidden = true; if (options.submitPrompts) submit(prompt.text); else { input.value = prompt.text; resizeInput(); input.focus(); } }
  function addPromptButton(container, prompt) { const button = doc.createElement('button'); button.type = 'button'; button.textContent = prompt.label; button.addEventListener('click', () => usePrompt(prompt)); container.append(button); }
  const random = doc.createElement('button'); random.type = 'button'; random.textContent = 'Random complex example'; random.addEventListener('click', () => { const prompt = chooseRandomComplex(options.prompts); if (prompt) usePrompt(prompt); else promptMenu.hidden = true; }); promptMenu.append(random);
  function addGroup(label, groupPrompts) { const details = doc.createElement('details'); const summary = doc.createElement('summary'); summary.textContent = label; const list = doc.createElement('div'); for (const prompt of groupPrompts) addPromptButton(list, prompt); details.append(summary, list); if (options.cascadingPrompts) { details.addEventListener('pointerenter', () => { details.classList.toggle('flip', details.getBoundingClientRect().right + 222 > win.innerWidth); details.open = true; }); details.addEventListener('pointerleave', () => { details.open = false; }); } promptMenu.append(details); }
  for (const group of options.prompts?.groups ?? []) addGroup(group.label, group.prompts ?? []);
  if (options.prompts?.edgeCases?.length) addGroup('Edge cases', options.prompts.edgeCases.slice(0, 15));
  function placePromptMenu() { const rect = promptButton.getBoundingClientRect(); const width = promptMenu.offsetWidth || 220; promptMenu.style.left = `${Math.max(6, Math.min(win.innerWidth - width - 6, rect.right - width))}px`; promptMenu.style.top = `${Math.max(6, Math.min(win.innerHeight - promptMenu.offsetHeight - 6, rect.bottom + 4))}px`; promptMenu.style.right = 'auto'; }
  promptButton.addEventListener('click', () => { promptMenu.hidden = !promptMenu.hidden; if (!promptMenu.hidden) placePromptMenu(); });
  const dismissPromptMenu = (event) => { if (!promptMenu.hidden && !promptMenu.contains(event.target) && !promptButton.contains(event.target)) promptMenu.hidden = true; };
  doc.addEventListener('pointerdown', dismissPromptMenu);
  close.addEventListener('click', () => { panel.hidden = true; options.onClose?.(); });
  input.addEventListener('input', resizeInput);
  input.addEventListener('keydown', (event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); form.requestSubmit(); } });
  form.addEventListener('submit', (event) => { event.preventDefault(); submit(input.value); });
  voiceButton?.addEventListener('click', async () => {
    if (listening) { await options.voice.stop?.(); listening = false; voiceButton.textContent = 'Start voice'; state.textContent = 'Ready'; }
    else { try { await options.voice.start((transcript) => submit(transcript, true)); listening = true; voiceButton.textContent = 'Stop voice'; state.textContent = 'Listening'; } catch (cause) { error.textContent = cause?.message ?? 'Voice is unavailable.'; } }
  });
  const positionKey = options.storageKey ? `${options.storageKey}:position` : null;
  const sizeKey = options.storageKey ? `${options.storageKey}:size` : null;
  function clampPanel() {
    if (panel.hidden) return;
    const rect = panel.getBoundingClientRect();
    const left = Math.max(6, Math.min(win.innerWidth - rect.width - 6, rect.left));
    const top = Math.max(6, Math.min(win.innerHeight - rect.height - 6, rect.top));
    panel.style.left = `${left}px`; panel.style.top = `${top}px`; panel.style.right = 'auto'; panel.style.bottom = 'auto';
  }
  if (options.draggable) {
    head.style.cursor = 'move'; let origin = null, moved = false;
    head.addEventListener('pointerdown', (event) => { if (event.target.closest('button')) return; const rect = panel.getBoundingClientRect(); origin = { x: event.clientX, y: event.clientY, left: rect.left, top: rect.top }; moved = false; head.setPointerCapture(event.pointerId); });
    head.addEventListener('pointermove', (event) => { if (!origin || !head.hasPointerCapture(event.pointerId)) return; const dx = event.clientX - origin.x, dy = event.clientY - origin.y; if (Math.abs(dx) + Math.abs(dy) < 4 && !moved) return; moved = true; panel.style.left = `${origin.left + dx}px`; panel.style.top = `${origin.top + dy}px`; panel.style.right = 'auto'; panel.style.bottom = 'auto'; clampPanel(); });
    head.addEventListener('pointerup', (event) => { if (head.hasPointerCapture(event.pointerId)) head.releasePointerCapture(event.pointerId); origin = null; if (moved && positionKey) try { win.localStorage.setItem(positionKey, JSON.stringify({ left: panel.style.left, top: panel.style.top })); } catch {} });
  }
  if (options.resizable) {
    for (const direction of ['w', 'e', 'n', 's', 'nw', 'ne', 'sw', 'se']) { const handle = doc.createElement('div'); handle.className = `amk-resize ${direction}`; handle.setAttribute('aria-label', 'Resize Ask Me'); panel.append(handle); handle.addEventListener('pointerdown', (event) => { event.preventDefault(); const rect = panel.getBoundingClientRect(), sx = event.clientX, sy = event.clientY; handle.setPointerCapture(event.pointerId); const move = (next) => { const dx = next.clientX - sx, dy = next.clientY - sy; let left = rect.left, top = rect.top, width = rect.width, height = rect.height; if (direction.includes('w')) { left += dx; width -= dx; } if (direction.includes('e')) width += dx; if (direction.includes('n')) { top += dy; height -= dy; } if (direction.includes('s')) height += dy; width = Math.max(300, Math.min(width, win.innerWidth - 12)); height = Math.max(220, Math.min(height, win.innerHeight - 12)); panel.style.left = `${left}px`; panel.style.top = `${top}px`; panel.style.width = `${width}px`; panel.style.height = `${height}px`; panel.style.right = 'auto'; panel.style.bottom = 'auto'; clampPanel(); }; const up = (next) => { if (handle.hasPointerCapture(next.pointerId)) handle.releasePointerCapture(next.pointerId); handle.removeEventListener('pointermove', move); handle.removeEventListener('pointerup', up); if (sizeKey) try { win.localStorage.setItem(sizeKey, JSON.stringify({ width: panel.style.width, height: panel.style.height })); } catch {} }; handle.addEventListener('pointermove', move); handle.addEventListener('pointerup', up); }); }
  }
  try { if (positionKey) { const saved = JSON.parse(win.localStorage.getItem(positionKey) || 'null'); if (saved?.left && saved?.top) { panel.style.left = saved.left; panel.style.top = saved.top; panel.style.right = 'auto'; panel.style.bottom = 'auto'; } } if (sizeKey) { const saved = JSON.parse(win.localStorage.getItem(sizeKey) || 'null'); if (saved?.width && saved?.height) { panel.style.width = saved.width; panel.style.height = saved.height; } } } catch {}
  win.addEventListener('resize', clampPanel);
  resizeInput();
  return {
    open() { panel.hidden = false; input.focus(); },
    close() { panel.hidden = true; },
    ask(text) { return submit(text); },
    setDraft(text) { input.value = String(text ?? ''); resizeInput(); },
    destroy() { options.voice?.stop?.(); win.removeEventListener('resize', clampPanel); doc.removeEventListener('pointerdown', dismissPromptMenu); promptMenu.remove(); panel.remove(); },
    element: panel,
  };
}
