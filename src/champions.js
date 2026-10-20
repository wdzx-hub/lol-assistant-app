// 英雄数据加载：id -> 中文名（来自 data/champions.json，Data Dragon 生成）。
const fs = require('fs');
const path = require('path');

let cache = null;

function load() {
  if (cache) return cache;
  const p = path.join(__dirname, '..', 'data', 'champions.json');
  try {
    cache = JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch (e) {
    cache = {};
  }
  return cache;
}

function getChampionName(id) {
  if (!id) return '未选择';
  const m = load();
  return m[String(id)] || `英雄${id}`;
}

module.exports = { getChampionName, load };
