import { oddsRatingData } from '../data/rulesData';

function OddsTable() {
  return (
    <div className="section-content">
      <h2>💰 赔率对照</h2>

      {/* 设计理念 */}
      <div className="design-goals-section">
        <h3>📋 赔率设计理念</h3>
        <div className="goals-grid">
          <div className="goal-card">
            <div className="goal-icon">📏</div>
            <div className="goal-title">积分决定赔率</div>
            <div className="goal-desc">赔率由双方选手的<strong>积分差</strong>动态计算，实力差距越大，赔率差异越明显</div>
          </div>
          <div className="goal-card">
            <div className="goal-icon">📈</div>
            <div className="goal-title">以弱胜高回报</div>
            <div className="goal-desc">低积分方赢球赔率最高 <strong>2.00</strong>，鼓励竞猜"冷门"结果</div>
          </div>
          <div className="goal-card">
            <div className="goal-icon">📉</div>
            <div className="goal-title">强者稳健收益</div>
            <div className="goal-desc">高积分方赢球赔率最低 <strong>1.10</strong>，稳定但不暴利</div>
          </div>
        </div>
      </div>

      {/* 赔率范围 */}
      <h3>📊 赔率范围</h3>
      <table className="data-table tier-table">
        <thead>
          <tr><th>参数</th><th>数值</th><th>说明</th></tr>
        </thead>
        <tbody>
          <tr>
            <td>赔率范围</td>
            <td><strong>1.10 ~ 2.00</strong></td>
            <td>高积分方最低 1.10，低积分方最高 2.00</td>
          </tr>
          <tr>
            <td>同实力赔率</td>
            <td><strong>1.50</strong></td>
            <td>双方积分相同时，赔率均为 1.50</td>
          </tr>
          <tr>
            <td>极值触发</td>
            <td><strong>积分差 ≥ {oddsRatingData.oddsDmax}</strong></td>
            <td>积分差达到 400 时，赔率触及极值（1.10 / 2.00）</td>
          </tr>
          <tr>
            <td>无选手时</td>
            <td><strong>双方均 1.10</strong></td>
            <td>仅一方参赛或双方均无选手时，统一赔率</td>
          </tr>
        </tbody>
      </table>

      {/* 赔率公式 */}
      <h3>📐 赔率计算公式</h3>
      <div className="highlight-box">
        <strong>线性映射公式：</strong><br/><br/>
        ① 计算差距系数：t = min(积分差 ÷ 400, 1)<br/>
        &emsp;&emsp;（积分差达到 400 时，t = 1，即为极值）<br/><br/>
        ② 高积分方赔率 = 1.50 − 0.40 × t&emsp;→ 最低 <strong>1.10</strong><br/>
        ③ 低积分方赔率 = 1.50 + 0.50 × t&emsp;→ 最高 <strong>2.00</strong>
      </div>

      {/* 积分差→赔率对照表 */}
      <h3>🔍 积分差 → 赔率对照表</h3>
      <p className="hint">积分差越大，赔率差异越明显。下表展示不同积分差对应的双方赔率</p>
      <table className="data-table">
        <thead>
          <tr>
            <th>积分差</th>
            <th>高积分方赔率</th>
            <th>低积分方赔率</th>
            <th>备注</th>
          </tr>
        </thead>
        <tbody>
          {oddsRatingData.oddsTable.map((row, i) => (
            <tr key={i}>
              <td><strong>{row.diff}</strong></td>
              <td>{row.higherOdds}</td>
              <td className="win">{row.lowerOdds}</td>
              <td style={{ fontSize: '12px', opacity: 0.7 }}>{row.note}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* 完整场景示例 */}
      <h3>💡 场景示例</h3>
      <table className="data-table">
        <thead>
          <tr>
            <th>场景</th>
            <th>红方积分</th>
            <th>蓝方积分</th>
            <th>积分差</th>
            <th>红方赔率</th>
            <th>蓝方赔率</th>
          </tr>
        </thead>
        <tbody>
          {oddsRatingData.oddsExamples.map((ex, i) => (
            <tr key={i}>
              <td><strong>{ex.scenario}</strong></td>
              <td>{ex.red}</td>
              <td>{ex.blue}</td>
              <td>{ex.diff}</td>
              <td>{ex.redOdds}</td>
              <td className={parseFloat(ex.blueOdds) > parseFloat(ex.redOdds) ? 'win' : ''}>{ex.blueOdds}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* 详细说明 */}
      {oddsRatingData.oddsExamples.map((ex, i) => (
        <div key={i} className="example-box" style={{ marginTop: '8px' }}>
          <strong>📌 {ex.scenario}：</strong><br/>
          红方 {ex.red} 分 vs 蓝方 {ex.blue} 分{ex.diff !== '—' ? `，积分差 ${ex.diff}` : ''}<br/>
          红方赔率 {ex.redOdds}，蓝方赔率 {ex.blueOdds}<br/>
          <span style={{ fontSize: '13px', opacity: 0.85 }}>{ex.desc}</span>
        </div>
      ))}

      {/* 收益示例 */}
      <div className="highlight-box" style={{ marginTop: '16px' }}>
        <strong>🎰 收益计算示例：</strong><br/><br/>
        场景：小明（1800分）vs 小红（1200分），积分差 600（已达极值）<br/>
        • 小明赔率 <strong>1.10</strong>，小红赔率 <strong>2.00</strong><br/><br/>
        <strong>押注小明 100 币猜中</strong> → 获得 <strong>110 币</strong>（100 × 1.10），净赚 10 币<br/>
        <strong>押注小红 100 币猜中</strong> → 获得 <strong>200 币</strong>（100 × 2.00），净赚 100 币<br/>
        <strong>押注小红 100 币猜错</strong> → 获得 <strong>0 币</strong>，损失 100 币
      </div>
    </div>
  );
}

export default OddsTable;
