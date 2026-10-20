// Mock 数据：无客户端时用于演示（默认启用，可用环境变量 LOL_MOCK=0 关闭）。
const { getChampionName } = require('./champions');
const { evaluatePlayer } = require('./evaluator');

// [puuid, name, level, winRate, kda, totalGames, championId, position]
const MOCK_PLAYERS = [
  ['mock-p1', '峡谷第一剑姬', 130, 58, 2.9, 820, 114, 'top'],   // 大神
  ['mock-p2', '中路杀神', 30, 71, 4.2, 96, 103, 'mid'],        // 小代
  ['mock-p3', '躺赢型选手', 200, 48, 1.9, 2100, 22, 'bottom'], // 本地人
  ['mock-p4', '我是小学生', 12, 33, 1.1, 45, 1, 'support'],    // 菜鸡
  ['mock-p5', '稳定上分', 88, 52, 2.2, 640, 64, 'jungle'],     // 本地人
  ['mock-e1', '对面打野爸爸', 25, 68, 3.8, 70, 64, 'jungle'],  // 小代
  ['mock-e2', '对面混子', 150, 47, 1.7, 1500, 22, 'top'],      // 本地人
  ['mock-e3', '对面菜鸟', 10, 30, 0.9, 30, 222, 'mid'],        // 菜鸡
  ['mock-e4', '对面稳健哥', 120, 54, 2.5, 900, 103, 'bottom'], // 本地人
  ['mock-e5', '对面辅助王', 95, 50, 2.1, 700, 53, 'support'],  // 本地人
];

// 备选英雄池：让近 10 场战绩看起来更真实（主英雄外穿插其他常用英雄）。
const ALT_CHAMPIONS = [103, 64, 22, 53, 222, 114, 24, 86];

function makeGames(winRate, kda, count, champion) {
  const wins = Math.max(0, Math.min(count, Math.round((count * winRate) / 100)));
  const now = Date.now();
  const games = [];
  for (let i = 0; i < count; i++) {
    const win = i < wins;
    const deaths = 2 + Math.floor(Math.random() * 7); // 2~8
    const kills = Math.max(0, Math.round(kda * deaths * 0.55) + (Math.random() < 0.5 ? 1 : 0));
    const assists = Math.max(0, Math.round(kda * deaths * 0.45));
    // 前 6 场用主英雄，其余穿插备选英雄，保证 topChampion 仍是主英雄
    const champ = i < 6 ? champion : ALT_CHAMPIONS[(i + champion) % ALT_CHAMPIONS.length];
    games.push({
      championId: champ,
      championName: getChampionName(champ),
      win,
      kills,
      deaths,
      assists,
      lane: '',
      gameCreation: now - (i + 1) * 86400000,
      gameDuration: (18 + Math.floor(Math.random() * 22)) * 60 + Math.floor(Math.random() * 60),
      queueId: 420,
    });
  }
  return games;
}

function makeHistory(winRate, kda, totalGames, champion) {
  const count = Math.min(totalGames, 10);
  const games = makeGames(winRate, kda, count, champion);
  let wins = 0, losses = 0, kills = 0, deaths = 0, assists = 0;
  const championCount = {};
  for (const g of games) {
    if (g.win) wins += 1; else losses += 1;
    kills += g.kills; deaths += g.deaths; assists += g.assists;
    championCount[g.championId] = (championCount[g.championId] || 0) + 1;
  }
  const realKda = deaths > 0 ? Math.round(((kills + assists) / deaths) * 100) / 100 : Math.round(kills + assists);
  return {
    totalGames,
    recentGames: count,
    wins,
    losses,
    kills,
    deaths,
    assists,
    kda: realKda,
    winRate: count > 0 ? Math.round((wins / count) * 1000) / 10 : 0,
    topChampion: champion,
    championCount,
    laneCount: { '': count },
    games,
  };
}

function getMockChampSelect() {
  const result = { myTeam: [], theirTeam: [], queueId: 420 };
  const sides = { myTeam: MOCK_PLAYERS.slice(0, 5), theirTeam: MOCK_PLAYERS.slice(5) };
  for (const side of ['myTeam', 'theirTeam']) {
    sides[side].forEach((p, idx) => {
      const [, name, level, wr, kda, total, champ, pos] = p;
      const history = makeHistory(wr, kda, total, champ);
      result[side].push({
        cellId: idx,
        championId: champ,
        championName: getChampionName(champ),
        assignedPosition: pos,
        summonerId: 1000 + idx,
        puuid: p[0],
        name,
        level,
        hidden: false,
        history,
        topChampionName: getChampionName(history.topChampion),
        rating: evaluatePlayer(history, level),
      });
    });
  }
  return result;
}

function getMockHistory(puuid) {
  const p = MOCK_PLAYERS.find((x) => x[0] === puuid);
  if (p) return makeHistory(p[3], p[4], p[5], p[6]);
  return makeHistory(50, 2.0, 500, 103);
}

function getMockLiveGame() {
  const player = (name, team, champion, level, k, d, a, cs) => ({
    championName: champion,
    team,
    level,
    isDead: false,
    summonerName: name,
    scores: { kills: k, deaths: d, assists: a, creepScore: cs },
  });
  const players = [
    player('峡谷第一剑姬', 'ORDER', '菲奥娜', 13, 5, 2, 4, 180),
    player('中路杀神', 'ORDER', '阿狸', 12, 6, 3, 5, 170),
    player('稳定上分', 'ORDER', '李青', 11, 3, 4, 9, 120),
    player('躺赢型选手', 'ORDER', '艾希', 10, 2, 5, 7, 140),
    player('我是小学生', 'ORDER', '安妮', 8, 0, 6, 3, 60),
    player('对面打野爸爸', 'CHAOS', '李青', 12, 5, 2, 5, 150),
    player('对面稳健哥', 'CHAOS', '阿狸', 11, 4, 3, 6, 140),
    player('对面混子', 'CHAOS', '艾希', 9, 1, 4, 4, 100),
    player('对面辅助王', 'CHAOS', '布里茨', 9, 1, 5, 8, 30),
    player('对面菜鸟', 'CHAOS', '金克丝', 8, 1, 7, 2, 70),
  ];
  return {
    activePlayer: { team: 'ORDER', summonerName: '峡谷第一剑姬', level: 13 },
    allPlayers: players,
    gameData: { gameTime: 18 * 60 + 42, mapName: 'Map11' },
  };
}

module.exports = { getMockChampSelect, getMockHistory, getMockLiveGame, MOCK_PLAYERS };
