// 玩家评价引擎：根据近期战绩给出「菜鸡 / 本地人 / 大神 / 小代」等标签。
// 综合 KDA 与胜率，各占 50%。
function evaluatePlayer(stats) {
  const wins = stats.wins || 0;
  const losses = stats.losses || 0;
  const played = wins + losses;
  const winRate = stats.winRate || 0;
  const kda = stats.kda || 0;

  if (played < 3) {
    return { label: '数据不足', tier: 'unknown', score: 0, reason: '近期对局过少，暂无法评价' };
  }

  // KDA 换算成百分制：以 8.0 为满分，封顶 100；与胜率各占 50% 求综合分。
  const kdaScore = Math.min((kda / 8) * 100, 100);
  const score = Math.round(kdaScore * 0.5 + winRate * 0.5);

  // 小代：综合分 > 90
  if (score > 90) {
    return { label: '小代', tier: 'booster', score, reason: `综合${score}（KDA${kda} + 胜率${winRate}%），疑似代练或小号` };
  }
  // 大神：综合分 65~90
  if (score >= 65) {
    return { label: '大神', tier: 'expert', score, reason: `综合${score}（KDA${kda} + 胜率${winRate}%）` };
  }
  // 本地人：综合分 50~65
  if (score >= 50) {
    return { label: '本地人', tier: 'local', score, reason: `综合${score}（KDA${kda} + 胜率${winRate}%）` };
  }
  // 菜鸡：综合分 < 50
  return { label: '菜鸡', tier: 'noob', score, reason: `综合${score}（KDA${kda} + 胜率${winRate}%），表现偏低` };
}

module.exports = { evaluatePlayer };
