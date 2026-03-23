import { useState, useEffect } from 'react';
import Login from './Login';
import QuizPage from './QuizPage';
import JoinPage from './JoinPage';
import { DanmakuFlyLayer, DanmakuInputModal } from './Danmaku';
import './MobileApp.css';

function MobileApp() {
  const [user, setUser] = useState(null);
  const [activeTab, setActiveTab] = useState('quiz'); // quiz | join
  const [danmakuOpen, setDanmakuOpen] = useState(false);

  useEffect(() => {
    const root = document.documentElement;
    const body = document.body;
    root.classList.add('mobile-app-route');
    body.classList.add('mobile-app-route');
    return () => {
      root.classList.remove('mobile-app-route');
      body.classList.remove('mobile-app-route');
    };
  }, []);

  if (!user) {
    return <Login onLogin={setUser} />;
  }

  return (
    <div className="mobile-app-with-tabs">
      <DanmakuFlyLayer />
      <main className="mobile-tab-content">
        {activeTab === 'quiz' ? (
          <QuizPage user={user} setUser={setUser} />
        ) : (
          <JoinPage user={user} setUser={setUser} />
        )}
      </main>
      <nav className="mobile-bottom-nav mobile-bottom-nav-3col">
        <button
          type="button"
          className={`mobile-nav-btn ${activeTab === 'quiz' ? 'active' : ''}`}
          onClick={() => setActiveTab('quiz')}
        >
          <span className="mobile-nav-icon">🎲</span>
          <span className="mobile-nav-label">我要竞猜</span>
        </button>
        <button
          type="button"
          className="mobile-nav-danmaku-fab"
          onClick={() => setDanmakuOpen(true)}
          aria-label="发弹幕"
        >
          <span className="mobile-nav-danmaku-fab-inner" aria-hidden>💬</span>
          <span className="mobile-nav-danmaku-fab-label">发弹幕</span>
        </button>
        <button
          type="button"
          className={`mobile-nav-btn ${activeTab === 'join' ? 'active' : ''}`}
          onClick={() => setActiveTab('join')}
        >
          <span className="mobile-nav-icon">🏆</span>
          <span className="mobile-nav-label">我要参赛</span>
        </button>
      </nav>
      <DanmakuInputModal user={user} open={danmakuOpen} onClose={() => setDanmakuOpen(false)} />
    </div>
  );
}

export default MobileApp;
