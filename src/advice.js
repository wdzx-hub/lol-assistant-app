// 对局分析与建议引擎：基于实时数据给出打团 / 出装建议（规则式）。
// 国服 Live Client Data 差异：
//   1) activePlayer 无 team 字段，需用 summonerName/riotId 在 allPlayers 里定位自己；
//   2) championName 是中文称号且可能乱码，改用 rawChampionName 里的英文内部名判断伤害类型。

// 英文内部名（rawChampionName 中 game_character_displayname_ 之后）-> 伤害类型。
const CHAMP_TYPE = {
  // 法术输出为主
  Ahri: 'AP', Akali: 'AP', Annie: 'AP', Anivia: 'AP', AurelionSol: 'AP', Azir: 'AP',
  Brand: 'AP', Cassiopeia: 'AP', Diana: 'AP', Elise: 'AP', Evelynn: 'AP',
  Fiddlesticks: 'AP', Fizz: 'AP', Galio: 'AP', Heimerdinger: 'AP', Karma: 'AP',
  Karthus: 'AP', Kassadin: 'AP', Katarina: 'AP', Kennen: 'AP', Leblanc: 'AP',
  Lillia: 'AP', Lissandra: 'AP', Lulu: 'AP', Lux: 'AP', Malzahar: 'AP',
  Morgana: 'AP', Neeko: 'AP', Nidalee: 'AP', Orianna: 'AP', Rumble: 'AP',
  Ryze: 'AP', Seraphine: 'AP', Swain: 'AP', Sylas: 'AP', Syndra: 'AP',
  Taliyah: 'AP', TwistedFate: 'AP', Veigar: 'AP', Velkoz: 'AP', Vex: 'AP',
  Viktor: 'AP', Vladimir: 'AP', Xerath: 'AP', Ziggs: 'AP', Zoe: 'AP', Zyra: 'AP',
  // 物理输出为主
  Aatrox: 'AD', Akshan: 'AD', Ashe: 'AD', Caitlyn: 'AD', Corki: 'AD',
  Darius: 'AD', Draven: 'AD', Ezreal: 'AD', Fiora: 'AD', Gangplank: 'AD',
  Garen: 'AD', Graves: 'AD', Hecarim: 'AD', Irelia: 'AD', JarvanIV: 'AD',
  Jax: 'AD', Jayce: 'AD', Jhin: 'AD', Jinx: 'AD', Kalista: 'AD',
  Kayn: 'AD', Khazix: 'AD', Kled: 'AD', LeeSin: 'AD', Lucian: 'AD',
  MasterYi: 'AD', Nasus: 'AD', Nocturne: 'AD', Olaf: 'AD', Pantheon: 'AD',
  Pyke: 'AD', Quinn: 'AD', Renekton: 'AD', Rengar: 'AD', Riven: 'AD',
  Samira: 'AD', Senna: 'AD', Sett: 'AD', Shaco: 'AD', Sivir: 'AD',
  Sion: 'AD', Talon: 'AD', Teemo: 'AD', Tristana: 'AD', Tryndamere: 'AD',
  Twitch: 'AD', Udyr: 'AD', Urgot: 'AD', Varus: 'AD', Vayne: 'AD',
  Vi: 'AD', Warwick: 'AD', Wukong: 'AD', Xayah: 'AD', XinZhao: 'AD',
  Yasuo: 'AD', Yone: 'AD', Yorick: 'AD', Zed: 'AD',
};

// 从 allPlayers 元素提取英文内部名，如 TahmKench。
function champKey(p) {
  const raw = p && p.rawChampionName ? p.rawChampionName : '';
  const m = raw.match(/game_character_displayname_([A-Za-z0-9]+)/);
  return m ? m[1] : '';
}

// 值得播报的关键装备（金身/保命装 + 主流成装）：itemID -> 中文名。
const ITEM_NAME = {
  // 保命 / 金身类（重点关注）
  2420: '秒表',
  3157: '中娅沙漏',
  3026: '守护天使',
  3139: '水银弯刀',
  // 物理成装
  3031: '无尽之刃',
  3078: '三相之力',
  3072: '饮血剑',
  3074: '贪欲九头蛇',
  3153: '破败王者之刃',
  3046: '幻影之舞',
  3085: '卢安娜的飓风',
  3094: '疾射火炮',
  3036: '多米尼克领主的致意',
  3053: '斯特拉克的挑战护手',
  3071: '黑色切割者',
  3124: '鬼索的狂暴之刃',
  // 法术成装
  3089: '灭世者的死亡之帽',
  3100: '巫妖之祸',
  3135: '虚空之杖',
  3116: '瑞莱的冰晶节杖',
  3115: '纳什之牙',
  3165: '莫雷洛秘典',
  3151: '兰德里的苦楚',
  3102: '女妖面纱',
  3146: '海克斯科技火箭腰带',
  3285: '卢登的回声',
  // 防装 / 坦克
  3068: '日炎圣盾',
  3075: '荆棘之甲',
  3083: '狂徒铠甲',
  3065: '振奋盔甲',
  3143: '兰顿之兆',
  3001: '深渊面具',
  3110: '冰霜之心',
  3156: '玛莫提乌斯之噬',
  3107: '救赎',
};

