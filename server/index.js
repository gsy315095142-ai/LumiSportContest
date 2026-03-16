import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';
import QRCode from 'qrcode';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: '*', methods: ['GET', 'POST'] }
});

app.use(cors());
app.use(express.json());

// ========== 数据存储 ==========

const DATA_DIR = path.join(__dirname, 'data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

function loadUsers() {
  try {
    if (fs.existsSync(USERS_FILE)) {
      return JSON.parse(fs.readFileSync(USERS_FILE, 'utf-8'));
    }
  } catch (e) {
    console.error('Failed to load users:', e.message);
  }
  return {};
}

function saveUsers(users) {
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2), 'utf-8');
}

let users = loadUsers();

// ========== 赔率矩阵（与前端 rulesData 一致） ==========

const TIERS = ['新手', '青铜', '白银', '黄金', '钻石', '铂金', '王者'];

const ODDS_MATRIX = [
  [1.50, 1.70, 1.90, 2.10, 2.30, 2.50, 2.70],
  [1.45, 1.65, 1.85, 2.05, 2.25, 2.45, 2.65],
  [1.40, 1.60, 1.80, 2.00, 2.20, 2.40, 2.60],
  [1.35, 1.55, 1.75, 1.95, 2.15, 2.35, 2.55],
  [1.30, 1.50, 1.70, 1.90, 2.10, 2.30, 2.50],
  [1.25, 1.45, 1.65, 1.85, 2.05, 2.25, 2.45],
  [1.20, 1.40, 1.60, 1.80, 2.00, 2.20, 2.40],
];

const QUIZ_TIER_THRESHOLDS = [
  { name: '新手预言家', threshold: 0, icon: '🔮' },
  { name: '青铜预言家', threshold: 2500, icon: '🥉' },
  { name: '白银预言家', threshold: 5000, icon: '🥈' },
  { name: '黄金预言家', threshold: 10000, icon: '🥇' },
  { name: '钻石预言家', threshold: 20000, icon: '💎' },
  { name: '铂金预言家', threshold: 50000, icon: '👑' },
  { name: '王者预言家', threshold: 100000, icon: '🏆' },
];

function getQuizTier(totalWinnings) {
  let tier = QUIZ_TIER_THRESHOLDS[0];
  for (const t of QUIZ_TIER_THRESHOLDS) {
    if (totalWinnings >= t.threshold) tier = t;
  }
  return tier;
}

function getOdds(redTier, blueTier) {
  const ri = TIERS.indexOf(redTier);
  const bi = TIERS.indexOf(blueTier);
  if (ri === -1 || bi === -1) return { red: 1.5, blue: 1.5 };
  return {
    red: ODDS_MATRIX[ri][bi],
    blue: ODDS_MATRIX[bi][ri],
  };
}

// ========== 比赛状态（仅内存） ==========

let gameState = createFreshGame();

function createFreshGame() {
  return {
    status: 'waiting',       // waiting | betting | started | settled
    gameType: 'hockey',      // hockey（魔法冰球） | boxing（魔法拳王）
    matchName: '',
    redTier: '新手',
    blueTier: '新手',
    redScore: '',
    blueScore: '',
    iceBalls: '',
    fireBalls: '',
    windBalls: '',
    totalKnockdowns: '',     // 魔法拳王：双方倒地次数总和
    bets: {},
    round: 1,
  };
}

function buildGameInfo() {
  const odds = getOdds(gameState.redTier, gameState.blueTier);
  return {
    status: gameState.status,
    gameType: gameState.gameType,
    matchName: gameState.matchName,
    redTier: gameState.redTier,
    blueTier: gameState.blueTier,
    round: gameState.round,
    odds,
  };
}

function buildBetSummary() {
  const summary = {
    winBet: { red: { count: 0, total: 0, details: [] }, blue: { count: 0, total: 0, details: [] } },
    elementKing: { ice: { count: 0, total: 0, details: [] }, fire: { count: 0, total: 0, details: [] }, wind: { count: 0, total: 0, details: [] } },
    knockdownKing: { count: 0, total: 0, details: [] },
    preciseTotal: { count: 0, total: 0, details: [] },
    preciseDiff: { count: 0, total: 0, details: [] },
  };

  for (const [username, bet] of Object.entries(gameState.bets)) {
    if (bet.winBet && bet.winBet.amount > 0) {
      const side = bet.winBet.side;
      summary.winBet[side].count++;
      summary.winBet[side].total += bet.winBet.amount;
      summary.winBet[side].details.push({ name: username, amount: bet.winBet.amount });
    }
    if (bet.elementKing && bet.elementKing.amount > 0) {
      const choice = bet.elementKing.choice;
      summary.elementKing[choice].count++;
      summary.elementKing[choice].total += bet.elementKing.amount;
      summary.elementKing[choice].details.push({ name: username, amount: bet.elementKing.amount });
    }
    if (bet.knockdownKing && bet.knockdownKing.amount > 0) {
      summary.knockdownKing.count++;
      summary.knockdownKing.total += bet.knockdownKing.amount;
      summary.knockdownKing.details.push({ name: username, amount: bet.knockdownKing.amount, value: bet.knockdownKing.value });
    }
    if (bet.preciseTotal && bet.preciseTotal.amount > 0) {
      summary.preciseTotal.count++;
      summary.preciseTotal.total += bet.preciseTotal.amount;
      summary.preciseTotal.details.push({ name: username, amount: bet.preciseTotal.amount, value: bet.preciseTotal.value });
    }
    if (bet.preciseDiff && bet.preciseDiff.amount > 0) {
      summary.preciseDiff.count++;
      summary.preciseDiff.total += bet.preciseDiff.amount;
      summary.preciseDiff.details.push({ name: username, amount: bet.preciseDiff.amount, value: bet.preciseDiff.value });
    }
  }
  return summary;
}

