# LOL 游戏辅助器（桌面应用版）

基于 **Electron + LCU API** 的桌面应用，功能：

1. **选人阶段**读取队友与对手信息并拉取近期战绩；
2. 根据战绩给出评价：**菜鸡 / 本地人 / 小代**（附「大神 / 数据不足 / 已隐藏」）；
3. **对局中**读取实时数据，给出**打团建议**与**出装建议**；
4. **游戏内悬浮提示**：不切出游戏，透明置顶窗口直接叠在游戏画面上显示建议；
5. 预留**其他游戏接入接口**（`GameAdapter` 抽象 + 注册中心）。

## 借鉴的开源项目

| 模块 | 借鉴 |
| --- | --- |
| LCU 连接 / 桌面架构 | [LyticalApp/Lytical](https://github.com/LyticalApp/Lytical)（支持国服 WeGame）、[Hanxven/LeagueAkari](https://github.com/Hanxven/LeagueAkari) |
| LCU 接口文档 | [KebsCS/lcu-and-riotclient-api](https://github.com/KebsCS/lcu-and-riotclient-api) |
| 英雄静态数据 | Data Dragon / Community Dragon |

本实现为轻量自研版：复用上述开源项目的**接口原理**，用 Electron + 原生 JS 重写核心逻辑，便于作业讲解与二次开发。

## 运行

```powershell
cd d:\compile_homework\lol-assistant-app
npm.cmd install
npm.cmd start
```

> 若 `npm` 被 PowerShell 执行策略拦截，请使用 `npm.cmd`（如上）或
> `Set-ExecutionPolicy -Scope Process Bypass` 后再运行。

## 使用说明

- **连接客户端**：启动英雄联盟客户端后，程序自动读取 `lockfile` 接入 LCU API。
- **选人分析**：进入选人阶段（ChampSelect），主窗口自动展示队友/对手战绩与评价。
- **对局分析 + 悬浮提示**：进入对局（InProgress），主窗口「对局分析」标签展示详情，
  同时**透明悬浮窗**直接叠在游戏画面上显示简洁建议（顶部中央）。
- **悬浮提示开关**：主窗口右上角「悬浮提示」可开/关。
- **Mock 演示**：未检测到客户端时自动返回示例数据（`LOL_MOCK=1`，默认开启）。

## 环境变量

| 变量 | 默认 | 说明 |
| --- | --- | --- |
| `LOL_MOCK` | `1` | 是否启用 mock 兜底（`0` 关闭） |
| `LOL_LCU_LOCKFILE` | 空 | 手动指定 lockfile 绝对路径 |
| `LOL_MATCH_COUNT` | `10` | 每个玩家拉取近几局 |

## 项目结构

```
lol-assistant-app/
├── main.js                # Electron 主进程（主窗口 + 悬浮窗 + 轮询）
├── preload.js             # 安全 IPC 桥接
├── src/                   # 核心逻辑（纯 Node，可单独测试）
│   ├── lcu.js             # LCU 连接层
│   ├── championSelect.js  # 选人解析
│   ├── matchHistory.js    # 战绩查询统计
│   ├── evaluator.js       # 玩家评价
│   ├── liveGame.js        # 对局实时数据
│   ├── advice.js          # 打团/出装建议
│   ├── mock.js            # mock 演示数据
│   ├── champions.js       # 英雄 id -> 中文名
│   └── adapters/          # 其他游戏开放接口
├── renderer/              # 前端（主窗口 + 悬浮窗）
└── data/champions.json    # 英雄数据
```

## 关键接口原理

- **选人数据**：`GET /lol-champ-select/v1/session`（`myTeam` / `theirTeam`，含 `summonerId`、`puuid`、`championId`、`assignedPosition`）。
- **召唤师信息**：`GET /lol-summoner/v1/summoners/{summonerId}`。
- **战绩查询**：`GET /lol-match-history/v1/products/lol/{puuid}/matches`（客户端自带后端，国服/外服均可用）。
- **对局实时数据**：`https://127.0.0.1:2999/liveclientdata/allgamedata`。

## 扩展其他游戏

1. 在 `src/adapters/` 新建类，继承 `base.js` 的 `GameAdapter`；
2. 实现 `connect / getPhase / getPlayers / getPlayerHistory / evaluate / getLiveState / getAdvice`；
3. 在 `src/adapters/registry.js` 中 `register(new YourAdapter())`。

## 重要合规提示

- 本工具仅读取客户端**官方暴露的本地接口**，不注入、不修改游戏进程。
- **注意**：Riot 已开始封禁「选人阶段窥探对面玩家信息（lobby reveal）」的插件，
  且新增「主播模式」可隐藏 Riot ID。**对面玩家名字可能被隐藏**，程序会回退显示
  「已隐藏」，请勿用于规避/窥探等违规用途。
- 悬浮窗叠加在游戏画面上，需要游戏运行在**无边框/窗口模式**（英雄联盟默认即为
  无边框），独占全屏模式下系统级悬浮窗无法覆盖。
- 使用风险自负，本工具非官方支持或背书。
