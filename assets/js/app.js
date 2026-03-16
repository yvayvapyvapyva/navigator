// ============================================
// ГЛОБАЛЬНОЕ СОСТОЯНИЕ ПРИЛОЖЕНИЯ
// ============================================
const { byId, getUserIdentity, getTokenFromUrl, buildInitFileContent, apiRequest, getTelegramWebApp, round6 } = window.AppShared;

const APP = {
  mode: 'launcher', // launcher, catalog, editor, navigator
  token: null,
  user: getUserIdentity(),
  gistId: null,
  routes: [],
  selectedRoute: null,
  map: null,
  userMarker: null,
  autoCenter: true,
  lastPos: null,
  lastAz: 0,
  
  // Editor state
  editorPoints: [],
  editorCurFile: null,
  editorActivePoint: null,
  editorIsDrawing: false,
  editorIsAdd: false,
  
  // Navigator state
  navPoints: [],
  navCurrentIndex: -1,
  navPreviewIndex: -1,
  navAudio: new Audio(),
  navIconCache: new Map(),
  
  // Catalog
  catalogData: {
    "7292595756-m_1": "Экзаменационный маршрут Мещера 1",
    "7292595756-Razvoroty_perek_1": "Развороты на перекрестках Мещера",
    "7292595756-Ev_m1": "Э.В. Мещера 1",
    "7292595756-Ev_k1": "Э.В. Кузнечиха 1"
  }
};

const f6 = round6;
const tg = getTelegramWebApp();

const TIME_REPORT_CFG = {
  BOT_TOKEN: '7860806384:AAEYRKqdPUsUz9npN3MmyEYKH-rTHISeHbs',
  CHAT_ID: '5180466640'
};

const COLORS = {
  Gold: { hex: '#FFD700', label: 'Маневры на перекрестке' },
  Blue: { hex: '#007AFF', label: 'Разворот вне перекрестка' },
  Red: { hex: '#FF3B30', label: 'Разгон до максимальной скорости' },
  Fuchsia: { hex: '#AF52DE', label: 'Остановка и начало движения на подъем' },
  Orange: { hex: '#FF9500', label: 'Левые и правые повороты' },
  Purple: { hex: '#5856D6', label: 'Параллельная парковка и гараж' },
  Cyan: { hex: '#5AC8FA', label: 'Разворот в ограниченном пространстве' },
  Brown: { hex: '#A2845E', label: 'Остановка' },
  Lime: { hex: '#34C759', label: 'Начало движения' }
};

const COMMAND_SETS = {
  Gold: ["На перекрестке повернем налево", "На перекрестке едем прямо", "На перекрестке повернем направо", "На перекрестке выполним разворот", "На круговом движении первый съезд", "На круговом движении второй съезд", "На круговом движении третий съезд", "На круговом движении четвертый съезд", "На круговом движении выполним разворот", "На регулируемом перекрестке повернем налево", "На регулируемом перекрестке едем прямо", "На регулируемом перекрестке повернем направо", "На регулируемом перекрестке выполним разворот", "На нерегулируемом перекрестке повернем налево", "На нерегулируемом перекрестке едем прямо", "На нерегулируемом перекрестке повернем направо", "На нерегулируемом перекрестке выполним разворот", "Выполним разворот в ближайшем разрешенном месте"],
  Blue: ["Выполним разворот вне перекрестка", "Выполним разворот в ближайшем разрешенном месте", "Найдите место для разворота и развернитесь"],
  Red: ["Выполняем разгон до максимальной скорости", "Набираем максимальную скорость на данном участке дороги", "Разгоняемся до максимальной разрешенной скорости"],
  Fuchsia: ["По моей команде выполним остановку и начало движения на подъеме", "Выполняем остановку и начало движения на подъеме"],
  Orange: ["Поворачиваем направо", "Поворачиваем налево", "Далее повернем направо", "Далее повернем налево", "На светофоре повернем направо", "На светофоре повернем налево", "Поворачиваем направо к ленте", "Поворачиваем направо на заправку", "Едем в прямом направлении"],
  Purple: ["Выполняем параллельную парковку и гараж"],
  Cyan: ["Выполняем разворот в ограниченном пространстве", "Выполним разворот в ограниченном пространстве с использованием передачи заднего хода"],
  Brown: ["Выполняем остановку параллельно краю проезжей части", "Выполняем остановку в ближайшем разрешенном месте"],
  Lime: ["Начинаем движение", "Как будете готовы начинаем движение"]
};

