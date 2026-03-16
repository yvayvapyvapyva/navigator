const { byId, getUserIdentity, getTokenFromUrl, buildInitFileContent, apiRequest, getTelegramWebApp } = window.AppShared;

const state = {
  token: null,
  user: getUserIdentity(),
  gistId: null,
  routes: [],
  selected: null,
  map: null,
  userMarker: null,
  autoCenter: true,
  lastPos: null,
  lastAz: 0
};

const TIME_REPORT_CFG = {
  BOT_TOKEN: '7860806384:AAEYRKqdPUsUz9npN3MmyEYKH-rTHISeHbs',
  CHAT_ID: '5180466640'
};

// Элементы UI
const ui = {
  loading: byId('loadingScreen'),
  map: byId('map'),
  menuBtn: byId('menuBtn'),
  sideMenu: byId('sideMenu'),
  menuOverlay: byId('menuOverlay'),
  telSpeed: byId('telSpeed'),
  locateBtn: byId('locateBtn'),
  routesList: byId('routesList'),
  createNewBtn: byId('createNewBtn'),
  createModal: byId('createModal'),
  routeNameInput: byId('routeNameInput'),
  confirmCreateBtn: byId('confirmCreateBtn'),
  cancelCreateBtn: byId('cancelCreateBtn'),
  instructionBtn: byId('instructionBtn'),
  instructionModal: byId('instructionModal'),
  instructionText: byId('instructionText'),
  instructionCloseBtn: byId('instructionCloseBtn'),
  routeActionsModal: byId('routeActionsModal'),
  openEditorBtn: byId('openEditorBtn'),
  openNavigatorBtn: byId('openNavigatorBtn'),
  renameRouteBtn: byId('renameRouteBtn'),
  copyLinkBtn: byId('copyLinkBtn'),
  deleteRouteBtn: byId('deleteRouteBtn'),
  closeActionsBtn: byId('closeActionsBtn')
};

// === Уведомления ===
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

// === Меню ===
function openMenu() {
  ui.sideMenu.classList.add('visible');
  ui.menuOverlay.classList.add('visible');
  document.body.style.overflow = 'hidden';
}

function closeMenu() {
  ui.sideMenu.classList.remove('visible');
  ui.menuOverlay.classList.remove('visible');
  document.body.style.overflow = '';
}

