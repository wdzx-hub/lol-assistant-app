// 战绩查询：通过客户端内置 match-history 接口拉取近期对局并统计。
const { getChampionName } = require('./champions');

const MATCH_HISTORY_COUNT = parseInt(process.env.LOL_MATCH_COUNT || '10', 10);

async function getMatchHistory(client, puuid, count = MATCH_HISTORY_COUNT) {
  const path = `/lol-match-history/v1/products/lol/${puuid}/matches?begIndex=0&endIndex=${count}`;
  return client.get(path);
}

// 当前登录账号信息（含 puuid，用于从对局里定位自己）。
async function getCurrentSummoner(client) {
  try {
    return await client.get('/lol-summoner/v1/current-summoner');
  } catch (e) {
    return null;
  }
}

// 查询当前登录账号自己的近期战绩（供独立「战绩」页随时查看）。
async function getSelfHistory(client, count = MATCH_HISTORY_COUNT) {
  const me = await getCurrentSummoner(client);
  const puuid = me && me.puuid;
  const raw = await getMatchHistory(client, puuid, count);
  const stats = parsePlayerStats(raw, puuid);
  stats.summoner = me
    ? {
        name: me.displayName || me.gameName || me.internalName || '',
        level: me.summonerLevel || 0,
        puuid: puuid || '',
      }
    : null;
  return stats;
}

function parsePlayerStats(raw, puuid) {
  const games = (raw && raw.games && raw.games.games) || [];
  const total = (raw && raw.games && raw.games.gameCount) || 0;

  const stats = {
    totalGames: total,
    recentGames: 0,
    wins: 0,
    losses: 0,
    kills: 0,
    deaths: 0,
    assists: 0,
    kda: 0,
    winRate: 0,
    topChampion: 0,
    championCount: {},
    laneCount: {},
    games: [],
  };

  for (const g of games) {
    if (!g || typeof g !== 'object') continue;
    let pid = null;
    for (const ident of g.participantIdentities || []) {
      const player = ident.player || {};
      if (player.puuid === puuid) {
        pid = ident.participantId;
        break;
      }
    }
    if (pid == null) continue;

    for (const part of g.participants || []) {
      if (part.participantId !== pid) continue;
      const s = part.stats || {};
      const win = !!s.win;
      const kills = s.kills || 0;
      const deaths = s.deaths || 0;
      const assists = s.assists || 0;
      const champ = part.championId || 0;
      const lane = (part.timeline && part.timeline.lane) || '';

      stats.recentGames += 1;
      stats.kills += kills;
      stats.deaths += deaths;
      stats.assists += assists;
      if (win) stats.wins += 1;
      else stats.losses += 1;
      stats.championCount[champ] = (stats.championCount[champ] || 0) + 1;
      stats.laneCount[lane] = (stats.laneCount[lane] || 0) + 1;
      stats.games.push({
        championId: champ,
        championName: getChampionName(champ),
        win,
        kills,
        deaths,
        assists,
        lane,
        gameCreation: g.gameCreation || 0,
        gameDuration: g.gameDuration || 0,
        queueId: g.queueId || 0,
      });
      break;
    }
  }

  const played = stats.wins + stats.losses;
  if (played > 0) stats.winRate = Math.round((stats.wins / played) * 1000) / 10;
  if (stats.deaths > 0) {
    stats.kda = Math.round(((stats.kills + stats.assists) / stats.deaths) * 100) / 100;
  } else {
    stats.kda = Math.round((stats.kills + stats.assists) * 100) / 100;
  }

  const champIds = Object.keys(stats.championCount);
  if (champIds.length) {
    stats.topChampion = parseInt(
      champIds.reduce((a, b) => (stats.championCount[a] >= stats.championCount[b] ? a : b)),
      10
    );
  }

  return stats;
}

module.exports = { getMatchHistory, parsePlayerStats, getCurrentSummoner, getSelfHistory, MATCH_HISTORY_COUNT };