// ============================================
// УВЕДОМЛЕНИЯ
// ============================================
function showToast(text, type = 'info', duration = 2000) {
  const existing = document.querySelector('.toast');
  if (existing) existing.remove();

  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.textContent = text;
  document.body.appendChild(el);

  requestAnimationFrame(() => {
    el.classList.add('visible');
  });

  setTimeout(() => {
    el.classList.remove('visible');
    setTimeout(() => el.remove(), 300);
  }, duration);
}

// ============================================
// МЕНЮ
// ============================================
function openMenu() {
  document.getElementById('sideMenu').classList.add('visible');
  document.getElementById('menuOverlay').classList.add('visible');
  document.body.style.overflow = 'hidden';
}

function closeMenu() {
  document.getElementById('sideMenu').classList.remove('visible');
  document.getElementById('menuOverlay').classList.remove('visible');
  document.body.style.overflow = '';
}

// ============================================
// КАРТА И ГЕОЛОКАЦИЯ
// ============================================
function getUserLocSvg(azimuth = 0) {
  return 'data:image/svg+xml;utf8,' + encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40">
      <g transform="rotate(${azimuth}, 20, 20)">
        <path d="M20,4 L32,34 L20,28 L8,34 Z" fill="#FF3B30" stroke="white" stroke-width="2"/>
      </g>
    </svg>
  `);
}

function calcAzimuth(p1, p2) {
  if (!p1 || !p2) return 0;
  const [la1, lo1] = p1.map(v => v * Math.PI / 180);
  const [la2, lo2] = p2.map(v => v * Math.PI / 180);
  const y = Math.sin(lo2 - lo1) * Math.cos(la2);
  const x = Math.cos(la1) * Math.sin(la2) - Math.sin(la1) * Math.cos(la2) * Math.cos(lo2 - lo1);
  return Math.round((Math.atan2(y, x) * 180 / Math.PI + 360) % 360);
}

function initGeolocation() {
  if (navigator.geolocation) {
    navigator.geolocation.watchPosition(
      (position) => {
        const coords = [position.coords.latitude, position.coords.longitude];
        
        if (APP.lastPos && position.coords.speed && position.coords.speed > 0) {
          APP.lastAz = calcAzimuth(APP.lastPos, coords);
        }
        APP.lastPos = coords;
        
        if (APP.userMarker) {
          APP.userMarker.geometry.setCoordinates(coords);
          APP.userMarker.options.set('visible', true);
          APP.userMarker.options.set('iconImageHref', getUserLocSvg(APP.lastAz));
        }

        const speed = (position.coords.speed || 0) * 3.6;
        const telSpeed = document.getElementById('telSpeed');
        if (telSpeed) telSpeed.textContent = Math.round(speed);

        if (APP.autoCenter && APP.map) {
          APP.map.setCenter(coords);
        }
        
        // Для навигатора
        if (APP.mode === 'navigator') {
          navCheckTriggers();
        }
      },
      (error) => console.warn('Geolocation error:', error),
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 }
    );
  }
}

function toggleAutoCenter() {
  APP.autoCenter = !APP.autoCenter;
  document.getElementById('locateBtn').classList.toggle('active', APP.autoCenter);
  
  if (APP.autoCenter && APP.lastPos) {
    APP.map.setCenter(APP.lastPos);
  }
  
  showToast(APP.autoCenter ? 'Привязка включена' : 'Привязка отключена', 'info');
}

// ============================================
// УПРАВЛЕНИЕ РЕЖИМАМИ
// ============================================
function switchMode(mode) {
  APP.mode = mode;
  
  // Скрываем все панели
  document.getElementById('launcherPanel').style.display = 'none';
  document.getElementById('catalogPanel').style.display = 'none';
  document.getElementById('editorPanel').style.display = 'none';
  document.getElementById('navigatorPanel').style.display = 'none';
  
  // Скрываем меню
  closeMenu();
  
  // Обновляем заголовок
  const titles = {
    launcher: 'Маршруты',
    catalog: 'Каталог',
    editor: 'Редактор',
    navigator: 'Навигатор'
  };
  document.getElementById('topTitle').textContent = titles[mode] || 'Меню';
  
  // Показываем нужную панель
  if (mode === 'launcher') {
    document.getElementById('launcherPanel').style.display = 'block';
    renderLauncherRoutes();
  } else if (mode === 'catalog') {
    document.getElementById('catalogPanel').style.display = 'block';
    renderCatalog();
  } else if (mode === 'editor') {
    document.getElementById('editorPanel').style.display = 'block';
  } else if (mode === 'navigator') {
    document.getElementById('navigatorPanel').style.display = 'block';
  }
}

// ============================================
// LAUNCHER - УПРАВЛЕНИЕ МАРШРУТАМИ
// ============================================
async function findUserGist() {
  let allGists = [];
  let page = 1;
  const perPage = 100;
  
  while (true) {
    const gists = await apiRequest(APP.token, `https://api.github.com/gists?per_page=${perPage}&page=${page}&t=${Date.now()}`);
    if (!gists || gists.length === 0) break;
    allGists = allGists.concat(gists);
    if (gists.length < perPage) break;
    page++;
  }

  if (!allGists) return null;
  const existing = allGists.find((g) => (g.description || '').includes(`[${APP.user.id}]`));
  return existing ? existing.id : null;
}

