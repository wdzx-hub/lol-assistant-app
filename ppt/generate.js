// 生成「LOL 助手」汇报 PPT —— 海克斯暗夜金蓝风格
const pptxgen = require('pptxgenjs');
const pres = new pptxgen();

// ============================================================
// 幻灯片尺寸常量
// ============================================================
pres.layout = 'LAYOUT_16x9';
const SLIDE_W = 10;
const SLIDE_H = 5.625;
const MARGIN = 0.5;
const CONTENT_X = MARGIN;
const CONTENT_Y = MARGIN;
const CONTENT_W = SLIDE_W - 2 * MARGIN;
const CONTENT_H = SLIDE_H - 2 * MARGIN;
const CENTER_X = SLIDE_W / 2;

// ============================================================
// 配色（LOL 海克斯暗夜金蓝）
// ============================================================
const C = {
  bg: '0A1428',        // 深蓝黑背景
  bgDeep: '050B18',    // 更深背景
  panel: '101D3A',     // 深蓝面板
  panel2: '16243F',    // 浅一档面板
  gold: 'C8AA6E',      // 海克斯金
  goldLight: 'F0E6D2', // 亮金
  goldDim: '785A28',   // 暗金
  hex: '0AC8B9',       // 海克斯青
  hexBlue: '2E8BFF',   // 海克斯蓝
  text: 'E8E6E3',      // 正文
  textDim: '9AA3B2',   // 次要
};

// ============================================================
// 字体
// ============================================================
const F_TITLE = 'SimSun';          // 中文衬线（宋体）
const F_BODY = 'Microsoft YaHei';  // 中文无衬线

// ============================================================
// 容器系统（文本溢出保护）
// ============================================================
function parseImageDimensions(path) {
  const m = path.match(/_(\d+)x(\d+)\.(png|jpg|jpeg|gif|webp)$/i);
  if (m) return { width: parseInt(m[1]), height: parseInt(m[2]) };
  return null;
}
function calculateScaledImageOpts(opts) {
  const { path, w: tW, h: tH, x = 0, y = 0, ...rest } = opts;
  if (!path || !tW || !tH) return opts;
  const d = parseImageDimensions(path);
  if (!d) return opts;
  const a = d.width / d.height, ta = tW / tH;
  let sw, sh, ox = 0, oy = 0;
  if (a > ta) { sw = tW; sh = tW / a; oy = (tH - sh) / 2; }
  else { sh = tH; sw = tH * a; ox = (tW - sw) / 2; }
  return { path, x: x + ox, y: y + oy, w: sw, h: sh, ...rest };
}
function createVirtualNode(type, data, px = 0, py = 0) {
  const opts = data.opts || {};
  const node = { type, data, absX: px + (opts.x || 0), absY: py + (opts.y || 0), w: opts.w || 0, h: opts.h || 0, children: [] };
  node.addShape = (st, o = {}) => { const c = createVirtualNode('shape', { shapeType: st, opts: o }, node.absX, node.absY); node.children.push(c); return c; };
  node.addText = (t, o = {}) => { const so = { fit: 'shrink', ...o }; const c = createVirtualNode('text', { text: t, opts: so }, node.absX, node.absY); node.children.push(c); return c; };
  node.addImage = (o = {}) => { const c = createVirtualNode('image', { opts: calculateScaledImageOpts(o) }, node.absX, node.absY); node.children.push(c); return c; };
  node.addTable = (td, o = {}) => { const c = createVirtualNode('table', { tableData: td, opts: o }, node.absX, node.absY); node.children.push(c); return c; };
  node.render = function () {};
  return node;
}
function flattenNode(n, rs, p) {
  const o = { ...n.data.opts, x: n.absX, y: n.absY };
  if (n.type === 'shape') rs.addShape(n.data.shapeType, o);
  else if (n.type === 'text') rs.addText(n.data.text, o);
  else if (n.type === 'image') rs.addImage(o);
  else if (n.type === 'table') rs.addTable(n.data.tableData, o);
  n.children.forEach((c) => flattenNode(c, rs, p));
}
const _addSlide = pres.addSlide.bind(pres);
pres.addSlide = function () {
  const rs = _addSlide();
  const vs = {
    children: [], _rs: rs,
    set background(v) { rs.background = v; },
    get background() { return rs.background; },
    addShape(st, o = {}) { const n = createVirtualNode('shape', { shapeType: st, opts: o }); this.children.push(n); return n; },
    addText(t, o = {}) { const n = createVirtualNode('text', { text: t, opts: { fit: 'shrink', ...o } }); this.children.push(n); return n; },
    addImage(o = {}) { const n = createVirtualNode('image', { opts: calculateScaledImageOpts(o) }); this.children.push(n); return n; },
    addTable(td, o = {}) { const n = createVirtualNode('table', { tableData: td, opts: o }); this.children.push(n); return n; },
    render() { this.children.forEach((c) => flattenNode(c, rs, pres)); },
  };
  return vs;
};