function buildRankings() {
  return Object.values(users)
    .map(u => ({
      name: u.name,
      coins: u.coins,
      totalWinnings: u.totalWinnings,
      tier: getQuizTier(u.totalWinnings),
    }))
    .sort((a, b) => b.totalWinnings - a.totalWinnings);
}

// ========== REST API ==========

app.post('/api/login', (req, res) => {
  const { name } = req.body;
  if (!name || typeof name !== 'string') {
    return res.status(400).json({ error: '请输入账号' });
  }
  const trimmed = name.trim();
  if (!trimmed) return res.status(400).json({ error: '账号不能为空' });
  if (!/^[\u4e00-\u9fa5a-zA-Z]+$/.test(trimmed)) {
    return res.status(400).json({ error: '账号只支持中文或英文，不支持特殊符号和空格' });
  }

  if (!users[trimmed]) {
    users[trimmed] = {
      name: trimmed,
      coins: 100,
      totalWinnings: 0,
      lastCheckin: null,
      adWatchedToday: 0,
      lastAdDate: null,
      coinLog: [{ time: new Date().toISOString(), type: 'gain', amount: 100, reason: '新用户注册奖励', balance: 100 }],
    };
    saveUsers(users);
  }
  res.json({ user: users[trimmed], gameInfo: buildGameInfo() });
});

app.get('/api/server-info', (_req, res) => {
  const nets = os.networkInterfaces();
  const ips = [];
  for (const iface of Object.values(nets)) {
    for (const cfg of iface) {
      if (cfg.family === 'IPv4' && !cfg.internal) {
        ips.push(cfg.address);
      }
    }
  }
  res.json({ ips, ip: ips[0] || 'localhost' });
});

app.get('/api/user/:name', (req, res) => {
  const user = users[req.params.name];
  if (!user) return res.status(404).json({ error: '用户不存在' });
  res.json({ user });
});

app.post('/api/checkin', (req, res) => {
  const { name } = req.body;
  const user = users[name];
  if (!user) return res.status(404).json({ error: '用户不存在' });

  const today = new Date().toISOString().slice(0, 10);
  if (user.lastCheckin === today) {
    return res.status(400).json({ error: '今天已签到' });
  }
  user.coins += 100;
  user.lastCheckin = today;
  if (!user.coinLog) user.coinLog = [];
  user.coinLog.push({ time: new Date().toISOString(), type: 'gain', amount: 100, reason: '每日签到', balance: user.coins });
  saveUsers(users);
  res.json({ user, added: 100 });
});

app.post('/api/watch-ad', (req, res) => {
  const { name } = req.body;
  const user = users[name];
  if (!user) return res.status(404).json({ error: '用户不存在' });

  const today = new Date().toISOString().slice(0, 10);
  if (user.lastAdDate !== today) {
    user.adWatchedToday = 0;
    user.lastAdDate = today;
  }
  if (user.adWatchedToday >= 5) {
    return res.status(400).json({ error: '今日观看次数已用完（5次/日）' });
  }
  user.coins += 30;
  user.adWatchedToday++;
  if (!user.coinLog) user.coinLog = [];
  user.coinLog.push({ time: new Date().toISOString(), type: 'gain', amount: 30, reason: '观看广告', balance: user.coins });
  saveUsers(users);
  res.json({ user, added: 30, remaining: 5 - user.adWatchedToday });
});

app.get('/api/rankings', (_req, res) => {
  res.json({ rankings: buildRankings() });
});

app.get('/api/game', (_req, res) => {
  res.json({ gameInfo: buildGameInfo(), betSummary: buildBetSummary() });
});

app.get('/api/my-bets/:name', (req, res) => {
  const bet = gameState.bets[req.params.name] || {};
  res.json({ bets: bet });
});

app.get('/api/history/:name', (req, res) => {
  const user = users[req.params.name];
  if (!user) return res.status(404).json({ error: '用户不存在' });
  const history = (user.history || []).slice().reverse();
  res.json({ history });
});

