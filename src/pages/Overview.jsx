import { overviewData } from '../data/rulesData';

function Overview() {
  return (
    <div className="section-content">
      <h2>📋 系统概览</h2>
      
      <h3>🎮 魔法冰球游戏简介</h3>
      <p>魔法冰球是一款基于VR的双人对战竞技游戏，玩家通过手势控制护盾的元素属性（冰/火/风），利用元素相克机制进行攻防，将球打进对方球门得分。</p>
      
      <h3>📊 竞猜系统架构</h3>
      <table className="data-table">
        <thead>
          <tr><th>模块</th><th>说明</th></tr>
        </thead>
        <tbody>
          {overviewData.modules.map((m, i) => (
            <tr key={i}><td>{m.name}</td><td>{m.desc}</td></tr>
          ))}
        </tbody>
      </table>
      
      <div className="highlight-box">
        <strong>🎯 核心玩法：</strong>观众通过小程序参与赛前竞猜，使用竞猜币投注，猜中即可获得奖励。比赛过程中可以通过打赏为选手加油，并获得实时弹幕展示。
      </div>
    </div>
  );
}

export default Overview;