// ============================================================
// 装饰辅助函数
// ============================================================
function setBg(slide, color) { slide.background = { color }; }

// 金色细线
function goldLine(slide, x, y, w, width = 0.02, color = C.goldDim) {
  slide.addShape(pres.shapes.RECTANGLE, { x, y, w, h: width, fill: { color }, line: { type: 'none' } });
}
// 海克斯菱形（金色边框，可选填充）
function diamond(slide, x, y, size, fill = 'none', lineColor = C.gold, lineW = 1.2) {
  const o = { x, y, w: size, h: size, line: { color: lineColor, width: lineW } };
  o.fill = fill === 'none' ? { type: 'none' } : { color: fill };
  slide.addShape(pres.shapes.DIAMOND, o);
}
// 符文圆环
function runeRing(slide, x, y, size, color = C.goldDim, lineW = 1.2) {
  slide.addShape(pres.shapes.OVAL, { x, y, w: size, h: size, fill: { type: 'none' }, line: { color, width: lineW } });
}
// 内容页标题头
function header(slide, kicker, title) {
  diamond(slide, CONTENT_X + 0.02, 0.55, 0.22, C.gold, C.gold, 0);
  slide.addText(kicker, { x: CONTENT_X + 0.34, y: 0.42, w: 4, h: 0.3, fontFace: F_BODY, fontSize: 11, color: C.hex, bold: true, charSpacing: 1, align: 'left', valign: 'middle', fit: 'shrink' });
  slide.addText(title, { x: CONTENT_X, y: 0.74, w: CONTENT_W, h: 0.7, fontFace: F_TITLE, fontSize: 30, bold: true, color: C.goldLight, charSpacing: 1.5, align: 'left', valign: 'middle', fit: 'shrink' });
  goldLine(slide, CONTENT_X, 1.52, CONTENT_W, 0.022, C.goldDim);
}
// 卡片容器
function card(slide, x, y, w, h, opts = {}) {
  const fill = opts.fill || C.panel;
  const lineC = opts.line || C.goldDim;
  return slide.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w, h, rectRadius: 0.08, fill: { color: fill }, line: { color: lineC, width: 1 } });
}

