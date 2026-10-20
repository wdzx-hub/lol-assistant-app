// LCU（League Client Update）本地客户端连接层。
// 原理同开源项目 Lytical / LeagueAkari：读取客户端 lockfile，通过本地 HTTPS
// 接口（basic auth，用户名为 riot）访问客户端内置 REST API。
// 国服（WeGame/TGP）把 LCU 凭证锁在管理员权限的 LeagueClientUx 进程里，
// lockfile 为空，此时需要通过管理员 PowerShell 读取进程命令行提取凭证。
const https = require('https');
const http = require('http');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const SEARCH_PATHS = [
  // 国服 WeGame/TGP 实际安装路径
  'D:\\WeGameApps\\英雄联盟\\LeagueClient\\lockfile',
  'C:\\WeGameApps\\英雄联盟\\LeagueClient\\lockfile',
  // 外服 Riot 客户端
  'C:\\Riot Games\\League of Legends\\lockfile',
  'D:\\Riot Games\\League of Legends\\lockfile',
  // 其他国服常见安装路径
  'C:\\WeGame\\英雄联盟\\lockfile',
  'D:\\WeGame\\英雄联盟\\lockfile',
  'C:\\腾讯游戏\\英雄联盟\\lockfile',
  'D:\\腾讯游戏\\英雄联盟\\lockfile',
  'C:\\Program Files\\腾讯游戏\\英雄联盟\\lockfile',
  'D:\\Program Files\\腾讯游戏\\英雄联盟\\lockfile',
];

function findLockfile() {
  const env = process.env.LOL_LCU_LOCKFILE;
  if (env && fs.existsSync(env)) return env;
  for (const p of SEARCH_PATHS) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

// 解析 lockfile，校验格式有效性；无效/空返回 null，避免 port 变成 NaN。
function parseLockfile(lf) {
  try {
    const raw = fs.readFileSync(lf, 'utf8').trim();
    if (!raw) return null;
    const parts = raw.split(':');
    if (parts.length < 5) return null;
    const port = parseInt(parts[2], 10);
    if (!port || Number.isNaN(port)) return null;
    return { process: parts[0], port, password: parts[3], protocol: parts[4] || 'https' };
  } catch (e) {
    return null;
  }
}

// 管理员 PowerShell：读取 LeagueClientUx 进程命令行，提取 LCU 凭证并写入 JSON 文件。
// 结果写入文件（而非 stdout）以避免 PowerShell 输出编码问题。
function extractLcuFromProcesses() {
  // 凭证中转文件写到系统临时目录，打包后 asar 内只读无法写入。
  const outFile = path.join(os.tmpdir(), 'lol-assistant-lcu-cred.json');
  const outPath = outFile.replace(/\\/g, '/');
  const ps = [
    `$ErrorActionPreference='SilentlyContinue'`,
    `$cl=(Get-CimInstance Win32_Process -Filter "Name='LeagueClientUx.exe'" | Select-Object -First 1).CommandLine`,
    `$t='';$p=0`,
    `if($cl){$m=[regex]::Match($cl,'--remoting-auth-token=([^\\s"]+)');if($m.Success){$t=$m.Groups[1].Value};$m2=[regex]::Match($cl,'--app-port=(\\d+)');if($m2.Success){$p=[int]$m2.Groups[1].Value}}`,
    `[PSCustomObject]@{password=$t;port=$p}|ConvertTo-Json -Compress|Set-Content -Path '${outPath}' -Encoding UTF8`,
  ].join(';');
  try {
    execFileSync('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', ps], {
      timeout: 8000,
      windowsHide: true,
      stdio: 'ignore',
    });
    const raw = fs.readFileSync(outFile, 'utf8').replace(/^\uFEFF/, '');
    const obj = JSON.parse(raw);
    if (obj.password && obj.port) {
      return { process: 'LeagueClientUx', port: obj.port, password: obj.password, protocol: 'https' };
    }
  } catch (e) {
    // 提取失败（未提权或客户端未启动）
  }
  return null;
}

class LcuClient {
  constructor() {
    this.available = false;
    this.error = '';
    this._cred = null; // 缓存动态提取到的凭证，避免每次轮询都跑 PowerShell
    this.connect();
  }

  connect() {
    this.available = false;
    this.error = '';

    // 1) 优先标准 lockfile（外服 / 常规安装）
    const lf = findLockfile();
    if (lf) {
      const cred = parseLockfile(lf);
      if (cred) {
        this._applyCred(cred);
        return true;
      }
      // lockfile 存在但无效（国服 0 字节等），继续尝试动态提取
    }

    // 2) 动态提取（管理员权限下读取进程命令行）
    if (this._cred) {
      this._applyCred(this._cred);
      return true;
    }
    const cred = extractLcuFromProcesses();
    if (cred) {
      this._cred = cred;
      this._applyCred(cred);
      return true;
    }

    if (lf) {
      this.error = 'LCU lockfile 无效，且无法提取凭证（请以管理员权限运行应用）';
    } else {
      this.error = '未找到 LCU lockfile（客户端可能未启动）';
    }
    return false;
  }

  _applyCred(cred) {
    this.process = cred.process;
    this.port = cred.port;
    this.password = cred.password;
    this.protocol = cred.protocol;
    this.available = true;
  }

  get baseUrl() {
    return `${this.protocol}://127.0.0.1:${this.port}`;
  }

  request(method, path) {
    return new Promise((resolve, reject) => {
      if (!this.available) {
        return reject(new Error(this.error || '未连接'));
      }
      const auth = Buffer.from('riot:' + this.password).toString('base64');
      const options = {
        hostname: '127.0.0.1',
        port: this.port,
        path,
        method,
        rejectUnauthorized: false,
        headers: { Authorization: 'Basic ' + auth, Accept: 'application/json' },
      };
      const mod = this.protocol === 'http' ? http : https;
      const req = mod.request(options, (res) => {
        let data = '';
        res.on('data', (c) => (data += c));
        res.on('end', () => {
          if (res.statusCode === 204) return resolve(null);
          if (res.statusCode >= 400) {
            return reject(new Error(`HTTP ${res.statusCode} ${path}`));
          }
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            resolve(data);
          }
        });
      });
      req.on('error', reject);
      req.setTimeout(5000, () => req.destroy(new Error('timeout')));
      req.end();
    });
  }

  get(path) {
    return this.request('GET', path);
  }
}

module.exports = { LcuClient, findLockfile };
