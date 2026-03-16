import { rewardData } from '../data/rulesData';

function RewardSystem() {
  return (
    <div className="section-content">
      <h2>🎁 打赏系统</h2>
      <p className="reward-intro">三种互动方式，支持你喜爱的选手！</p>
      
      {/* 三种打赏方式并排展示 */}
      <div className="reward-modes-grid">
        
        {/* 点赞弹幕 */}
        <div className="reward-mode-card danmaku-card">
          <div className="reward-mode-header">
            <span className="reward-mode-icon">❤️</span>
            <h3>点赞 + 实时弹幕</h3>
            <span className="reward-mode-badge free">免费</span>
          </div>
          
          <div className="reward-mode-features">
            <div className="feature-item">
              <span className="feature-icon">👆</span>
              <span><strong>免费点赞：</strong>点击 ❤️ 为选手加油</span>
            </div>
            <div className="feature-item">
              <span className="feature-icon">💬</span>
              <span><strong>弹幕留言：</strong>点赞时可输入一句话（最多20字）</span>
            </div>
            <div className="feature-item">
              <span className="feature-icon">📺</span>
              <span><strong>实时投屏：</strong>弹幕同步显示在大屏幕上</span>
            </div>
          </div>
          
          <div className="reward-mode-subsection">
            <h4>弹幕样式区分</h4>
            <div className="danmaku-styles">
              {rewardData.danmakuStyles.map((s, i) => (
                <div key={i} className={`danmaku-style-item ${s.type.includes('普通') ? 'normal' : s.type.includes('VIP') ? 'vip' : 'whale'}`}>
                  <span className="danmaku-type">{s.type}</span>
                  <span className="danmaku-color">{s.color}</span>
                  <span className="danmaku-sample">{s.style}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
        
        {/* 功能物品 */}
        <div className="reward-mode-card items-card">
          <div className="reward-mode-header">
            <span className="reward-mode-icon">🎉</span>
            <h3>功能物品打赏</h3>
            <span className="reward-mode-badge paid">付费</span>
          </div>
          
          <div className="reward-mode-desc">
            购买功能物品，为选手触发炫酷特效！
          </div>
          
          <div className="items-list">
            {rewardData.items.map((item, i) => (
              <div key={i} className="item-row">
                <span className="item-name">{item.name}</span>
                <span className="item-price">{item.price}</span>
                <span className="item-effect">{item.effect}</span>
                <span className="item-timing">{item.timing}</span>
              </div>
            ))}
          </div>
        </div>
        
        {/* 模型皮肤 */}
        <div className="reward-mode-card skins-card">
          <div className="reward-mode-header">
            <span className="reward-mode-icon">👤</span>
            <h3>模型皮肤系统</h3>
            <span className="reward-mode-badge premium">高级</span>
          </div>
          
          <div className="reward-mode-info">
            <div className="info-row">
              <span className="info-icon">⏱️</span>
              <span><strong>有效期：</strong>24小时（从首次装备开始）</span>
            </div>
            <div className="info-row">
              <span className="info-icon">🔄</span>
              <span><strong>切换费用：</strong>100竞猜币</span>
            </div>
            <div className="info-row">
              <span className="info-icon">🎮</span>
              <span>有效期内所有比赛可用</span>
            </div>
          </div>
          
          <div className="reward-mode-subsection">
            <h4>皮肤类型</h4>
            <div className="skin-grid-mini">
              {rewardData.skins.map((skin, i) => (
                <div className="skin-card-mini" key={i}>
                  <div className="skin-emoji">{skin.emoji}</div>
                  <div className="skin-name">{skin.name}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
        
      </div>
    </div>
  );
}

export default RewardSystem;
