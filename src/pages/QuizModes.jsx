import { quizData } from '../data/rulesData';

function QuizModes() {
  return (
    <div className="section-content">
      <h2>🎮 趣味竞猜玩法</h2>
      <p className="quiz-intro">三种趣味玩法，难度不同，回报也不同！选择你喜欢的玩法参与竞猜。</p>
      
      {/* 三种玩法并排展示 */}
      <div className="quiz-modes-grid">
        
        {/* 元素之王 */}
        <div className="quiz-mode-card element-king">
          <div className="quiz-mode-header">
            <span className="quiz-mode-icon">❄️🔥🌪️</span>
            <h3>元素之王</h3>
            <span className="quiz-mode-badge easy">简单</span>
            <span className="quiz-mode-odds">赔率 1:3</span>
          </div>
          
          <div className="quiz-mode-question">
            <strong>🎯 问题：</strong>本局全场出现次数最多的元素球是哪一种？
          </div>
          
          <div className="quiz-mode-options">
            {quizData.elementKing.map((item, i) => (
              <div key={i} className={`quiz-option ${item.option.includes('冰') ? 'opt-ice' : item.option.includes('火') ? 'opt-fire' : 'opt-wind'}`}>
                <span className="option-emoji">{item.option}</span>
                <span className="option-odds">{item.odds}</span>
                <span className="option-desc">{item.desc}</span>
              </div>
            ))}
          </div>
          
          <div className="quiz-mode-rule">
            <strong>⚖️ 平局规则：</strong>{quizData.elementKingRule}
          </div>
          
          <div className="quiz-mode-tip">
            💡 3种元素均分概率，各33%，赔率1:3提供合理回报
          </div>
        </div>
        
        {/* 精准总分 */}
        <div className="quiz-mode-card precise-score">
          <div className="quiz-mode-header">
            <span className="quiz-mode-icon">🎯</span>
            <h3>精准总分</h3>
            <span className="quiz-mode-badge hard">⭐高难度</span>
            <span className="quiz-mode-odds">赔率 1:20</span>
          </div>
          
          <div className="quiz-mode-question">
            <strong>🎯 问题：</strong>本局双方总得分会是多少分？
          </div>
          
          <div className="quiz-mode-howto">
            <div className="howto-item">
              <span className="howto-icon">📝</span>
              <span>手动输入数字（如：12）</span>
            </div>
            <div className="howto-item">
              <span className="howto-icon">✅</span>
              <span>必须完全一致才算中奖</span>
            </div>
            <div className="howto-item highlight">
              <span className="howto-icon">💰</span>
              <span>赔率 <strong>1:20</strong>（高难度高回报）</span>
            </div>
          </div>
          
          <div className="quiz-mode-example">
            <strong>📌 示例：</strong>猜12分，实际7:5=12分 → <span className="win-text">中奖！</span>
          </div>
        </div>
        
        {/* 精准分差 */}
        <div className="quiz-mode-card precise-diff">
          <div className="quiz-mode-header">
            <span className="quiz-mode-icon">📊</span>
            <h3>精准分差</h3>
            <span className="quiz-mode-badge hard">⭐高难度</span>
            <span className="quiz-mode-odds">赔率 1:15</span>
          </div>
          
          <div className="quiz-mode-question">
            <strong>🎯 问题：</strong>本局双方得分相差多少分？
          </div>
          
          <div className="quiz-mode-howto">
            <div className="howto-item">
              <span className="howto-icon">📝</span>
              <span>手动输入数字（如：3）</span>
            </div>
            <div className="howto-item">
              <span className="howto-icon">✅</span>
              <span>必须完全一致（不区分谁高谁低）</span>
            </div>
            <div className="howto-item highlight">
              <span className="howto-icon">💰</span>
              <span>赔率 <strong>1:15</strong></span>
            </div>
          </div>
          
          <div className="quiz-mode-example">
            <strong>📌 示例：</strong>猜相差3分，实际8:5=3分 → <span className="win-text">中奖！</span>
          </div>
        </div>
        
      </div>
    </div>
  );
}

export default QuizModes;
