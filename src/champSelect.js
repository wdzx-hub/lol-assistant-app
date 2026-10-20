// 选人（Champion Select）阶段：检测阶段、解析队友与对手。
// 对手名字可能因「主播模式 / Riot 反窥探策略」被隐藏，需降级处理。
const { getChampionName } = require('./champions');

async function getPhase(client) {
  try {
    return (await client.get('/lol-gameflow/v1/gameflow-phase')) || 'None';
  } catch (e) {
    return 'None';
  }
}

async function getSession(client) {
  try {
    return await client.get('/lol-champ-select/v1/session');
  } catch (e) {
    return null;
  }
}

// 选人阶段结束后，gameflow session 会返回 10 人（含被隐藏的对方）的 puuid + championId。
async function getGameflowSession(client) {
  try {
    return await client.get('/lol-gameflow/v1/session');
  } catch (e) {
    return null;
  }
}

// teamOne / teamTwo 明确区分敌我两队，每队含 puuid + championId，用于补齐被隐藏的对方。
async function getGameflowTeams(client) {
  const session = await getGameflowSession(client);
  const gameData = (session && session.gameData) || {};
  return {
    teamOne: gameData.teamOne || [],
    teamTwo: gameData.teamTwo || [],
  };
}

async function getSummoner(client, id) {
  try {
    return await client.get(`/lol-summoner/v1/summoners/${id}`);
  } catch (e) {
    return null;
  }
}

async function resolveOne(client, member) {
  const sid = member.summonerId || 0;
  let puuid = member.puuid || '';
  let name = '';
  let level = 0;
  let hidden = false;

  if (sid && sid > 0) {
    const info = await getSummoner(client, sid);
    if (info) {
      puuid = info.puuid || puuid;
      name = info.displayName || info.gameName || '';
      level = info.summonerLevel || 0;
    }
  }

  const nameVisibility = member.nameVisibilityType || '';
  if (!name && !puuid && nameVisibility) hidden = true;

  return {
    cellId: member.cellId,
    championId: member.championId || 0,
    championName: getChampionName(member.championId || 0),
    assignedPosition: member.assignedPosition || '',
    summonerId: sid,
    puuid,
    name,
    level,
    hidden,
  };
}

async function resolvePlayers(client, session) {
  const result = { myTeam: [], theirTeam: [], queueId: session.queueId || 0 };
  for (const side of ['myTeam', 'theirTeam']) {
    for (const member of session[side] || []) {
      if (member && typeof member === 'object') {
        result[side].push(await resolveOne(client, member));
      }
    }
  }
  return result;
}

module.exports = { getPhase, getSession, getSummoner, getGameflowSession, getGameflowTeams, resolvePlayers };
