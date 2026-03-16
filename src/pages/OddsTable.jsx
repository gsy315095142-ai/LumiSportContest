import { oddsData } from '../data/rulesData';

function OddsTable() {
  const tiers = ['新手', '青铜', '白银', '黄金', '钻石', '铂金', '王者'];
  
  return (
    <div className="section-content">
      <h2>💰 赔率对照表</h2>
      
      <h3>基础胜负竞猜</h3>
      <div className="formula">
        <strong>赔率说明：</strong>表格显示的是<strong>纵向段位</strong>在对战<strong>横向段位</strong>时的赔率<br/><br/>
        例如：新手(纵) vs 王者(横) = 投注新手获胜的赔率为<strong>2.7倍</strong><br/>
        段位差距越大，弱者赔率越高（最高<strong>2.7倍</strong>），最低赔率<strong>1.2倍</strong>
      </div>
      
      <h3>完整赔率矩阵</h3>
      <div className="highlight-box">
        <strong>🎯 数值设计目标：</strong><br/>
        • 横向和纵向都是<strong>等差数列</strong>（横向公差+0.20，纵向公差-0.05）<br/>
        • 弱者打强者，弱者赔率高<br/>
        • 强者对决赔率更高（吸引下注）<br/>
        • 所有赔率尾数为5或0
      </div>
      <p className="hint">每个格子显示<strong>纵向列</strong>在对战<strong>横向列</strong>时的赔率<br/>示例：蓝方(纵)新手 vs 红方(横)王者 = 投注蓝方获胜赔率为<strong>2.7倍</strong></p>
      
      <table className="data-table odds-matrix">
        <thead>
          <tr>
            <th>蓝方\红方</th>
            {tiers.map((t, i) => <th key={i}>{t}</th>)}
          </tr>
        </thead>
        <tbody>
          {oddsData.matrix.map((row, i) => (
            <tr key={i}>
              <th>{tiers[i]}</th>
              {row.map((cell, j) => (
                <td key={j} className={i === j ? 'highlight' : ''}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      
      <div className="highlight-box">
        <strong>🎯 同段位赔率规则：</strong>段位越高，同段对决赔率越高！<br/>
        • 新手同段：<strong>1.50倍</strong><br/>
        • 青铜同段：<strong>1.65倍</strong><br/>
        • 白银同段：<strong>1.80倍</strong><br/>
        • 黄金同段：<strong>1.95倍</strong><br/>
        • 钻石同段：<strong>2.10倍</strong><br/>
        • 铂金同段：<strong>2.25倍</strong><br/>
        • 王者同段：<strong>2.40倍</strong>（高手对决最刺激！）<br/><br/>
        <strong>跨段位规则：</strong>段位差距越大，赔率差距越大<br/>
        • 弱者赔率最高 <strong>2.70倍</strong>（如新手vs王者）<br/>
        • 最低赔率 <strong>1.20倍</strong>（王者对战新手）
      </div>
    </div>
  );
}

export default OddsTable;
