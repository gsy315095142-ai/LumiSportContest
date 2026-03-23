import { useState, useEffect, useLayoutEffect, Component } from 'react';
import Login from './Login';
import QuizPage from './QuizPage';
import JoinPage from './JoinPage';
import { DanmakuFlyLayer, DanmakuInputModal } from './Danmaku';
import { SocketProvider } from './SocketContext.jsx';
import './MobileApp.css';

/** 捕获子树运行时错误，避免整页白屏 */
class MobileAppErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('[MobileApp] ErrorBoundary', error, errorInfo?.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="mobile-app-error-boundary">
          <p className="mobile-app-error-boundary-title">页面出错了</p>
          <p className="mobile-app-error-boundary-hint">请稍后再试，或刷新页面</p>
          <button
            type="button"
            className="mobile-app-error-boundary-retry"
            onClick={() => this.setState({ hasError: false, error: null })}
          >
            重试
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

function MobileAppInner() {
  const [user, setUser] = useState(null);
  const [activeTab, setActiveTab] = useState('quiz'); // quiz | join
  const [danmakuOpen, setDanmakuOpen] = useState(false);

  /** 首帧前打上类名，避免 index.css 里 body 的 flex 居中在首屏把 #root 顶离底部 */
  useLayoutEffect(() => {
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
    <SocketProvider>
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
    </SocketProvider>
  );
}

export default function MobileApp() {
  return (
    <MobileAppErrorBoundary>
      <MobileAppInner />
    </MobileAppErrorBoundary>
  );
}
