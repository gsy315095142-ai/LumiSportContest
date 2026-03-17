// 规则数据配置文件
// 所有表格数据集中管理，方便修改

// ========== 选手积分数据（与 server/index.js 保持一致） ==========

export const ratingData = {
  defaultRating: 1500,
  minRating: 600,

  // 结算示例
  settlementExamples: [
    { red: '1500', blue: '1500', score: '5 : 3', diff: '2', redChange: '+2', blueChange: '-2', desc: '实力对等，小明险胜' },
    { red: '1600', blue: '1400', score: '7 : 4', diff: '3', redChange: '+3', blueChange: '-3', desc: '实力接近，大比分获胜' },
    { red: '1800', blue: '1200', score: '3 : 5', diff: '2', redChange: '-2', blueChange: '+2', desc: '弱者逆袭成功' },
    { red: '1500', blue: '1500', score: '5 : 5', diff: '0', redChange: '0', blueChange: '0', desc: '平局，积分不变' },
    { red: '610', blue: '1800', score: '2 : 8', diff: '6', redChange: '0（保底）', blueChange: '+6', desc: '触发保底保护' },
  ],
};

// ========== 赔率数据（与 server/index.js 保持一致） ==========

export const oddsRatingData = {
  oddsDmax: 400,
  oddsMin: 1.10,
  oddsMax: 2.00,

  // 积分差 → 赔率对照
  oddsTable: [
    { diff: 0, higherOdds: '1.50', lowerOdds: '1.50', note: '实力完全相同' },
    { diff: 50, higherOdds: '1.45', lowerOdds: '1.56', note: '' },
    { diff: 100, higherOdds: '1.40', lowerOdds: '1.63', note: '' },
    { diff: 150, higherOdds: '1.35', lowerOdds: '1.69', note: '' },
    { diff: 200, higherOdds: '1.30', lowerOdds: '1.75', note: '较小差距' },
    { diff: 250, higherOdds: '1.25', lowerOdds: '1.81', note: '' },
    { diff: 300, higherOdds: '1.20', lowerOdds: '1.88', note: '' },
    { diff: 350, higherOdds: '1.15', lowerOdds: '1.94', note: '' },
    { diff: '≥400', higherOdds: '1.10', lowerOdds: '2.00', note: '差距达到极值' },
  ],

  // 完整场景示例
  oddsExamples: [
    {
      red: '1500', blue: '1500', diff: '0',
      redOdds: '1.50', blueOdds: '1.50',
      scenario: '实力对等',
      desc: '双方积分相同，赔率均为 1.50，胜负各半'
    },
    {
      red: '1600', blue: '1400', diff: '200',
      redOdds: '1.30', blueOdds: '1.75',
      scenario: '较小差距',
      desc: '高分方赔率 1.30（稳），低分方赔率 1.75（搏一搏）'
    },
    {
      red: '1750', blue: '1250', diff: '500',
      redOdds: '1.10', blueOdds: '2.00',
      scenario: '差距达极值',
      desc: '高分方赔率已触底 1.10，低分方赔率拉满 2.00'
    },
    {
      red: '1500', blue: '—', diff: '—',
      redOdds: '1.10', blueOdds: '1.10',
      scenario: '仅一方参赛',
      desc: '缺少对手数据，双方统一赔率 1.10'
    },
  ],
};

// ========== 旧的段位赔率矩阵（已废弃，保留备用） ==========

export const oddsData = {
  matrix: [
    ['1.50', '1.70', '1.90', '2.10', '2.30', '2.50', '2.70'],
    ['1.45', '1.65', '1.85', '2.05', '2.25', '2.45', '2.65'],
    ['1.40', '1.60', '1.80', '2.00', '2.20', '2.40', '2.60'],
    ['1.35', '1.55', '1.75', '1.95', '2.15', '2.35', '2.55'],
    ['1.30', '1.50', '1.70', '1.90', '2.10', '2.30', '2.50'],
    ['1.25', '1.45', '1.65', '1.85', '2.05', '2.25', '2.45'],
    ['1.20', '1.40', '1.60', '1.80', '2.00', '2.20', '2.40']
  ],
  tiers: ['新手', '青铜', '白银', '黄金', '钻石', '铂金', '王者']
};

