const { byId, getTg, getTgUser, calcAz, sendRouteReport, expandTg } = window.AppShared;
const CFG = { GITHUB_USER: "yvayvapyvapyva", CACHE_NAME: "route-audio-v1", TRIGGER_DIST: 25, AZ_TOLERANCE: 45, SPEED_THRESHOLD: 2, DEFAULT_CENTER: [56.3268, 44.0059], COLORS: { Gold:'#FFD700', Blue:'#007AFF', Red:'#FF3B30', Lime:'#34C759', Fuchsia:'#AF52DE', Orange:'#FF9500', Purple:'#5856D6', Cyan:'#5AC8FA', Brown:'#A2845E', Grey:'#8E8E93' } };
const REPORT_CFG = { BOT_TOKEN: '7860806384:AAEYRKqdPUsUz9npN3MmyEYKH-rTHISeHbs', CHAT_ID: '5180466640' };
const audio = new Audio(), ui = byId;
let tgUser = null, startParam = null, tg = getTg(), v = ui('v'), wl = null, map, userMarker, pointsCollection, linesCollection, pointsData = [], currentIndex = -1, previewIndex = -1, autoCenter = false, lastPos = null, lastAz = 0, currentSpeed = 0, iconCache = new Map(), wakeWanted = false;

if (tg) { expandTg(); tgUser = getTgUser(); startParam = tg.initDataUnsafe?.start_param; }
if (!startParam) startParam = new URLSearchParams(window.location.search).get('route') || new URLSearchParams(window.location.search).get('startapp');

const getAudioPath = text => { if (!text) return null; const n = text.normalize('NFC').toLowerCase().replace(/[.,\/#!$%\^&\*;:{}=\-`~()]/g, "").trim().replace(/\s+/g, '_'); return `audio/${encodeURIComponent(n)}.mp3`; };
const preloadAudio = async data => { if (!('caches' in window)) return; const cache = await caches.open(CFG.CACHE_NAME), paths = [...new Set(data.map(p => getAudioPath(p.cmd)).filter(p => p))]; let loaded = 0; ui('cacheStatus').style.display = 'block'; ui('cacheStatus').innerText = `Кэширование: 0%`; for (const path of paths) { try { const res = await fetch(path); if (res.ok) await cache.put(path, res); } catch(e) {} loaded++; ui('cacheStatus').innerText = `Кэширование: ${Math.round((loaded / paths.length) * 100)}%`; } setTimeout(() => { ui('cacheStatus').innerText = "Готов к офлайну"; setTimeout(() => ui('cacheStatus').style.display = 'none', 3000); }, 1000); };
const playCmd = async text => { const path = getAudioPath(text); if (!path) return; audio.pause(); if ('caches' in window) { const cache = await caches.open(CFG.CACHE_NAME), cached = await cache.match(path); if (cached) { audio.src = URL.createObjectURL(await cached.blob()); audio.play().catch(e => {}); return; } } audio.src = path; audio.play().catch(() => {}); };

const getIcon = (col, txt, az, isEnd, isCurr = false, hasComm = false) => {
    const key = `${col}-${txt}-${az}-${isEnd}-${isCurr}-${hasComm}`;
    if (iconCache.has(key)) return iconCache.get(key);
    const s = isEnd ? 34 : 40, c = s/2, t = txt.replace('!','');
    let strk = '#000', strkW = 1.5;
    if (isCurr && !isEnd) { strk = '#00FF00'; strkW = 2; } else if (isEnd) { strk = '#FFF'; }
    const txtCol = hasComm ? '#FF9500' : '#000';
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}"><g transform="rotate(${az},${c},${c})"><polygon points="${c},2 ${c+10},${s-5} ${c},${s-14} ${c-10},${s-5}" fill="${col}" stroke="${strk}" stroke-width="${strkW}"/></g><circle cx="${c}" cy="${c}" r="${isEnd?7:9}" fill="${col}" stroke="${strk}" stroke-width="${strkW}"/><text x="${c}" y="${c+0.5}" font-size="${isEnd?8:9}" font-family="Arial" font-weight="900" text-anchor="middle" dominant-baseline="middle" fill="${txtCol}" stroke="white" stroke-width="2" style="paint-order:stroke fill">${t}</text></svg>`;
    const url = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svg)));
    iconCache.set(key, url); return url;
};

