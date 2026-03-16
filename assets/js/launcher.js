const { byId, getUserIdentity, getTokenFromUrl, buildInitFileContent, apiRequest, getTg, findUserGist, ensureGist, sendLaunchReport, notify, toggleModal, expandTg } = window.AppShared;
const REPORT_CFG = { BOT_TOKEN: '7860806384:AAEYRKqdPUsUz9npN3MmyEYKH-rTHISeHbs', CHAT_ID: '5180466640' };
const state = { token: null, user: getUserIdentity(), gistId: null, routes: [], selected: null };
const ui = { loading: byId('loadingScreen'), routesScreen: byId('routesScreen'), emptyScreen: byId('emptyScreen'), createScreen: byId('createScreen'), routesSelect: byId('routesSelect'), selectedRouteLabel: byId('selectedRouteLabel'), createNewBtn: byId('createNewBtn'), emptyCreateBtn: byId('emptyCreateBtn'), routesTitle: byId('routesTitle'), routesRow: byId('routesRow'), openActions: byId('openActions'), routeSettingsBtn: byId('routeSettingsBtn'), routeSettingsModal: byId('routeSettingsModal'), closeSettingsBtn: byId('closeSettingsBtn'), instructionBtn: byId('instructionBtn'), instructionModal: byId('instructionModal'), instructionText: byId('instructionText'), instructionCloseBtn: byId('instructionCloseBtn'), openEditorBtn: byId('openEditorBtn'), openNavigatorBtn: byId('openNavigatorBtn'), renameRouteBtn: byId('renameRouteBtn'), deleteRouteBtn: byId('deleteRouteBtn'), copyLinkBtn: byId('copyLinkBtn'), routeNameInput: byId('routeNameInput'), confirmCreateBtn: byId('confirmCreateBtn'), backFromCreateBtn: byId('backFromCreateBtn') };
const getTokenParam = () => { const p = new URLSearchParams(window.location.search); return p.has('t') ? p.get('t') : null; };
const gistDesc = () => `[${state.user.id}] User: ${state.user.name} ${state.user.username || ''}`.trim();
const hideAll = () => { ui.routesScreen.style.display = 'none'; ui.emptyScreen.style.display = 'none'; ui.createScreen.style.display = 'none'; };
const showRoutes = () => { hideAll(); ui.routesScreen.style.display = 'flex'; };
const showEmpty = () => { hideAll(); ui.emptyScreen.style.display = 'flex'; };
const showCreate = () => { hideAll(); ui.createScreen.style.display = 'flex'; ui.routeNameInput.value = ''; ui.routeNameInput.focus(); };
const backCreate = () => { showRoutes(); };
const hideLoading = () => { ui.loading.style.display = 'none'; };
const fetchRoutes = async () => { if (!state.gistId) return []; const g = await apiRequest(state.token, `https://api.github.com/gists/${state.gistId}?t=${Date.now()}`); return g ? Object.keys(g.files || {}).filter(fn => fn.endsWith('.json')).sort((a, b) => a.localeCompare(b)) : []; };
const renderRoutes = () => { ui.routesSelect.innerHTML = '<option value="">Выберите маршрут</option>'; state.selected = null; ui.openActions.style.display = 'none'; if (ui.selectedRouteLabel) { ui.selectedRouteLabel.style.display = 'none'; ui.selectedRouteLabel.textContent = ''; } updateSettingsBtns(); if (!state.routes.length) return; state.routes.forEach(file => { const name = file.replace('.json', ''), op = document.createElement('option'); op.value = file; op.textContent = name; ui.routesSelect.appendChild(op); }); };
const createRoute = async () => { const name = (ui.routeNameInput.value || '').trim().replace(/[^a-zA-Z0-9_]/g, ''); if (!name) { notify('Введите название маршрута.'); return; } notify('ПОДОЖДИТЕ...', 0); const gistId = await ensureGist(state.token, state.user.id, gistDesc(), buildInitFileContent()); if (!gistId) { notify('Ошибка подключения к GitHub.'); return; } state.gistId = gistId; const fn = `${name}.json`; if (state.routes.includes(fn)) { notify('Маршрут с таким именем уже существует.'); ui.routeNameInput.focus(); return; } const ok = await apiRequest(state.token, `https://api.github.com/gists/${gistId}`, 'PATCH', { files: { [fn]: { content: '[]' } } }); if (!ok) { notify('Не удалось создать маршрут.'); return; } const t = getTokenParam(), url = new URL('editor.html', window.location.href); url.searchParams.set('route', name); if (t) url.searchParams.set('t', t); window.location.href = url.toString(); };
const renameRoute = async () => { if (!state.selected) return; const cur = state.selected.replace('.json', ''), next = prompt('Новое название маршрута (разрешены: a-z, 0-9, _)', cur)?.trim().replace(/[^a-zA-Z0-9_]/g, ''); if (!next || next === cur) { notify('Некорректное имя маршрута.'); return; } const nextFile = `${next}.json`; if (state.routes.includes(nextFile)) { notify('Маршрут с таким именем уже существует.'); return; } const g = await apiRequest(state.token, `https://api.github.com/gists/${state.gistId}?t=${Date.now()}`); if (!g?.files?.[state.selected]) { notify('Не удалось загрузить данные маршрута.'); return; } const ok = await apiRequest(state.token, `https://api.github.com/gists/${state.gistId}`, 'PATCH', { files: { [state.selected]: null, [nextFile]: { content: g.files[state.selected].content || '[]' } } }); if (!ok) { notify('Не удалось переименовать маршрут.'); return; } state.routes = await fetchRoutes(); renderRoutes(); state.selected = nextFile; ui.routesSelect.value = nextFile; ui.openActions.style.display = 'block'; if (ui.selectedRouteLabel) { ui.selectedRouteLabel.textContent = `Выбран маршрут: ${next}`; ui.selectedRouteLabel.style.display = 'block'; } notify('Маршрут переименован.'); closeSettings(); };
const deleteRoute = async () => { if (!state.selected) return; if (!confirm(`Удалить маршрут ${state.selected.replace('.json', '')}?`)) return; const ok = await apiRequest(state.token, `https://api.github.com/gists/${state.gistId}`, 'PATCH', { files: { [state.selected]: null } }); if (!ok) { notify('Не удалось удалить маршрут.'); return; } state.routes = await fetchRoutes(); if (!state.routes.length) { notify('Маршрут удалён.'); showEmpty(); return; } renderRoutes(); showRoutes(); notify('Маршрут удалён.'); closeSettings(); };
const copyLink = async () => { if (!state.selected) return; const link = `https://t.me/e_ia_bot/nav?startapp=${state.user.id}-${state.selected.replace('.json', '')}`; let copied = false; try { await navigator.clipboard.writeText(link); copied = true; } catch(e) { try { const ta = document.createElement('textarea'); ta.value = link; document.body.appendChild(ta); ta.select(); copied = document.execCommand('copy'); document.body.removeChild(ta); } catch(e2) {} } if (copied) notify('Ссылка скопирована в буфер обмена.'); else prompt('Скопируйте ссылку вручную:', link); closeSettings(); };
const openEditor = () => { if (!state.selected) return; const t = getTokenParam(), url = new URL('editor.html', window.location.href); url.searchParams.set('route', state.selected.replace('.json', '')); if (t) url.searchParams.set('t', t); window.location.href = url.toString(); };
const openNavigator = () => { if (!state.selected) return; const t = getTokenParam(), url = new URL('nav.html', window.location.href); url.searchParams.set('route', `${state.user.id}-${state.selected.replace('.json', '')}`); if (t) url.searchParams.set('t', t); window.location.href = url.toString(); };
const openSettings = () => { if (!ui.routeSettingsModal) return; updateSettingsBtns(); ui.routeSettingsModal.style.display = 'flex'; };
const closeSettings = () => { if (!ui.routeSettingsModal) return; ui.routeSettingsModal.style.display = 'none'; };
const openCatalog = () => { const t = getTokenParam(), url = new URL('katalog.html', window.location.href); if (t) url.searchParams.set('t', t); window.location.href = url.toString(); };
const updateSettingsBtns = () => { const has = !!state.selected; if (ui.renameRouteBtn) ui.renameRouteBtn.disabled = !has; if (ui.copyLinkBtn) ui.copyLinkBtn.disabled = !has; if (ui.deleteRouteBtn) ui.deleteRouteBtn.disabled = !has; };
const loadInstruction = async () => { if (!ui.instructionModal || !ui.instructionText) return; try { const res = await fetch('instr.txt'); ui.instructionText.textContent = await res.text(); } catch(e) { ui.instructionText.textContent = 'Не удалось загрузить инструкцию'; } ui.instructionModal.style.display = 'flex'; };
const closeInstruction = () => { if (!ui.instructionModal) return; ui.instructionModal.style.display = 'none'; };
const init = async () => {
    expandTg();
    await sendLaunchReport(REPORT_CFG.BOT_TOKEN, REPORT_CFG.CHAT_ID, { telegramWebApp: getTg() });
    const urlParams = new URLSearchParams(window.location.search), startParam = (getTg()?.initDataUnsafe?.start_param) || urlParams.get('startapp'), hasT = urlParams.has('t');
    state.token = getTokenFromUrl();
    if (!hasT) { window.location.href = startParam ? `nav.html?route=${encodeURIComponent(startParam)}` : 'katalog.html'; return; }
    if (ui.instructionBtn) ui.instructionBtn.style.display = 'block';
    if (!state.token) { ui.loading.textContent = 'ОШИБКА: НЕКОРРЕКТНЫЙ ПАРАМЕТР t'; return; }
    state.gistId = await findUserGist(state.token, state.user.id);
    state.routes = await fetchRoutes(); hideLoading();
    state.routes.length ? (renderRoutes(), showRoutes()) : showEmpty();
};