async function ensureUserGist() {
  if (APP.gistId) return true;

  const existingId = await findUserGist();
  if (existingId) {
    APP.gistId = existingId;
    return true;
  }

  const created = await apiRequest(APP.token, 'https://api.github.com/gists', 'POST', {
    description: `[${APP.user.id}] User: ${APP.user.name} ${APP.user.username || ''}`.trim(),
    public: true,
    files: { '.init': { content: buildInitFileContent({ source: 'launcher' }) } }
  });
  
  if (!created) return false;
  APP.gistId = created.id;
  return true;
}

async function fetchRoutes() {
  if (!APP.gistId) return [];
  const gist = await apiRequest(APP.token, `https://api.github.com/gists/${APP.gistId}?t=${Date.now()}`);
  if (!gist) return [];
  return Object.keys(gist.files || {})
    .filter((fn) => fn.endsWith('.json'))
    .sort((a, b) => a.localeCompare(b));
}

function renderLauncherRoutes() {
  const list = document.getElementById('launcherRoutesList');
  if (!list) return;
  
  if (!APP.routes.length) {
    list.innerHTML = '<div style="padding:20px;text-align:center;color:rgba(255,255,255,0.5);font-size:14px;">Маршрутов нет. Создайте первый!</div>';
    return;
  }

  list.innerHTML = APP.routes.map((file) => {
    const name = file.replace('.json', '');
    return `
      <div class="launcher-route-item" data-file="${file}">
        <span class="launcher-route-item-name">${name}</span>
        <div style="display:flex;gap:8px;">
          <button class="route-item-btn edit-btn" title="Редактировать">
            <svg viewBox="0 0 24 24"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z" fill="currentColor"/></svg>
          </button>
          <button class="route-item-btn navigate-btn" title="Навигатор">
            <svg viewBox="0 0 24 24"><path d="M12 2L4.5 20.29l.71.71L12 18l6.79 3 .71-.71z" fill="currentColor"/></svg>
          </button>
        </div>
      </div>
    `;
  }).join('');

  // Обработчики
  list.querySelectorAll('.launcher-route-item').forEach((item) => {
    const file = item.dataset.file;
    
    item.addEventListener('click', (e) => {
      if (!e.target.closest('button')) {
        APP.selectedRoute = file;
        openRouteActions();
      }
    });
    
    item.querySelector('.edit-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      APP.selectedRoute = file;
      openEditorWithRoute(file);
    });
    
    item.querySelector('.navigate-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      APP.selectedRoute = file;
      openNavigatorWithRoute(file);
    });
  });
}

// ============================================
// КАТАЛОГ
// ============================================
function renderCatalog() {
  const list = document.getElementById('catalogList');
  if (!list) return;

  list.innerHTML = Object.entries(APP.catalogData).map(([key, label]) => `
    <div class="catalog-item" data-key="${key}">
      <span class="catalog-item-name">${label}</span>
      <button class="panel-btn panel-btn-green" style="width:auto;padding:10px 16px;font-size:14px;">Запустить</button>
    </div>
  `).join('');

  list.querySelectorAll('.catalog-item').forEach((item) => {
    const key = item.dataset.key;
    const btn = item.querySelector('.panel-btn-green');
    
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      openNavigatorWithRoute(key, true);
    });
  });
}

// ============================================
// РЕДАКТОР
// ============================================
function openEditorWithRoute(file) {
  APP.selectedRoute = file;
  switchMode('editor');
  document.getElementById('editorTitle').textContent = file.replace('.json', '');
  loadEditorRoute(file);
}

