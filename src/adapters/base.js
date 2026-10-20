// 其他游戏接入的统一抽象接口（开放接口）。
// 新增游戏：继承 GameAdapter 实现下列方法，并在 registry 中注册。
class GameAdapter {
  constructor() {
    this.gameId = 'generic';
    this.gameName = '通用游戏';
  }

  connect() { return false; }
  async getPhase() { return 'None'; }
  async getPlayers() { return { myTeam: [], theirTeam: [], queueId: 0 }; }
  async getPlayerHistory(playerId) { return {}; }
  evaluate(stats, extra) { return {}; }
  async getLiveState() { return null; }
  getAdvice(liveState) { return { available: false }; }
}

module.exports = { GameAdapter };
