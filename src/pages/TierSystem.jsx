import { ratingData } from '../data/rulesData';

function TierSystem() {
  return (
    <div className="section-content">
      <h2>🎯 选手积分系统</h2>

      {/* 设计目标 */}
      <div className="design-goals-section">
        <h3>📋 设计理念</h3>
        <div className="goals-grid">
          <div className="goal-card">
            <div className="goal-icon">⚖️</div>
            <div className="goal-title">简单直观</div>
            <div className="goal-desc">抛弃复杂的段位制，采用<strong>纯积分</strong>，赢多少加多少，输多少扣多少</div>
          </div>
          <div className="goal-card">
            <div className="goal-icon">🛡️</div>
            <div className="goal-title">保底保护</div>
            <div className="goal-desc">积分最低不低于 <strong>600 分</strong>，不会无限掉分</div>
          </div>
          <div className="goal-card">
            <div className="goal-icon">🔄</div>
            <div className="goal-title">零和机制</div>
            <div className="goal-desc">一方加多少分，另一方就扣多少分，双方积分总和恒定不变</div>
          </div>
        </div>
      </div>

      {/* 基础参数 */}
      <h3>📊 基础参数</h3>
      <table className="data-table tier-table">
        <thead>
          <tr><th>参数</th><th>数值</th><th>说明</th></tr>
        </thead>
        <tbody>
          <tr>
            <td>初始积分</td>
            <td><strong>{ratingData.defaultRating}</strong> 分</td>
            <td>所有新注册选手统一从 1500 分开始</td>
          </tr>
          <tr>
            <td>保底积分</td>
            <td><strong>{ratingData.minRating}</strong> 分</td>
            <td>积分不会低于 600，保护新手体验</td>
          </tr>
          <tr>
            <td>积分上限</td>
            <td><strong>无上限</strong></td>
            <td>可无限累积，越高代表实力越强</td>
          </tr>
        </tbody>
      </table>

      {/* 积分计算规则 */}
      <h3>🔢 积分结算规则</h3>
      <div className="highlight-box">
        <strong>核心公式：</strong>积分变化 = 比分差（绝对值）<br/>
        <strong>胜方加分</strong> = |红方比分 − 蓝方比分|&emsp;
        <strong>负方扣分</strong> = −|红方比分 − 蓝方比分|<br/>
        <strong>平局：</strong>双方积分不变
      </div>
      <div className="highlight-box" style={{ marginTop: '8px', fontSize: '13px', opacity: 0.85 }}>
        <strong>零和机制：</strong>一方加多少分，另一方就扣多少分，双方积分总和恒定不变
      </div>

      {/* 结算示例 */}
      <h3>📝 结算示例</h3>
      <table className="data-table">
        <thead>
          <tr>
            <th>赛前积分</th>
            <th>比赛结果</th>
            <th>比分差</th>
            <th>红方变化</th>
            <th>蓝方变化</th>
            <th>说明</th>
          </tr>
        </thead>
        <tbody>
          {ratingData.settlementExamples.map((ex, i) => (
            <tr key={i}>
              <td>红 {ex.red} / 蓝 {ex.blue}</td>
              <td>{ex.score}</td>
              <td>{ex.diff}</td>
              <td className={ex.redChange.startsWith('+') || ex.redChange === '0' ? 'win' : 'lose'}>
                {ex.redChange}
              </td>
              <td className={ex.blueChange.startsWith('+') || ex.blueChange === '0' ? 'win' : 'lose'}>
                {ex.blueChange}
              </td>
              <td style={{ fontSize: '12px', opacity: 0.7 }}>{ex.desc}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* 跳转提示 */}
      <div className="highlight-box" style={{ marginTop: '16px', textAlign: 'center' }}>
        💡 选手的积分差会直接影响竞猜赔率，详情请查看 <strong>「赔率对照」</strong> 页面
      </div>
    </div>
  );
}

export default TierSystem;