// ============================================================
// Slide 1 封面
// ============================================================
let s = pres.addSlide();
setBg(s, C.bgDeep);
// 顶部与底部金色装饰线
goldLine(s, 0, 0.35, SLIDE_W, 0.03, C.gold);
goldLine(s, 0, SLIDE_H - 0.35, SLIDE_W, 0.03, C.gold);
// 四角海克斯菱形
diamond(s, 0.4, 0.5, 0.28, C.gold, C.gold, 0);
diamond(s, SLIDE_W - 0.68, 0.5, 0.28, C.gold, C.gold, 0);
diamond(s, 0.4, SLIDE_H - 0.78, 0.28, C.gold, C.gold, 0);
diamond(s, SLIDE_W - 0.68, SLIDE_H - 0.78, 0.28, C.gold, C.gold, 0);
// 中央符文圆环装饰
runeRing(s, CENTER_X - 1.5, 1.05, 3.0, C.goldDim, 1.4);
runeRing(s, CENTER_X - 1.15, 1.4, 2.3, C.hex, 0.9);
// 中央菱形
diamond(s, CENTER_X - 0.32, 1.62, 0.64, C.gold, C.gold, 0);
// 主标题
s.addText('LOL 助手', { x: 0, y: 2.6, w: SLIDE_W, h: 1.0, fontFace: F_TITLE, fontSize: 54, bold: true, color: C.goldLight, charSpacing: 2.5, align: 'center', valign: 'middle', fit: 'shrink' });
// 副标题
s.addText('英雄联盟对局辅助系统 · 设计与实现汇报', { x: 0, y: 3.62, w: SLIDE_W, h: 0.5, fontFace: F_BODY, fontSize: 20, color: C.text, charSpacing: 1, align: 'center', valign: 'middle', fit: 'shrink' });
// 底部信息
s.addText('Electron · LCU API · 实时战绩与语音播报', { x: 0, y: 4.35, w: SLIDE_W, h: 0.4, fontFace: F_BODY, fontSize: 13, color: C.textDim, align: 'center', valign: 'middle', fit: 'shrink' });
s.render();

// ============================================================
// Slide 2 目录
// ============================================================
s = pres.addSlide();
setBg(s, C.bg);
header(s, 'CONTENTS', '目录');
const toc = [
  { n: '01', t: '设计意图', d: '背景痛点 · 核心目标' },
  { n: '02', t: '实现原理', d: '架构 · 数据获取 · 评价算法 · 语音播报' },
  { n: '03', t: '项目部署', d: 'GitHub 仓库 · 目录结构 · 打包' },
  { n: '04', t: '视频演示', d: '实机运行效果' },
];
const tocGap = 0.4;
const tocW = (CONTENT_W - 3 * tocGap) / 4;
toc.forEach((it, i) => {
  const x = CONTENT_X + i * (tocW + tocGap);
  const c = card(s, x, 2.1, tocW, 2.6, { fill: C.panel });
  c.addText(it.n, { x: 0, y: 0.35, w: tocW, h: 0.7, fontFace: F_TITLE, fontSize: 40, bold: true, color: C.gold, charSpacing: 1.5, align: 'center', valign: 'middle', fit: 'shrink' });
  c.addShape(pres.shapes.DIAMOND, { x: tocW / 2 - 0.12, y: 1.28, w: 0.24, h: 0.24, fill: { color: C.goldDim }, line: { type: 'none' } });
  c.addText(it.t, { x: 0, y: 1.55, w: tocW, h: 0.5, fontFace: F_TITLE, fontSize: 18, bold: true, color: C.text, align: 'center', valign: 'middle', fit: 'shrink' });
  c.addText(it.d, { x: 0.18, y: 2.05, w: tocW - 0.36, h: 0.5, fontFace: F_BODY, fontSize: 10, color: C.textDim, align: 'center', valign: 'top', autoFit: false, fit: 'none' });
  c.render();
});
s.render();

