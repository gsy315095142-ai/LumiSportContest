import { useState, useLayoutEffect, useRef, Component } from 'react';
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
  const bottomNavRef = useRef(null);
  const stableLayoutHeightRef = useRef(window.innerHeight);

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

  /**
   * 键盘 / 视口变化时，部分 WebView 会缩小布局视口，fixed bottom:0 会锚在「可见区底」导致底栏被顶起。
   * 用 visualViewport 与 innerHeight 差值（及无 vv 时的回退）计算应向下平移的距离，使底栏贴回物理屏幕底缘（可被键盘盖住）。
   */
  useLayoutEffect(() => {
    if (!user) return;
    const nav = bottomNavRef.current;
    if (!nav) return;

    stableLayoutHeightRef.current = window.innerHeight;

    const computeInsetBottom = () => {
      const vv = window.visualViewport;
      if (vv) {
        const fromVv = window.innerHeight - vv.height - vv.offsetTop;
        if (fromVv > 0.5) return fromVv;
      }
      return Math.max(0, stableLayoutHeightRef.current - window.innerHeight);
    };

    const apply = () => {
      const inset = computeInsetBottom();
      nav.style.transform = inset > 0.5 ? `translateY(${inset}px)` : '';
    };

    const onWinResize = () => apply();

    const onOrientation = () => {
      window.setTimeout(() => {
        stableLayoutHeightRef.current = window.innerHeight;
        apply();
      }, 350);
    };

    const onFocusIn = (e) => {
      const t = e.target;
      if (!(t instanceof HTMLElement)) return;
      if (!t.matches('input, textarea, select')) return;
      requestAnimationFrame(() => requestAnimationFrame(apply));
    };

    window.addEventListener('resize', onWinResize);
    window.addEventListener('orientationchange', onOrientation);
    document.addEventListener('focusin', onFocusIn, true);
    const vv = window.visualViewport;
    if (vv) {
      vv.addEventListener('resize', apply);
      vv.addEventListener('scroll', apply);
    }
    apply();

    return () => {
      window.removeEventListener('resize', onWinResize);
      window.removeEventListener('orientationchange', onOrientation);
      document.removeEventListener('focusin', onFocusIn, true);
      if (vv) {
        vv.removeEventListener('resize', apply);
        vv.removeEventListener('scroll', apply);
      }
      nav.style.transform = '';
    };
  }, [user]);

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
        <nav ref={bottomNavRef} className="mobile-bottom-nav mobile-bottom-nav-3col">
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
