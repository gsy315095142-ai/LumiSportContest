import { tierData } from '../data/rulesData';

function TierSystem() {
  return (
    <div className="section-content">
      <h2>🎯 段位积分系统</h2>
      
      {/* 数值设计目标 - 放在最前面 */}
      <div className="design-goals-section">
        <h3>📋 数值设计目标</h3>
        <div className="goals-grid">
          <div className="goal-card">
            <div className="goal-icon">🛡️</div>
            <div className="goal-title">保护新手</div>
            <div className="goal-desc">弱者打强者，实力悬殊（高4段以上）输了<strong>不扣分</strong></div>
          </div>
          <div className="goal-card">
            <div className="goal-icon">⚡</div>
            <div className="goal-title">快速晋级</div>
            <div className="goal-desc">同段位100%胜率，仅需<strong>5场</strong>升一段</div>
          </div>
          <div className="goal-card">
            <div className="goal-icon">⚖️</div>
            <div className="goal-title">平衡体验</div>
            <div className="goal-desc">同段位50%胜率，约<strong>14场</strong>升一段</div>
          </div>
        </div>
      </div>
      
      {/* 数值模块 */}
      <h3>📊 段位划分</h3>
      <p className="hint">每500分一个段位，共7个段位</p>
      <table className="data-table tier-table">
        <thead>
          <tr><th>段位</th><th>积分区间</th><th>标识</th></tr>
        </thead>
        <tbody>
          {tierData.tiers.map((t, i) => (
            <tr key={i}>
              <td className={t.class}>{t.name}</td>
              <td>{t.range}</td>
              <td>{t.icon}</td>
            </tr>
          ))}
        </tbody>
      </table>
      
      <h3>🔢 积分计算规则</h3>
      <div className="highlight-box">
        <strong>核心数值：</strong>同段位胜利 <strong>+100分</strong>，失败 <strong>-25分</strong>
      </div>
      <div className="highlight-box" style={{ marginTop: '8px', fontSize: '13px', opacity: 0.85 }}>
        <strong>公式：</strong>胜方步长 ±15/段差，负方步长 ±10/段差 &nbsp;|&nbsp; 差3段及以上输给强者不扣分
      </div>
      <table className="data-table">
        <thead>
          <tr><th>段位差距</th><th>获胜得分</th><th>失败扣分</th></tr>
        </thead>
        <tbody>
          {tierData.scoreRules.map((r, i) => (
            <tr key={i}>
              <td>{r.gap}</td>
              <td className="win">{r.win}</td>
              <td className={r.loseClass}>{r.lose}</td>
            </tr>
          ))}
        </tbody>
      </table>
      
      <h3>📈 晋级规则</h3>
      <table className="data-table">
        <thead>
          <tr><th>当前段位</th><th>目标段位</th><th>所需积分</th><th>全胜场次</th><th>50%胜率场次</th></tr>
        </thead>
        <tbody>
          {tierData.promotionRules.map((r, i) => (
            <tr key={i}>
              <td className={`tier-${r.current.slice(0,2)}`}>{r.current}</td>
              <td className={`tier-${r.target.slice(0,2)}`}>{r.target}</td>
              <td>{r.points}</td>
              <td>{r.wins}</td>
              <td>{r.winRate50}</td>
            </tr>
          ))}
        </tbody>
      </table>
      
      <div className="example-box">
        <strong>💡 示例说明（50%胜率晋级）：</strong><br/>
        小明是<strong>新手魔法师</strong>（0分），挑战同段位对手：<br/>
        • 第1场：胜 +100分（总分100分）<br/>
        • 第2场：负 -25分（总分75分）<br/>
        • 第3场：胜 +100分（总分175分）<br/>
        • ...（持续约7胜7负）<br/>
        • 第14场后：总分达标 → <strong>晋级青铜魔法师！</strong><br/><br/>
        <em>计算：7胜×100分 - 7负×25分 = 700 - 175 = 525分（达标晋级）</em>
      </div>
      
      <h3>🏆 王者魔法师</h3>
      <div className="highlight-box">
        <strong>当积分达到3000分（王者魔法师）后：</strong><br/><br/>
        • 不再显示段位名称，改为显示<strong>全国排名</strong><br/>
        • 排名根据积分高低实时更新<br/>
        • 显示格式：王者魔法师 · 全国第127名<br/>
        • 积分无上限，可继续累积提升排名
      </div>
    </div>
  );
}

export default TierSystem;