app.get('/api/coin-log/:name', (req, res) => {
  const user = users[req.params.name];
  if (!user) return res.status(404).json({ error: '用户不存在' });
  const coinLog = (user.coinLog || []).slice().reverse();
  res.json({ coinLog });
});

// ========== Socket.IO ==========

io.on('connection', (socket) => {
  console.log(`Client connected: ${socket.id}`);

  socket.emit('game:update', buildGameInfo());
  socket.emit('bet:update', buildBetSummary());
  socket.emit('rank:update', buildRankings());

  // PC 端：更新比赛设置（仅在 waiting/betting 状态下允许）
  socket.on('game:config', (data) => {
    if (gameState.status === 'started' || gameState.status === 'settled') return;
    const { matchName, redTier, blueTier, gameType } = data;
    if (matchName !== undefined) gameState.matchName = matchName;
    if (redTier && TIERS.includes(redTier)) gameState.redTier = redTier;
    if (blueTier && TIERS.includes(blueTier)) gameState.blueTier = blueTier;
    if (gameType && (gameType === 'hockey' || gameType === 'boxing')) gameState.gameType = gameType;
    io.emit('game:update', buildGameInfo());
  });

  // PC 端：开始竞猜（从 waiting 进入 betting，允许手机端下注）
  socket.on('game:openBetting', () => {
    if (gameState.status !== 'waiting') return;
    if (!gameState.matchName.trim()) {
      socket.emit('game:error', { message: '请先填写赛事名称' });
      return;
    }
    gameState.status = 'betting';
    io.emit('game:update', buildGameInfo());
  });

  // PC 端：比赛开始（锁定下注）
  socket.on('game:start', () => {
    if (gameState.status !== 'betting') return;
    gameState.status = 'started';
    io.emit('game:start', buildGameInfo());
    io.emit('game:update', buildGameInfo());
  });

  // PC 端：确认开奖
  socket.on('game:settle', (data) => {
    if (gameState.status !== 'started') {
      socket.emit('game:error', { message: '当前状态无法开奖' });
      return;
    }

    const { redScore, blueScore, iceBalls, fireBalls, windBalls, totalKnockdowns } = data;
    const isHockey = gameState.gameType === 'hockey';
    const missing = [];
    if (redScore === '' || redScore === undefined || redScore === null) missing.push('红方分数');
    if (blueScore === '' || blueScore === undefined || blueScore === null) missing.push('蓝方分数');
    if (isHockey) {
      if (iceBalls === '' || iceBalls === undefined || iceBalls === null) missing.push('冰球次数');
      if (fireBalls === '' || fireBalls === undefined || fireBalls === null) missing.push('火球次数');
      if (windBalls === '' || windBalls === undefined || windBalls === null) missing.push('风球次数');
    } else {
      if (totalKnockdowns === '' || totalKnockdowns === undefined || totalKnockdowns === null) missing.push('倒地次数总和');
    }
    if (missing.length > 0) {
      socket.emit('game:error', { message: `以下数据尚未录入：${missing.join('、')}` });
      return;
    }

    const rs = parseInt(redScore);
    const bs = parseInt(blueScore);

    let elementWinner = null;
    let ice = 0, fire = 0, wind = 0, knockdowns = 0;

    if (isHockey) {
      ice = parseInt(iceBalls);
      fire = parseInt(fireBalls);
      wind = parseInt(windBalls);
      const maxElem = Math.max(ice, fire, wind);
      // 并列时按固定优先级 ice > fire > wind 决出元素之王
      if (ice === maxElem) elementWinner = 'ice';
      else if (fire === maxElem) elementWinner = 'fire';
      else elementWinner = 'wind';
    } else {
      knockdowns = parseInt(totalKnockdowns);
    }

    gameState.redScore = rs;
    gameState.blueScore = bs;
    gameState.iceBalls = ice;
    gameState.fireBalls = fire;
    gameState.windBalls = wind;
    gameState.totalKnockdowns = knockdowns;
    gameState.status = 'settled';

    const odds = getOdds(gameState.redTier, gameState.blueTier);
    const totalScore = rs + bs;
    const scoreDiff = Math.abs(rs - bs);
    let winSide = null;
    if (rs > bs) winSide = 'red';
    else if (bs > rs) winSide = 'blue';

    const settlements = [];

    for (const [username, bet] of Object.entries(gameState.bets)) {
      const user = users[username];
      if (!user) continue;
      let totalWon = 0;
      const details = [];

      // 先扣除所有下注金额
      let totalBetted = 0;
      if (bet.winBet && bet.winBet.amount > 0) totalBetted += bet.winBet.amount;
      if (isHockey && bet.elementKing && bet.elementKing.amount > 0) totalBetted += bet.elementKing.amount;
      if (!isHockey && bet.knockdownKing && bet.knockdownKing.amount > 0) totalBetted += bet.knockdownKing.amount;
      if (bet.preciseTotal && bet.preciseTotal.amount > 0) totalBetted += bet.preciseTotal.amount;
      if (bet.preciseDiff && bet.preciseDiff.amount > 0) totalBetted += bet.preciseDiff.amount;
      const coinsBefore = user.coins;
      user.coins -= totalBetted;

      const actualWinLabel = winSide === 'red' ? '红方胜' : winSide === 'blue' ? '蓝方胜' : '平局';

      // 胜负竞猜
      if (bet.winBet && bet.winBet.amount > 0) {
        const myLabel = bet.winBet.side === 'blue' ? '蓝方胜' : '红方胜';
        if (winSide === null) {
          user.coins += bet.winBet.amount;
          details.push({ type: '胜负竞猜', myBet: myLabel, amount: bet.winBet.amount, actual: actualWinLabel, result: '平局', refund: bet.winBet.amount });
        } else if (bet.winBet.side === winSide) {
          const winAmount = Math.round(bet.winBet.amount * odds[winSide] * 100) / 100;
          user.coins += winAmount;
          user.totalWinnings += winAmount;
          totalWon += winAmount;
          details.push({ type: '胜负竞猜', myBet: myLabel, amount: bet.winBet.amount, actual: actualWinLabel, result: '猜中', won: winAmount });
        } else {
          details.push({ type: '胜负竞猜', myBet: myLabel, amount: bet.winBet.amount, actual: actualWinLabel, result: '未猜中', lost: bet.winBet.amount });
        }
      }

      // 元素之王（仅冰球模式）
      if (isHockey && bet.elementKing && bet.elementKing.amount > 0) {
        const elemNames = { ice: '冰球', fire: '火球', wind: '风球' };
        const myLabel = elemNames[bet.elementKing.choice];
        const actualLabel = elemNames[elementWinner];
        if (bet.elementKing.choice === elementWinner) {
          const winAmount = bet.elementKing.amount * 3;
          user.coins += winAmount;
          user.totalWinnings += winAmount;
          totalWon += winAmount;
          details.push({ type: '元素之王', myBet: myLabel, amount: bet.elementKing.amount, actual: actualLabel, result: '猜中', won: winAmount });
        } else {
          details.push({ type: '元素之王', myBet: myLabel, amount: bet.elementKing.amount, actual: actualLabel, result: '未猜中', lost: bet.elementKing.amount });
        }
      }

      // 躺平之王（仅拳王模式）：猜中倒地次数总和，赔率 ×3
      if (!isHockey && bet.knockdownKing && bet.knockdownKing.amount > 0) {
        const myLabel = `${bet.knockdownKing.value} 次`;
        const actualLabel = `${knockdowns} 次`;
        if (parseInt(bet.knockdownKing.value) === knockdowns) {
          const winAmount = bet.knockdownKing.amount * 3;
          user.coins += winAmount;
          user.totalWinnings += winAmount;
          totalWon += winAmount;
          details.push({ type: '躺平之王', myBet: myLabel, amount: bet.knockdownKing.amount, actual: actualLabel, result: '猜中', won: winAmount });
        } else {
          details.push({ type: '躺平之王', myBet: myLabel, amount: bet.knockdownKing.amount, actual: actualLabel, result: '未猜中', lost: bet.knockdownKing.amount });
        }
      }

      // 精准总分
      if (bet.preciseTotal && bet.preciseTotal.amount > 0) {
        const myLabel = `${bet.preciseTotal.value} 分`;
        const actualLabel = `${totalScore} 分`;
        if (parseInt(bet.preciseTotal.value) === totalScore) {
          const winAmount = bet.preciseTotal.amount * 20;
          user.coins += winAmount;
          user.totalWinnings += winAmount;
          totalWon += winAmount;
          details.push({ type: '精准总分', myBet: myLabel, amount: bet.preciseTotal.amount, actual: actualLabel, result: '猜中', won: winAmount });
        } else {
          details.push({ type: '精准总分', myBet: myLabel, amount: bet.preciseTotal.amount, actual: actualLabel, result: '未猜中', lost: bet.preciseTotal.amount });
        }
      }

      // 精准分差
      if (bet.preciseDiff && bet.preciseDiff.amount > 0) {
        const myLabel = `${bet.preciseDiff.value} 分差`;
        const actualLabel = `${scoreDiff} 分差`;
        if (parseInt(bet.preciseDiff.value) === scoreDiff) {
          const winAmount = bet.preciseDiff.amount * 15;
          user.coins += winAmount;
          user.totalWinnings += winAmount;
          totalWon += winAmount;
          details.push({ type: '精准分差', myBet: myLabel, amount: bet.preciseDiff.amount, actual: actualLabel, result: '猜中', won: winAmount });
        } else {
          details.push({ type: '精准分差', myBet: myLabel, amount: bet.preciseDiff.amount, actual: actualLabel, result: '未猜中', lost: bet.preciseDiff.amount });
        }
      }

      const netResult = user.coins - coinsBefore;
      settlements.push({ username, totalWon, totalBetted, netResult, details, newCoins: user.coins });

      // 竞猜币流水
      if (!user.coinLog) user.coinLog = [];
      const now = new Date().toISOString();
      const matchLabel = `${gameState.matchName} 第${gameState.round}局`;
      if (totalBetted > 0) {
        user.coinLog.push({ time: now, type: 'spend', amount: totalBetted, reason: `竞猜下注 · ${matchLabel}`, balance: coinsBefore - totalBetted });
      }
      if (totalWon > 0) {
        user.coinLog.push({ time: now, type: 'gain', amount: totalWon, reason: `竞猜赢得 · ${matchLabel}`, balance: user.coins });
      }
      for (const d of details) {
        if (d.refund) {
          user.coinLog.push({ time: now, type: 'gain', amount: d.refund, reason: `平局退还 · ${matchLabel} · ${d.type}`, balance: user.coins });
        }
      }

      // 保存历史记录
      if (!user.history) user.history = [];
      user.history.push({
        time: new Date().toISOString(),
        matchName: gameState.matchName,
        gameType: gameState.gameType,
        blueTier: gameState.blueTier,
        redTier: gameState.redTier,
        blueScore: bs,
        redScore: rs,
        round: gameState.round,
        totalBetted,
        totalWon,
        netResult,
        details,
      });
    }

    saveUsers(users);

    const resultData = {
      gameType: gameState.gameType,
      redScore: rs,
      blueScore: bs,
      iceBalls: ice,
      fireBalls: fire,
      windBalls: wind,
      totalKnockdowns: knockdowns,
      winSide,
      elementWinner,
      totalScore,
      scoreDiff,
      settlements,
    };

    io.emit('game:result', resultData);
    io.emit('game:update', buildGameInfo());
    io.emit('rank:update', buildRankings());
  });

  // PC 端：进入下一局
  socket.on('game:next', (data) => {
    const force = data && data.force;
    if (gameState.status !== 'settled' && !force) {
      socket.emit('game:error', { message: '本局尚未开奖，确定要跳过吗？', needConfirm: true });
      return;
    }
    if (force && gameState.status !== 'settled') {
      const now = new Date().toISOString();
      for (const [username, bet] of Object.entries(gameState.bets)) {
        const user = users[username];
        if (!user) continue;
        const totalBetted = Object.values(bet).reduce((s, b) => s + (b.amount || 0), 0);
        if (totalBetted > 0) {
          user.coinLog = user.coinLog || [];
          user.coinLog.push({
            time: now, type: 'info', amount: 0,
            reason: `第${gameState.round}局作废，押注 ${totalBetted} 币已回退`,
            balance: user.coins
          });
        }
      }
      saveUsers();
    }
    const nextRound = gameState.round + 1;
    gameState = createFreshGame();
    gameState.round = nextRound;
    io.emit('game:next', buildGameInfo());
    io.emit('game:update', buildGameInfo());
    io.emit('bet:update', buildBetSummary());
  });

  // 手机端：下注
  socket.on('bet:place', (data) => {
    const { username, betType, side, choice, value, amount } = data;
    if (!username || !users[username]) {
      socket.emit('bet:error', { message: '用户不存在' });
      return;
    }
    if (gameState.status !== 'betting') {
      socket.emit('bet:error', { message: '当前无法下注' });
      return;
    }

    const user = users[username];
    if (!gameState.bets[username]) {
      gameState.bets[username] = {};
    }
    const myBets = gameState.bets[username];

    const amt = parseInt(amount);
    if (!amt || amt < 0) {
      socket.emit('bet:error', { message: '请输入有效的下注金额' });
      return;
    }

    // 计算用户当前已下注总额（不含本次要修改的项目）
    let totalBetted = 0;
    if (myBets.winBet && betType !== 'winBet') totalBetted += myBets.winBet.amount || 0;
    if (myBets.elementKing && betType !== 'elementKing') totalBetted += myBets.elementKing.amount || 0;
    if (myBets.knockdownKing && betType !== 'knockdownKing') totalBetted += myBets.knockdownKing.amount || 0;
    if (myBets.preciseTotal && betType !== 'preciseTotal') totalBetted += myBets.preciseTotal.amount || 0;
    if (myBets.preciseDiff && betType !== 'preciseDiff') totalBetted += myBets.preciseDiff.amount || 0;

    if (totalBetted + amt > user.coins) {
      socket.emit('bet:error', { message: `竞猜币不足（当前 ${user.coins} 币，已下注 ${totalBetted} 币，还可下注 ${user.coins - totalBetted} 币）` });
      return;
    }

    if (betType === 'winBet') {
      if (side !== 'red' && side !== 'blue') {
        socket.emit('bet:error', { message: '请选择红方或蓝方' });
        return;
      }
      myBets.winBet = { side, amount: amt };
    } else if (betType === 'elementKing') {
      if (!['ice', 'fire', 'wind'].includes(choice)) {
        socket.emit('bet:error', { message: '请选择元素' });
        return;
      }
      myBets.elementKing = { choice, amount: amt };
    } else if (betType === 'knockdownKing') {
      if (value === undefined || value === '' || parseInt(value) < 0) {
        socket.emit('bet:error', { message: '请输入有效的倒地次数预测' });
        return;
      }
      myBets.knockdownKing = { value: parseInt(value), amount: amt };
    } else if (betType === 'preciseTotal') {
      if (value === undefined || value === '' || parseInt(value) < 0) {
        socket.emit('bet:error', { message: '请输入有效的总分预测' });
        return;
      }
      myBets.preciseTotal = { value: parseInt(value), amount: amt };
    } else if (betType === 'preciseDiff') {
      if (value === undefined || value === '' || parseInt(value) < 0) {
        socket.emit('bet:error', { message: '请输入有效的分差预测' });
        return;
      }
      myBets.preciseDiff = { value: parseInt(value), amount: amt };
    }

    socket.emit('bet:myBets', myBets);
    io.emit('bet:update', buildBetSummary());
  });

  // 手机端：取消下注
  socket.on('bet:cancel', (data) => {
    const { username, betType } = data;
    if (gameState.status !== 'betting') {
      socket.emit('bet:error', { message: '当前无法修改下注' });
      return;
    }
    if (gameState.bets[username] && gameState.bets[username][betType]) {
      delete gameState.bets[username][betType];
      socket.emit('bet:myBets', gameState.bets[username]);
      io.emit('bet:update', buildBetSummary());
    }
  });

  // 手机端：获取自己的下注信息
  socket.on('bet:getMyBets', (data) => {
    const myBets = gameState.bets[data.username] || {};
    socket.emit('bet:myBets', myBets);
  });

  socket.on('disconnect', () => {
    console.log(`Client disconnected: ${socket.id}`);
  });
});

