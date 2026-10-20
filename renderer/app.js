// 主窗口渲染逻辑：接收主进程推送的数据并渲染。
const ICON = (id) =>
  `https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1/champion-icons/${id}.png`;

const POS_NAME = {
  top: '上单', jungle: '打野', middle: '中单', mid: '中单',
  bottom: '下路', bot: '下路', utility: '辅助', support: '辅助', fill: '补位', '': '',
};

function el(id) { return document.getElementById(id); }

function escapeHtml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function tierClass(tier) {
  const map = { booster: 'booster', expert: 'expert', local: 'local', noob: 'noob', hidden: 'hidden', unknown: 'unknown' };
  return map[tier] || 'unknown';
}

function timeAgo(ts) {
  if (!ts) return '';
  const d = Date.now() - ts;
  if (d < 0) return '';
  const day = Math.floor(d / 86400000);
  if (day <= 0) return '今天';
  if (day === 1) return '昨天';
  return day + '天前';
}

function fmtDur(sec) {
  if (!sec) return '';
  const m = Math.floor(sec / 60);
  const s = String(Math.floor(sec % 60)).padStart(2, '0');
  return m + ':' + s;
}

// —— 语音播报：优先自然女声，只播经济差（每 2 分钟）+ 敌方关键出装 ——
let voiceEnabled = true;
let zhVoice = null;

// 优先选自然女声（晓晓/晓伊 > 瑶瑶 > 慧慧），排除男声，播报更灵动不机械。
function pickVoice() {
  if (!('speechSynthesis' in window)) return null;
  const voices = window.speechSynthesis.getVoices() || [];
  const prefer = ['xiaoxiao', 'xiaoyi', 'yaoyao', 'huihui'];
  for (const key of prefer) {
    const v = voices.find((x) => (x.name || '').toLowerCase().includes(key));
    if (v) return v;
  }
  const male = ['kangkang', 'yunxi', 'yunyang', 'zhiyong', 'yunjian'];
  return (
    voices.find(
      (x) => x.lang && x.lang.toLowerCase().startsWith('zh') && !male.some((m) => (x.name || '').toLowerCase().includes(m))
    ) || null
  );
}

function refreshVoice() {
  const v = pickVoice();
  if (v) zhVoice = v;
}
if ('speechSynthesis' in window) {
  refreshVoice();
  window.speechSynthesis.onvoiceschanged = refreshVoice;
}

function speakText(text) {
  if (!text || !('speechSynthesis' in window)) return;
  try {
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'zh-CN';
    if (zhVoice) u.voice = zhVoice;
    u.rate = 1.0;
    u.pitch = 1.0;
    window.speechSynthesis.speak(u);
  } catch (e) {}
}

// 经济差：每 2 分钟播报一次，只报经济差。
let lastGoldTime = 0;
const GOLD_INTERVAL = 120000; // 2 分钟

// 已播报过的敌方装备，避免重复；对局结束后清空，下局重新播报。
let seenEnemyItems = new Set();

function collectEnemyItemText(d) {
  const list = d.enemyItems || [];
  const fresh = [];
  for (const p of list) {
    for (const it of p.items || []) {
      const key = p.name + ':' + it.itemId;
      if (seenEnemyItems.has(key)) continue;
      seenEnemyItems.add(key);
      fresh.push(`${p.name}出了${it.name}`);
    }
  }
  return fresh;
}

function maybeGoldText(d) {
  const now = Date.now();
  if (now - lastGoldTime < GOLD_INTERVAL) return null;
  lastGoldTime = now;
  const gd = d.goldDiff || 0;
  return gd >= 0 ? `我方经济领先${gd}` : `我方经济落后${Math.abs(gd)}`;
}

