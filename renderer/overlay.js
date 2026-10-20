// 悬浮提示渲染：接收主进程 overlay-live 事件并显示/隐藏提示卡片。
function escapeHtml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

window.api.onOverlayLive((msg) => {
  const card = document.getElementById('tip');
  if (!msg || !msg.visible || !msg.data || !msg.data.available) {
    card.style.display = 'none';
    return;
  }
  const d = msg.data;
  const min = Math.floor(d.gameTime / 60);
  const sec = String(Math.floor(d.gameTime % 60)).padStart(2, '0');

  document.getElementById('tip-time').textContent = `${min}:${sec}`;

  const gd = d.goldDiff;
  const kd = d.killDiff;
  document.getElementById('tip-diffs').innerHTML =
    `<span class="${gd >= 0 ? 'pos' : 'neg'}">经济 ${gd >= 0 ? '+' : ''}${gd}</span>` +
    `<span class="${kd >= 0 ? 'pos' : 'neg'}">击杀 ${kd >= 0 ? '+' : ''}${kd}</span>` +
    `<span>我方 ${d.myTeam.kills}/${d.myTeam.deaths}</span>`;

  const tf = (d.teamfightAdvice || []).slice(0, 2).map((a) => escapeHtml(a)).join('<br/>');
  const bd = (d.buildAdvice || []).slice(0, 1).map((a) => escapeHtml(a)).join('');
  document.getElementById('tip-advice').innerHTML =
    `<div class="tf">${tf}</div><div class="bd">${bd}</div>`;

  card.style.display = 'block';
});
