// 英雄联盟适配器：实现 GameAdapter 接口，对接 LCU + Live Client Data。
const { GameAdapter } = require('./base');
const { LcuClient } = require('../lcu');
const championSelect = require('../champSelect');
const matchHistory = require('../matchHistory');
const evaluator = require('../evaluator');
const liveGame = require('../liveGame');
const advice = require('../advice');
const { getChampionName } = require('../champions');

class LolAdapter extends GameAdapter {
  constructor() {
    super();
    this.gameId = 'lol';
    this.gameName = '英雄联盟';
    this.client = new LcuClient();
  }

  connect() {
    return this.client.connect();
  }

  get connected() {
    return this.client.available;
  }

  async getPhase() {
    return championSelect.getPhase(this.client);
  }

  async getPlayers() {
    const session = await championSelect.getSession(this.client);
    if (!session) return { myTeam: [], theirTeam: [], queueId: 0 };
    return championSelect.resolvePlayers(this.client, session);
  }

  async getPlayerHistory(puuid) {
    const raw = await matchHistory.getMatchHistory(this.client, puuid);
    return matchHistory.parsePlayerStats(raw, puuid);
  }

  async getSelfHistory() {
    return matchHistory.getSelfHistory(this.client);
  }

  // 选人结束后，用 gameflow session 的 teamOne/teamTwo 补齐被隐藏的对手，并拉取其战绩。
  async enrichEnemyHistory(payload) {
    const { teamOne, teamTwo } = await championSelect.getGameflowTeams(this.client);

    // 用当前登录账号的 puuid 判断哪支是我方、哪支是对手（teamOne 只代表蓝方，不一定是己方）。
    const me = await matchHistory.getCurrentSummoner(this.client);
    const myPuuid = me && me.puuid;
    let enemyTeam = teamTwo;
    if (myPuuid) {
      const mineIsOne = teamOne.some((x) => x.puuid === myPuuid);
      enemyTeam = mineIsOne ? teamTwo : teamOne;
    }
    if (!enemyTeam || !enemyTeam.length) return false; // 数据未就绪，返回 false 供上层重试

    const used = new Set();
    for (const p of payload.theirTeam || []) {
      if (p.puuid) continue; // 已有 puuid 则跳过

      // 优先按英雄匹配；若缓存里的英雄 id 缺失，则按剩余顺序兜底。
      let match = p.championId
        ? enemyTeam.find((m) => m.championId === p.championId && !used.has(m.puuid))
        : null;
      if (!match) match = enemyTeam.find((m) => !used.has(m.puuid));
      if (!match) continue;

      used.add(match.puuid);
      p.puuid = match.puuid;
      if (!p.championId) p.championId = match.championId;
      // 补齐 championId 后同步刷新英雄名，避免对方英雄仍显示「未选择」。
      if (p.championId) p.championName = getChampionName(p.championId);
      p.hidden = false;
      try {
        const hist = await this.getPlayerHistory(match.puuid);
        p.history = hist;
        p.rating = this.evaluate(hist, { level: p.level || 0 });
        p.topChampionName = getChampionName(hist.topChampion || 0);
      } catch (e) {
        p.rating = { label: '查询失败', tier: 'unknown', score: 0, reason: '战绩查询失败' };
      }
    }
    return payload;
  }

  evaluate(stats) {
    return evaluator.evaluatePlayer(stats);
  }

  async getLiveState() {
    return liveGame.getAllGameData();
  }

  getAdvice(liveState) {
    return advice.analyzeGame(liveState);
  }

  async buildChampSelectPayload() {
    const players = await this.getPlayers();
    for (const side of ['myTeam', 'theirTeam']) {
      for (const p of players[side]) {
        p.history = null;
        p.rating = null;
        if (!p.hidden && p.puuid) {
          try {
            const hist = await this.getPlayerHistory(p.puuid);
            p.history = hist;
            p.rating = this.evaluate(hist, { level: p.level });
            p.topChampionName = getChampionName(hist.topChampion || 0);
          } catch (e) {
            p.rating = { label: '查询失败', tier: 'unknown', score: 0, reason: '战绩查询失败' };
          }
        } else if (p.hidden) {
          p.rating = { label: '已隐藏', tier: 'hidden', score: 0, reason: '玩家开启了名称隐藏' };
        } else {
          p.rating = { label: '无数据', tier: 'unknown', score: 0, reason: '无 puuid 信息' };
        }
      }
    }
    return players;
  }
}

module.exports = { LolAdapter };