// ============================================================
// Slide 3 设计意图 · 背景与痛点
// ============================================================
s = pres.addSlide();
setBg(s, C.bg);
header(s, '01 设计意图', '背景与痛点');
const pains = [
  { k: '选人盲区', t: '不了解队友与对手真实水平，无法在 BP 阶段针对性应对，选完才发现差距。' },
  { k: '信息滞后', t: '对局中需频繁切出查看经济、装备，信息滞后、操作分心。' },
  { k: '决策缺失', t: '团战与出装缺乏实时参考，劣势时不知道何时接团、该出什么装备。' },
];
const painW = (CONTENT_W - 2 * 0.4) / 3;
pains.forEach((p, i) => {
  const x = CONTENT_X + i * (painW + 0.4);
  const c = card(s, x, 2.0, painW, 2.7, { fill: C.panel });
  diamond(s, x + painW / 2 - 0.2, 2.18, 0.4, C.hex, C.hex, 0);
  c.addText(p.k, { x: 0, y: 0.85, w: painW, h: 0.5, fontFace: F_TITLE, fontSize: 20, bold: true, color: C.goldLight, align: 'center', valign: 'middle', charSpacing: 1, fit: 'shrink' });
  c.addText(p.t, { x: 0.28, y: 1.5, w: painW - 0.56, h: 1.0, fontFace: F_BODY, fontSize: 13, color: C.text, align: 'center', valign: 'top', autoFit: false, fit: 'none' });
  c.render();
});
s.render();

// ============================================================
// Slide 4 设计意图 · 核心目标
// ============================================================
s = pres.addSlide();
setBg(s, C.bg);
header(s, '01 设计意图', '核心目标');
const goals = [
  { t: '战力预判', d: '选人阶段展示双方近十场战绩与评级，一眼识别小代 / 菜鸡。' },
  { t: '实时建议', d: '对局中实时计算经济差，给出打团与出装建议。' },
  { t: '语音播报', d: '灵动女声播报关键信息，解放双眼、专注操作。' },
  { t: '悬浮提示', d: '游戏内透明悬浮窗置顶显示，不遮挡、不影响操作。' },
];
const gW = (CONTENT_W - 0.4) / 2;
const gH = 1.4;
goals.forEach((g, i) => {
  const col = i % 2, row = Math.floor(i / 2);
  const x = CONTENT_X + col * (gW + 0.4);
  const y = 1.9 + row * (gH + 0.35);
  const c = card(s, x, y, gW, gH, { fill: C.panel });
  const icon = c.addShape(pres.shapes.DIAMOND, { x: 0.25, y: 0.35, w: 0.5, h: 0.5, fill: { color: C.gold }, line: { type: 'none' } });
  icon.addText(String(i + 1), { x: 0, y: 0, w: 0.5, h: 0.5, fontFace: F_BODY, fontSize: 14, bold: true, color: C.bgDeep, align: 'center', valign: 'middle', fit: 'shrink' });
  c.addText(g.t, { x: 0.9, y: 0.18, w: gW - 1.1, h: 0.45, fontFace: F_TITLE, fontSize: 17, bold: true, color: C.goldLight, align: 'left', valign: 'middle', charSpacing: 1, fit: 'shrink' });
  c.addText(g.d, { x: 0.9, y: 0.62, w: gW - 1.15, h: 0.7, fontFace: F_BODY, fontSize: 12, color: C.text, align: 'left', valign: 'top', autoFit: false, fit: 'none' });
  c.render();
});
s.render();