function maybeSpeakLive(d) {
  if (!voiceEnabled || !d || !d.available) {
    // 对局结束后清空出装记忆，下局重新播报。
    if (d && !d.available && seenEnemyItems.size) {
      seenEnemyItems.clear();
      lastGoldTime = 0;
    }
    return;
  }

  const parts = [];

  // 敌方关键出装（新出现的）
  const items = collectEnemyItemText(d);
  if (items.length) parts.push('敌方' + items.join('，'));

  // 经济差（每 2 分钟）
  const gold = maybeGoldText(d);
  if (gold) parts.push(gold);

  if (parts.length) speakText(parts.join('；'));
}

function renderRecent(h) {
  const games = (h && h.games) || [];
  if (!games.length) return '<div class="recent-empty">暂无逐场数据</div>';
  const rows = games
    .map((g) => `
      <div class="game ${g.win ? 'win' : 'loss'}">
        <img class="g-champ" src="${ICON(g.championId)}" alt="" loading="lazy" />
        <span class="g-name">${escapeHtml(g.championName || '')}</span>
        <span class="g-kda">${g.kills}/${g.deaths}/${g.assists}</span>
        <span class="g-dur">${fmtDur(g.gameDuration)}</span>
        <span class="g-time">${timeAgo(g.gameCreation)}</span>
      </div>`)
    .join('');
  return `<div class="recent-head">近 ${games.length} 场战绩</div><div class="recent-list">${rows}</div>`;
}

// 记录已展开的玩家卡片，避免每 2 秒轮询重渲染时把展开状态重置掉。
const expandedCells = new Set();

function playerKey(side, p) {
  return side + ':' + (p.cellId != null ? p.cellId : (p.puuid || p.championId || '?'));
}

function setCardOpen(card, open) {
  const recent = card.querySelector('.recent');
  if (recent) recent.hidden = !open;
  card.classList.toggle('open', open);
  const chev = card.querySelector('.chevron');
  if (chev) chev.textContent = open ? '▴' : '▾';
}

function renderPlayer(p, side) {
  const rating = p.rating || { label: '—', tier: 'unknown', reason: '' };
  const h = p.history || null;
  const wr = h ? h.winRate + '%' : '—';
  const kda = h ? h.kda : '—';
  const posRaw = (p.assignedPosition || '').trim();
  const pos = POS_NAME[posRaw.toLowerCase()] || posRaw || '—';
  const topChamp = p.topChampionName || '';
  const sub = [pos, topChamp ? `常用: ${topChamp}` : ''].filter(Boolean).join(' · ');
  const initial = (p.championName || '?').charAt(0);
  const key = playerKey(side, p);
  const open = expandedCells.has(key);

  return `
    <div class="player ${open ? 'open' : ''}" data-expand data-key="${escapeHtml(key)}">
      <div class="player-main">
        <div class="avatar">
          <span class="avatar-fallback">${escapeHtml(initial)}</span>
          <img class="champ" src="${ICON(p.championId)}" alt="${escapeHtml(p.championName)}" loading="lazy" />
        </div>
        <div class="info">
          <div class="name">${escapeHtml(p.name || '召唤师')}</div>
          <div class="sub">${escapeHtml(sub || p.championName)}</div>
        </div>
        <span class="pos">${escapeHtml(p.championName)}</span>
        <div class="stats">
          <div>胜率 <b>${wr}</b></div>
          <div>KDA <b>${kda}</b></div>
        </div>
        <span class="badge ${tierClass(rating.tier)}" title="${escapeHtml(rating.reason)}">${escapeHtml(rating.label)}</span>
        <span class="chevron">${open ? '▴' : '▾'}</span>
      </div>
      <div class="recent" ${open ? '' : 'hidden'}>${renderRecent(h)}</div>
    </div>`;
}

function renderChampSelect(data) {
  el('my-team').innerHTML = (data.myTeam || []).map((p) => renderPlayer(p, 'my')).join('');
  el('their-team').innerHTML = (data.theirTeam || []).map((p) => renderPlayer(p, 'their')).join('');
  document.querySelectorAll('.avatar img.champ').forEach((img) => {
    img.addEventListener('error', () => img.remove());
  });
  document.querySelectorAll('.player[data-expand]').forEach((card) => {
    card.addEventListener('click', () => {
      const key = card.dataset.key;
      const willOpen = !card.classList.contains('open');
      if (willOpen) expandedCells.add(key);
      else expandedCells.delete(key);
      setCardOpen(card, willOpen);
    });
  });
  document.querySelectorAll('.game img.g-champ').forEach((img) => {
    img.addEventListener('error', () => (img.style.visibility = 'hidden'));
  });
}

