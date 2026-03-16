import { useState } from 'react';

function FlowChart() {
  const [activeStep, setActiveStep] = useState(1);

  const flowDetails = [
    {
      step: 1,
      icon: '💰',
      title: '获取竞猜币',
      subtitle: '多渠道积累',
      desc: '通过每日签到、分享好友、观看广告或充值获得竞猜币，为参与竞猜做准备。',
      methods: ['📅 每日签到 +100币', '📤 分享好友 +50币/次', '📺 观看广告 +30币/次', '💳 充值购买 100币=1元'],
      tip: '连续签到7天可额外获得500币奖励！',
      color: '#e94560'
    },
    {
      step: 2,
      icon: '🎮',
      title: '参与竞猜',
      subtitle: '赛前投注',
      desc: '比赛开始前，使用竞猜币对比赛结果进行投注。可选择基础胜负竞猜或趣味竞猜玩法。',
      methods: ['🏆 基础竞猜：猜胜负', '🔥 趣味竞猜：元素之王', '🎯 精准总分/分差'],
      tip: '段位差距越大，赔率差异越明显，低段胜高段回报丰厚！',
      color: '#ffd93d'
    },
    {
      step: 3,
      icon: '🎁',
      title: '打赏支持',
      subtitle: '赛中互动',
      desc: '比赛过程中，通过打赏功能物品为选手加油，同时获得实时弹幕展示和特效反馈。',
      methods: ['❤️ 免费点赞+弹幕', '🎉 彩带礼炮 100币', '🔥 火焰助威 300币', '👤 模型皮肤 800币'],
      tip: '大额打赏可获得红色特效弹幕，全场瞩目！',
      color: '#6bcb77'
    },
    {
      step: 4,
      icon: '🏆',
      title: '结果揭晓',
      subtitle: '结算奖励',
      desc: '比赛结束后，系统自动结算竞猜结果。猜中者按比例获得竞猜币奖励。',
      methods: ['✅ 猜中：本金×赔率', '❌ 未中：失去本金', '🎊 趣味猜中：高倍奖励'],
      tip: '精准总分猜中可获得20倍回报！',
      color: '#00bfff'
    },
    {
      step: 5,
      icon: '🛒',
      title: '兑换奖励',
      subtitle: '良性循环',
      desc: '使用累积的竞猜币兑换周边奖品，或继续参与下一轮竞猜，形成完整生态循环。',
      methods: ['🎁 兑换周边（贴纸/T恤/VR手柄）', '💎 继续投注', '🎨 购买皮肤道具'],
      tip: '20000币可兑换联名VR手柄！',
      color: '#ff6b6b'
    }
  ];

  const activeItem = flowDetails.find(item => item.step === activeStep) || flowDetails[0];

  return (
    <div className="section-content">
      <h2>🔄 竞猜系统完整流程</h2>
      
      {/* 横向时间轴 */}
      <div className="horizontal-timeline">
        <div className="timeline-track">
          {flowDetails.map((item, i) => (
            <div key={i} className="timeline-node-wrapper">
              <div 
                className={`timeline-node ${activeStep === item.step ? 'active' : ''}`}
                onClick={() => setActiveStep(item.step)}
                style={{ '--node-color': item.color }}
              >
                <div className="node-circle">
                  <span className="node-icon">{item.icon}</span>
                </div>
                <div className="node-label">{item.title}</div>
                <div className="node-step">步骤 {item.step}</div>
              </div>
              {i < flowDetails.length - 1 && (
                <div className="timeline-arrow">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M5 12h14M13 5l7 7-7 7"/>
                  </svg>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
      
      {/* 详细卡片 */}
      <div className="flow-detail-card" style={{ '--card-color': activeItem.color }}>
        <div className="flow-detail-header">
          <div className="flow-detail-left">
            <span className="flow-detail-icon">{activeItem.icon}</span>
            <div className="flow-detail-title-group">
              <h3>{activeItem.title}</h3>
              <span className="flow-detail-subtitle">{activeItem.subtitle}</span>
            </div>
          </div>
          <span className="flow-detail-badge" style={{ background: activeItem.color }}>
            步骤 {activeItem.step}
          </span>
        </div>
        
        <p className="flow-detail-desc">{activeItem.desc}</p>
        
        <div className="flow-detail-methods">
          <h4>📋 操作方式</h4>
          <div className="methods-grid">
            {activeItem.methods.map((m, j) => {
              // Split emoji icon from text
              const icon = m.match(/^[^\s]+/)?.[0] || '';
              const text = m.replace(/^[^\s]+\s*/, '');
              return (
                <div key={j} className="method-box">
                  <div className="method-icon">{icon}</div>
                  <div className="method-text">{text}</div>
                </div>
              );
            })}
          </div>
        </div>
        
        <div className="flow-detail-tip">
          <span className="tip-icon">💡</span>
          <div className="tip-text">
            <strong>小贴士</strong>
            <p>{activeItem.tip}</p>
          </div>
        </div>
      </div>
      
      {/* 流程导航 */}
      <div className="flow-navigation">
        <button 
          className="flow-nav-btn prev"
          disabled={activeStep === 1}
          onClick={() => setActiveStep(activeStep - 1)}
        >
          ← 上一步
        </button>
        <div className="flow-dots">
          {flowDetails.map((item, i) => (
            <span 
              key={i}
              className={`flow-dot ${activeStep === item.step ? 'active' : ''}`}
              style={{ background: activeStep === item.step ? item.color : 'rgba(255,255,255,0.2)' }}
              onClick={() => setActiveStep(item.step)}
            />
          ))}
        </div>
        <button 
          className="flow-nav-btn next"
          disabled={activeStep === 5}
          onClick={() => setActiveStep(activeStep + 1)}
        >
          下一步 →
        </button>
      </div>
    </div>
  );
}

export default FlowChart;