// 用于语音播报的英雄名：优先取中文名（过滤乱码），失败则退回英文内部名。
function enemyDisplayName(p) {
  const cn = (p.championName || '').trim();
  if (cn) {
    const clean = cn.replace(/[^\u4e00-\u9fa5A-Za-z0-9· ]/g, '');
    if (clean) return clean.split(/\s+/).pop();
  }
  return champKey(p) || '敌方英雄';
}

// 提取敌方当前的关键出装（大件 / 金身），供语音播报。
function extractEnemyItems(players, myTeam) {
  const result = [];
  for (const p of players) {
    if (p.team === myTeam) continue;
    const items = (p.items || [])
      .filter((it) => ITEM_NAME[it.itemID])
      .map((it) => ({ itemId: it.itemID, name: ITEM_NAME[it.itemID] }));
    if (!items.length) continue;
    result.push({ name: enemyDisplayName(p), items });
  }
  return result;
}

// —— 打野露头检测已移除 ——

function approxGold(player) {
  const scores = player.scores || {};
  const cs = scores.creepScore || 0;
  const kills = scores.kills || 0;
  const assists = scores.assists || 0;
  return Math.round(cs * 22 + kills * 300 + assists * 150);
}

function sideStats(players, team) {
  const members = players.filter((p) => p.team === team);
  const kills = members.reduce((s, p) => s + ((p.scores || {}).kills || 0), 0);
  const deaths = members.reduce((s, p) => s + ((p.scores || {}).deaths || 0), 0);
  const assists = members.reduce((s, p) => s + ((p.scores || {}).assists || 0), 0);
  const gold = members.reduce((s, p) => s + approxGold(p), 0);
  const level = members.length
    ? Math.round((members.reduce((s, p) => s + (p.level || 0), 0) / members.length) * 10) / 10
    : 0;
  return { kills, deaths, assists, gold, level, count: members.length };
}

function analyzeGame(data) {
  if (!data) return { available: false, reason: '未获取到对局数据' };

  const players = data.allPlayers || [];
  const gameTime = (data.gameData && data.gameData.gameTime) || 0;
  const active = data.activePlayer || {};

  // 国服 activePlayer 无 team，用召唤师名/riotId 定位自己所在队伍。
  let myTeam = active.team;
  if (!myTeam) {
    const me = players.find(
      (p) => p.summonerName === active.summonerName || p.riotId === active.riotId
    );
    myTeam = me ? me.team : '';
  }

  const order = sideStats(players, 'ORDER');
  const chaos = sideStats(players, 'CHAOS');
  let mine, theirs;
  if (myTeam === 'ORDER') { mine = order; theirs = chaos; }
  else if (myTeam === 'CHAOS') { mine = chaos; theirs = order; }
  else { mine = order; theirs = chaos; }

  const goldDiff = mine.gold - theirs.gold;
  const killDiff = mine.kills - theirs.kills;

  const teamfight = [];
  if (gameTime < 10 * 60) teamfight.push('对线期：优先补刀发育，别急着打团。');
  if (goldDiff >= 3000) teamfight.push('经济领先，可抱团推进/控小龙与先锋，主动开团扩大优势。');
  else if (goldDiff <= -3000) teamfight.push('经济落后，避免正面团，清线发育、抓单，等对方失误。');
  else if (Math.abs(goldDiff) <= 1500) teamfight.push('均势局：优先做视野、控小龙，抓对方落单再打。');
  else teamfight.push('小优/小劣：以资源交换为主，别打无把握的团。');
  if (mine.deaths > theirs.deaths + 5) teamfight.push('我方阵亡偏多，稳住节奏，避免频繁开团。');

  const build = [];
  const enemyPlayers = players.filter((p) => p.team !== myTeam);
  const enemyItems = extractEnemyItems(players, myTeam);
  const ap = enemyPlayers.filter((p) => CHAMP_TYPE[champKey(p)] === 'AP').length;
  const ad = enemyPlayers.filter((p) => CHAMP_TYPE[champKey(p)] === 'AD').length;
  if (ap >= 3) build.push('对方法术输出多，建议补魔抗（自然之力/女妖面纱/水银鞋）。');
  else if (ad >= 3) build.push('对方物理输出多，建议补护甲（荆棘之甲/亡者的板甲/护甲鞋）。');
  else build.push('对方伤害均衡，按对线英雄补对应抗性装。');
  if (mine.deaths >= 6 && goldDiff < 0) build.push('阵亡较多，优先补生存/保命装。');
  if (goldDiff > 0) build.push('顺风可继续出核心输出装，快速成型滚雪球。');

  return {
    available: true,
    gameTime: Math.round(gameTime),
    myTeam: mine,
    theirTeam: theirs,
    goldDiff,
    killDiff,
    teamfightAdvice: teamfight,
    buildAdvice: build,
    enemyItems,
  };
}

module.exports = { analyzeGame, CHAMP_TYPE };