export const quizTierData = {
  tiers: [
    { name: '新手预言家', threshold: '0', icon: '🔮', class: 'tier-新手' },
    { name: '青铜预言家', threshold: '2,500', icon: '🥉', class: 'tier-青铜' },
    { name: '白银预言家', threshold: '5,000', icon: '🥈', class: 'tier-白银' },
    { name: '黄金预言家', threshold: '10,000', icon: '🥇', class: 'tier-黄金' },
    { name: '钻石预言家', threshold: '20,000', icon: '💎', class: 'tier-钻石' },
    { name: '铂金预言家', threshold: '50,000', icon: '👑', class: 'tier-铂金' },
    { name: '王者预言家', threshold: '100,000', icon: '🏆', class: 'tier-王者' }
  ],
  estimates: [
    { mode: '胜负竞猜（同段位）', odds: '×1.50~2.40', perWin: '150~240', tensWin: '1,500~2,400', desc: '最基础玩法，50%命中率' },
    { mode: '胜负竞猜（跨段位）', odds: '×1.20~2.70', perWin: '120~270', tensWin: '1,200~2,700', desc: '弱胜强赔率更高' },
    { mode: '元素之王', odds: '×3', perWin: '300', tensWin: '3,000', desc: '简单模式，约33%命中率' },
    { mode: '精准分差', odds: '×15', perWin: '1,500', tensWin: '15,000', desc: '高难度，命中率低但回报高' },
    { mode: '精准总分', odds: '×20', perWin: '2,000', tensWin: '20,000', desc: '最高难度，单次回报最高' }
  ]
};

export const quizData = {
  elementKing: [
    { option: '❄️ 冰球', odds: '1:3', desc: '冰元素出现最多' },
    { option: '🔥 火球', odds: '1:3', desc: '火元素出现最多' },
    { option: '🌪️ 风球', odds: '1:3', desc: '风元素出现最多' }
  ],
  elementKingRule: '若出现两种或三种元素次数相同且并列最多的情况，以最新一次出现的元素球为准判定胜负。',
  
  preciseScore: {
    title: '精准总分',
    desc: '本局双方总得分会是多少分？',
    odds: '1:20',
    example: '玩家猜12分，实际红队7:蓝队5=12分 → 中奖！'
  },
  
  preciseDiff: {
    title: '精准分差',
    desc: '本局双方得分相差多少分？',
    odds: '1:15',
    example: '玩家猜相差3分，实际红队8:蓝队5=3分 → 中奖！'
  }
};

export const rewardData = {
  danmakuStyles: [
    { type: '普通用户', color: '白色', style: '❤️ 小王：红队加油！' },
    { type: 'VIP用户', color: '金色', style: '❤️ VIP：冰系必胜！' },
    { type: '大额打赏', color: '红色+特效', style: '🔥 大佬：炸裂吧！' }
  ],
  
  items: [
    { name: '🎉 彩带礼炮', price: '100币', effect: '选手出场彩带动画', timing: '赛前' },
    { name: '🥤 能量饮料', price: '200币', effect: '护盾发光特效（5秒）', timing: '赛中' },
    { name: '🔥 火焰助威', price: '300币', effect: '火焰特效（10秒）', timing: '赛中' },
    { name: '❄️ 冰霜守护', price: '300币', effect: '冰霜特效（10秒）', timing: '赛中' },
    { name: '👤 模型皮肤', price: '800币', effect: '改变选手模型外观（24小时）', timing: '赛前' }
  ],
  
  skins: [
    { emoji: '🤖', name: '机甲战士', desc: '银色科技风' },
    { emoji: '😈', name: '火焰恶魔', desc: '红色烈焰' },
    { emoji: '🧙', name: '冰霜骑士', desc: '蓝色冰晶' },
    { emoji: '🧚', name: '风之精灵', desc: '绿色轻盈' },
    { emoji: '👑', name: '黄金圣斗士', desc: '金色闪耀' }
  ]
};

export const currencyData = {
  sources: [
    { method: '🎁 新用户注册', amount: '100币', limit: '首次注册自动赠送' },
    { method: '📅 每日签到', amount: '100币', limit: '1次/日（连续7天额外500币）' },
    { method: '📤 分享好友', amount: '50币', limit: '3次/日' },
    { method: '📺 观看广告', amount: '30币', limit: '5次/日（每次30秒）' },
    { method: '💳 充值购买', amount: '100币 = 1元', limit: '无上限' }
  ],
  
  rewards: [
    { prize: '主题贴纸', cost: '500币' },
    { prize: '签名明信片', cost: '1500币' },
    { prize: '定制钥匙扣', cost: '2000币' },
    { prize: '主题T恤', cost: '5000币' },
    { prize: '线下观赛门票', cost: '8000币' },
    { prize: '联名VR手柄', cost: '20000币' }
  ]
};

export const flowSteps = [
  { icon: '💰', title: '获取竞猜币' },
  { icon: '🎮', title: '参与竞猜' },
  { icon: '🎁', title: '打赏支持' },
  { icon: '🏆', title: '结果揭晓' },
  { icon: '🛒', title: '兑换奖励' }
];

export const overviewData = {
  modules: [
    { name: '基础竞猜', desc: '胜负竞猜 + 积分动态赔率' },
    { name: '趣味竞猜', desc: '元素之王、精准总分、精准分差' },
    { name: '打赏系统', desc: '弹幕点赞、功能物品、模型皮肤' },
    { name: '竞猜币经济', desc: '签到/分享/广告/充值获取，兑换周边和打赏' }
  ]
};