function renderLive(data) {
  const box = el('live-content');
  if (!data || !data.available) {
    box.innerHTML = `<div class="card"><p class="hint">${escapeHtml((data && data.reason) || '暂无对局数据')}</p></div>`;
    return;
  }
  const gd = data.goldDiff;
  const kd = data.killDiff;
  const min = Math.floor(data.gameTime / 60);
  const sec = String(Math.floor(data.gameTime % 60)).padStart(2, '0');

  box.innerHTML = `
    <div class="card">
      <h3>对局概览</h3>
      <div class="kpis">
        <div class="kpi"><div class="label">游戏时间</div><div class="value">${min}:${sec}</div></div>
        <div class="kpi"><div class="label">经济差（我方-对方）</div><div class="value ${gd >= 0 ? 'pos' : 'neg'}">${gd >= 0 ? '+' : ''}${gd}</div></div>
        <div class="kpi"><div class="label">击杀差</div><div class="value ${kd >= 0 ? 'pos' : 'neg'}">${kd >= 0 ? '+' : ''}${kd}</div></div>
        <div class="kpi"><div class="label">我方击杀/阵亡</div><div class="value">${data.myTeam.kills}/${data.myTeam.deaths}</div></div>
        <div class="kpi"><div class="label">对方击杀/阵亡</div><div class="value">${data.theirTeam.kills}/${data.theirTeam.deaths}</div></div>
      </div>
    </div>
    <div class="card">
      <h3>打团建议</h3>
      <ul class="advice-list">${(data.teamfightAdvice || []).map((a) => `<li>${escapeHtml(a)}</li>`).join('')}</ul>
    </div>
    <div class="card">
      <h3>出装建议</h3>
      <ul class="advice-list">${(data.buildAdvice || []).map((a) => `<li class="build">${escapeHtml(a)}</li>`).join('')}</ul>
    </div>`;
}

function renderAdapters(list) {
  el('adapter-list').innerHTML = list
    .map((a) => `<li>${escapeHtml(a.gameName)}<span class="id">${escapeHtml(a.gameId)}</span></li>`)
    .join('');
}

// 主进程数据订阅
window.api.onStatus((s) => {
  el('conn-dot').className = 'dot ' + (s.connected ? 'on' : 'off');
  el('conn-text').textContent = s.connected ? '已连接客户端' : (s.mock ? 'Mock 演示模式' : '未连接客户端');
  el('phase-tag').textContent = s.phase || '—';
  el('overlay-toggle').checked = s.overlayEnabled;
});

window.api.onChampSelect((cs) => {
  renderChampSelect(cs.data || {});
  const hint = el('select-hint');
  if (cs.mock) hint.textContent = '当前为 Mock 演示数据（未检测到游戏客户端）。';
  else if (cs.phase !== 'ChampSelect') hint.textContent = `当前阶段：${cs.phase}（等待进入选人阶段…）`;
  else hint.textContent = '数据来自游戏客户端 LCU API。';
});

window.api.onLive((lv) => {
  const d = lv.data || {};
  renderLive(d);
  maybeSpeakLive(d);
});

window.api.getAdapters().then(renderAdapters);

el('overlay-toggle').addEventListener('change', (e) => {
  window.api.setOverlayEnabled(e.target.checked);
});

// Tab 切换
document.querySelectorAll('.tab').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach((b) => b.classList.remove('active'));
    document.querySelectorAll('.tab-panel').forEach((p) => p.classList.remove('active'));
    btn.classList.add('active');
    el('tab-' + btn.dataset.tab).classList.add('active');
  });
});
