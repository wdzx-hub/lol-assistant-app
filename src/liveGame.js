// 游戏内实时数据：读取 Live Client Data API（进入对局后 127.0.0.1:2999）。
const https = require('https');

const LIVE_HOST = '127.0.0.1';
const LIVE_PORT = 2999;

function getAllGameData() {
  return new Promise((resolve) => {
    const req = https.request(
      {
        hostname: LIVE_HOST,
        port: LIVE_PORT,
        path: '/liveclientdata/allgamedata',
        method: 'GET',
        rejectUnauthorized: false,
      },
      (res) => {
        let data = '';
        res.on('data', (c) => (data += c));
        res.on('end', () => {
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            resolve(null);
          }
        });
      }
    );
    req.on('error', () => resolve(null));
    req.setTimeout(3000, () => req.destroy());
    req.end();
  });
}

module.exports = { getAllGameData };
