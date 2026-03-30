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
const MATCH_HISTORY_FILE = path.join(DATA_DIR, 'matchHistory.json');

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

// ========== 选手积分与赔率（按玩法独立积分） ==========

const DEFAULT_RATING = 100;
const MIN_RATING = 1;
const ODDS_FEE_RATE = 0.10;
const SCORE_RATE = 0.05;
const WIN_BET_BLOCK_WIN_RATE = 0.90;
const GAME_TYPES = ['hockey', 'boxing'];

function round2(x) {
  return Math.round(Number(x) * 100) / 100;
}

function normalizeGameType(gameType) {
  return GAME_TYPES.includes(gameType) ? gameType : 'hockey';
}

function sanitizeRating(value, fallback = DEFAULT_RATING) {
  const num = Number(value);
  if (!Number.isFinite(num)) return fallback;
  return Math.max(MIN_RATING, round2(num));
}

function ensureUserRatings(user) {
  let changed = false;
  if (!user.ratings || typeof user.ratings !== 'object') {
    user.ratings = {};
    changed = true;
  }
  for (const gameType of GAME_TYPES) {
    const raw = user.ratings[gameType] ?? user.rating ?? DEFAULT_RATING;
    const normalized = sanitizeRating(raw, DEFAULT_RATING);
    if (user.ratings[gameType] !== normalized) {
      user.ratings[gameType] = normalized;
      changed = true;
    }
  }
  // 兼容旧字段，避免老客户端读取异常
  if (user.rating !== user.ratings.hockey) {
    user.rating = user.ratings.hockey;
    changed = true;
  }
  return changed;
}

// 启动时迁移：为老用户补全 ratings（按玩法独立）
let usersNeedSave = false;
for (const u of Object.values(users)) {
  if (ensureUserRatings(u)) usersNeedSave = true;
}
if (usersNeedSave) saveUsers(users);

function getUserRating(username, gameType) {
  if (!username) return null;
  const u = users[username];
  if (!u) return null;
  ensureUserRatings(u);
  return u.ratings[normalizeGameType(gameType)] ?? DEFAULT_RATING;
}

function getExpectedWinRate(myRating, enemyRating) {
  const my = sanitizeRating(myRating, DEFAULT_RATING);
  const enemy = sanitizeRating(enemyRating, DEFAULT_RATING);
  const total = my + enemy;
  if (total <= 0) return 0.5;
  return my / total;
}

function isRobotPlayer(name) {
  if (!name) return false;
  const raw = String(name).trim();
  // 机器人定义：只要当前选手名不在用户数据中，即视为机器人。
  return !users[raw];
}

function getWinBetRestriction(redPlayer, bluePlayer, gameType) {
  const redIsRobot = isRobotPlayer(redPlayer);
  const blueIsRobot = isRobotPlayer(bluePlayer);
  if (redIsRobot || blueIsRobot) {
    return {
      winBetEnabled: false,
      blockedReason: '本场为机器人对局，暂不开放胜负竞猜，可参与趣味竞猜',
      redWinRate: null,
      blueWinRate: null,
    };
  }

  const redRating = getUserRating(redPlayer, gameType);
  const blueRating = getUserRating(bluePlayer, gameType);
  if (redRating === null || blueRating === null) {
    return {
      winBetEnabled: true,
      blockedReason: '',
      redWinRate: null,
      blueWinRate: null,
    };
  }
  const redWinRate = getExpectedWinRate(redRating, blueRating);
  const blueWinRate = getExpectedWinRate(blueRating, redRating);
  const blocked = redWinRate >= WIN_BET_BLOCK_WIN_RATE || blueWinRate >= WIN_BET_BLOCK_WIN_RATE;
  return {
    winBetEnabled: !blocked,
    blockedReason: blocked ? '双方实力差距过大，本场暂不开放胜负竞猜，可参与趣味竞猜' : '',
    redWinRate: round2(redWinRate),
    blueWinRate: round2(blueWinRate),
  };
}

/** 本局竞猜净盈亏（相对下注本金）：下注已在 bet:place 扣款，不能用结算前后余额差 */
function computeBetNetResult(totalWon, totalBetted, details) {
  let refundSum = 0;
  for (const d of details) {
    if (d.refund) refundSum += d.refund;
  }
  return Math.round((totalWon + refundSum - totalBetted) * 10) / 10;
}

/** 根据红蓝选手积分计算赔率，赔率 = (1 / 胜率) * (1 - 服务费) */
function getOddsByRating(redPlayer, bluePlayer, gameType) {
  const redRating = getUserRating(redPlayer, gameType);
  const blueRating = getUserRating(bluePlayer, gameType);

  if (redRating === null || blueRating === null) {
    return { red: 1.1, blue: 1.1 };
  }

  const redWinRate = getExpectedWinRate(redRating, blueRating);
  const blueWinRate = getExpectedWinRate(blueRating, redRating);
  const redOdds = (1 / redWinRate) * (1 - ODDS_FEE_RATE);
  const blueOdds = (1 / blueWinRate) * (1 - ODDS_FEE_RATE);
  return {
    red: round2(redOdds),
    blue: round2(blueOdds),
  };
}

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

// ========== 比赛状态（仅内存） ==========

let gameState = createFreshGame();
let lastSettledMatch = null;  // 上一局结果，用于 waiting 时展示

/** 未填写赛事名称时用语义化默认名（按局数），避免客户端仍显示上一局名称或留空 */
function ensureDefaultMatchName() {
  if (String(gameState.matchName || '').trim()) return;
  gameState.matchName = `第${gameState.round}局`;
}

