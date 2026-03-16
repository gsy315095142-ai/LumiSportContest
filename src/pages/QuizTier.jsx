import { quizTierData } from '../data/rulesData';

function QuizTier() {
  return (
    <div className="section-content">
      <h2>🔮 竞猜段位</h2>

      <div className="highlight-box">
        <strong>核心规则：</strong>竞猜段位由<strong>历史累计赢得的竞猜币总额</strong>决定，<strong>只升不降</strong>！<br/>
        即使后续竞猜亏损，段位也不会掉落——你的每一次正确预言都会被永久记录。<br/>
        <em>注：累计赢得 = 猜中后返还的总额（含本金），非纯利润。例如押 100 币猜中，赔率 1.5，则累计 +150 币。</em>
      </div>

      <h3>📊 数值预期</h3>
      <p className="hint">基于每次投注 100 竞猜币计算</p>
      <table className="data-table">
        <thead>
          <tr>
            <th>竞猜玩法</th>
            <th>赔率</th>
            <th>猜对1次获得</th>
            <th>猜对10次累计</th>
            <th>说明</th>
          </tr>
        </thead>
        <tbody>
          {quizTierData.estimates.map((e, i) => (
            <tr key={i}>
              <td>{e.mode}</td>
              <td>{e.odds}</td>
              <td className="win">{e.perWin} 币</td>
              <td className="win">{e.tensWin} 币</td>
              <td>{e.desc}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="example-box">
        <strong>💡 晋级节奏参考（每次投注100币）：</strong><br/><br/>
        若<strong>胜负竞猜</strong>与<strong>趣味竞猜</strong>都参与，同一局两项都猜中时，可获得约 <strong>500 币</strong>（胜负约200 + 元素之王300；若再中精准类则更高）。<br/><br/>
        晋级<strong>青铜预言家</strong>需累计赢得 2,500 币，约需<strong>赢 5 局</strong>（每局两项都中）即可达成。
      </div>

      <h3>🏅 段位阶梯</h3>
      <p className="hint">累计赢得竞猜币达到门槛即可晋级，只升不降</p>
      <table className="data-table">
        <thead>
          <tr>
            <th>段位</th>
            <th>累计赢得门槛</th>
            <th>标识</th>
          </tr>
        </thead>
        <tbody>
          {quizTierData.tiers.map((t, i) => (
            <tr key={i}>
              <td className={t.class}>{t.name}</td>
              <td>{t.threshold === '0' ? '初始段位' : `${t.threshold} 币`}</td>
              <td>{t.icon}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h3>🏆 王者预言家</h3>
      <div className="highlight-box">
        <strong>当累计赢得竞猜币达到 100,000 币（王者预言家）后：</strong><br/><br/>
        • 不再显示段位名称，改为显示<strong>全国排名</strong><br/>
        • 排名根据累计赢得竞猜币高低实时更新<br/>
        • 显示格式：王者预言家 · 全国第42名<br/>
        • 累计无上限，可继续赢取竞猜币提升排名
      </div>
    </div>
  );
}

export default QuizTier;