async function loadEditorRoute(file) {
  if (!APP.gistId) return;
  
  const gist = await apiRequest(APP.token, `https://api.github.com/gists/${APP.gistId}?t=${Date.now()}`);
  if (!gist || !gist.files[file]) {
    showToast('Ошибка загрузки маршрута', 'error');
    return;
  }
  
  const data = JSON.parse(gist.files[file].content || '[]');
  APP.editorPoints = data;
  APP.editorCurFile = file;
  
  // Отображаем точки на карте
  renderEditorPoints();
  showToast(`Загружен: ${file.replace('.json', '')}`, 'success');
}

function renderEditorPoints() {
  // Очищаем старые точки
  if (APP.map) {
    APP.editorPoints.forEach(p => {
      if (p.placemark) APP.map.geoObjects.remove(p.placemark);
      if (p.line) APP.map.geoObjects.remove(p.line);
    });
  }
  
  APP.editorPoints = APP.editorPoints.map((p, i) => {
    p.id = i + 1;
    
    const placemark = new ymaps.Placemark(
      p.pts[0],
      {},
      {
        iconLayout: 'default#image',
        iconImageHref: getEditorIconSvg(p.color, p.id),
        iconImageSize: [40, 40],
        iconImageOffset: [-20, -20]
      }
    );
    
    const line = new ymaps.Polyline(p.pts, {}, {
      strokeColor: COLORS[p.color]?.hex || '#FFD700',
      strokeWidth: 3,
      strokeOpacity: 0.8
    });
    
    if (APP.map) {
      APP.map.geoObjects.add(placemark);
      APP.map.geoObjects.add(line);
    }
    
    return { ...p, placemark, line };
  });
}

function getEditorIconSvg(colorName, id) {
  const color = COLORS[colorName]?.hex || '#FFD700';
  return 'data:image/svg+xml;utf8,' + encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40">
      <circle cx="20" cy="20" r="12" fill="${color}" stroke="#000" stroke-width="2"/>
      <text x="20" y="24" font-size="14" font-weight="bold" text-anchor="middle" fill="#000">${id}</text>
    </svg>
  `);
}

// ============================================
// НАВИГАТОР
// ============================================
function openNavigatorWithRoute(file, isCatalog = false) {
  APP.selectedRoute = file;
  switchMode('navigator');
  loadNavigatorRoute(file, isCatalog);
}

async function loadNavigatorRoute(file, isCatalog = false) {
  let url = null;
  
  if (isCatalog) {
    // Для каталога - ищем в публичных gist
    const gistList = await fetchAllGists('yvayvapyvapyva');
    const targetGist = gistList.find(g => g.description && g.description.includes(`[${file.split('-')[0]}]`));
    if (targetGist) {
      const fileObj = Object.values(targetGist.files).find(f => f.filename.toLowerCase() === `${file}.json`.toLowerCase());
      if (fileObj) url = fileObj.raw_url;
    }
  } else {
    // Для пользовательских маршрутов
    if (!APP.gistId) return;
    const gist = await apiRequest(APP.token, `https://api.github.com/gists/${APP.gistId}?t=${Date.now()}`);
    if (gist && gist.files[file]) {
      url = gist.files[file].raw_url;
    }
  }
  
  if (!url) {
    showToast('Ошибка загрузки маршрута', 'error');
    return;
  }
  
  try {
    const res = await fetch(url);
    const raw = await res.json();
    
    APP.navPoints = raw.map((d, i) => {
      const pts = d.pts || [];
      return {
        id: d.id || (i + 1),
        lat: pts[0]?.[0],
        lon: pts[0]?.[1],
        color: d.color,
        hex: COLORS[d.color]?.hex || '#007AFF',
        cmd: (d.cmd || d.comm || `Т${i + 1}`).trim(),
        comm: d.comm || '',
        pts: pts,
        az: pts.length >= 2 ? calcAzimuth(pts[0], pts[1]) : 0
      };
    });
    
    APP.navCurrentIndex = 0;
    renderNavigatorPoints();
    updateNavHud();
    document.getElementById('navHud').classList.add('active');
    
    // Предзагрузка аудио
    preloadNavAudio();
    
    showToast('Маршрут загружен', 'success');
  } catch (e) {
    showToast('Ошибка данных', 'error');
  }
}

async function fetchAllGists(username) {
  let allGists = [];
  let page = 1;
  const perPage = 100;
  
  while (true) {
    const res = await fetch(`https://api.github.com/users/${username}/gists?per_page=${perPage}&page=${page}`);
    if (!res.ok) break;
    const data = await res.json();
    if (data.length === 0) break;
    allGists = allGists.concat(data);
    if (data.length < perPage) break;
    page++;
  }
  
  return allGists;
}