// ============================================================
// Slide 5 实现原理 · 整体架构
// ============================================================
s = pres.addSlide();
setBg(s, C.bg);
header(s, '02 实现原理', '整体架构（Electron 三层）');
function archBox(x, y, w, h, title, sub, fill, tcolor) {
  const c = card(s, x, y, w, h, { fill });
  c.addText(title, { x: 0.15, y: 0.06, w: w - 0.3, h: 0.3, fontFace: F_TITLE, fontSize: 14, bold: true, color: tcolor || C.goldLight, align: 'center', valign: 'middle', charSpacing: 0.5, fit: 'shrink' });
  c.addText(sub, { x: 0.15, y: 0.38, w: w - 0.3, h: h - 0.44, fontFace: F_BODY, fontSize: 10, color: C.text, align: 'center', valign: 'middle', autoFit: false, fit: 'none' });
  return c;
}
function vArrow(x, y) {
  s.addText('▼', { x: x - 0.2, y, w: 0.4, h: 0.2, fontFace: F_BODY, fontSize: 12, color: C.hex, align: 'center', valign: 'middle', fit: 'shrink' });
}
// 数据源层
archBox(CONTENT_X, 1.7, 4.2, 0.95, '数据源', 'LCU 本地 API（HTTPS + riot:token）\nLive Client Data API（127.0.0.1:2999）', C.panel2);
archBox(CONTENT_X + 4.8, 1.7, 4.2, 0.95, '凭证提取', '国服 lockfile 为空，管理员权限读取\nLeagueClientUx.exe 进程命令行', C.panel2);
vArrow(CONTENT_X + 2.1, 2.67);
vArrow(CONTENT_X + 6.9, 2.67);
// 主进程
archBox(CONTENT_X, 2.87, 9, 0.6, '主进程 main.js', '每 2 秒轮询 → 凭证提取 → 数据分析 → 事件分发到渲染层', C.panel, C.hex);
vArrow(CONTENT_X + 4.5, 3.49);
// preload
archBox(CONTENT_X, 3.69, 9, 0.58, 'preload.js（安全桥接）', 'contextIsolation 开启，暴露受限 API', C.panel2);
vArrow(CONTENT_X + 4.5, 4.29);
// 渲染层
archBox(CONTENT_X, 4.49, 4.2, 0.62, '主窗口 renderer', '选人分析 · 对局分析 · 语音播报', C.panel);
archBox(CONTENT_X + 4.8, 4.49, 4.2, 0.62, '悬浮窗 overlay', '游戏内透明置顶提示', C.panel);
s.render();

// ============================================================
// Slide 6 实现原理 · 数据获取流程
// ============================================================
s = pres.addSlide();
setBg(s, C.bg);
header(s, '02 实现原理', '数据获取流程');
const steps = [
  { t: '提权', d: '管理员权限启动，读取 LCU 进程命令行，提取认证 token 与端口' },
  { t: '连接', d: '通过本地 HTTPS + Basic Auth（riot:token）连接 LCU API' },
  { t: '轮询', d: '每 2 秒轮询 gameflow 阶段 / 选人 session / 战绩接口' },
  { t: '局内', d: '对局中切换 Live Client Data API 获取实时对战数据' },
];
const stW = (CONTENT_W - 3 * 0.7) / 4;
const stY = 2.1;
steps.forEach((st, i) => {
  const x = CONTENT_X + i * (stW + 0.7);
  const c = card(s, x, stY, stW, 2.5, { fill: C.panel });
  const num = c.addShape(pres.shapes.OVAL, { x: stW / 2 - 0.32, y: 0.28, w: 0.64, h: 0.64, fill: { color: C.hex }, line: { type: 'none' } });
  num.addText(String(i + 1), { x: 0, y: 0, w: 0.64, h: 0.64, fontFace: F_BODY, fontSize: 16, bold: true, color: C.bgDeep, align: 'center', valign: 'middle', fit: 'shrink' });
  c.addText(st.t, { x: 0, y: 1.05, w: stW, h: 0.45, fontFace: F_TITLE, fontSize: 16, bold: true, color: C.goldLight, align: 'center', valign: 'middle', charSpacing: 1, fit: 'shrink' });
  c.addText(st.d, { x: 0.18, y: 1.55, w: stW - 0.36, h: 0.85, fontFace: F_BODY, fontSize: 11, color: C.text, align: 'center', valign: 'top', autoFit: false, fit: 'none' });
  c.render();
  if (i < steps.length - 1) {
    s.addText('▶', { x: x + stW + 0.12, y: stY + 0.95, w: 0.46, h: 0.4, fontFace: F_BODY, fontSize: 16, color: C.gold, align: 'center', valign: 'middle', fit: 'shrink' });
  }
});
// 说明
s.addText('关键点：国服 LCU 凭证被锁在管理员进程里，lockfile 为空，必须以管理员权限从进程命令行提取。', {
  x: CONTENT_X, y: 4.9, w: CONTENT_W, h: 0.4, fontFace: F_BODY, fontSize: 12, color: C.hex, italic: true, align: 'left', valign: 'middle', fit: 'shrink',
});
s.render();

