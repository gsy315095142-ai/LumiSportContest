import { currencyData } from '../data/rulesData';

function Currency() {
  const cycleSteps = [
    { icon: '📱', title: '获取竞猜币', desc: '签到/分享/广告/充值', color: '#6bcb77' },
    { icon: '🎮', title: '参与竞猜', desc: '投注支持心仪选手', color: '#e94560' },
    { icon: '🎁', title: '打赏互动', desc: '用币购买道具助威', color: '#ffd93d' },
    { icon: '🏆', title: '比赛精彩', desc: '选手表现更出色', color: '#00bfff' },
    { icon: '💰', title: '获得回报', desc: '竞猜成功赢更多币', color: '#ff6b6b' },
    { icon: '🔄', title: '循环继续', desc: '投入下一轮竞猜', color: '#9b59b6' }
  ];

  // 周边奖励图片占位（使用emoji作为图片占位）
  const rewardsWithImages = [
    { prize: '主题贴纸', emoji: '🏷️', desc: '精美魔法冰球主题贴纸' },
    { prize: '签名明信片', emoji: '📮', desc: '选手亲笔签名明信片' },
    { prize: '定制钥匙扣', emoji: '🔑', desc: '专属定制钥匙扣' },
    { prize: '主题T恤', emoji: '👕', desc: '魔法冰球主题T恤' },
    { prize: '线下观赛门票', emoji: '🎟️', desc: '线下比赛观赛资格' },
    { prize: '联名VR手柄', emoji: '🎮', desc: '限量联名款VR手柄' }
  ];

  return (
    <div className="section-content">
      <h2>💎 竞猜币系统</h2>
      
      {/* 经济循环图示 */}
      <div className="currency-cycle-header">
        <span className="cycle-header-icon">♻️</span>
        <h3>🔄 竞猜币经济循环</h3>
        <span className="cycle-header-badge">良性循环生态</span>
      </div>
      
      <div className="currency-cycle-container">
        <div className="currency-cycle">
          {cycleSteps.map((step, i) => (
            <div key={i} className="currency-cycle-step">
              <div className="cycle-step-icon" style={{ background: step.color }}>
                {step.icon}
              </div>
              <div className="cycle-step-info">
                <div className="cycle-step-title">{step.title}</div>
                <div className="cycle-step-desc">{step.desc}</div>
              </div>
              {i < cycleSteps.length - 1 && <div className="cycle-arrow-right">→</div>}
              {i === cycleSteps.length - 1 && <div className="cycle-arrow-back">↻</div>}
            </div>
          ))}
        </div>
      </div>
      
      <h3>💰 获取途径</h3>
      <table className="data-table">
        <thead>
          <tr><th>方式</th><th>获得数量</th><th>每日限制</th></tr>
        </thead>
        <tbody>
          {currencyData.sources.map((s, i) => (
            <tr key={i}><td>{s.method}</td><td>{s.amount}</td><td>{s.limit}</td></tr>
          ))}
        </tbody>
      </table>
      
      <h3>🎁 兑换奖励</h3>
      <p className="hint">累积竞猜币，兑换精美周边奖品！（价格待定）</p>
      
      <div className="rewards-gallery">
        {rewardsWithImages.map((item, i) => (
          <div className="reward-card" key={i}>
            <div className="reward-image">
              <span className="reward-emoji">{item.emoji}</span>
            </div>
            <div className="reward-info">
              <div className="reward-name">{item.prize}</div>
              <div className="reward-desc">{item.desc}</div>
            </div>
          </div>
        ))}
      </div>
      
      <div className="highlight-box">
        <strong>💡 更多兑换：</strong>竞猜币还可用于购买所有打赏功能物品（彩带礼炮、能量饮料、火焰助威、冰霜守护、模型皮肤等）
      </div>
    </div>
  );
}

export default Currency;
