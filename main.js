// Electron 主进程：主窗口 + 游戏内透明悬浮提示窗口 + 轮询 LCU 数据。
const { app, BrowserWindow, ipcMain, screen } = require('electron');
const path = require('path');
const { execFileSync } = require('child_process');

function isAdministrator() {
  if (process.platform !== 'win32') return true;
  try {
    execFileSync('net', ['session'], { stdio: 'ignore' });
    return true;
  } catch (e) {
    return false;
  }
}

// 国服 LCU 凭证锁在管理员进程里，普通权限读不到；非管理员时自动提权重启一次。
if (process.platform === 'win32' && !isAdministrator() && process.env.LOL_NO_ELEVATE !== '1') {
  const appPath = app.getAppPath();
  const cmd = `Start-Process -Verb RunAs -FilePath '${process.execPath}' -ArgumentList '${appPath}'`;
  try {
    execFileSync('powershell.exe', ['-NoProfile', '-Command', cmd], { stdio: 'ignore' });
  } catch (e) {}
  app.exit(0);
}

const { getAdapter, listAdapters } = require('./src/adapters/registry');
const { getMockChampSelect, getMockLiveGame } = require('./src/mock');
const { analyzeGame } = require('./src/advice');

const MOCK = process.env.LOL_MOCK !== '0';
const POLL_INTERVAL = 2000;

// 选人结束后进入的这些阶段仍属「本局进行中」，此时继续展示缓存的选人结果。
const IN_GAME_PHASES = new Set(['GameStart', 'InProgress', 'WaitingForStats', 'PreEndOfGame', 'EndOfGame']);

// 将用户数据（缓存/GPU cache 等）放到项目目录内，避免写入系统 AppData 被拦截，也便于便携运行。
// 打包后 __dirname 位于只读的 asar 内，改回系统默认 userData 目录。
if (!app.isPackaged) {
  app.setPath('userData', path.join(__dirname, '.user-data'));
}

let mainWin = null;
let overlayWin = null;
let overlayEnabled = true;
let pollTimer = null;
let polling = false;
let lastChampSelect = null; // 缓存最近一次选人结果，对局结束前不消失
let enemyEnriched = false; // 是否已在加载阶段补齐对手战绩

const lol = getAdapter('lol');

function createMainWindow() {
  mainWin = new BrowserWindow({
    width: 1120,
    height: 780,
    minWidth: 900,
    minHeight: 600,
    title: 'LOL 助手',
    backgroundColor: '#0e1117',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  mainWin.loadFile(path.join(__dirname, 'renderer', 'index.html'));
  mainWin.on('closed', () => {
    mainWin = null;
    if (overlayWin) overlayWin.close();
  });
}

function createOverlayWindow() {
  const { bounds } = screen.getPrimaryDisplay();
  overlayWin = new BrowserWindow({
    x: bounds.x,
    y: bounds.y,
    width: bounds.width,
    height: bounds.height,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    focusable: false,
    resizable: false,
    hasShadow: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      transparent: true,
    },
  });
  overlayWin.setAlwaysOnTop(true, 'screen-saver');
  overlayWin.setIgnoreMouseEvents(true, { forward: true });
  overlayWin.loadFile(path.join(__dirname, 'renderer', 'overlay.html'));
  overlayWin.on('closed', () => {
    overlayWin = null;
  });
}

async function poll() {
  if (polling) return;
  polling = true;
  try {
    await doPoll();
  } finally {
    polling = false;
  }
}

async function doPoll() {
  const connected = lol.connect();
  let phase = 'None';
  if (connected) phase = await lol.getPhase();

  const mock = !connected && MOCK;

  // 状态
  if (mainWin && !mainWin.isDestroyed()) {
    mainWin.webContents.send('status', {
      connected,
      mock,
      phase,
      gameName: '英雄联盟',
      overlayEnabled,
    });
  }

  // 选人数据
  if (connected && phase === 'ChampSelect') {
    const data = await lol.buildChampSelectPayload();
    lastChampSelect = data;
    enemyEnriched = false;
    if (mainWin) mainWin.webContents.send('champ-select', { mock: false, phase, data });
  } else if (mock) {
    lastChampSelect = null;
    enemyEnriched = false;
    if (mainWin) mainWin.webContents.send('champ-select', { mock: true, phase: 'ChampSelect', data: getMockChampSelect() });
  } else if (connected && lastChampSelect && IN_GAME_PHASES.has(phase)) {
    // 选人已结束但本局尚未结束：补齐被隐藏的对手战绩，再展示缓存。
    if (!enemyEnriched) {
      try {
        const enriched = await lol.enrichEnemyHistory(lastChampSelect);
        if (enriched) {
          lastChampSelect = enriched;
          enemyEnriched = true;
        }
      } catch (e) {
        // 补齐失败（或数据未就绪），下一轮重试
      }
    }
    if (mainWin) mainWin.webContents.send('champ-select', { mock: false, phase, data: lastChampSelect });
  } else {
    lastChampSelect = null;
    enemyEnriched = false;
    if (mainWin) mainWin.webContents.send('champ-select', { mock: false, phase, data: { myTeam: [], theirTeam: [], queueId: 0 } });
  }

  // 对局数据
  let advice;
  if (connected && phase === 'InProgress') {
    const live = await lol.getLiveState();
    advice = live
      ? lol.getAdvice(live)
      : { available: false, reason: '实时数据接口(127.0.0.1:2999)未响应：国服客户端可能未开放 Live Client Data API' };
  } else if (mock) {
    advice = analyzeGame(getMockLiveGame());
  } else {
    advice = { available: false, reason: `当前阶段: ${phase}` };
  }
  if (mainWin && !mainWin.isDestroyed()) {
    mainWin.webContents.send('live', { mock, phase, data: advice });
  }

  // 悬浮提示（游戏内 / mock 预览）
  const overlayVisible = overlayEnabled && !!(advice && advice.available);
  if (overlayWin && !overlayWin.isDestroyed()) {
    overlayWin.webContents.send('overlay-live', { visible: overlayVisible, data: advice });
  }
}

ipcMain.handle('get-adapters', () => listAdapters());
ipcMain.handle('set-overlay-enabled', (e, v) => {
  overlayEnabled = !!v;
  return overlayEnabled;
});

app.whenReady().then(() => {
  createMainWindow();
  createOverlayWindow();
  poll();
  pollTimer = setInterval(poll, POLL_INTERVAL);
});

app.on('window-all-closed', () => {
  if (pollTimer) clearInterval(pollTimer);
  app.quit();
});