// ============================================================
// Slide 7 实现原理 · 战绩评价算法
// ============================================================
s = pres.addSlide();
setBg(s, C.bg);
header(s, '02 实现原理', '战绩评价算法');
// 公式卡片
const fc = card(s, CONTENT_X, 1.85, CONTENT_W, 1.3, { fill: C.panel2 });
fc.addText('综合评分 = KDA 得分 × 50% ＋ 胜率 × 50%', { x: 0, y: 0.2, w: CONTENT_W, h: 0.55, fontFace: F_TITLE, fontSize: 22, bold: true, color: C.goldLight, align: 'center', valign: 'middle', charSpacing: 1, fit: 'shrink' });
fc.addText('KDA 得分 = min(KDA ÷ 8 × 100, 100)；近十场对局不足 3 场则判为「数据不足」', { x: 0, y: 0.78, w: CONTENT_W, h: 0.4, fontFace: F_BODY, fontSize: 12, color: C.text, align: 'center', valign: 'middle', fit: 'shrink' });
fc.render();
// 分级卡片
const tiers = [
  { label: '小代', range: '> 90', color: 'F0E6D2', bg: '3A2E12' },
  { label: '大神', range: '65 - 90', color: C.hex, bg: '0F2E33' },
  { label: '本地人', range: '50 - 65', color: '2E8BFF', bg: '0F2438' },
  { label: '菜鸡', range: '< 50', color: 'B05A5A', bg: '33171A' },
];
const tW = (CONTENT_W - 3 * 0.4) / 4;
tiers.forEach((t, i) => {
  const x = CONTENT_X + i * (tW + 0.4);
  const c = card(s, x, 3.45, tW, 1.55, { fill: t.bg, line: C.goldDim });
  c.addText(t.label, { x: 0, y: 0.2, w: tW, h: 0.55, fontFace: F_TITLE, fontSize: 22, bold: true, color: t.color, align: 'center', valign: 'middle', charSpacing: 1, fit: 'shrink' });
  c.addText(t.range, { x: 0, y: 0.85, w: tW, h: 0.5, fontFace: F_BODY, fontSize: 16, bold: true, color: C.text, align: 'center', valign: 'middle', fit: 'shrink' });
  c.render();
});
s.render();

