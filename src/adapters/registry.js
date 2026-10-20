// 适配器注册中心：开放其他游戏的接入点。
const { LolAdapter } = require('./lol');

const registry = {};

function register(adapter) {
  registry[adapter.gameId] = adapter;
  return adapter;
}

function getAdapter(gameId) {
  return registry[gameId];
}

function listAdapters() {
  return Object.values(registry).map((a) => ({ gameId: a.gameId, gameName: a.gameName }));
}

register(new LolAdapter());

module.exports = { register, getAdapter, listAdapters };