// ========== QR 码接口 ==========

app.get('/api/qr', async (req, res) => {
  const { url } = req.query;
  if (!url) return res.status(400).json({ error: '缺少 url 参数' });
  try {
    const png = await QRCode.toBuffer(url, { width: 300, margin: 2 });
    res.set('Content-Type', 'image/png');
    res.send(png);
  } catch (e) {
    res.status(500).json({ error: '生成 QR 码失败' });
  }
});

// ========== Admin API（供 Unity Server 调用） ==========

const ADMIN_TOKEN = process.env.ADMIN_TOKEN || 'lumisports-secret';

function checkAdminToken(req, res) {
  const token = req.body && req.body.adminToken;
  if (token !== ADMIN_TOKEN) {
    res.status(403).json({ error: '无效的 adminToken' });
    return false;
  }
  return true;
}

// 配置赛事并开启竞猜
app.post('/api/admin/configure', (req, res) => {
  if (!checkAdminToken(req, res)) return;
  if (gameState.status === 'started') {
    return res.status(400).json({ error: '比赛进行中，无法重新配置' });
  }

  const { matchName, gameType, redTier, blueTier } = req.body;
  const nextRound = gameState.status === 'settled' ? gameState.round + 1 : gameState.round;
  gameState = createFreshGame();
  gameState.round = nextRound;

  if (matchName) gameState.matchName = matchName;
  if (gameType && (gameType === 'hockey' || gameType === 'boxing')) gameState.gameType = gameType;
  if (redTier && TIERS.includes(redTier)) gameState.redTier = redTier;
  if (blueTier && TIERS.includes(blueTier)) gameState.blueTier = blueTier;

  gameState.status = 'betting';

  io.emit('game:update', buildGameInfo());
  io.emit('bet:update', buildBetSummary());
  io.emit('rank:update', buildRankings());

  console.log(`[Admin] configure: ${gameType} "${matchName}" ${redTier} vs ${blueTier}, round=${gameState.round}`);
  res.json({ success: true, gameInfo: buildGameInfo() });
});