// === Карта и геолокация ===
function getUserLocSvg(azimuth = 0) {
  return 'data:image/svg+xml;utf8,' + encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40">
      <g transform="rotate(${azimuth}, 20, 20)">
        <path d="M20,4 L32,34 L20,28 L8,34 Z" fill="#FF3B30" stroke="white" stroke-width="2"/>
      </g>
    </svg>
  `);
}

function initMap() {
  ymaps.ready(() => {
    const tg = getTelegramWebApp();
    if (tg) {
      tg.expand();
      if (tg.requestFullscreen) {
        try { tg.requestFullscreen(); } catch (e) {}
      }
      if (tg.setHeaderColor) tg.setHeaderColor('secondary_bg_color');
    }

    state.map = new ymaps.Map('map', {
      center: [56.3399, 43.9332],
      zoom: 17,
      type: 'yandex#satellite',
      controls: []
    });

    // Маркер текущего местоположения (красная стрелка)
    state.userMarker = new ymaps.Placemark([0, 0], {}, {
      iconLayout: 'default#image',
      iconImageHref: getUserLocSvg(0),
      iconImageSize: [40, 40],
      iconImageOffset: [-20, -20],
      zIndex: 5000,
      visible: false
    });
    state.map.geoObjects.add(state.userMarker);

    // Геолокация
    initGeolocation();

    // Привязка включена по умолчанию - активируем кнопку
    ui.locateBtn.classList.add('active');

    // Скрываем загрузочный экран
    hideLoading();

    // Инициализация приложения
    initApp();
  });
}

// === Меню ===
function openMenu() {
  ui.sideMenu.classList.add('visible');
  ui.menuOverlay.classList.add('visible');
  document.body.style.overflow = 'hidden';
}

function closeMenu() {
  ui.sideMenu.classList.remove('visible');
  ui.menuOverlay.classList.remove('visible');
  document.body.style.overflow = '';
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
        
        // Вычисляем азимут при движении
        if (state.lastPos && position.coords.speed && position.coords.speed > 0) {
          state.lastAz = calcAzimuth(state.lastPos, coords);
        }
        state.lastPos = coords;
        
        if (state.userMarker) {
          state.userMarker.geometry.setCoordinates(coords);
          state.userMarker.options.set('visible', true);
          // Поворачиваем стрелку по азимуту
          state.userMarker.options.set('iconImageHref', getUserLocSvg(state.lastAz));
        }

        // Обновляем скорость
        const speed = (position.coords.speed || 0) * 3.6;
        ui.telSpeed.textContent = Math.round(speed);

        // Автоцентрирование
        if (state.autoCenter && state.map) {
          state.map.setCenter(coords);
        }
      },
      (error) => {
        console.warn('Geolocation error:', error);
      },
      {
        enableHighAccuracy: true,
        maximumAge: 5000,
        timeout: 10000
      }
    );
  }
}

function toggleAutoCenter() {
  state.autoCenter = !state.autoCenter;
  ui.locateBtn.classList.toggle('active', state.autoCenter);
  
  if (state.autoCenter && state.lastPos) {
    state.map.setCenter(state.lastPos);
  }
  
  showToast(state.autoCenter ? 'Привязка к местоположению включена' : 'Привязка отключена', 'info');
}

// === Загрузка и инициализация ===
function hideLoading() {
  ui.loading.style.display = 'none';
}

async function findUserGist() {
  let allGists = [];
  let page = 1;
  const perPage = 100;
  
  while (true) {
    const gists = await apiRequest(state.token, `https://api.github.com/gists?per_page=${perPage}&page=${page}&t=${Date.now()}`);
    if (!gists || gists.length === 0) break;
    allGists = allGists.concat(gists);
    if (gists.length < perPage) break;
    page++;
  }

  if (!allGists) return null;
  const existing = allGists.find((g) => (g.description || '').includes(`[${state.user.id}]`));
  return existing ? existing.id : null;
}

async function ensureUserGist() {
  if (state.gistId) return true;

  const existingId = await findUserGist();
  if (existingId) {
    state.gistId = existingId;
    return true;
  }

  const created = await apiRequest(state.token, 'https://api.github.com/gists', 'POST', {
    description: `[${state.user.id}] User: ${state.user.name} ${state.user.username || ''}`.trim(),
    public: true,
    files: { '.init': { content: buildInitFileContent({ source: 'launcher' }) } }
  });
  
  if (!created) return false;
  state.gistId = created.id;
  return true;
}

async function fetchRoutes() {
  if (!state.gistId) return [];
  const gist = await apiRequest(state.token, `https://api.github.com/gists/${state.gistId}?t=${Date.now()}`);
  if (!gist) return [];
  return Object.keys(gist.files || {})
    .filter((fn) => fn.endsWith('.json'))
    .sort((a, b) => a.localeCompare(b));
}

function renderRoutesList() {
  ui.routesList.innerHTML = '';
  
  if (!state.routes.length) {
    ui.routesList.innerHTML = '<div style="padding:20px;text-align:center;color:rgba(255,255,255,0.5);font-size:14px;">Маршрутов нет</div>';
    return;
  }

  state.routes.forEach((file) => {
    const name = file.replace('.json', '');
    const item = document.createElement('div');
    item.className = 'route-item';
    if (state.selected === file) item.classList.add('active');
    
    item.innerHTML = `
      <span class="route-item-name">${name}</span>
      <div class="route-item-actions">
        <button class="route-item-btn edit-btn" title="Редактировать">
          <svg viewBox="0 0 24 24"><path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z" fill="currentColor"/></svg>
        </button>
        <button class="route-item-btn navigate-btn" title="Навигатор">
          <svg viewBox="0 0 24 24"><path d="M12 2L4.5 20.29l.71.71L12 18l6.79 3 .71-.71z" fill="currentColor"/></svg>
        </button>
      </div>
    `;
    
    // Клик по элементу - выбор маршрута
    item.addEventListener('click', (e) => {
      if (!e.target.closest('.route-item-btn')) {
        selectRoute(file);
      }
    });
    
    // Кнопка редактирования
    item.querySelector('.edit-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      selectRoute(file);
      openRouteActions();
      setTimeout(() => {
        openEditor();
      }, 100);
    });
    
    // Кнопка навигатора
    item.querySelector('.navigate-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      selectRoute(file);
      openRouteActions();
      setTimeout(() => {
        openNavigator();
      }, 100);
    });
    
    ui.routesList.appendChild(item);
  });
}