const wake = async () => {
    if (audio.paused) { audio.src = "data:audio/wav;base64,UklGRigAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQQAAAAAAA=="; audio.play().catch(() => {}); }
    if (wl) { try { await wl.release(); } catch(e) {} wl = null; }
    if ('wakeLock' in navigator) { try { wl = await navigator.wakeLock.request('screen'); wakeWanted = true; hideWake(); } catch(e) { if (wakeWanted) showWake(); } } else if (wakeWanted) showWake();
    if (!v.src) v.src = "data:video/mp4;base64,AAAAIGZ0eXBpc29tAAACAGlzb21hdmMxbXA0MgAAAAhmcmVlAAAALm1kYXQAAAHvYXZjQwFQAFr/4AAZAWgAVv/AAB9AAAADAAIAAAMAHBDeEAEABWj/gAAAAA5ieHRyY3Rsc3RyYmMAAAALYm9vdnNoZHIAAAADbXZoZAAAAAAAAAAAAAAAAAAAA+gAAAPoAAAAAQAAAAAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACAAACAGlzb21hdmMxbXA0MgAAAAhmcmVlAAAALm1kYXQ=";
    v.play().catch(()=>{});
};
const showWake = () => { if (ui('wakeOverlay')) ui('wakeOverlay').style.display = 'flex'; };
const hideWake = () => { if (ui('wakeOverlay')) ui('wakeOverlay').style.display = 'none'; };
const tryWake = () => { showWake(); if (wakeWanted) wake(); };
['touchstart', 'click'].forEach(e => document.addEventListener(e, () => { wakeWanted = true; wake(); }));
document.addEventListener('visibilitychange', tryWake);
window.addEventListener('focus', tryWake);
if (ui('wakeBtn')) ui('wakeBtn').addEventListener('click', () => { wakeWanted = true; wake(); });
showWake();