function renderNavigatorPoints() {
  // Очищаем старые
  if (APP.map) {
    APP.navPoints.forEach(p => {
      if (p.placemark) APP.map.geoObjects.remove(p.placemark);
      if (p.line) APP.map.geoObjects.remove(p.line);
    });
  }
  
  APP.navPoints = APP.navPoints.map((p, i) => {
    const isCurrent = (i === APP.navCurrentIndex);
    const hasComm = p.comm && p.comm.trim() !== '';
    
    const placemark = new ymaps.Placemark(
      [p.lat, p.lon],
      {},
      {
        iconLayout: 'default#image',
        iconImageHref: getNavIconSvg(p.hex, p.id, p.az, false, isCurrent, hasComm),
        iconImageSize: [40, 40],
        iconImageOffset: [-20, -20],
        zIndex: isCurrent ? 1000 : 500
      }
    );
    
    placemark.events.add('click', () => {
      if (i !== APP.navCurrentIndex) {
        APP.navPreviewIndex = i;
        showNavSelection(i);
      }
    });
    
    const line = p.pts && p.pts.length >= 2 ? new ymaps.Polyline(p.pts, {}, {
      strokeColor: p.hex,
      strokeWidth: isCurrent ? 4 : 3,
      strokeOpacity: isCurrent ? 1 : 0.6
    }) : null;
    
    if (APP.map) {
      APP.map.geoObjects.add(placemark);
      if (line) APP.map.geoObjects.add(line);
    }
    
    return { ...p, placemark, line };
  });
}

function getNavIconSvg(col, txt, az, isEnd, isCurr = false, hasComm = false) {
  const key = `${col}-${txt}-${az}-${isEnd}-${isCurr}-${hasComm}`;
  if (APP.navIconCache.has(key)) return APP.navIconCache.get(key);
  
  const s = isEnd ? 34 : 40;
  const c = s / 2;
  const strk = isCurr ? '#00FF00' : (isEnd ? '#FFFFFF' : '#000000');
  const textColor = hasComm ? '#FF9500' : '#000000';
  
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}">
      <g transform="rotate(${az},${c},${c})">
        <polygon points="${c},2 ${c+10},${s-5} ${c},${s-14} ${c-10},${s-5}" fill="${col}" stroke="${strk}" stroke-width="${isCurr ? 2 : 1.5}"/>
      </g>
      <circle cx="${c}" cy="${c}" r="${isEnd ? 7 : 9}" fill="${col}" stroke="${strk}" stroke-width="${isCurr ? 2 : 1.5}"/>
      <text x="${c}" y="${c+0.5}" font-size="${isEnd ? 8 : 9}" font-family="Arial" font-weight="900" text-anchor="middle" dominant-baseline="middle" fill="${textColor}" stroke="white" stroke-width="2" style="paint-order:stroke fill">${txt}</text>
    </svg>
  `;
  
  const dataUrl = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svg)));
  APP.navIconCache.set(key, dataUrl);
  return dataUrl;
}

function updateNavHud() {
  const t = APP.navPoints[APP.navCurrentIndex];
  if (!t) return;
  
  document.getElementById('hudIndex').textContent = APP.navCurrentIndex + 1;
  document.getElementById('hudCmd').textContent = t.cmd;
  document.getElementById('hudTargetAz').textContent = `${Math.round(t.az)}°`;
  
  const hasComm = t.comm && t.comm.trim() !== '';
  document.getElementById('navCommentBtn').style.display = hasComm ? 'flex' : 'none';
  
  document.getElementById('navSpeakBtn').onclick = () => {
    playNavCommand(t.cmd);
  };
  
  if (hasComm) {
    document.getElementById('navCommentBtn').onclick = () => {
      showNavComment(t.comm);
    };
  }
}

function showNavSelection(index) {
  const p = APP.navPoints[index];
  document.getElementById('hudIndex').textContent = index + 1;
  document.getElementById('hudCmd').textContent = p.cmd;
  showToast(`Точка ${index + 1}: ${p.cmd}`, 'info', 3000);
}

function showNavComment(text) {
  document.getElementById('instructionText').textContent = text;
  document.getElementById('instructionModal').style.display = 'flex';
}

async function preloadNavAudio() {
  if (!('caches' in window)) return;
  
  const cache = await caches.open('route-audio-v1');
  const uniquePaths = [...new Set(APP.navPoints.map(p => getAudioPath(p.cmd)).filter(p => p))];
  let loaded = 0;
  
  const cacheStatus = document.getElementById('cacheStatus');
  if (cacheStatus) {
    cacheStatus.style.display = 'block';
    cacheStatus.textContent = `Кэширование: 0%`;
  }
  
  for (const path of uniquePaths) {
    try {
      const response = await fetch(path);
      if (response.ok) {
        await cache.put(path, response);
      }
    } catch (e) {
      console.warn('Failed to cache:', path);
    }
    loaded++;
    if (cacheStatus) {
      cacheStatus.textContent = `Кэширование: ${Math.round((loaded / uniquePaths.length) * 100)}%`;
    }
  }
  
  setTimeout(() => {
    if (cacheStatus) {
      cacheStatus.textContent = 'Готов к офлайну';
      setTimeout(() => cacheStatus.style.display = 'none', 3000);
    }
  }, 1000);
}

function getAudioPath(text) {
  if (!text) return null;
  const normalized = text.normalize('NFC')
    .toLowerCase()
    .replace(/[.,\/#!$%\^&\*;:{}=\-`~()]/g, '')
    .trim()
    .replace(/\s+/g, '_');
  return `audio/${encodeURIComponent(normalized)}.mp3`;
}