// ============================================================
// Slide 8 实现原理 · 语音播报
// ============================================================
s = pres.addSlide();
setBg(s, C.bg);
header(s, '02 实现原理', '语音播报');
const vc = card(s, CONTENT_X, 1.85, 4.6, 3.3, { fill: C.panel });
vc.addText('Web Speech API', { x: 0.3, y: 0.3, w: 4.0, h: 0.5, fontFace: F_TITLE, fontSize: 20, bold: true, color: C.goldLight, align: 'left', valign: 'middle', charSpacing: 1, fit: 'shrink' });
vc.addText('渲染层调用 speechSynthesis，选用系统灵动中文女声，播报关键信息。', { x: 0.3, y: 0.9, w: 4.0, h: 0.8, fontFace: F_BODY, fontSize: 13, color: C.text, align: 'left', valign: 'top', autoFit: false, fit: 'none' });
vc.addShape(pres.shapes.RECTANGLE, { x: 0.3, y: 1.75, w: 4.0, h: 0.02, fill: { color: C.goldDim }, line: { type: 'none' } });
vc.addText('播报项', { x: 0.3, y: 1.9, w: 4.0, h: 0.4, fontFace: F_TITLE, fontSize: 15, bold: true, color: C.hex, align: 'left', valign: 'middle', charSpacing: 0.5, fit: 'shrink' });
const voiceItems = [
  '经济差：每 2 分钟播报一次',
  '敌方关键出装：金身 / 大件',
];
voiceItems.forEach((it, i) => {
  const y = 2.35 + i * 0.42;
  vc.addShape(pres.shapes.DIAMOND, { x: 0.32, y: y + 0.05, w: 0.16, h: 0.16, fill: { color: C.gold }, line: { type: 'none' } });
  vc.addText(it, { x: 0.6, y, w: 3.7, h: 0.35, fontFace: F_BODY, fontSize: 13, color: C.text, align: 'left', valign: 'middle', fit: 'shrink' });
});
vc.render();
// 右侧：语音要点卡片
const vr = card(s, CONTENT_X + 5.0, 1.85, 4.0, 3.3, { fill: C.panel });
vr.addText('设计要点', { x: 0.3, y: 0.3, w: 3.4, h: 0.5, fontFace: F_TITLE, fontSize: 20, bold: true, color: C.goldLight, align: 'left', valign: 'middle', charSpacing: 1, fit: 'shrink' });
const points = [
  ['专注操作', '解放双眼，不依赖视觉查看'],
  ['关键优先', '只播经济差与出装，避免信息轰炸'],
  ['自然灵动', '挑选女声，减少机器感'],
];
points.forEach((p, i) => {
  const y = 0.95 + i * 0.72;
  const ic = vr.addShape(pres.shapes.OVAL, { x: 0.32, y, w: 0.4, h: 0.4, fill: { color: C.hex }, line: { type: 'none' } });
  ic.addText('✓', { x: 0, y: 0, w: 0.4, h: 0.4, fontFace: F_BODY, fontSize: 12, bold: true, color: C.bgDeep, align: 'center', valign: 'middle', fit: 'shrink' });
  vr.addText(p[0], { x: 0.85, y: y - 0.02, w: 3.0, h: 0.35, fontFace: F_TITLE, fontSize: 14, bold: true, color: C.text, align: 'left', valign: 'middle', charSpacing: 0.5, fit: 'shrink' });
  vr.addText(p[1], { x: 0.85, y: y + 0.28, w: 2.95, h: 0.35, fontFace: F_BODY, fontSize: 11, color: C.textDim, align: 'left', valign: 'top', autoFit: false, fit: 'none' });
});
vr.render();
s.render();

// ============================================================
// Slide 9 项目部署 · GitHub
// ============================================================
s = pres.addSlide();
setBg(s, C.bg);
header(s, '03 项目部署', 'GitHub 仓库');
// 仓库地址卡片
const repo = card(s, CONTENT_X, 1.8, CONTENT_W, 0.95, { fill: C.panel2, line: C.gold });
repo.addText('github.com/wdzx-hub/lol-assistant-app', { x: 0, y: 0.15, w: CONTENT_W, h: 0.6, fontFace: F_BODY, fontSize: 18, bold: true, color: C.hex, align: 'center', valign: 'middle', charSpacing: 0.5, fit: 'shrink' });
repo.render();
// 目录结构
const dirCard = card(s, CONTENT_X, 3.0, 5.6, 2.1, { fill: C.panel });
dirCard.addText('目录结构', { x: 0.3, y: 0.2, w: 5.0, h: 0.4, fontFace: F_TITLE, fontSize: 16, bold: true, color: C.goldLight, align: 'left', valign: 'middle', charSpacing: 0.5, fit: 'shrink' });
dirCard.addText('main.js / preload.js\nsrc/  lcu.js · advice.js · evaluator.js · matchHistory.js\nrenderer/  主窗口 + 悬浮窗\ndata/  champions.json（英雄名映射）', {
  x: 0.3, y: 0.7, w: 5.0, h: 1.3, fontFace: F_BODY, fontSize: 12, color: C.text, align: 'left', valign: 'top', autoFit: false, fit: 'none', lineSpacingMultiple: 1.15,
});
dirCard.render();
// 打包卡片
const pkg = card(s, CONTENT_X + 6.0, 3.0, 3.0, 2.1, { fill: C.panel });
pkg.addText('打包分发', { x: 0.25, y: 0.2, w: 2.5, h: 0.4, fontFace: F_TITLE, fontSize: 16, bold: true, color: C.goldLight, align: 'left', valign: 'middle', charSpacing: 0.5, fit: 'shrink' });
pkg.addText('electron-builder\nNSIS 安装包\nrequireAdministrator\n管理员权限运行', { x: 0.25, y: 0.7, w: 2.5, h: 1.2, fontFace: F_BODY, fontSize: 12, color: C.text, align: 'left', valign: 'top', autoFit: false, fit: 'none', lineSpacingMultiple: 1.2 });
pkg.render();
s.render();

