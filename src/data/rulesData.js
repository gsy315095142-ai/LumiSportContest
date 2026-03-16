// 规则数据配置文件
// 所有表格数据集中管理，方便修改

export const tierData = {
  tiers: [
    { name: '新手魔法师', range: '0 - 499', icon: '🌱', class: 'tier-新手' },
    { name: '青铜魔法师', range: '500 - 999', icon: '🥉', class: 'tier-青铜' },
    { name: '白银魔法师', range: '1000 - 1499', icon: '🥈', class: 'tier-白银' },
    { name: '黄金魔法师', range: '1500 - 1999', icon: '🥇', class: 'tier-黄金' },
    { name: '钻石魔法师', range: '2000 - 2499', icon: '💎', class: 'tier-钻石' },
    { name: '铂金魔法师', range: '2500 - 2999', icon: '👑', class: 'tier-铂金' },
    { name: '王者魔法师', range: '3000+', icon: '🏆', class: 'tier-王者' }
  ],
  
  scoreRules: [
    { gap: '对手高6段（新手vs王者）', win: '+190分', lose: '0分（不扣分）', loseClass: 'no-lose' },
    { gap: '对手高5段', win: '+175分', lose: '0分（不扣分）', loseClass: 'no-lose' },
    { gap: '对手高4段', win: '+160分', lose: '0分（不扣分）', loseClass: 'no-lose' },
    { gap: '对手高3段', win: '+145分', lose: '0分（不扣分）', loseClass: 'no-lose' },
    { gap: '对手高2段', win: '+130分', lose: '-5分', loseClass: 'lose' },
    { gap: '对手高1段', win: '+115分', lose: '-15分', loseClass: 'lose' },
    { gap: '对手同段位', win: '+100分', lose: '-25分', loseClass: 'lose' },
    { gap: '对手低1段', win: '+85分', lose: '-35分', loseClass: 'lose' },
    { gap: '对手低2段', win: '+70分', lose: '-45分', loseClass: 'lose' },
    { gap: '对手低3段', win: '+55分', lose: '-55分', loseClass: 'lose' },
    { gap: '对手低4段', win: '+40分', lose: '-65分', loseClass: 'lose' },
    { gap: '对手低5段', win: '+25分', lose: '-75分', loseClass: 'lose' },
    { gap: '对手低6段（王者vs新手）', win: '+10分', lose: '-85分', loseClass: 'lose' }
  ],
  
  promotionRules: [
    { current: '新手魔法师', target: '青铜魔法师', points: '500分', wins: '5场', winRate50: '14场' },
    { current: '青铜魔法师', target: '白银魔法师', points: '500分', wins: '5场', winRate50: '14场' },
    { current: '白银魔法师', target: '黄金魔法师', points: '500分', wins: '5场', winRate50: '14场' },
    { current: '黄金魔法师', target: '钻石魔法师', points: '500分', wins: '5场', winRate50: '14场' },
    { current: '钻石魔法师', target: '铂金魔法师', points: '500分', wins: '5场', winRate50: '14场' },
    { current: '铂金魔法师', target: '王者魔法师', points: '500分', wins: '5场', winRate50: '14场' }
  ]
};

export const oddsData = {
  // 赔率矩阵 [红方][蓝方] - 只显示纵向列的赔率，最低1.1倍
  // 每个格子显示：纵向列（红方）在对战横向列（蓝方）时的赔率
  matrix: [
    // 新手, 青铜, 白银, 黄金, 钻石, 铂金, 王者
    ['1.50', '1.70', '1.90', '2.10', '2.30', '2.50', '2.70'], // 新手
    ['1.45', '1.65', '1.85', '2.05', '2.25', '2.45', '2.65'], // 青铜
    ['1.40', '1.60', '1.80', '2.00', '2.20', '2.40', '2.60'], // 白银
    ['1.35', '1.55', '1.75', '1.95', '2.15', '2.35', '2.55'], // 黄金
    ['1.30', '1.50', '1.70', '1.90', '2.10', '2.30', '2.50'], // 钻石
    ['1.25', '1.45', '1.65', '1.85', '2.05', '2.25', '2.45'], // 铂金
    ['1.20', '1.40', '1.60', '1.80', '2.00', '2.20', '2.40']  // 王者
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
  // 数值预期（基于每次投注100币）
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
  // 弹幕样式
  danmakuStyles: [
    { type: '普通用户', color: '白色', style: '❤️ 小王：红队加油！' },
    { type: 'VIP用户', color: '金色', style: '❤️ VIP：冰系必胜！' },
    { type: '大额打赏', color: '红色+特效', style: '🔥 大佬：炸裂吧！' }
  ],
  
  // 功能物品
  items: [
    { name: '🎉 彩带礼炮', price: '100币', effect: '选手出场彩带动画', timing: '赛前' },
    { name: '🥤 能量饮料', price: '200币', effect: '护盾发光特效（5秒）', timing: '赛中' },
    { name: '🔥 火焰助威', price: '300币', effect: '火焰特效（10秒）', timing: '赛中' },
    { name: '❄️ 冰霜守护', price: '300币', effect: '冰霜特效（10秒）', timing: '赛中' },
    { name: '👤 模型皮肤', price: '800币', effect: '改变选手模型外观（24小时）', timing: '赛前' }
  ],
  
  // 皮肤列表
  skins: [
    { emoji: '🤖', name: '机甲战士', desc: '银色科技风' },
    { emoji: '😈', name: '火焰恶魔', desc: '红色烈焰' },
    { emoji: '🧙', name: '冰霜骑士', desc: '蓝色冰晶' },
    { emoji: '🧚', name: '风之精灵', desc: '绿色轻盈' },
    { emoji: '👑', name: '黄金圣斗士', desc: '金色闪耀' }
  ]
};

export const currencyData = {
  // 获取途径
  sources: [
    { method: '🎁 新用户注册', amount: '100币', limit: '首次注册自动赠送' },
    { method: '📅 每日签到', amount: '100币', limit: '1次/日（连续7天额外500币）' },
    { method: '📤 分享好友', amount: '50币', limit: '3次/日' },
    { method: '📺 观看广告', amount: '30币', limit: '5次/日（每次30秒）' },
    { method: '💳 充值购买', amount: '100币 = 1元', limit: '无上限' }
  ],
  
  // 周边奖励
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
    { name: '基础竞猜', desc: '胜负竞猜 + 段位动态赔率' },
    { name: '趣味竞猜', desc: '元素之王、精准总分、精准分差' },
    { name: '打赏系统', desc: '弹幕点赞、功能物品、模型皮肤' },
    { name: '竞猜币经济', desc: '签到/分享/广告/充值获取，兑换周边和打赏' }
  ]
};
