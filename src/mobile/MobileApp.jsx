import { useState } from 'react';
import Login from './Login';
import QuizPage from './QuizPage';
import JoinPage from './JoinPage';
import './MobileApp.css';

function MobileApp() {
  const [user, setUser] = useState(null);
  const [activeTab, setActiveTab] = useState('quiz'); // quiz | join

  if (!user) {
    return <Login onLogin={setUser} />;
  }

  return (
    <div className="mobile-app-with-tabs">
      <main className="mobile-tab-content">
        {activeTab === 'quiz' ? (
          <QuizPage user={user} setUser={setUser} />
        ) : (
          <JoinPage user={user} setUser={setUser} />
        )}
      </main>
      <nav className="mobile-bottom-nav">
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
          className={`mobile-nav-btn ${activeTab === 'join' ? 'active' : ''}`}
          onClick={() => setActiveTab('join')}
        >
          <span className="mobile-nav-icon">🏆</span>
          <span className="mobile-nav-label">我要参赛</span>
        </button>
      </nav>
    </div>
  );
}

export default MobileApp;