// ============================================================
// Slide 10 视频演示
// ============================================================
s = pres.addSlide();
setBg(s, C.bg);
header(s, '04 视频演示', '实机运行效果');
// 视频占位区
const vp = card(s, CONTENT_X, 1.85, CONTENT_W, 3.0, { fill: C.bgDeep, line: C.goldDim });
// 播放按钮（三角 + 圆）
const play = vp.addShape(pres.shapes.OVAL, { x: CONTENT_W / 2 - 0.45, y: 1.0, w: 0.9, h: 0.9, fill: { color: C.panel }, line: { color: C.gold, width: 1.5 } });
play.addText('▶', { x: 0, y: 0, w: 0.9, h: 0.9, fontFace: F_BODY, fontSize: 24, color: C.goldLight, align: 'center', valign: 'middle', fit: 'shrink' });
vp.addText('在此插入演示视频', { x: 0, y: 2.05, w: CONTENT_W, h: 0.5, fontFace: F_BODY, fontSize: 16, color: C.textDim, align: 'center', valign: 'middle', fit: 'shrink' });
vp.render();
s.addText('提示：在 PowerPoint 中，选中此页 → 插入 → 视频 → 选择你的演示视频文件即可替换占位。', {
  x: CONTENT_X, y: 5.05, w: CONTENT_W, h: 0.35, fontFace: F_BODY, fontSize: 11, color: C.textDim, italic: true, align: 'center', valign: 'middle', fit: 'shrink',
});
s.render();

// ============================================================
// Slide 11 结尾
// ============================================================
s = pres.addSlide();
setBg(s, C.bgDeep);
goldLine(s, 0, 0.4, SLIDE_W, 0.03, C.gold);
goldLine(s, 0, SLIDE_H - 0.4, SLIDE_W, 0.03, C.gold);
diamond(s, CENTER_X - 0.3, 1.3, 0.6, C.gold, C.gold, 0);
s.addText('感谢观看', { x: 0, y: 2.1, w: SLIDE_W, h: 0.9, fontFace: F_TITLE, fontSize: 44, bold: true, color: C.goldLight, align: 'center', valign: 'middle', charSpacing: 2.5, fit: 'shrink' });
s.addText('github.com/wdzx-hub/lol-assistant-app', { x: 0, y: 3.2, w: SLIDE_W, h: 0.5, fontFace: F_BODY, fontSize: 16, color: C.hex, align: 'center', valign: 'middle', charSpacing: 0.5, fit: 'shrink' });
s.addText('敬请指正 · 欢迎交流', { x: 0, y: 3.85, w: SLIDE_W, h: 0.4, fontFace: F_BODY, fontSize: 13, color: C.textDim, align: 'center', valign: 'middle', fit: 'shrink' });
s.render();

// ============================================================
// 输出
// ============================================================
pres.writeFile({ fileName: 'd:/compile_homework/LOL助手汇报.pptx' }).then(() => {
  console.log('OK: d:/compile_homework/LOL助手汇报.pptx');
});