// 锁定下注（比赛正式开始）
app.post('/api/admin/lock', (req, res) => {
  if (!checkAdminToken(req, res)) return;
  if (gameState.status !== 'betting') {
    return res.status(400).json({ error: `当前状态 ${gameState.status} 无法锁定` });
  }

  gameState.status = 'started';
  io.emit('game:start', buildGameInfo());
  io.emit('game:update', buildGameInfo());

  console.log('[Admin] lock: betting -> started');
  res.json({ success: true });
});

// 开奖结算（比赛结束，由 Unity 传入结果）
app.post('/api/admin/settle', (req, res) => {
  if (!checkAdminToken(req, res)) return;
  if (gameState.status !== 'started') {
    return res.status(400).json({ error: `当前状态 ${gameState.status} 无法结算` });
  }

  const { redScore, blueScore, iceBalls, fireBalls, windBalls, totalKnockdowns } = req.body;
  const isHockey = gameState.gameType === 'hockey';

  // 校验必填字段
  const missing = [];
  if (redScore === undefined || redScore === null || redScore === '') missing.push('红方分数');
  if (blueScore === undefined || blueScore === null || blueScore === '') missing.push('蓝方分数');
  if (isHockey) {
    if (iceBalls === undefined || iceBalls === null) missing.push('冰球次数');
    if (fireBalls === undefined || fireBalls === null) missing.push('火球次数');
    if (windBalls === undefined || windBalls === null) missing.push('风球次数');
  } else {
    if (totalKnockdowns === undefined || totalKnockdowns === null) missing.push('倒地次数');
  }
  if (missing.length > 0) {
    return res.status(400).json({ error: `缺少字段：${missing.join('、')}` });
  }

  const rs = parseInt(redScore);
  const bs = parseInt(blueScore);

  let elementWinner = null;
  let ice = 0, fire = 0, wind = 0, knockdowns = 0;

  if (isHockey) {
    ice = parseInt(iceBalls);
    fire = parseInt(fireBalls);
    wind = parseInt(windBalls);
    const maxElem = Math.max(ice, fire, wind);
    // 并列时按固定优先级 ice > fire > wind 决出元素之王
    if (ice === maxElem) elementWinner = 'ice';
    else if (fire === maxElem) elementWinner = 'fire';
    else elementWinner = 'wind';
  } else {
    knockdowns = parseInt(totalKnockdowns);
  }

  gameState.redScore = rs;
  gameState.blueScore = bs;
  gameState.iceBalls = ice;
  gameState.fireBalls = fire;
  gameState.windBalls = wind;
  gameState.totalKnockdowns = knockdowns;
  gameState.status = 'settled';

  const odds = getOdds(gameState.redTier, gameState.blueTier);
  const totalScore = rs + bs;
  const scoreDiff = Math.abs(rs - bs);
  let winSide = null;
  if (rs > bs) winSide = 'red';
  else if (bs > rs) winSide = 'blue';

  const settlements = [];

  for (const [username, bet] of Object.entries(gameState.bets)) {
    const user = users[username];
    if (!user) continue;
    let totalWon = 0;
    const details = [];

    let totalBetted = 0;
    if (bet.winBet && bet.winBet.amount > 0) totalBetted += bet.winBet.amount;
    if (isHockey && bet.elementKing && bet.elementKing.amount > 0) totalBetted += bet.elementKing.amount;
    if (!isHockey && bet.knockdownKing && bet.knockdownKing.amount > 0) totalBetted += bet.knockdownKing.amount;
    if (bet.preciseTotal && bet.preciseTotal.amount > 0) totalBetted += bet.preciseTotal.amount;
    if (bet.preciseDiff && bet.preciseDiff.amount > 0) totalBetted += bet.preciseDiff.amount;

    const coinsBefore = user.coins;
    user.coins -= totalBetted;

    const actualWinLabel = winSide === 'red' ? '红方胜' : winSide === 'blue' ? '蓝方胜' : '平局';

    if (bet.winBet && bet.winBet.amount > 0) {
      const myLabel = bet.winBet.side === 'blue' ? '蓝方胜' : '红方胜';
      if (winSide === null) {
        user.coins += bet.winBet.amount;
        details.push({ type: '胜负竞猜', myBet: myLabel, amount: bet.winBet.amount, actual: actualWinLabel, result: '平局', refund: bet.winBet.amount });
      } else if (bet.winBet.side === winSide) {
        const winAmount = Math.round(bet.winBet.amount * odds[winSide] * 100) / 100;
        user.coins += winAmount;
        user.totalWinnings += winAmount;
        totalWon += winAmount;
        details.push({ type: '胜负竞猜', myBet: myLabel, amount: bet.winBet.amount, actual: actualWinLabel, result: '猜中', won: winAmount });
      } else {
        details.push({ type: '胜负竞猜', myBet: myLabel, amount: bet.winBet.amount, actual: actualWinLabel, result: '未猜中', lost: bet.winBet.amount });
      }
    }

    if (isHockey && bet.elementKing && bet.elementKing.amount > 0) {
      const elemNames = { ice: '冰球', fire: '火球', wind: '风球' };
      const myLabel = elemNames[bet.elementKing.choice];
      const actualLabel = elemNames[elementWinner];
      if (bet.elementKing.choice === elementWinner) {
        const winAmount = bet.elementKing.amount * 3;
        user.coins += winAmount;
        user.totalWinnings += winAmount;
        totalWon += winAmount;
        details.push({ type: '元素之王', myBet: myLabel, amount: bet.elementKing.amount, actual: actualLabel, result: '猜中', won: winAmount });
      } else {
        details.push({ type: '元素之王', myBet: myLabel, amount: bet.elementKing.amount, actual: actualLabel, result: '未猜中', lost: bet.elementKing.amount });
      }
    }

    if (!isHockey && bet.knockdownKing && bet.knockdownKing.amount > 0) {
      const myLabel = `${bet.knockdownKing.value} 次`;
      const actualLabel = `${knockdowns} 次`;
      if (parseInt(bet.knockdownKing.value) === knockdowns) {
        const winAmount = bet.knockdownKing.amount * 3;
        user.coins += winAmount;
        user.totalWinnings += winAmount;
        totalWon += winAmount;
        details.push({ type: '躺平之王', myBet: myLabel, amount: bet.knockdownKing.amount, actual: actualLabel, result: '猜中', won: winAmount });
      } else {
        details.push({ type: '躺平之王', myBet: myLabel, amount: bet.knockdownKing.amount, actual: actualLabel, result: '未猜中', lost: bet.knockdownKing.amount });
      }
    }

    if (bet.preciseTotal && bet.preciseTotal.amount > 0) {
      const myLabel = `${bet.preciseTotal.value} 分`;
      const actualLabel = `${totalScore} 分`;
      if (parseInt(bet.preciseTotal.value) === totalScore) {
        const winAmount = bet.preciseTotal.amount * 20;
        user.coins += winAmount;
        user.totalWinnings += winAmount;
        totalWon += winAmount;
        details.push({ type: '精准总分', myBet: myLabel, amount: bet.preciseTotal.amount, actual: actualLabel, result: '猜中', won: winAmount });
      } else {
        details.push({ type: '精准总分', myBet: myLabel, amount: bet.preciseTotal.amount, actual: actualLabel, result: '未猜中', lost: bet.preciseTotal.amount });
      }
    }

    if (bet.preciseDiff && bet.preciseDiff.amount > 0) {
      const myLabel = `${bet.preciseDiff.value} 分差`;
      const actualLabel = `${scoreDiff} 分差`;
      if (parseInt(bet.preciseDiff.value) === scoreDiff) {
        const winAmount = bet.preciseDiff.amount * 15;
        user.coins += winAmount;
        user.totalWinnings += winAmount;
        totalWon += winAmount;
        details.push({ type: '精准分差', myBet: myLabel, amount: bet.preciseDiff.amount, actual: actualLabel, result: '猜中', won: winAmount });
      } else {
        details.push({ type: '精准分差', myBet: myLabel, amount: bet.preciseDiff.amount, actual: actualLabel, result: '未猜中', lost: bet.preciseDiff.amount });
      }
    }

    const netResult = user.coins - coinsBefore;
    settlements.push({ username, totalWon, totalBetted, netResult, details, newCoins: user.coins });

    if (!user.coinLog) user.coinLog = [];
    const now = new Date().toISOString();
    const matchLabel = `${gameState.matchName} 第${gameState.round}局`;
    if (totalBetted > 0) {
      user.coinLog.push({ time: now, type: 'spend', amount: totalBetted, reason: `竞猜下注 · ${matchLabel}`, balance: coinsBefore - totalBetted });
    }
    if (totalWon > 0) {
      user.coinLog.push({ time: now, type: 'gain', amount: totalWon, reason: `竞猜赢得 · ${matchLabel}`, balance: user.coins });
    }
    for (const d of details) {
      if (d.refund) {
        user.coinLog.push({ time: now, type: 'gain', amount: d.refund, reason: `平局退还 · ${matchLabel} · ${d.type}`, balance: user.coins });
      }
    }

    if (!user.history) user.history = [];
    user.history.push({
      time: new Date().toISOString(),
      matchName: gameState.matchName,
      gameType: gameState.gameType,
      blueTier: gameState.blueTier,
      redTier: gameState.redTier,
      blueScore: bs,
      redScore: rs,
      round: gameState.round,
      totalBetted,
      totalWon,
      netResult,
      details,
    });
  }

  saveUsers(users);

  const resultData = {
    gameType: gameState.gameType,
    redScore: rs,
    blueScore: bs,
    iceBalls: ice,
    fireBalls: fire,
    windBalls: wind,
    totalKnockdowns: knockdowns,
    winSide,
    elementWinner,
    totalScore,
    scoreDiff,
    settlements,
  };

  io.emit('game:result', resultData);
  io.emit('game:update', buildGameInfo());
  io.emit('rank:update', buildRankings());

  console.log(`[Admin] settle: ${winSide || '平局'} red=${rs} blue=${bs}`);
  res.json({ success: true, settlements });
});

// 重置下一局
app.post('/api/admin/reset', (req, res) => {
  if (!checkAdminToken(req, res)) return;

  const nextRound = gameState.round + 1;
  gameState = createFreshGame();
  gameState.round = nextRound;

  io.emit('game:next', buildGameInfo());
  io.emit('game:update', buildGameInfo());
  io.emit('bet:update', buildBetSummary());

  console.log(`[Admin] reset: -> round ${gameState.round}`);
  res.json({ success: true, round: gameState.round });
});

// ========== 启动 ==========

const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on http://0.0.0.0:${PORT}`);
});