function createFreshGame() {
  return {
    status: 'waiting',       // waiting | betting | started | settled
    gameType: 'hockey',      // hockey（魔法冰球） | boxing（魔法拳王）
    matchName: '',
    redPlayer: null,         // 红方选手用户名
    bluePlayer: null,       // 蓝方选手用户名
    redScore: '',
    blueScore: '',
    iceBalls: '',
    fireBalls: '',
    windBalls: '',
    totalKnockdowns: '',     // 魔法拳王：双方倒地次数总和
    bets: {},
    round: 1,
    isMasterMode: true,      // 是否大师模式；冰球非大师模式时不显示/结算元素之王
    /** 锁定下注瞬间的胜负赔率快照；赛后积分变化时仍展示赛前赔率 */
    lockedOdds: null,
    /** 本局最近一次开奖 payload（与 game:result 一致），供 HTTP / 重进页恢复展示 */
    lastSettleResult: null,
  };
}

/** 比赛开始（锁定下注）时调用，固定本局用于展示与结算的胜负赔率 */
function lockOddsForCurrentMatch() {
  gameState.lockedOdds = getOddsByRating(gameState.redPlayer, gameState.bluePlayer, gameState.gameType);
}

function buildGameInfo() {
  const liveOdds = getOddsByRating(gameState.redPlayer, gameState.bluePlayer, gameState.gameType);
  const odds =
    (gameState.status === 'started' || gameState.status === 'settled') && gameState.lockedOdds
      ? gameState.lockedOdds
      : liveOdds;
  const redRating = gameState.redPlayer ? getUserRating(gameState.redPlayer, gameState.gameType) : null;
  const blueRating = gameState.bluePlayer ? getUserRating(gameState.bluePlayer, gameState.gameType) : null;
  const winBetRestriction = getWinBetRestriction(gameState.redPlayer, gameState.bluePlayer, gameState.gameType);
  const info = {
    status: gameState.status,
    gameType: gameState.gameType,
    matchName: gameState.matchName,
    redPlayer: gameState.redPlayer,
    bluePlayer: gameState.bluePlayer,
    redRating: redRating ?? 0,
    blueRating: blueRating ?? 0,
    round: gameState.round,
    odds,
    isMasterMode: gameState.isMasterMode ?? true,
    winBetEnabled: winBetRestriction.winBetEnabled,
    winBetDisabledReason: winBetRestriction.blockedReason,
    redWinRate: winBetRestriction.redWinRate,
    blueWinRate: winBetRestriction.blueWinRate,
  };
  if (gameState.status === 'started' || gameState.status === 'settled') {
    const rs = typeof gameState.redScore === 'number' ? gameState.redScore : parseInt(gameState.redScore);
    const bs = typeof gameState.blueScore === 'number' ? gameState.blueScore : parseInt(gameState.blueScore);
    info.redScore = !isNaN(rs) ? rs : gameState.redScore;
    info.blueScore = !isNaN(bs) ? bs : gameState.blueScore;
    if (!isNaN(rs) && !isNaN(bs)) {
      info.winSide = rs > bs ? 'red' : rs < bs ? 'blue' : null;
      info.result = rs > bs ? '红方胜' : rs < bs ? '蓝方胜' : '平局';
      info.totalScore = rs + bs;
      info.scoreDiff = Math.abs(rs - bs);
    }
    if (gameState.status === 'settled') {
      info.elementWinner = gameState.elementWinner ?? null;
      info.totalKnockdowns = gameState.totalKnockdowns;
      if (gameState.lastSettleResult) {
        info.lastGameResult = gameState.lastSettleResult;
      }
    }
  }
  // waiting 或 betting 时展示上一局结果（比赛结束后、下一局开始前/中）
  if ((gameState.status === 'waiting' || gameState.status === 'betting') && lastSettledMatch) {
    info.lastSettledMatch = lastSettledMatch;
  }
  return info;
}

function buildContestStatus() {
  return {
    redPlayer: gameState.redPlayer,
    bluePlayer: gameState.bluePlayer,
    redAvailable: gameState.redPlayer === null,
    blueAvailable: gameState.bluePlayer === null,
  };
}

function refundAllBets(reason) {
  const now = new Date().toISOString();
  for (const [username, bet] of Object.entries(gameState.bets)) {
    const user = users[username];
    if (!user) continue;
    const totalBetted = Object.values(bet).reduce((s, b) => s + (b.amount || 0), 0);
    if (totalBetted > 0) {
      user.coins = (user.coins || 0) + totalBetted;
      user.coinLog = user.coinLog || [];
      user.coinLog.push({
        time: now, type: 'gain', amount: totalBetted,
        reason,
        balance: user.coins
      });
    }
  }
  saveUsers(users);
}

function loadMatchHistory() {
  try {
    if (fs.existsSync(MATCH_HISTORY_FILE)) {
      return JSON.parse(fs.readFileSync(MATCH_HISTORY_FILE, 'utf-8'));
    }
  } catch (e) {
    console.error('Failed to load match history:', e.message);
  }
  return [];
}

function saveMatchHistory(history) {
  fs.writeFileSync(MATCH_HISTORY_FILE, JSON.stringify(history, null, 2), 'utf-8');
}

function appendMatchRecord(record) {
  const history = loadMatchHistory();
  history.push(record);
  saveMatchHistory(history);
}