const showError = msg => { ui('loadingText').style.display = 'none'; ui('errorMsg').style.display = 'block'; ui('errorMsg').innerText = msg; ui('routeHeaderBtn').innerText = "ОШИБКА"; };
const closeSel = () => { ui('selectionHud').classList.remove('active'); previewIndex = -1; if (currentIndex >= 0) { ui('navHud').classList.add('active'); refreshMap(); } };
const fetchAll = async username => { let all = [], page = 1; while (true) { const res = await fetch(`https://api.github.com/users/${username}/gists?per_page=100&page=${page}`); if (!res.ok) break; const data = await res.json(); if (!data.length) break; all = all.concat(data); if (data.length < 100) break; page++; } return all; };
const fetchRoute = async param => {
    const parts = param.split('-');
    if (parts.length < 2) { showError("НЕВЕРНЫЙ ФОРМАТ"); return; }
    const targetId = parts[0].trim(), clean = parts.slice(1).join('-').trim(), targetFile = clean + ".json";
    ui('routeHeaderBtn').innerText = "ПОИСК...";
    try {
        const data = await fetchAll(CFG.GITHUB_USER), gist = data.find(g => g.description?.includes(`[${targetId}]`));
        if (gist) { const file = Object.values(gist.files).find(f => f.filename.toLowerCase() === targetFile.toLowerCase()); if (file) { ui('gistDesc').innerText = gist.description || "Нет описания"; loadData(file.raw_url, clean); } else showError(`ФАЙЛ "${targetFile}" НЕ НАЙДЕН`); } else showError(`GIST "${targetId}" НЕ НАЙДЕН`);
    } catch(e) { showError("ОШИБКА GITHUB"); }
};
const loadData = async (url, name) => {
    iconCache.clear();
    try {
        const res = await fetch(url), raw = await res.json();
        pointsData = raw.map((d, i) => { const pts = d.pts || []; return { id: d.id, lat: pts[0]?.[0], lon: pts[0]?.[1], color: d.color, hex: CFG.COLORS[d.color] || '#007AFF', cmd: (d.cmd || d.comm || `Т${d.id}`).trim(), comm: d.comm || "", pts: pts, az: pts.length >= 2 ? calcAz(pts[0], pts[1]) : 0 }; });
        preloadAudio(pointsData); currentIndex = 0; previewIndex = -1;
        ui('routeHeaderBtn').innerText = name.toUpperCase(); refreshMap();
        if (pointsData.length) { const bounds = pointsCollection.getBounds(); if (bounds) map.setBounds(bounds, { zoomMargin: 60 }); }
        ui('navHud').classList.add('active'); ui('loading').classList.add('hidden');
        sendRouteReport(REPORT_CFG.BOT_TOKEN, REPORT_CFG.CHAT_ID, name, 'navigator', tgUser ? `${tgUser.first_name||''}${tgUser.last_name?` ${tgUser.last_name}`:''}`.trim() : 'Unknown', tgUser?.username ? `@${tgUser.username}` : '@none');
    } catch(e) { showError("ОШИБКА ДАННЫХ"); }
};
const refreshMap = () => {
    pointsCollection.removeAll(); linesCollection.removeAll();
    if (currentIndex < 0 || currentIndex >= pointsData.length) return;
    pointsData.forEach((p, i) => {
        if (i < currentIndex) return;
        const isCurr = i === currentIndex, isPrev = i === previewIndex, hasComm = p.comm?.trim();
        const pl = new ymaps.Placemark([p.lat, p.lon], {}, { iconLayout: 'default#image', iconImageHref: getIcon(p.hex, String(p.id), p.az, false, isCurr, hasComm), iconImageSize: [40, 40], iconImageOffset: [-20, -20], zIndex: (isCurr || isPrev) ? 1000 : 500 });
        pl.events.add('click', e => {
            if (i === currentIndex) return;
            previewIndex = i; ui('navHud').classList.remove('active'); ui('selectionHud').classList.add('active');
            ui('selIndex').innerText = i + 1; ui('selCmd').innerText = p.cmd;
            ui('selConfirmBtn').onclick = () => { currentIndex = i; previewIndex = -1; refreshMap(); wake(); };
            ui('selSpeakBtn').onclick = ev => { ev.stopPropagation(); playCmd(p.cmd); };
            if (hasComm) { ui('selCommentBtn').style.display = 'flex'; ui('selCommentBtn').onclick = ev => { ev.stopPropagation(); ui('commentText').innerText = p.comm; ui('commentOverlay').style.display = 'flex'; }; } else ui('selCommentBtn').style.display = 'none';
            refreshMap();
        });
        pointsCollection.add(pl);
        if ((isCurr || isPrev) && p.pts?.length >= 2) drawPath(p, isPrev, hasComm);
    });
    renderList(); updateHUD();
};
const drawPath = (p, isPrev, hasComm) => {
    linesCollection.add(new ymaps.Polyline(p.pts, {}, { strokeColor: p.hex, strokeWidth: isPrev ? 3 : 4, strokeOpacity: isPrev ? 0.6 : 1, outline: true, outlineColor: '#000', outlineWidth: 1.5 }));
    const last = p.pts[p.pts.length-1], prev = p.pts[p.pts.length-2];
    linesCollection.add(new ymaps.Placemark(last, {}, { iconLayout: 'default#image', iconImageSize: [34, 34], iconImageOffset: [-17, -17], iconImageHref: getIcon(p.hex, String(p.id), calcAz(prev, last), true, !isPrev, hasComm), opacity: isPrev ? 0.6 : 1, zIndex: isPrev ? 900 : 950 }));
};
const checkNav = () => {
    if (currentIndex < 0 || !lastPos || !pointsData[currentIndex]) return;
    const t = pointsData[currentIndex], d = ymaps.coordSystem.geo.getDistance(lastPos, [t.lat, t.lon]);
    let ad = Math.abs(lastAz - t.az) % 360; if (ad > 180) ad = 360 - ad;
    updateHUD(d, ad);
    if (d <= CFG.TRIGGER_DIST && ad <= CFG.AZ_TOLERANCE) { playCmd(t.cmd); currentIndex++; previewIndex = -1; if (currentIndex < pointsData.length) refreshMap(); else { ui('hudCmd').innerText = "ФИНИШ"; refreshMap(); } }
};
const updateHUD = (d, ad) => {
    const t = pointsData[currentIndex]; if (!t) return;
    ui('hudIndex').innerText = currentIndex + 1; ui('hudCmd').innerText = t.cmd; ui('hudTargetAz').innerText = `${t.az}°`;
    const hasComm = t.comm?.trim();
    if (hasComm) { ui('navCommentBtn').style.display = 'flex'; ui('navCommentBtn').onclick = ev => { ev.stopPropagation(); ui('commentText').innerText = t.comm; ui('commentOverlay').style.display = 'flex'; }; } else ui('navCommentBtn').style.display = 'none';
    ui('navSpeakBtn').onclick = ev => { ev.stopPropagation(); playCmd(t.cmd); };
    if (d !== undefined) { ui('hudDist').innerText = `${Math.round(d)}м`; ui('hudDist').classList.toggle('in-range', d <= CFG.TRIGGER_DIST); ui('hudTargetAz').classList.toggle('in-range', ad <= CFG.AZ_TOLERANCE); }
};
const renderList = () => { ui('pointsList').innerHTML = pointsData.map((p, i) => { const hasComm = p.comm?.trim(); return `<div class="point-item ${i===currentIndex?'active':''}" onclick="currentIndex=${i};previewIndex=-1;refreshMap();wake();togglePointsMenu(false);"><div class="point-badge" style="${i===currentIndex?'background:#00FF00;color:black':''}">${i+1}</div><div class="point-content"><div class="point-name">${p.cmd}</div></div><div class="point-actions">${hasComm ? `<button class="action-icon-btn comm-btn" onclick="event.stopPropagation();ui('commentText').innerText='${p.comm.replace(/'/g,"\\'")}';ui('commentOverlay').style.display='flex';"><svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/></svg></button>` : ''}<button class="action-icon-btn" onclick="event.stopPropagation();playCmd('${p.cmd.replace(/'/g,"\\'")}');"><svg viewBox="0 0 24 24"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z"/></svg></button></div></div>`; }).join(''); };

ymaps.ready(() => {
    map = new ymaps.Map("map", { center: CFG.DEFAULT_CENTER, zoom: 15, type: 'yandex#satellite', controls: [] });
    pointsCollection = new ymaps.GeoObjectCollection(); linesCollection = new ymaps.GeoObjectCollection();
    map.geoObjects.add(linesCollection).add(pointsCollection);
    userMarker = new ymaps.Placemark(CFG.DEFAULT_CENTER, {}, { iconLayout: 'default#image', iconImageSize: [40, 40], iconImageOffset: [-20, -20], zIndex: 2000 });
    map.geoObjects.add(userMarker);
    navigator.geolocation.watchPosition(p => {
        const c = [p.coords.latitude, p.coords.longitude]; currentSpeed = (p.coords.speed || 0) * 3.6;
        if (currentSpeed >= CFG.SPEED_THRESHOLD) lastAz = p.coords.heading ?? (lastPos ? calcAz(lastPos, c) : lastAz);
        lastPos = c; userMarker.geometry.setCoordinates(c);
        userMarker.options.set('iconImageHref', `data:image/svg+xml;base64,${btoa(`<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40"><g transform="rotate(${lastAz},20,20)"><path d="M20,4 L32,34 L20,28 L8,34 Z" fill="#FF3B30" stroke="white" stroke-width="2"/></g></svg>`)}`);
        ui('telSpeed').innerText = Math.round(currentSpeed); ui('telAz').innerText = `${Math.round(lastAz)}°`;
        if (autoCenter) map.panTo(c); checkNav();
    }, null, { enableHighAccuracy: true });
    map.events.add('click', () => { closeSel(); togglePointsMenu(false); toggleSettings(false); ui('gistInfoOverlay').style.display = 'none'; ui('commentOverlay').style.display = 'none'; });
    if (!startParam) showError("ПАРАМЕТР МАРШРУТА ОТСУТСТВУЕТ"); else fetchRoute(startParam);
});

['navHud', 'selectionHud'].forEach(id => { const el = ui(id); if (el) el.classList.add('active'); });
document.getElementById('cfgTrigger')?.addEventListener('input', e => { CFG.TRIGGER_DIST = Number(e.target.value); });
document.getElementById('cfgSpeed')?.addEventListener('input', e => { CFG.SPEED_THRESHOLD = Number(e.target.value); });
document.getElementById('cfgAz')?.addEventListener('input', e => { CFG.AZ_TOLERANCE = Number(e.target.value); });
const togglePointsMenu = s => { const m = ui('pointsMenu'); m.style.display = (s ?? m.style.display !== 'flex') ? 'flex' : 'none'; if (m.style.display === 'flex') { toggleSettings(false); ui('gistInfoOverlay').style.display = 'none'; ui('commentOverlay').style.display = 'none'; } };
const toggleSettings = s => { const o = ui('settingsOverlay'); o.style.display = (s ?? o.style.display !== 'flex') ? 'flex' : 'none'; if (o.style.display === 'flex') { togglePointsMenu(false); ui('gistInfoOverlay').style.display = 'none'; ui('commentOverlay').style.display = 'none'; } };
const toggleGistInfo = s => { const o = ui('gistInfoOverlay'); o.style.display = (s ?? o.style.display !== 'flex') ? 'flex' : 'none'; if (o.style.display === 'flex') { togglePointsMenu(false); toggleSettings(false); ui('commentOverlay').style.display = 'none'; } };