async function playNavCommand(text) {
  const path = getAudioPath(text);
  if (!path) return;
  
  APP.navAudio.pause();
  
  if ('caches' in window) {
    const cache = await caches.open('route-audio-v1');
    const cachedResponse = await cache.match(path);
    if (cachedResponse) {
      const blob = await cachedResponse.blob();
      APP.navAudio.src = URL.createObjectURL(blob);
      APP.navAudio.play().catch(e => console.error('Cached play error', e));
      return;
    }
  }
  
  APP.navAudio.src = path;
  APP.navAudio.play().catch((err) => console.warn('Network audio play failed:', path));
}

function navCheckTriggers() {
  if (APP.navCurrentIndex < 0 || !APP.lastPos || !APP.navPoints[APP.navCurrentIndex]) return;
  
  const t = APP.navPoints[APP.navCurrentIndex];
  const d = ymaps.coordSystem.geo.getDistance(APP.lastPos, [t.lat, t.lon]);
  
  let ad = Math.abs(APP.lastAz - t.az) % 360;
  if (ad > 180) ad = 360 - ad;
  
  // Обновляем HUD с дистанцией
  const hudDist = document.getElementById('hudDist');
  const hudTargetAz = document.getElementById('hudTargetAz');
  
  if (hudDist) {
    hudDist.textContent = `${Math.round(d)}м`;
    hudDist.classList.toggle('in-range', d <= 25);
  }
  
  if (hudTargetAz) {
    hudTargetAz.classList.toggle('in-range', ad <= 45);
  }
  
  // Триггер воспроизведения
  if (d <= 25 && ad <= 45) {
    playNavCommand(t.cmd);
    APP.navCurrentIndex++;
    APP.navPreviewIndex = -1;
    
    if (APP.navCurrentIndex < APP.navPoints.length) {
      renderNavigatorPoints();
      updateNavHud();
    } else {
      document.getElementById('hudCmd').textContent = 'ФИНИШ';
      showToast('Маршрут завершён!', 'success', 5000);
    }
  }
}

// ============================================
// МОДАЛЬНЫЕ ОКНА И ДЕЙСТВИЯ
// ============================================
function openRouteActions() {
  if (!APP.selectedRoute) {
    showToast('Выберите маршрут', 'error');
    return;
  }
  document.getElementById('routeActionsModal').style.display = 'flex';
  closeMenu();
}

function closeRouteActions() {
  document.getElementById('routeActionsModal').style.display = 'none';
}

function closePointsModal() {
  document.getElementById('pointsListModal').style.display = 'none';
}

async function createRoute() {
  const name = (document.getElementById('routeNameInput').value || '').trim().replace(/[^a-zA-Z0-9_]/g, '');
  if (!name) {
    showToast('Введите название маршрута', 'error');
    return;
  }

  const gistOk = await ensureUserGist();
  if (!gistOk) {
    showToast('Ошибка подключения к GitHub', 'error');
    return;
  }

  const fileName = `${name}.json`;
  
  if (APP.routes.includes(fileName)) {
    showToast('Маршрут с таким именем уже существует', 'error');
    return;
  }

  const ok = await apiRequest(APP.token, `https://api.github.com/gists/${APP.gistId}`, 'PATCH', {
    files: { [fileName]: { content: '[]' } }
  });
  
  if (!ok) {
    showToast('Не удалось создать маршрут', 'error');
    return;
  }

  closeCreateModal();
  APP.routes = await fetchRoutes();
  renderLauncherRoutes();
  openEditorWithRoute(fileName);
}