function selectRoute(file) {
  state.selected = file;
  renderRoutesList();
  showToast(`Выбран: ${file.replace('.json', '')}`, 'success');
}

// === Модальные окна ===
function openCreateModal() {
  ui.routeNameInput.value = '';
  ui.createModal.style.display = 'flex';
  ui.routeNameInput.focus();
  closeMenu();
}

function closeCreateModal() {
  ui.createModal.style.display = 'none';
}

function openRouteActions() {
  if (!state.selected) {
    showToast('Выберите маршрут', 'error');
    return;
  }
  ui.routeActionsModal.style.display = 'flex';
  closeMenu();
}

function closeRouteActions() {
  ui.routeActionsModal.style.display = 'none';
}

async function openInstruction() {
  try {
    const response = await fetch('instr.txt');
    const text = await response.text();
    ui.instructionText.textContent = text;
  } catch (e) {
    ui.instructionText.textContent = 'Не удалось загрузить инструкцию';
  }
  ui.instructionModal.style.display = 'flex';
  closeMenu();
}

function closeInstruction() {
  ui.instructionModal.style.display = 'none';
}

// === Действия с маршрутами ===
async function createRoute() {
  const name = (ui.routeNameInput.value || '').trim().replace(/[^a-zA-Z0-9_]/g, '');
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
  
  if (state.routes.includes(fileName)) {
    showToast('Маршрут с таким именем уже существует', 'error');
    return;
  }

  const ok = await apiRequest(state.token, `https://api.github.com/gists/${state.gistId}`, 'PATCH', {
    files: { [fileName]: { content: '[]' } }
  });
  
  if (!ok) {
    showToast('Не удалось создать маршрут', 'error');
    return;
  }

  closeCreateModal();
  state.routes = await fetchRoutes();
  renderRoutesList();
  
  // Переход в редактор
  const routeName = fileName.replace('.json', '');
  const tokenParam = getTokenParam();
  const url = new URL('editor.html', window.location.href);
  url.searchParams.set('route', routeName);
  if (tokenParam) url.searchParams.set('t', tokenParam);
  window.location.href = url.toString();
}

async function renameRoute() {
  if (!state.selected) return;
  
  const currentName = state.selected.replace('.json', '');
  const nextRaw = prompt('Новое название маршрута (разрешены: a-z, 0-9, _)', currentName);
  if (nextRaw === null) return;
  
  const nextName = nextRaw.trim().replace(/[^a-zA-Z0-9_]/g, '');
  if (!nextName) {
    showToast('Некорректное имя маршрута', 'error');
    return;
  }
  
  if (nextName === currentName) return;
  
  const nextFile = `${nextName}.json`;
  if (state.routes.includes(nextFile)) {
    showToast('Маршрут с таким именем уже существует', 'error');
    return;
  }

  const gist = await apiRequest(state.token, `https://api.github.com/gists/${state.gistId}?t=${Date.now()}`);
  if (!gist || !gist.files || !gist.files[state.selected]) {
    showToast('Не удалось загрузить данные маршрута', 'error');
    return;
  }
  
  const content = gist.files[state.selected].content || '[]';
  const ok = await apiRequest(state.token, `https://api.github.com/gists/${state.gistId}`, 'PATCH', {
    files: {
      [state.selected]: null,
      [nextFile]: { content }
    }
  });
  
  if (!ok) {
    showToast('Не удалось переименовать маршрут', 'error');
    return;
  }

  state.routes = await fetchRoutes();
  state.selected = nextFile;
  renderRoutesList();
  closeRouteActions();
  showToast('Маршрут переименован', 'success');
}

async function deleteRoute() {
  if (!state.selected) return;
  
  const routeName = state.selected.replace('.json', '');
  if (!confirm(`Удалить маршрут "${routeName}"?`)) return;
  
  const ok = await apiRequest(state.token, `https://api.github.com/gists/${state.gistId}`, 'PATCH', {
    files: { [state.selected]: null }
  });
  
  if (!ok) {
    showToast('Не удалось удалить маршрут', 'error');
    return;
  }

  state.routes = await fetchRoutes();
  state.selected = null;
  renderRoutesList();
  closeRouteActions();
  showToast('Маршрут удалён', 'success');
}