ui.createNewBtn.onclick = showCreate; ui.emptyCreateBtn.onclick = showCreate; ui.confirmCreateBtn.onclick = createRoute; ui.backFromCreateBtn.onclick = backCreate;
ui.openEditorBtn.onclick = openEditor; ui.openNavigatorBtn.onclick = openNavigator;
ui.renameRouteBtn.onclick = renameRoute; ui.deleteRouteBtn.onclick = deleteRoute; ui.copyLinkBtn.onclick = copyLink;
if (ui.routeSettingsBtn) ui.routeSettingsBtn.onclick = openSettings;
if (ui.routeSettingsModal) ui.routeSettingsModal.onclick = e => { if (e.target === ui.routeSettingsModal) closeSettings(); };
if (ui.closeSettingsBtn) ui.closeSettingsBtn.onclick = closeSettings;
if (ui.instructionBtn) ui.instructionBtn.onclick = loadInstruction;
if (ui.instructionCloseBtn) ui.instructionCloseBtn.onclick = closeInstruction;
if (ui.instructionModal) ui.instructionModal.onclick = e => { if (e.target === ui.instructionModal) closeInstruction(); };
document.querySelectorAll('.catalog-btn').forEach(btn => { btn.onclick = openCatalog; });
ui.routesSelect.onchange = e => { state.selected = e.target.value || null; ui.openActions.style.display = state.selected ? 'block' : 'none'; updateSettingsBtns(); if (ui.selectedRouteLabel) { if (state.selected) { ui.selectedRouteLabel.textContent = `Выбран маршрут: ${state.selected.replace('.json', '')}`; ui.selectedRouteLabel.style.display = 'block'; } else { ui.selectedRouteLabel.textContent = ''; ui.selectedRouteLabel.style.display = 'none'; } } };

init();