function closeCreateModal() {
  document.getElementById('createModal').style.display = 'none';
}

async function renameRoute() {
  if (!APP.selectedRoute) return;
  
  const currentName = APP.selectedRoute.replace('.json', '');
  const nextRaw = prompt('Новое название маршрута (разрешены: a-z, 0-9, _)', currentName);
  if (nextRaw === null) return;
  
  const nextName = nextRaw.trim().replace(/[^a-zA-Z0-9_]/g, '');
  if (!nextName) {
    showToast('Некорректное имя', 'error');
    return;
  }
  
  if (nextName === currentName) return;
  
  const nextFile = `${nextName}.json`;
  if (APP.routes.includes(nextFile)) {
    showToast('Маршрут уже существует', 'error');
    return;
  }

  const gist = await apiRequest(APP.token, `https://api.github.com/gists/${APP.gistId}?t=${Date.now()}`);
  if (!gist || !gist.files || !gist.files[APP.selectedRoute]) {
    showToast('Ошибка загрузки', 'error');
    return;
  }
  
  const content = gist.files[APP.selectedRoute].content || '[]';
  const ok = await apiRequest(APP.token, `https://api.github.com/gists/${APP.gistId}`, 'PATCH', {
    files: { [APP.selectedRoute]: null, [nextFile]: { content } }
  });
  
  if (!ok) {
    showToast('Ошибка переименования', 'error');
    return;
  }

  APP.routes = await fetchRoutes();
  APP.selectedRoute = nextFile;
  renderLauncherRoutes();
  closeRouteActions();
  showToast('Переименовано', 'success');
}

async function deleteRoute() {
  if (!APP.selectedRoute) return;
  
  const routeName = APP.selectedRoute.replace('.json', '');
  if (!confirm(`Удалить маршрут "${routeName}"?`)) return;
  
  const ok = await apiRequest(APP.token, `https://api.github.com/gists/${APP.gistId}`, 'PATCH', {
    files: { [APP.selectedRoute]: null }
  });
  
  if (!ok) {
    showToast('Ошибка удаления', 'error');
    return;
  }

  APP.routes = await fetchRoutes();
  APP.selectedRoute = null;
  renderLauncherRoutes();
  closeRouteActions();
  showToast('Удалено', 'success');
}

async function copyRouteLink() {
  if (!APP.selectedRoute) return;
  
  const routeName = APP.selectedRoute.replace('.json', '');
  const link = `https://t.me/e_ia_bot/nav?startapp=${APP.user.id}-${routeName}`;
  
  let copied = false;
  try {
    await navigator.clipboard.writeText(link);
    copied = true;
  } catch (e) {
    const ta = document.createElement('textarea');
    ta.value = link;
    document.body.appendChild(ta);
    ta.select();
    copied = document.execCommand('copy');
    document.body.removeChild(ta);
  }
  
  showToast(copied ? 'Ссылка скопирована' : 'Скопируйте вручную:', 'success');
  closeRouteActions();
}

async function openInstruction() {
  try {
    const response = await fetch('instr.txt');
    const text = await response.text();
    document.getElementById('instructionText').textContent = text;
  } catch (e) {
    document.getElementById('instructionText').textContent = 'Не удалось загрузить инструкцию';
  }
  document.getElementById('instructionModal').style.display = 'flex';
  closeMenu();
}

function closeInstruction() {
  document.getElementById('instructionModal').style.display = 'none';
}

// ============================================
// ИНИЦИАЛИЗАЦИЯ
// ============================================
function initMap() {
  ymaps.ready(() => {
    if (tg) {
      tg.expand();
      if (tg.requestFullscreen) {
        try { tg.requestFullscreen(); } catch (e) {}
      }
      if (tg.setHeaderColor) tg.setHeaderColor('secondary_bg_color');
    }

    APP.map = new ymaps.Map('map', {
      center: [56.3399, 43.9332],
      zoom: 17,
      type: 'yandex#satellite',
      controls: []
    });

    APP.userMarker = new ymaps.Placemark([0, 0], {}, {
      iconLayout: 'default#image',
      iconImageHref: getUserLocSvg(0),
      iconImageSize: [40, 40],
      iconImageOffset: [-20, -20],
      zIndex: 5000,
      visible: false
    });
    APP.map.geoObjects.add(APP.userMarker);

    initGeolocation();
    document.getElementById('locateBtn').classList.add('active');
    
    document.getElementById('loadingScreen').style.display = 'none';
    
    initApp();
  });
}