async function copyRouteLink() {
  if (!state.selected) return;
  
  const routeName = state.selected.replace('.json', '');
  const link = `https://t.me/e_ia_bot/nav?startapp=${state.user.id}-${routeName}`;
  
  let copied = false;
  try {
    await navigator.clipboard.writeText(link);
    copied = true;
  } catch (e) {
    try {
      const ta = document.createElement('textarea');
      ta.value = link;
      document.body.appendChild(ta);
      ta.select();
      copied = document.execCommand('copy');
      document.body.removeChild(ta);
    } catch (e2) {
      copied = false;
    }
  }
  
  if (copied) {
    showToast('Ссылка скопирована', 'success');
  } else {
    prompt('Скопируйте ссылку вручную:', link);
  }
  
  closeRouteActions();
}

function openEditor() {
  if (!state.selected) return;
  const routeName = state.selected.replace('.json', '');
  const tokenParam = getTokenParam();
  const url = new URL('editor.html', window.location.href);
  url.searchParams.set('route', routeName);
  if (tokenParam) url.searchParams.set('t', tokenParam);
  window.location.href = url.toString();
}

function openNavigator() {
  if (!state.selected) return;
  const routeName = state.selected.replace('.json', '');
  const tokenParam = getTokenParam();
  const navRoute = `${state.user.id}-${routeName}`;
  const url = new URL('nav.html', window.location.href);
  url.searchParams.set('route', navRoute);
  if (tokenParam) url.searchParams.set('t', tokenParam);
  window.location.href = url.toString();
}

// === Инициализация приложения ===
async function initApp() {
  const tg = getTelegramWebApp();
  
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

  state.token = getTokenFromUrl();

  if (!hasTParam) {
    if (startParam) {
      window.location.href = `nav.html?route=${encodeURIComponent(startParam)}`;
      return;
    }
    // Нет параметра t - остаёмся на главном экране, токен не требуется для просмотра
    state.token = null;
  }

  if (!state.token) {
    // Работаем без токена - только просмотр
    renderRoutesList();
    return;
  }

  // Ищем существующий гист
  state.gistId = await findUserGist();
  state.routes = await fetchRoutes();
  
  renderRoutesList();
  
  if (window.TelegramTimeReport && window.TelegramTimeReport.sendRouteLaunchReport) {
    await window.TelegramTimeReport.sendRouteLaunchReport(
      TIME_REPORT_CFG.BOT_TOKEN,
      TIME_REPORT_CFG.CHAT_ID,
      { routeName: 'launcher', userName: state.user.name, username: state.user.username, source: 'launcher', telegramWebApp: tg }
    );
  }
}

// === Обработчики событий ===
ui.menuBtn.addEventListener('click', openMenu);
ui.createNewBtn.addEventListener('click', openCreateModal);
ui.confirmCreateBtn.addEventListener('click', createRoute);
ui.cancelCreateBtn.addEventListener('click', closeCreateModal);
ui.instructionBtn.addEventListener('click', openInstruction);
ui.instructionCloseBtn.addEventListener('click', closeInstruction);
ui.openEditorBtn.addEventListener('click', openEditor);
ui.openNavigatorBtn.addEventListener('click', openNavigator);
ui.renameRouteBtn.addEventListener('click', renameRoute);
ui.copyLinkBtn.addEventListener('click', copyRouteLink);
ui.deleteRouteBtn.addEventListener('click', deleteRoute);
ui.closeActionsBtn.addEventListener('click', closeRouteActions);

// Закрытие модальных окон по клику на overlay
ui.createModal.addEventListener('click', (e) => {
  if (e.target === ui.createModal) closeCreateModal();
});

ui.routeActionsModal.addEventListener('click', (e) => {
  if (e.target === ui.routeActionsModal) closeRouteActions();
});

ui.instructionModal.addEventListener('click', (e) => {
  if (e.target === ui.instructionModal) closeInstruction();
});

// Инициализация карты
initMap();