function applyPlayerRatingAndHistory(rs, bs, winSide) {
  const redPlayer = gameState.redPlayer;
  const bluePlayer = gameState.bluePlayer;
  const gameType = normalizeGameType(gameState.gameType);
  let redRatingChange = 0;
  let blueRatingChange = 0;
  let redRatingBefore = null;
  let blueRatingBefore = null;
  let redRatingAfter = null;
  let blueRatingAfter = null;
  let result = '平局';

  if (redPlayer && bluePlayer) {
    const redCurrent = getUserRating(redPlayer, gameType);
    const blueCurrent = getUserRating(bluePlayer, gameType);
    redRatingBefore = redCurrent;
    blueRatingBefore = blueCurrent;

    if (winSide === 'red') {
      const newRed = sanitizeRating(redCurrent * (1 + SCORE_RATE * (blueCurrent / redCurrent)), redCurrent);
      const newBlue = sanitizeRating(blueCurrent / (1 + SCORE_RATE * (blueCurrent / redCurrent)), blueCurrent);
      redRatingAfter = Math.max(MIN_RATING, round2(newRed));
      blueRatingAfter = Math.max(MIN_RATING, round2(newBlue));
      redRatingChange = round2(redRatingAfter - redCurrent);
      blueRatingChange = round2(blueRatingAfter - blueCurrent);
      result = '红方胜';
    } else if (winSide === 'blue') {
      const newRed = sanitizeRating(redCurrent / (1 + SCORE_RATE * (redCurrent / blueCurrent)), redCurrent);
      const newBlue = sanitizeRating(blueCurrent * (1 + SCORE_RATE * (redCurrent / blueCurrent)), blueCurrent);
      redRatingAfter = Math.max(MIN_RATING, round2(newRed));
      blueRatingAfter = Math.max(MIN_RATING, round2(newBlue));
      redRatingChange = round2(redRatingAfter - redCurrent);
      blueRatingChange = round2(blueRatingAfter - blueCurrent);
      result = '蓝方胜';
    } else {
      redRatingAfter = redCurrent;
      blueRatingAfter = blueCurrent;
    }
  }

  if (redPlayer && users[redPlayer]) {
    ensureUserRatings(users[redPlayer]);
    if (redRatingAfter !== null) {
      users[redPlayer].ratings[gameType] = redRatingAfter;
      users[redPlayer].rating = users[redPlayer].ratings.hockey;
    }
  }
  if (bluePlayer && users[bluePlayer]) {
    ensureUserRatings(users[bluePlayer]);
    if (blueRatingAfter !== null) {
      users[bluePlayer].ratings[gameType] = blueRatingAfter;
      users[bluePlayer].rating = users[bluePlayer].ratings.hockey;
    }
  }

  appendMatchRecord({
    time: new Date().toISOString(),
    matchName: gameState.matchName,
    gameType: gameState.gameType,
    redPlayer,
    bluePlayer,
    redScore: rs,
    blueScore: bs,
    ratingGameType: gameType,
    redRatingBefore,
    blueRatingBefore,
    redRatingAfter,
    blueRatingAfter,
    redRatingChange,
    blueRatingChange,
    result,
  });
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

/** 选手积分排行（按积分从高到低，有积分的选手即可上榜） */
function buildRatingRankings(gameType = 'hockey') {
  const normalizedGameType = normalizeGameType(gameType);
  return Object.values(users)
    .map((u) => {
      ensureUserRatings(u);
      return u;
    })
    .filter(u => (u.ratings?.[normalizedGameType] ?? 0) > 0)
    .map(u => ({
      name: u.name,
      rating: u.ratings?.[normalizedGameType] ?? DEFAULT_RATING,
    }))
    .sort((a, b) => b.rating - a.rating);
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
      rating: DEFAULT_RATING,
      ratings: {
        hockey: DEFAULT_RATING,
        boxing: DEFAULT_RATING,
      },
      lastCheckin: null,
      adWatchedToday: 0,
      lastAdDate: null,
      coinLog: [{ time: new Date().toISOString(), type: 'gain', amount: 100, reason: '新用户注册奖励', balance: 100 }],
    };
    saveUsers(users);
  } else {
    if (ensureUserRatings(users[trimmed])) saveUsers(users);
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
  if (ensureUserRatings(user)) saveUsers(users);
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

app.get('/api/rating-rankings', (req, res) => {
  const gameType = normalizeGameType(req.query.gameType || gameState.gameType);
  res.json({ gameType, rankings: buildRatingRankings(gameType) });
});

app.get('/api/game', (_req, res) => {
  res.json({
    gameInfo: buildGameInfo(),
    betSummary: buildBetSummary(),
    contestStatus: buildContestStatus(),
  });
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

// ========== 参赛 API ==========

app.get('/api/contest/status', (_req, res) => {
  const contestStatus = buildContestStatus();
  const gameInfo = buildGameInfo();
  res.json({ contestStatus, gameInfo });
});

app.post('/api/contest/confirm', (req, res) => {
  const { name, side } = req.body;
  if (!name || !users[name]) {
    return res.status(404).json({ error: '用户不存在' });
  }
  if (gameState.status !== 'betting') {
    return res.status(400).json({ error: '当前无法参赛' });
  }
  if (side !== 'red' && side !== 'blue') {
    return res.status(400).json({ error: '请选择红方或蓝方' });
  }
  if (side === 'red' && gameState.redPlayer) {
    return res.status(400).json({ error: '红方已被选择' });
  }
  if (side === 'blue' && gameState.bluePlayer) {
    return res.status(400).json({ error: '蓝方已被选择' });
  }
  const myBets = gameState.bets[name] || {};
  const hasBets = (myBets.winBet?.amount > 0) || (myBets.elementKing?.amount > 0) ||
    (myBets.knockdownKing?.amount > 0) || (myBets.preciseTotal?.amount > 0) || (myBets.preciseDiff?.amount > 0);
  if (hasBets) {
    return res.status(400).json({ error: '当前有正在参与的竞猜，需要取消掉才能参赛' });
  }
  if (side === 'red') {
    gameState.redPlayer = name;
  } else {
    gameState.bluePlayer = name;
  }
  io.emit('game:update', buildGameInfo());
  io.emit('contest:update', buildContestStatus());
  res.json({ success: true, contestStatus: buildContestStatus() });
});

app.post('/api/contest/cancel', (req, res) => {
  const { name } = req.body;
  if (!name || !users[name]) {
    return res.status(404).json({ error: '用户不存在' });
  }
  if (gameState.status !== 'betting') {
    return res.status(400).json({ error: '比赛开始后无法撤销参赛' });
  }
  if (gameState.redPlayer === name) {
    gameState.redPlayer = null;
  } else if (gameState.bluePlayer === name) {
    gameState.bluePlayer = null;
  } else {
    return res.status(400).json({ error: '您未参赛' });
  }
  io.emit('game:update', buildGameInfo());
  io.emit('contest:update', buildContestStatus());
  res.json({ success: true, contestStatus: buildContestStatus() });
});

app.get('/api/match-history/:name', (req, res) => {
  const { name } = req.params;
  if (!users[name]) {
    return res.status(404).json({ error: '用户不存在' });
  }
  const history = loadMatchHistory();
  const userHistory = history
    .filter(m => m.redPlayer === name || m.bluePlayer === name)
    .slice()
    .reverse();
  res.json({ history: userHistory });
});

// ========== 弹幕（内存队列；手机 Socket 实时 + Unity poll）==========

const DANMAKU_MAX_LEN = 40;
const DANMAKU_RING_MAX = 500;
/** 同一账号两次发送的最小间隔 */
const DANMAKU_INTERVAL_MS = 5000;
/** 敏感词文件（每行一个词；支持 # 注释行） */
const DANMAKU_BLOCKED_WORDS_FILE = path.join(DATA_DIR, 'danmakuBlockedWords.txt');
/** 文件缺失/读取失败时的最小兜底词库 */
const DANMAKU_BLOCKED_WORDS_FALLBACK = ['傻逼', 'nmsl', 'fuck', 'shit'];

let danmakuSeq = 0;
const danmakuRing = [];
let danmakuSessionKey = '';
const danmakuLastSendMs = {};
/** 超过该时间未再发弹幕则视为不活跃，从频控表中删除（避免长时间运行只增不减） */
const DANMAKU_LAST_SEND_STALE_MS = 60 * 60 * 1000;
const DANMAKU_LAST_SEND_PRUNE_INTERVAL_MS = 15 * 60 * 1000;

function normalizeBlockedWordLine(line) {
  return String(line || '').trim();
}

function parseDanmakuBlockedWordsText(text) {
  const set = new Set();
  const lines = String(text || '').split(/\r?\n/);
  for (const rawLine of lines) {
    const line = normalizeBlockedWordLine(rawLine);
    if (!line || line.startsWith('#')) continue;
    set.add(line);
  }
  return Array.from(set);
}

function buildDanmakuBlockedWordsTemplate() {
  return [
    '# 弹幕敏感词词库（每行一个词）',
    '# 说明：',
    '# 1) 以 # 开头的行会被忽略',
    '# 2) 修改后调用 /api/danmaku/reload-words 或重启服务即可生效',
    ...DANMAKU_BLOCKED_WORDS_FALLBACK,
    '',
  ].join('\n');
}

function ensureDanmakuBlockedWordsFile() {
  if (fs.existsSync(DANMAKU_BLOCKED_WORDS_FILE)) return;
  try {
    fs.writeFileSync(DANMAKU_BLOCKED_WORDS_FILE, buildDanmakuBlockedWordsTemplate(), 'utf-8');
    console.log('[danmaku] created blocked words file:', DANMAKU_BLOCKED_WORDS_FILE);
  } catch (e) {
    console.error('[danmaku] failed to create blocked words file:', e.message);
  }
}

function loadDanmakuBlockedWords() {
  ensureDanmakuBlockedWordsFile();
  try {
    const text = fs.readFileSync(DANMAKU_BLOCKED_WORDS_FILE, 'utf-8');
    const words = parseDanmakuBlockedWordsText(text);
    if (words.length > 0) {
      console.log(`[danmaku] loaded blocked words: ${words.length}`);
      return { words, source: 'file', reason: null };
    }
    console.warn('[danmaku] blocked words file is empty, fallback to defaults');
    return {
      words: DANMAKU_BLOCKED_WORDS_FALLBACK.slice(),
      source: 'fallback',
      reason: 'blocked words file is empty',
    };
  } catch (e) {
    console.error('[danmaku] failed to load blocked words file:', e.message);
    return {
      words: DANMAKU_BLOCKED_WORDS_FALLBACK.slice(),
      source: 'fallback',
      reason: `failed to load file: ${e.message}`,
    };
  }
}

const initialDanmakuWords = loadDanmakuBlockedWords();
let danmakuBlockedWords = initialDanmakuWords.words;

function pruneDanmakuLastSendMs() {
  const cutoff = Date.now() - DANMAKU_LAST_SEND_STALE_MS;
  let removed = 0;
  for (const k of Object.keys(danmakuLastSendMs)) {
    if (danmakuLastSendMs[k] < cutoff) {
      delete danmakuLastSendMs[k];
      removed += 1;
    }
  }
  if (removed > 0) {
    console.log(`[danmaku] pruned ${removed} stale rate-limit entries`);
  }
}

setInterval(pruneDanmakuLastSendMs, DANMAKU_LAST_SEND_PRUNE_INTERVAL_MS);

function ensureDanmakuSession() {
  const key = `${gameState.matchName || ''}|${gameState.round}`;
  if (key !== danmakuSessionKey) {
    danmakuSessionKey = key;
    danmakuRing.length = 0;
    danmakuSeq = 0;
  }
}

function danmakuContainsBlocked(text) {
  const t = String(text);
  const lower = t.toLowerCase();
  for (const w of danmakuBlockedWords) {
    if (!w) continue;
    if (/[^\x00-\x7f]/.test(w)) {
      if (t.includes(w)) return true;
    } else if (lower.includes(w.toLowerCase())) return true;
  }
  return false;
}

app.post('/api/danmaku/send', (req, res) => {
  ensureDanmakuSession();
  const { username, text } = req.body || {};
  const name = typeof username === 'string' ? username.trim() : '';
  const raw = typeof text === 'string' ? text.trim() : '';
  if (!name || !users[name]) {
    return res.status(404).json({ error: '用户不存在' });
  }
  if (!raw.length || raw.length > DANMAKU_MAX_LEN) {
    return res.status(400).json({ error: `弹幕长度为 1～${DANMAKU_MAX_LEN} 字` });
  }
  if (danmakuContainsBlocked(raw)) {
    return res.status(400).json({ error: '内容包含不当词语' });
  }
  const now = Date.now();
  const last = danmakuLastSendMs[name] || 0;
  if (now - last < DANMAKU_INTERVAL_MS) {
    return res.status(429).json({ error: '发送过于频繁，每 5 秒只能发 1 条' });
  }
  danmakuLastSendMs[name] = now;
  danmakuSeq += 1;
  const item = {
    seq: danmakuSeq,
    ts: new Date().toISOString(),
    username: name,
    text: raw,
  };
  danmakuRing.push(item);
  while (danmakuRing.length > DANMAKU_RING_MAX) danmakuRing.shift();
  io.emit('danmaku:message', item);
  res.json({ ok: true, seq: item.seq, ts: item.ts });
});

app.post('/api/danmaku/reload-words', (_req, res) => {
  const previousCount = danmakuBlockedWords.length;
  const loaded = loadDanmakuBlockedWords();
  danmakuBlockedWords = loaded.words;
  res.json({
    ok: true,
    source: loaded.source,
    reason: loaded.reason,
    previousCount,
    currentCount: danmakuBlockedWords.length,
    file: DANMAKU_BLOCKED_WORDS_FILE,
  });
});

app.get('/api/danmaku/poll', (req, res) => {
  const clientSessionRaw = req.query.sessionId != null ? String(req.query.sessionId) : '';
  ensureDanmakuSession();
  const sessionId = danmakuSessionKey;

  const since = parseInt(req.query.since, 10);
  const s = Number.isFinite(since) ? since : 0;

  /** 客户端仍持上一场的 sessionId，场次已换 */
  const sessionMismatch = clientSessionRaw !== '' && clientSessionRaw !== sessionId;
  /**
   * 场次重置后 danmakuSeq 从 0 再起，若 Unity 仍带上一场的大 since（如 50），
   * 会出现 seq > s 恒为假且 truncated 误判为 false —— 应用全量重同步。
   */
  const staleSinceCursor = s > danmakuSeq;

  let items;
  let truncated;
  if (sessionMismatch || staleSinceCursor) {
    items = danmakuRing.slice();
    truncated = true;
  } else {
    const minSeq = danmakuRing.length ? danmakuRing[0].seq : danmakuSeq + 1;
    truncated = danmakuRing.length > 0 && s < minSeq - 1;
    items = danmakuRing.filter((it) => it.seq > s);
  }

  res.json({
    sessionId,
    latestSeq: danmakuSeq,
    truncated,
    items,
  });
});

// ========== Socket.IO ==========

io.on('connection', (socket) => {
  console.log(`Client connected: ${socket.id}`);

  socket.emit('game:update', buildGameInfo());
  socket.emit('bet:update', buildBetSummary());
  socket.emit('rank:update', buildRankings());
  socket.emit('contest:update', buildContestStatus());

  // 手机端：确认参赛
  socket.on('contest:confirm', (data) => {
    const { name, side } = data;
    if (!name || !users[name]) {
      socket.emit('contest:error', { message: '用户不存在' });
      return;
    }
    if (gameState.status !== 'betting') {
      socket.emit('contest:error', { message: '当前无法参赛' });
      return;
    }
    if (side !== 'red' && side !== 'blue') {
      socket.emit('contest:error', { message: '请选择红方或蓝方' });
      return;
    }
    if (side === 'red' && gameState.redPlayer) {
      socket.emit('contest:error', { message: '红方已被选择' });
      return;
    }
    if (side === 'blue' && gameState.bluePlayer) {
      socket.emit('contest:error', { message: '蓝方已被选择' });
      return;
    }
    const myBets = gameState.bets[name] || {};
    const hasBets = (myBets.winBet?.amount > 0) || (myBets.elementKing?.amount > 0) ||
      (myBets.knockdownKing?.amount > 0) || (myBets.preciseTotal?.amount > 0) || (myBets.preciseDiff?.amount > 0);
    if (hasBets) {
      socket.emit('contest:error', { message: '当前有正在参与的竞猜，需要取消掉才能参赛' });
      return;
    }
    if (side === 'red') gameState.redPlayer = name;
    else gameState.bluePlayer = name;
    io.emit('game:update', buildGameInfo());
    io.emit('contest:update', buildContestStatus());
  });

  // 手机端：撤销参赛
  socket.on('contest:cancel', (data) => {
    const { name } = data;
    if (!name || !users[name]) {
      socket.emit('contest:error', { message: '用户不存在' });
      return;
    }
    if (gameState.status !== 'betting') {
      socket.emit('contest:error', { message: '比赛开始后无法撤销参赛' });
      return;
    }
    if (gameState.redPlayer === name) {
      gameState.redPlayer = null;
    } else if (gameState.bluePlayer === name) {
      gameState.bluePlayer = null;
    } else {
      socket.emit('contest:error', { message: '您未参赛' });
      return;
    }
    io.emit('game:update', buildGameInfo());
    io.emit('contest:update', buildContestStatus());
  });

  // PC 端：更新比赛设置（仅在 waiting/betting 状态下允许，选手由手机端参赛确认）
  socket.on('game:config', (data) => {
    if (gameState.status === 'started' || gameState.status === 'settled') return;
    const { matchName, gameType, isMasterMode } = data;
    if (matchName !== undefined) gameState.matchName = matchName;
    if (gameType && (gameType === 'hockey' || gameType === 'boxing')) gameState.gameType = gameType;
    if (isMasterMode !== undefined) gameState.isMasterMode = !!isMasterMode;
    io.emit('game:update', buildGameInfo());
  });

  // PC 端：开始竞猜（从 waiting 进入 betting，允许手机端下注）
  socket.on('game:openBetting', () => {
    if (gameState.status !== 'waiting') return;
    ensureDefaultMatchName();
    gameState.status = 'betting';
    io.emit('game:update', buildGameInfo());
  });

  // PC 端：比赛开始（锁定下注）
  socket.on('game:start', () => {
    if (gameState.status !== 'betting') return;
    lockOddsForCurrentMatch();
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
    const isMasterMode = gameState.isMasterMode ?? true;
    if (isHockey && isMasterMode) {
      if (iceBalls === '' || iceBalls === undefined || iceBalls === null) missing.push('冰球次数');
      if (fireBalls === '' || fireBalls === undefined || fireBalls === null) missing.push('火球次数');
      if (windBalls === '' || windBalls === undefined || windBalls === null) missing.push('风球次数');
    } else if (!isHockey) {
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

    if (isHockey && isMasterMode) {
      ice = parseInt(iceBalls);
      fire = parseInt(fireBalls);
      wind = parseInt(windBalls);
      const maxElem = Math.max(ice, fire, wind);
      // 并列时按固定优先级 ice > fire > wind 决出元素之王
      if (ice === maxElem) elementWinner = 'ice';
      else if (fire === maxElem) elementWinner = 'fire';
      else elementWinner = 'wind';
    } else if (!isHockey) {
      knockdowns = parseInt(totalKnockdowns);
    }

    gameState.redScore = rs;
    gameState.blueScore = bs;
    gameState.iceBalls = ice;
    gameState.fireBalls = fire;
    gameState.windBalls = wind;
    gameState.totalKnockdowns = knockdowns;
    gameState.elementWinner = elementWinner;
    if (!gameState.lockedOdds) {
      lockOddsForCurrentMatch();
    }
    gameState.status = 'settled';

    const odds = gameState.lockedOdds || getOddsByRating(gameState.redPlayer, gameState.bluePlayer, gameState.gameType);
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

      // 下注金额已在 bet:place 时扣减，此处仅结算奖金/退还
      let totalBetted = 0;
      if (bet.winBet && bet.winBet.amount > 0) totalBetted += bet.winBet.amount;
      if (isHockey && isMasterMode && bet.elementKing && bet.elementKing.amount > 0) totalBetted += bet.elementKing.amount;
      if (!isHockey && bet.knockdownKing && bet.knockdownKing.amount > 0) totalBetted += bet.knockdownKing.amount;
      if (bet.preciseTotal && bet.preciseTotal.amount > 0) totalBetted += bet.preciseTotal.amount;
      if (bet.preciseDiff && bet.preciseDiff.amount > 0) totalBetted += bet.preciseDiff.amount;

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

      // 元素之王（仅冰球大师模式）
      if (isHockey && isMasterMode && bet.elementKing && bet.elementKing.amount > 0) {
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

      const netResult = computeBetNetResult(totalWon, totalBetted, details);
      settlements.push({ username, totalWon, totalBetted, netResult, details, newCoins: user.coins });

      // 竞猜币流水（下注扣减已在 bet:place 时记录，此处只记赢得/退还）
      if (!user.coinLog) user.coinLog = [];
      const now = new Date().toISOString();
      const matchLabel = `${gameState.matchName} 第${gameState.round}局`;
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
        redPlayer: gameState.redPlayer,
        bluePlayer: gameState.bluePlayer,
        blueScore: bs,
        redScore: rs,
        round: gameState.round,
        totalBetted,
        totalWon,
        netResult,
        details,
      });
    }

    applyPlayerRatingAndHistory(rs, bs, winSide);
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

    gameState.lastSettleResult = resultData;
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
      refundAllBets(`第${gameState.round}局作废，押注已全额退还`);
    }
    if (gameState.status === 'settled' && gameState.redPlayer && gameState.bluePlayer) {
      const rs = parseInt(gameState.redScore);
      const bs = parseInt(gameState.blueScore);
      lastSettledMatch = {
        matchName: gameState.matchName,
        gameType: gameState.gameType,
        redPlayer: gameState.redPlayer,
        bluePlayer: gameState.bluePlayer,
        redScore: isNaN(rs) ? '' : rs,
        blueScore: isNaN(bs) ? '' : bs,
        result: !isNaN(rs) && !isNaN(bs) ? (rs > bs ? '红方胜' : rs < bs ? '蓝方胜' : '平局') : '',
        odds: gameState.lockedOdds ? { ...gameState.lockedOdds } : null,
      };
    }
    const nextRound = gameState.round + 1;
    gameState = createFreshGame();
    gameState.round = nextRound;
    io.emit('game:next', buildGameInfo());
    io.emit('game:update', buildGameInfo());
    io.emit('bet:update', buildBetSummary());
    io.emit('contest:update', buildContestStatus());
  });

  // PC 端：取消竞猜（betting 或 started 状态，退还所有押注，进入下一局）
  socket.on('game:cancel', () => {
    if (gameState.status !== 'betting') {
      socket.emit('game:error', { message: '只能在竞猜开始后、比赛开始前取消竞猜' });
      return;
    }
    refundAllBets(`第${gameState.round}局取消竞猜，押注已全额退还`);
    const nextRound = gameState.round + 1;
    gameState = createFreshGame();
    gameState.round = nextRound;
    io.emit('game:cancel', buildGameInfo());
    io.emit('game:update', buildGameInfo());
    io.emit('bet:update', buildBetSummary());
    io.emit('contest:update', buildContestStatus());
    console.log(`[Admin] cancel: refunded bets, -> round ${gameState.round}`);
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
    if (gameState.redPlayer === username || gameState.bluePlayer === username) {
      socket.emit('bet:error', { message: '要先撤销参赛，才能参与竞猜' });
      return;
    }

    const user = users[username];
    if (!gameState.bets[username]) {
      gameState.bets[username] = {};
    }
    const myBets = gameState.bets[username];

    const amt = parseInt(amount, 10);
    if (!Number.isFinite(amt) || amt < 10) {
      socket.emit('bet:error', { message: amt > 0 && amt < 10 ? '单次下注至少需要 10 竞猜币' : '请输入有效的下注金额（最少 10 币）' });
      return;
    }

    // 计算用户当前已下注总额（不含本次要修改的项目）
    let totalBetted = 0;
    if (myBets.winBet && betType !== 'winBet') totalBetted += myBets.winBet.amount || 0;
    if (myBets.elementKing && betType !== 'elementKing') totalBetted += myBets.elementKing.amount || 0;
    if (myBets.knockdownKing && betType !== 'knockdownKing') totalBetted += myBets.knockdownKing.amount || 0;
    if (myBets.preciseTotal && betType !== 'preciseTotal') totalBetted += myBets.preciseTotal.amount || 0;
    if (myBets.preciseDiff && betType !== 'preciseDiff') totalBetted += myBets.preciseDiff.amount || 0;

    // 本次下注/修改的金额变化：新增或增加为正，减少为负（退还）
    const prevAmt = (myBets[betType] && myBets[betType].amount) || 0;
    const delta = amt - prevAmt;
    if (delta > 0 && delta > user.coins) {
      socket.emit('bet:error', { message: `竞猜币不足（当前 ${user.coins} 币，需再扣 ${delta} 币）` });
      return;
    }

    if (betType === 'winBet') {
      if (!gameState.redPlayer || !gameState.bluePlayer) {
        socket.emit('bet:error', { message: '请先等待红蓝双方选手就位后，再进行胜负竞猜' });
        return;
      }
      const restriction = getWinBetRestriction(gameState.redPlayer, gameState.bluePlayer, gameState.gameType);
      if (!restriction.winBetEnabled) {
        socket.emit('bet:error', { message: restriction.blockedReason });
        return;
      }
      if (side !== 'red' && side !== 'blue') {
        socket.emit('bet:error', { message: '请选择红方或蓝方' });
        return;
      }
      myBets.winBet = { side, amount: amt };
    } else if (betType === 'elementKing') {
      if (gameState.gameType === 'hockey' && !(gameState.isMasterMode ?? true)) {
        socket.emit('bet:error', { message: '当前模式不支持元素之王竞猜' });
        return;
      }
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

    // 下注时立即扣减竞猜币（delta>0 扣减，delta<0 退还修改差额）
    if (delta !== 0) {
      user.coins -= delta;
      if (!user.coinLog) user.coinLog = [];
      const matchLabel = `${gameState.matchName || '赛事'} 第${gameState.round}局`;
      if (delta > 0) {
        user.coinLog.push({ time: new Date().toISOString(), type: 'spend', amount: delta, reason: `竞猜下注 · ${matchLabel}`, balance: user.coins });
      } else {
        user.coinLog.push({ time: new Date().toISOString(), type: 'gain', amount: -delta, reason: `修改下注退还 · ${matchLabel}`, balance: user.coins });
      }
      saveUsers(users);
    }

    socket.emit('bet:myBets', myBets);
    if (delta !== 0) socket.emit('user:coins', { coins: user.coins });
    io.emit('bet:update', buildBetSummary());
  });

  // 手机端：取消下注（退还竞猜币）
  socket.on('bet:cancel', (data) => {
    const { username, betType } = data;
    if (gameState.status !== 'betting') {
      socket.emit('bet:error', { message: '当前无法修改下注' });
      return;
    }
    const bet = gameState.bets[username] && gameState.bets[username][betType];
    if (!bet) return;
    const refundAmt = bet.amount || 0;
    if (refundAmt > 0) {
      const user = users[username];
      if (user) {
        user.coins = (user.coins || 0) + refundAmt;
        if (!user.coinLog) user.coinLog = [];
        const matchLabel = `${gameState.matchName || '赛事'} 第${gameState.round}局`;
        user.coinLog.push({ time: new Date().toISOString(), type: 'gain', amount: refundAmt, reason: `取消下注退还 · ${matchLabel}`, balance: user.coins });
        saveUsers(users);
      }
    }
    delete gameState.bets[username][betType];
    socket.emit('bet:myBets', gameState.bets[username]);
    if (refundAmt > 0 && users[username]) socket.emit('user:coins', { coins: users[username].coins });
    io.emit('bet:update', buildBetSummary());
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

  // 若当前为已结算，先保存上一局结果供 waiting/betting 时展示
  if (gameState.status === 'settled' && gameState.redPlayer && gameState.bluePlayer) {
    const rs = parseInt(gameState.redScore);
    const bs = parseInt(gameState.blueScore);
    lastSettledMatch = {
      matchName: gameState.matchName,
      gameType: gameState.gameType,
      redPlayer: gameState.redPlayer,
      bluePlayer: gameState.bluePlayer,
      redScore: isNaN(rs) ? '' : rs,
      blueScore: isNaN(bs) ? '' : bs,
      result: !isNaN(rs) && !isNaN(bs) ? (rs > bs ? '红方胜' : rs < bs ? '蓝方胜' : '平局') : '',
      odds: gameState.lockedOdds ? { ...gameState.lockedOdds } : null,
    };
  }

  const { matchName, gameType, isMasterMode } = req.body;
  const nextRound = gameState.status === 'settled' ? gameState.round + 1 : gameState.round;
  gameState = createFreshGame();
  gameState.round = nextRound;

  if (matchName) gameState.matchName = matchName;
  if (gameType && (gameType === 'hockey' || gameType === 'boxing')) gameState.gameType = gameType;
  if (isMasterMode !== undefined) gameState.isMasterMode = !!isMasterMode;

  ensureDefaultMatchName();
  gameState.status = 'betting';

  io.emit('game:update', buildGameInfo());
  io.emit('bet:update', buildBetSummary());
  io.emit('rank:update', buildRankings());
  io.emit('contest:update', buildContestStatus());

  console.log(`[Admin] configure: ${gameType} "${matchName}", round=${gameState.round}`);
  res.json({ success: true, gameInfo: buildGameInfo() });
});

// 锁定下注（比赛正式开始）
app.post('/api/admin/lock', (req, res) => {
  if (!checkAdminToken(req, res)) return;
  if (gameState.status !== 'betting') {
    return res.status(400).json({ error: `当前状态 ${gameState.status} 无法锁定` });
  }

  lockOddsForCurrentMatch();
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
  const isMasterMode = gameState.isMasterMode ?? true;

  // 校验必填字段
  const missing = [];
  if (redScore === undefined || redScore === null || redScore === '') missing.push('红方分数');
  if (blueScore === undefined || blueScore === null || blueScore === '') missing.push('蓝方分数');
  if (isHockey && isMasterMode) {
    if (iceBalls === undefined || iceBalls === null) missing.push('冰球次数');
    if (fireBalls === undefined || fireBalls === null) missing.push('火球次数');
    if (windBalls === undefined || windBalls === null) missing.push('风球次数');
  } else if (!isHockey) {
    if (totalKnockdowns === undefined || totalKnockdowns === null) missing.push('倒地次数');
  }
  if (missing.length > 0) {
    return res.status(400).json({ error: `缺少字段：${missing.join('、')}` });
  }

  const rs = parseInt(redScore);
  const bs = parseInt(blueScore);

  let elementWinner = null;
  let ice = 0, fire = 0, wind = 0, knockdowns = 0;

  if (isHockey && isMasterMode) {
    ice = parseInt(iceBalls);
    fire = parseInt(fireBalls);
    wind = parseInt(windBalls);
    const maxElem = Math.max(ice, fire, wind);
    // 并列时按固定优先级 ice > fire > wind 决出元素之王
    if (ice === maxElem) elementWinner = 'ice';
    else if (fire === maxElem) elementWinner = 'fire';
    else elementWinner = 'wind';
  } else if (!isHockey) {
    knockdowns = parseInt(totalKnockdowns);
  }

  gameState.redScore = rs;
  gameState.blueScore = bs;
  gameState.iceBalls = ice;
  gameState.fireBalls = fire;
  gameState.windBalls = wind;
  gameState.totalKnockdowns = knockdowns;
  gameState.elementWinner = elementWinner;
  if (!gameState.lockedOdds) {
    lockOddsForCurrentMatch();
  }
  gameState.status = 'settled';

  const odds = gameState.lockedOdds || getOddsByRating(gameState.redPlayer, gameState.bluePlayer, gameState.gameType);
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
    if (isHockey && isMasterMode && bet.elementKing && bet.elementKing.amount > 0) totalBetted += bet.elementKing.amount;
    if (!isHockey && bet.knockdownKing && bet.knockdownKing.amount > 0) totalBetted += bet.knockdownKing.amount;
    if (bet.preciseTotal && bet.preciseTotal.amount > 0) totalBetted += bet.preciseTotal.amount;
    if (bet.preciseDiff && bet.preciseDiff.amount > 0) totalBetted += bet.preciseDiff.amount;

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

    if (isHockey && isMasterMode && bet.elementKing && bet.elementKing.amount > 0) {
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

    const netResult = computeBetNetResult(totalWon, totalBetted, details);
    settlements.push({ username, totalWon, totalBetted, netResult, details, newCoins: user.coins });

    if (!user.coinLog) user.coinLog = [];
    const now = new Date().toISOString();
    const matchLabel = `${gameState.matchName} 第${gameState.round}局`;
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
      redPlayer: gameState.redPlayer,
      bluePlayer: gameState.bluePlayer,
      blueScore: bs,
      redScore: rs,
      round: gameState.round,
      totalBetted,
      totalWon,
      netResult,
      details,
    });
  }

  applyPlayerRatingAndHistory(rs, bs, winSide);
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

  gameState.lastSettleResult = resultData;
  io.emit('game:result', resultData);
  io.emit('game:update', buildGameInfo());
  io.emit('rank:update', buildRankings());

  console.log(`[Admin] settle: ${winSide || '平局'} red=${rs} blue=${bs}`);
  res.json({ success: true, settlements });
});

// 重置下一局
app.post('/api/admin/reset', (req, res) => {
  if (!checkAdminToken(req, res)) return;

  if (gameState.status === 'settled' && gameState.redPlayer && gameState.bluePlayer) {
    const rs = parseInt(gameState.redScore);
    const bs = parseInt(gameState.blueScore);
    lastSettledMatch = {
      matchName: gameState.matchName,
      gameType: gameState.gameType,
      redPlayer: gameState.redPlayer,
      bluePlayer: gameState.bluePlayer,
      redScore: isNaN(rs) ? '' : rs,
      blueScore: isNaN(bs) ? '' : bs,
      result: !isNaN(rs) && !isNaN(bs) ? (rs > bs ? '红方胜' : rs < bs ? '蓝方胜' : '平局') : '',
      odds: gameState.lockedOdds ? { ...gameState.lockedOdds } : null,
    };
  }
  const nextRound = gameState.round + 1;
  gameState = createFreshGame();
  gameState.round = nextRound;

  io.emit('game:next', buildGameInfo());
  io.emit('game:update', buildGameInfo());
  io.emit('bet:update', buildBetSummary());
  io.emit('contest:update', buildContestStatus());

  console.log(`[Admin] reset: -> round ${gameState.round}`);
  res.json({ success: true, round: gameState.round });
});

// 取消竞猜（betting 或 started 状态，退还所有押注，进入下一局）
app.post('/api/admin/cancel', (req, res) => {
  if (!checkAdminToken(req, res)) return;
  if (gameState.status !== 'betting') {
    return res.status(400).json({ error: `只能在竞猜开始后、比赛开始前取消竞猜（当前状态：${gameState.status}）` });
  }
  refundAllBets(`第${gameState.round}局取消竞猜，押注已全额退还`);
  const nextRound = gameState.round + 1;
  gameState = createFreshGame();
  gameState.round = nextRound;
  io.emit('game:cancel', buildGameInfo());
  io.emit('game:update', buildGameInfo());
  io.emit('bet:update', buildBetSummary());
  io.emit('contest:update', buildContestStatus());
  console.log(`[Admin] cancel: refunded bets, -> round ${gameState.round}`);
  res.json({ success: true, round: gameState.round });
});

// ========== 启动 ==========

const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on http://0.0.0.0:${PORT}`);
});