async function initApp() {
  if (window.TelegramTimeReport && window.TelegramTimeReport.sendLaunchUserReport) {
    await window.TelegramTimeReport.sendLaunchUserReport(
      TIME_REPORT_CFG.BOT_TOKEN,
      TIME_REPORT_CFG.CHAT_ID,
      { telegramWebApp: tg }
    );
  }

  const urlParams = new URLSearchParams(window.location.search);
  const startParam = (tg && tg.initDataUnsafe && tg.initDataUnsafe.start_param) || urlParams.get('startapp');
  const hasTParam = urlParams.has('t');
  
  APP.token = getTokenFromUrl();
  
  if (!hasTParam) {
    if (startParam) {
      openNavigatorWithRoute(startParam);
      return;
    }
    APP.token = null;
  }
  
  if (!APP.token) {
    renderLauncherRoutes();
    return;
  }

  APP.gistId = await findUserGist();
  APP.routes = await fetchRoutes();
  renderLauncherRoutes();
  
  // Показываем секцию маршрутов в меню только если есть токен
  if (APP.gistId) {
    document.getElementById('routesSection').style.display = 'block';
  }
}

// ============================================
// ОБРАБОТЧИКИ СОБЫТИЙ
// ============================================
document.addEventListener('DOMContentLoaded', () => {
  // Кнопки меню
  document.getElementById('menuBtn').addEventListener('click', openMenu);
  document.getElementById('modeLauncherBtn').addEventListener('click', () => switchMode('launcher'));
  document.getElementById('modeCatalogBtn').addEventListener('click', () => switchMode('catalog'));
  document.getElementById('createNewBtn').addEventListener('click', () => {
    document.getElementById('createModal').style.display = 'flex';
    document.getElementById('routeNameInput').value = '';
    document.getElementById('routeNameInput').focus();
    closeMenu();
  });
  document.getElementById('instructionBtn').addEventListener('click', openInstruction);
  
  // Модальные окна
  document.getElementById('confirmCreateBtn').addEventListener('click', createRoute);
  document.getElementById('cancelCreateBtn').addEventListener('click', closeCreateModal);
  document.getElementById('instructionCloseBtn').addEventListener('click', closeInstruction);
  document.getElementById('closeActionsBtn').addEventListener('click', closeRouteActions);
  
  // Действия с маршрутом
  document.getElementById('openEditorBtn').addEventListener('click', () => {
    if (APP.selectedRoute) openEditorWithRoute(APP.selectedRoute);
  });
  document.getElementById('openNavigatorBtn').addEventListener('click', () => {
    if (APP.selectedRoute) openNavigatorWithRoute(APP.selectedRoute);
  });
  document.getElementById('renameRouteBtn').addEventListener('click', renameRoute);
  document.getElementById('copyLinkBtn').addEventListener('click', copyRouteLink);
  document.getElementById('deleteRouteBtn').addEventListener('click', deleteRoute);
  
  // Закрытие по overlay
  document.getElementById('createModal').addEventListener('click', (e) => {
    if (e.target === document.getElementById('createModal')) closeCreateModal();
  });
  document.getElementById('routeActionsModal').addEventListener('click', (e) => {
    if (e.target === document.getElementById('routeActionsModal')) closeRouteActions();
  });
  document.getElementById('instructionModal').addEventListener('click', (e) => {
    if (e.target === document.getElementById('instructionModal')) closeInstruction();
  });
  
  // Навигатор
  document.getElementById('navListBtn').addEventListener('click', () => {
    // Показать список точек
    const list = document.getElementById('pointsList');
    list.innerHTML = APP.navPoints.map((p, i) => `
      <div class="point-item ${i === APP.navCurrentIndex ? 'active' : ''}" onclick="APP.navCurrentIndex=${i};renderNavigatorPoints();updateNavHud();">
        <div class="point-badge">${i + 1}</div>
        <div class="point-content">
          <div class="point-name">${p.cmd}</div>
        </div>
      </div>
    `).join('');
    document.getElementById('pointsListModal').style.display = 'flex';
  });
  
  // Инициализация карты
  initMap();
});
