import { useState, useEffect, useRef, useCallback } from 'react';
import { formatCoins, netFromBetDetails } from '../utils/coinFormat.js';
import { useMobileSocket } from './SocketContext.jsx';

function QuizPage({ user, setUser }) {
  const socket = useMobileSocket();
  const [gameInfo, setGameInfo] = useState(null);
  const [myBets, setMyBets] = useState({});
  const [rankings, setRankings] = useState([]);
  const [resultData, setResultData] = useState(null);
  const [error, setError] = useState('');
  const [adPlaying, setAdPlaying] = useState(false);
  const [showAdModal, setShowAdModal] = useState(false);
  const [adError, setAdError] = useState('');
  const [showHistory, setShowHistory] = useState(false);
  const [historyData, setHistoryData] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [showCoinLog, setShowCoinLog] = useState(false);
  const [coinLogData, setCoinLogData] = useState([]);
  const [coinLogLoading, setCoinLogLoading] = useState(false);
  const [coinParticles, setCoinParticles] = useState([]);
  const videoRef = useRef(null);
  const coinTargetRef = useRef(null);
  const prevCoinsRef = useRef(user.coins);
  const lastRoundRef = useRef(null);

  // 下注表单
  const [winSide, setWinSide] = useState('');
  const [winAmount, setWinAmount] = useState('');
  const [elemChoice, setElemChoice] = useState('');
  const [elemAmount, setElemAmount] = useState('');
  const [knockdownGuess, setKnockdownGuess] = useState('');
  const [knockdownAmount, setKnockdownAmount] = useState('');
  const [totalGuess, setTotalGuess] = useState('');
  const [totalAmount, setTotalAmount] = useState('');
  const [diffGuess, setDiffGuess] = useState('');
  const [diffAmount, setDiffAmount] = useState('');

  const refreshUser = useCallback(async () => {
    try {
      const res = await fetch(`/api/user/${user.name}`);
      if (res.ok) {
        const data = await res.json();
        setUser(data.user);
      }
    } catch {}
  }, [user.name, setUser]);

  /** 段位榜仅依赖 socket 推送时，切 Tab 卸载页面会丢 state，且不会触发新的 connection 推送；用 HTTP 与推送双通道对齐 JoinPage 的选手榜 */
  const loadRankings = useCallback(async () => {
    try {
      const res = await fetch('/api/rankings');
      if (res.ok) {
        const data = await res.json();
        setRankings(Array.isArray(data.rankings) ? data.rankings : []);
      }
    } catch {}
  }, []);

  useEffect(() => {
    loadRankings();
  }, [loadRankings]);

  /** 与参赛页一致：挂载时拉取当局状态，避免切 Tab 卸载后 gameInfo 为空、status 误显示为 waiting/betting */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/game');
        if (!res.ok || cancelled) return;
        const data = await res.json();
        if (cancelled) return;
        if (data.gameInfo) setGameInfo(data.gameInfo);
      } catch {}
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!socket) return;

    const requestMyBets = () => {
      socket.emit('bet:getMyBets', { username: user.name });
    };

    const onConnect = () => {
      requestMyBets();
      loadRankings();
    };

    const onGameUpdate = (info) => {
      setGameInfo(info);
      if (info.status === 'betting' || info.status === 'waiting') {
        setResultData(null);
      }
      if (lastRoundRef.current !== null && info.round !== lastRoundRef.current) {
        setMyBets({});
        setWinSide(''); setWinAmount('');
        setElemChoice(''); setElemAmount('');
        setKnockdownGuess(''); setKnockdownAmount('');
        setTotalGuess(''); setTotalAmount('');
        setDiffGuess(''); setDiffAmount('');
      }
      lastRoundRef.current = info.round;
    };

    const onGameNext = () => {
      setMyBets({});
      setResultData(null);
      setWinSide(''); setWinAmount('');
      setElemChoice(''); setElemAmount('');
      setKnockdownGuess(''); setKnockdownAmount('');
      setTotalGuess(''); setTotalAmount('');
      setDiffGuess(''); setDiffAmount('');
    };

    const onGameCancel = () => {
      setMyBets({});
      setResultData(null);
      setWinSide(''); setWinAmount('');
      setElemChoice(''); setElemAmount('');
      setKnockdownGuess(''); setKnockdownAmount('');
      setTotalGuess(''); setTotalAmount('');
      setDiffGuess(''); setDiffAmount('');
      refreshUser();
    };

    const onGameResult = (data) => {
      setResultData(data);
      refreshUser();
    };

    const onUserCoins = (data) => {
      setUser(prev => prev ? { ...prev, coins: data.coins } : prev);
    };

    const onBetMyBets = (bets) => {
      setMyBets(bets);
      if (bets.winBet) { setWinSide(bets.winBet.side); setWinAmount(String(bets.winBet.amount)); }
      if (bets.elementKing) { setElemChoice(bets.elementKing.choice); setElemAmount(String(bets.elementKing.amount)); }
      if (bets.knockdownKing) { setKnockdownGuess(String(bets.knockdownKing.value)); setKnockdownAmount(String(bets.knockdownKing.amount)); }
      if (bets.preciseTotal) { setTotalGuess(String(bets.preciseTotal.value)); setTotalAmount(String(bets.preciseTotal.amount)); }
      if (bets.preciseDiff) { setDiffGuess(String(bets.preciseDiff.value)); setDiffAmount(String(bets.preciseDiff.amount)); }
    };

    const onBetError = (data) => {
      setError(data.message);
      setTimeout(() => setError(''), 3000);
    };

    const onRankUpdate = (data) => {
      setRankings(Array.isArray(data) ? data : []);
    };

    socket.on('connect', onConnect);
    socket.on('game:update', onGameUpdate);
    socket.on('game:next', onGameNext);
    socket.on('game:cancel', onGameCancel);
    socket.on('game:result', onGameResult);
    socket.on('user:coins', onUserCoins);
    socket.on('bet:myBets', onBetMyBets);
    socket.on('bet:error', onBetError);
    socket.on('rank:update', onRankUpdate);

    if (socket.connected) {
      requestMyBets();
      loadRankings();
    }

    return () => {
      socket.off('connect', onConnect);
      socket.off('game:update', onGameUpdate);
      socket.off('game:next', onGameNext);
      socket.off('game:cancel', onGameCancel);
      socket.off('game:result', onGameResult);
      socket.off('user:coins', onUserCoins);
      socket.off('bet:myBets', onBetMyBets);
      socket.off('bet:error', onBetError);
      socket.off('rank:update', onRankUpdate);
    };
  }, [socket, user.name, refreshUser, setUser, loadRankings]);

  const placeBet = (betType, extra) => {
    const raw = extra?.amount;
    const amt = typeof raw === 'string' ? parseInt(raw, 10) : parseInt(String(raw), 10);
    if (!Number.isFinite(amt) || amt < 10) {
      setError('单次下注至少需要 10 竞猜币');
      setTimeout(() => setError(''), 3000);
      return;
    }
    socket?.emit('bet:place', { username: user.name, betType, ...extra, amount: amt });
  };

  const cancelBet = (betType) => {
    socket?.emit('bet:cancel', { username: user.name, betType });
    if (betType === 'winBet') { setWinSide(''); setWinAmount(''); }
    if (betType === 'elementKing') { setElemChoice(''); setElemAmount(''); }
    if (betType === 'knockdownKing') { setKnockdownGuess(''); setKnockdownAmount(''); }
    if (betType === 'preciseTotal') { setTotalGuess(''); setTotalAmount(''); }
    if (betType === 'preciseDiff') { setDiffGuess(''); setDiffAmount(''); }
  };

  const handleCheckin = async () => {
    try {
      const res = await fetch('/api/checkin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: user.name }),
      });
      const data = await res.json();
      if (res.ok) {
        setUser(data.user);
      } else {
        setError(data.error);
        setTimeout(() => setError(''), 3000);
      }
    } catch {
      setError('网络错误');
    }
  };

  const handleWatchAd = () => {
    setShowAdModal(true);
    setAdPlaying(true);
    setAdError('');
  };

  const handleAdEnded = async () => {
    setAdPlaying(false);
    try {
      const res = await fetch('/api/watch-ad', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: user.name }),
      });
      const data = await res.json();
      if (res.ok) {
        setUser(data.user);
        setShowAdModal(false);
      } else {
        setAdError(data.error);
      }
    } catch {
      setAdError('网络错误');
    }
  };

  const handleAdError = () => {
    setAdPlaying(false);
    setAdError('广告无法播放（网络异常、文件缺失或设备不支持该视频格式），未发放奖励。可检查网络或联系主持更换为 H.264 编码的 MP4 后重试。');
  };

  const handleAdRetry = () => {
    setAdError('');
    setAdPlaying(true);
    const v = videoRef.current;
    if (v) {
      v.load();
      v.play?.().catch(() => {});
    }
  };

  const openHistory = async () => {
    setShowHistory(true);
    setHistoryLoading(true);
    try {
      const res = await fetch(`/api/history/${user.name}`);
      if (res.ok) {
        const data = await res.json();
        setHistoryData(data.history || []);
      }
    } catch {
      setHistoryData([]);
    }
    setHistoryLoading(false);
  };

  const openCoinLog = async () => {
    setShowCoinLog(true);
    setCoinLogLoading(true);
    try {
      const res = await fetch(`/api/coin-log/${user.name}`);
      if (res.ok) {
        const data = await res.json();
        setCoinLogData(data.coinLog || []);
      }
    } catch {
      setCoinLogData([]);
    }
    setCoinLogLoading(false);
  };

  const triggerCoinAnim = useCallback(() => {
    const target = coinTargetRef.current?.getBoundingClientRect();
    const tx = target ? target.left + target.width / 2 : 60;
    const ty = target ? target.top + target.height / 2 : 12;
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    const particles = Array.from({ length: 20 }, (_, i) => ({
      id: Date.now() + i,
      startX: vw * 0.15 + Math.random() * vw * 0.7,
      startY: vh * 0.25 + Math.random() * vh * 0.35,
      tx, ty,
      delay: Math.random() * 350,
      duration: 900 + Math.random() * 400,
    }));
    setCoinParticles(particles);
    setTimeout(() => setCoinParticles([]), 1800);
  }, []);

  useEffect(() => {
    if (user.coins > prevCoinsRef.current) {
      triggerCoinAnim();
    }
    prevCoinsRef.current = user.coins;
  }, [user.coins, triggerCoinAnim]);

  useEffect(() => {
    if (!showAdModal) return;
    const v = videoRef.current;
    if (!v) return;
    v.muted = true;
    const tryPlay = () => {
      v.play?.().catch(() => {});
    };
    tryPlay();
    v.addEventListener('canplay', tryPlay);
    return () => v.removeEventListener('canplay', tryPlay);
  }, [showAdModal]);

  const today = new Date().toISOString().slice(0, 10);
  const checkedIn = user.lastCheckin === today;
  const status = gameInfo?.status || 'waiting';
  const amIParticipating = gameInfo?.redPlayer === user?.name || gameInfo?.bluePlayer === user?.name;
  const canBet = status === 'betting' && !amIParticipating;
  const odds = gameInfo?.odds || { red: 1.5, blue: 1.5 };
  const isHockey = (gameInfo?.gameType || 'hockey') === 'hockey';
  const redPlayer = gameInfo?.redPlayer;
  const bluePlayer = gameInfo?.bluePlayer;
  const redRating = gameInfo?.redRating ?? 0;
  const blueRating = gameInfo?.blueRating ?? 0;

  // 已下注汇总
  let totalBetted = 0;
  if (myBets.winBet) totalBetted += myBets.winBet.amount || 0;
  if (myBets.elementKing) totalBetted += myBets.elementKing.amount || 0;
  if (myBets.knockdownKing) totalBetted += myBets.knockdownKing.amount || 0;
  if (myBets.preciseTotal) totalBetted += myBets.preciseTotal.amount || 0;
  if (myBets.preciseDiff) totalBetted += myBets.preciseDiff.amount || 0;

  /** Socket 推送或 buildGameInfo.lastGameResult（切 Tab 重进后仍可用） */
  const effectiveResult = resultData ?? gameInfo?.lastGameResult;
  const mySettlement = effectiveResult?.settlements?.find((s) => s.username === user.name);
  const myNet =
    mySettlement != null
      ? (mySettlement.netResult ?? netFromBetDetails(mySettlement.details) ?? 0)
      : null;

  return (
    <div className="mobile-quiz">
      {/* 顶部栏 */}
      <div className="mq-header">
        <div className="mq-user-info">
          <span className="mq-username">👤 {user.name}</span>
          <span className="mq-coins" ref={coinTargetRef}>💰 {formatCoins(user.coins)} 币</span>
          {totalBetted > 0 && status !== 'settled' && <span className="mq-betted">已下注 {formatCoins(totalBetted)} 币</span>}
        </div>
        <div className="mq-actions">
          <div className="mq-actions-row">
            <button onClick={handleCheckin} disabled={checkedIn} className="mq-btn-small">
              {checkedIn ? '✅ 已签到' : '📅 签到 +100'}
            </button>
            <button onClick={handleWatchAd} className="mq-btn-small">
              📺 看广告 +30
            </button>
          </div>
          <div className="mq-actions-row">
            <button onClick={openHistory} className="mq-btn-small mq-btn-history">
              📜 历史竞猜
            </button>
            <button onClick={openCoinLog} className="mq-btn-small mq-btn-coinlog">
              📒 币记录
            </button>
          </div>
        </div>
      </div>

      {/* 广告弹窗 */}
      {showAdModal && (
        <div className="mq-modal-overlay">
          <div className="mq-ad-modal">
            <h3>📺 观看广告</h3>
            {adError && <div className="mq-error">{adError}</div>}
            <div className="mq-ad-video-container">
              <video
                ref={videoRef}
                src="/ads/ad.mp4"
                autoPlay
                muted
                playsInline
                controls
                preload="auto"
                onEnded={handleAdEnded}
                onError={handleAdError}
                style={{ width: '100%', maxHeight: '300px', background: '#000' }}
              />
            </div>
            {adPlaying && !adError && (
              <p className="mq-ad-hint">请观看完整广告（若无画面请点击播放器播放；仍黑屏多为视频编码不兼容，可更换为 H.264 编码的 MP4）</p>
            )}
            {adError && (
              <div className="mq-ad-actions">
                <button type="button" onClick={handleAdRetry} className="mq-btn-small">重新加载</button>
              </div>
            )}
            <button onClick={() => { setShowAdModal(false); setAdError(''); }} className="mq-btn-close">关闭</button>
          </div>
        </div>
      )}

      {/* 历史竞猜弹窗 */}
      {showHistory && (
        <div className="mq-modal-overlay" onClick={() => setShowHistory(false)}>
          <div className="mq-history-modal" onClick={e => e.stopPropagation()}>
            <div className="mq-history-header">
              <h3>📜 历史竞猜记录</h3>
              <button onClick={() => setShowHistory(false)} className="mq-btn-close-x">✕</button>
            </div>
            <div className="mq-history-body">
              {historyLoading && <p className="mq-empty">加载中...</p>}
              {!historyLoading && historyData.length === 0 && <p className="mq-empty">暂无历史记录</p>}
              {!historyLoading && historyData.map((h, idx) => {
                const dt = new Date(h.time);
                const timeStr = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')} ${String(dt.getHours()).padStart(2, '0')}:${String(dt.getMinutes()).padStart(2, '0')}`;
                const rowNet = h.netResult ?? netFromBetDetails(h.details) ?? 0;
                return (
                  <div key={idx} className="mq-history-item">
                    <div className="mq-history-item-head">
                      <span className="mq-history-time">{timeStr}</span>
                      <span className={`mq-history-won ${rowNet > 0 ? 'positive' : rowNet < 0 ? 'negative' : ''}`}>
                        {rowNet > 0 ? `净赚 ${formatCoins(rowNet)} 币` : rowNet < 0 ? `亏损 ${formatCoins(Math.abs(rowNet))} 币` : '不赚不亏'}
                      </span>
                    </div>
                    <div className="mq-history-match">
                      {h.gameType === 'hockey' ? '🏒' : '🥊'} {h.matchName}
                      <span className="mq-history-vs">🔵{h.bluePlayer || '—'} {h.blueScore} : {h.redScore} {h.redPlayer || '—'}🔴</span>
                    </div>
                    {h.details && h.details.length > 0 && (
                      <div className="mq-history-my-entries-title">本局我的条目</div>
                    )}
                    <div className="mq-history-details">
                      {(h.details || []).map((d, j) => {
                        const isHit = d.result === '猜中';
                        const isDraw = d.result === '平局';
                        return (
                          <div key={j} className={`mq-history-detail ${isHit ? 'hit' : isDraw ? 'draw' : 'miss'}`}>
                            <span className="mq-hd-type">{d.type}</span>
                            {d.myBet && <span className="mq-hd-bet">我猜：{d.myBet}</span>}
                            {d.actual && <span className="mq-hd-actual">实际：{d.actual}</span>}
                            <span className={`mq-hd-result ${isHit ? 'hit' : isDraw ? 'draw' : 'miss'}`}>
                              {isHit ? '✅' : isDraw ? '⚖️' : '❌'}
                              {d.won ? ` +${formatCoins(d.won)}` : ''}{d.refund ? ` 退${formatCoins(d.refund)}` : ''}{d.lost ? ` -${formatCoins(d.lost)}` : ''}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* 竞猜币记录弹窗 */}
      {showCoinLog && (
        <div className="mq-modal-overlay" onClick={() => setShowCoinLog(false)}>
          <div className="mq-history-modal" onClick={e => e.stopPropagation()}>
            <div className="mq-history-header">
              <h3>📒 竞猜币记录</h3>
              <button onClick={() => setShowCoinLog(false)} className="mq-btn-close-x">✕</button>
            </div>
            <div className="mq-history-body">
              {coinLogLoading && <p className="mq-empty">加载中...</p>}
              {!coinLogLoading && coinLogData.length === 0 && <p className="mq-empty">暂无记录</p>}
              {!coinLogLoading && coinLogData.map((log, idx) => {
                const dt = new Date(log.time);
                const timeStr = `${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')} ${String(dt.getHours()).padStart(2, '0')}:${String(dt.getMinutes()).padStart(2, '0')}`;
                const isGain = log.type === 'gain';
                const isInfo = log.type === 'info';
                return (
                  <div key={idx} className={`mq-coinlog-item ${isInfo ? 'info' : isGain ? 'gain' : 'spend'}`}>
                    <div className="mq-coinlog-left">
                      <span className="mq-coinlog-reason">{log.reason}</span>
                      <span className="mq-coinlog-time">{timeStr}</span>
                    </div>
                    <div className="mq-coinlog-right">
                      {isInfo ? (
                        <span className="mq-coinlog-amount info">ℹ️</span>
                      ) : (
                        <span className={`mq-coinlog-amount ${isGain ? 'gain' : 'spend'}`}>
                          {isGain ? '+' : '-'}{formatCoins(log.amount)}
                        </span>
                      )}
                      <span className="mq-coinlog-balance">余额 {formatCoins(log.balance)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* 错误提示 */}
      {error && <div className="mq-error-toast">{error}</div>}

      {/* 比赛状态 */}
      <div className="mq-game-status">
        {status === 'waiting' && <div className="mq-status-msg">⏳ 等待主持人配置比赛...</div>}
        {status !== 'waiting' && (
          <>
            <div className="mq-match-name">{isHockey ? '🏒' : '🥊'} {gameInfo?.matchName || '竞猜赛事'}</div>
            <div className="mq-players-odds">
              <div className="mq-player-box blue">
                <div className="mq-player-side blue">
                  <div className="mq-player-label">🔵 蓝方</div>
                  <div className="mq-player-name">{bluePlayer || '等待选手报名'}</div>
                  <div className="mq-player-rating">{blueRating}分</div>
                  <div className="mq-odds-tag">赔率 ×{odds.blue}</div>
                </div>
              </div>
              <span className="mq-vs-sep mq-vs-gold">VS</span>
              <div className="mq-player-box red">
                <div className="mq-player-side red">
                  <div className="mq-player-label">🔴 红方</div>
                  <div className="mq-player-name">{redPlayer || '等待选手报名'}</div>
                  <div className="mq-player-rating">{redRating}分</div>
                  <div className="mq-odds-tag">赔率 ×{odds.red}</div>
                </div>
              </div>
            </div>
          </>
        )}
        {status === 'betting' && <div className="mq-status-msg betting">🎯 下注中 — 请在比赛开始前完成下注</div>}
        {status === 'started' && <div className="mq-status-msg started">{isHockey ? '🏒' : '🥊'} 比赛进行中 — 下注已锁定</div>}
        {status === 'settled' && <div className="mq-status-msg settled">🏆 已开奖</div>}
        {amIParticipating && status === 'betting' && (
          <div className="mq-participant-block">
            <p className="mq-participant-msg">您已报名参赛，要先撤销参赛才能参与竞猜</p>
          </div>
        )}
      </div>

      {/* 开奖结果（个人） */}
      {(effectiveResult || (status === 'settled' && gameInfo)) && (
        <div className="mq-result-card">
          {/* 比赛比分（优先 effectiveResult，fallback gameInfo） */}
          <div className="mq-result-score">
            <span className="blue-text">🔵 {effectiveResult?.blueScore ?? gameInfo?.blueScore ?? '?'}</span>
            <span> : </span>
            <span className="red-text">{effectiveResult?.redScore ?? gameInfo?.redScore ?? '?'} 🔴</span>
          </div>
          {/* 本局开奖结果 - 各竞猜条目实际结果 */}
          <div className="mq-result-info">
            <span>胜方：{(effectiveResult?.winSide ?? gameInfo?.winSide) === 'blue' ? '蓝方' : (effectiveResult?.winSide ?? gameInfo?.winSide) === 'red' ? '红方' : '平局'}</span>
            {(effectiveResult?.gameType ?? gameInfo?.gameType) === 'hockey' && gameInfo?.isMasterMode !== false
              ? <span>元素之王：{{ ice: '❄️ 冰', fire: '🔥 火', wind: '🌪️ 风' }[effectiveResult?.elementWinner] ?? '—'}</span>
              : (effectiveResult?.gameType ?? gameInfo?.gameType) !== 'hockey'
                ? <span>倒地总和：{effectiveResult?.totalKnockdowns ?? gameInfo?.totalKnockdowns ?? '—'} 次</span>
                : null
            }
          </div>
          <div className="mq-result-actual-outcomes">
            <div className="mq-result-actual-title">📋 本局开奖结果</div>
            <div className="mq-result-actual-list">
              <div className="mq-result-actual-item">胜负：{(effectiveResult?.winSide ?? gameInfo?.winSide) === 'red' ? '🔴 红方胜' : (effectiveResult?.winSide ?? gameInfo?.winSide) === 'blue' ? '🔵 蓝方胜' : '⚖️ 平局'}</div>
              {(effectiveResult?.gameType ?? gameInfo?.gameType) === 'hockey' && gameInfo?.isMasterMode !== false
                ? <div className="mq-result-actual-item">元素之王：{{ ice: '❄️ 冰球', fire: '🔥 火球', wind: '🌪️ 风球' }[effectiveResult?.elementWinner] ?? '—'}</div>
                : (effectiveResult?.gameType ?? gameInfo?.gameType) !== 'hockey'
                  ? <div className="mq-result-actual-item">倒地总和：{effectiveResult?.totalKnockdowns ?? gameInfo?.totalKnockdowns ?? '—'} 次</div>
                  : null
              }
              <div className="mq-result-actual-item">精准总分：{effectiveResult?.totalScore ?? (gameInfo?.redScore != null && gameInfo?.blueScore != null ? (parseInt(gameInfo.redScore) + parseInt(gameInfo.blueScore)) : '—')}</div>
              <div className="mq-result-actual-item">精准分差：{effectiveResult?.scoreDiff ?? (gameInfo?.redScore != null && gameInfo?.blueScore != null ? Math.abs(parseInt(gameInfo.redScore) - parseInt(gameInfo.blueScore)) : '—')}</div>
            </div>
          </div>
          {mySettlement && (
            <div className={`mq-my-result ${myNet > 0 ? 'won' : myNet === 0 ? 'even' : 'lost'}`}>
              <div className="mq-my-result-summary">
                {myNet > 0
                  ? `🎉 恭喜！净赚 ${formatCoins(myNet)} 币`
                  : myNet === 0
                    ? '😌 本局不赚不亏'
                    : `😅 本局亏损 ${formatCoins(Math.abs(myNet))} 币`}
              </div>
              {mySettlement.details && mySettlement.details.length > 0 && (
                <div className="mq-result-my-entries-title">我的竞猜条目</div>
              )}
              <div className="mq-result-details">
                {(mySettlement.details || []).map((d, i) => {
                  const isHit = d.result === '猜中';
                  const isDraw = d.result === '平局';
                  return (
                    <div key={i} className={`mq-result-detail-item ${isHit ? 'hit' : isDraw ? 'draw' : 'miss'}`}>
                      <div className="mq-result-detail-type">{d.type}</div>
                      {d.myBet && <div className="mq-result-detail-bet">我的竞猜：{d.myBet} · {formatCoins(d.amount)} 币</div>}
                      {d.actual && <div className="mq-result-detail-actual">实际结果：{d.actual}</div>}
                      <div className={`mq-result-detail-outcome ${isHit ? 'hit' : isDraw ? 'draw' : 'miss'}`}>
                        {isHit ? '✅ 猜中' : isDraw ? '⚖️ 平局' : '❌ 未猜中'}
                        {d.won ? ` +${formatCoins(d.won)} 币` : ''}
                        {d.refund ? ` 退${formatCoins(d.refund)} 币` : ''}
                        {d.lost ? ` -${formatCoins(d.lost)} 币` : ''}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* 下注区域 */}
      {(status === 'betting' || status === 'started') && !effectiveResult && (
        <div className="mq-betting-section">
          {/* 胜负竞猜 */}
          <div className="mq-bet-card">
            <h4>🏒 胜负竞猜 <span className="mq-bet-note">（只能猜单边）</span></h4>
            <p className="mq-bet-desc">猜测哪一方会赢得本场比赛</p>
            <div className="mq-win-bet">
              <div className="mq-side-buttons">
                <button
                  className={`mq-side-btn blue ${winSide === 'blue' ? 'selected' : ''}`}
                  onClick={() => canBet && !myBets.winBet && setWinSide('blue')}
                  disabled={!canBet || !!myBets.winBet}
                >
                  🔵 蓝方胜 ×{odds.blue}
                </button>
                <button
                  className={`mq-side-btn red ${winSide === 'red' ? 'selected' : ''}`}
                  onClick={() => canBet && !myBets.winBet && setWinSide('red')}
                  disabled={!canBet || !!myBets.winBet}
                >
                  🔴 红方胜 ×{odds.red}
                </button>
              </div>
              {winSide && !myBets.winBet && canBet && (
                <>
                  <div className="mq-bet-amount-row">
                    <label className="mq-amount-label">💰 押注金额</label>
                    <input
                      type="number"
                      min="10"
                      step="1"
                      value={winAmount}
                      onChange={e => setWinAmount(e.target.value)}
                      placeholder="最少 10 币"
                    />
                  </div>
                  <div className="mq-bet-action-row">
                    <button
                      onClick={() => placeBet('winBet', { side: winSide, amount: winAmount })}
                      disabled={!winAmount}
                      className="mq-btn-bet"
                    >
                      确认下注
                    </button>
                  </div>
                </>
              )}
              {myBets.winBet && canBet && (
                <div className="mq-bet-locked-row">
                  <span className="mq-current-bet">✅ 已下注：{myBets.winBet.side === 'red' ? '红方' : '蓝方'} {formatCoins(myBets.winBet.amount)} 币</span>
                  <button onClick={() => cancelBet('winBet')} className="mq-btn-cancel">取消</button>
                </div>
              )}
              {myBets.winBet && !canBet && (
                <div className="mq-current-bet">
                  ✅ 已下注：{myBets.winBet.side === 'red' ? '红方' : '蓝方'} {formatCoins(myBets.winBet.amount)} 币
                </div>
              )}
            </div>
          </div>

          {/* 元素之王（冰球大师模式）/ 躺平之王（拳王模式）/ 冰球非大师模式不显示 */}
          {isHockey && gameInfo?.isMasterMode !== false ? (
            <div className="mq-bet-card">
              <h4>❄️🔥🌪️ 元素之王 <span className="mq-bet-odds">赔率 ×3</span></h4>
              <p className="mq-bet-desc">猜测哪种元素球出现次数最多</p>
              <div className="mq-elem-buttons">
                <button
                  className={`mq-elem-btn ice ${elemChoice === 'ice' ? 'selected' : ''}`}
                  onClick={() => canBet && !myBets.elementKing && setElemChoice('ice')}
                  disabled={!canBet || !!myBets.elementKing}
                >❄️ 冰球</button>
                <button
                  className={`mq-elem-btn fire ${elemChoice === 'fire' ? 'selected' : ''}`}
                  onClick={() => canBet && !myBets.elementKing && setElemChoice('fire')}
                  disabled={!canBet || !!myBets.elementKing}
                >🔥 火球</button>
                <button
                  className={`mq-elem-btn wind ${elemChoice === 'wind' ? 'selected' : ''}`}
                  onClick={() => canBet && !myBets.elementKing && setElemChoice('wind')}
                  disabled={!canBet || !!myBets.elementKing}
                >🌪️ 风球</button>
              </div>
              {elemChoice && !myBets.elementKing && canBet && (
                <>
                  <div className="mq-bet-amount-row">
                    <label className="mq-amount-label">💰 押注金额</label>
                    <input
                      type="number"
                      min="10"
                      step="1"
                      value={elemAmount}
                      onChange={e => setElemAmount(e.target.value)}
                      placeholder="最少 10 币"
                    />
                  </div>
                  <div className="mq-bet-action-row">
                    <button
                      onClick={() => placeBet('elementKing', { choice: elemChoice, amount: elemAmount })}
                      disabled={!elemAmount}
                      className="mq-btn-bet"
                    >
                      确认下注
                    </button>
                  </div>
                </>
              )}
              {myBets.elementKing && canBet && (
                <div className="mq-bet-locked-row">
                  <span className="mq-current-bet">✅ 已下注：{{ ice: '冰球', fire: '火球', wind: '风球' }[myBets.elementKing.choice]} {formatCoins(myBets.elementKing.amount)} 币</span>
                  <button onClick={() => cancelBet('elementKing')} className="mq-btn-cancel">取消</button>
                </div>
              )}
              {myBets.elementKing && !canBet && (
                <div className="mq-current-bet">
                  ✅ 已下注：{{ ice: '冰球', fire: '火球', wind: '风球' }[myBets.elementKing.choice]} {formatCoins(myBets.elementKing.amount)} 币
                </div>
              )}
            </div>
          ) : !isHockey ? (
            <div className="mq-bet-card">
              <h4>🤸 躺平之王 <span className="mq-bet-odds">赔率 ×3</span></h4>
              <p className="mq-bet-desc">竞猜本场双方倒地次数总和</p>
              {!myBets.knockdownKing && canBet && (
                <>
                  <div className="mq-bet-guess-row">
                    <label className="mq-guess-label">🎯 预测次数</label>
                    <input
                      type="number"
                      min="0"
                      value={knockdownGuess}
                      onChange={e => setKnockdownGuess(e.target.value)}
                      placeholder="预测次数"
                    />
                  </div>
                  <div className="mq-bet-amount-row">
                    <label className="mq-amount-label">💰 押注金额</label>
                    <input
                      type="number"
                      min="10"
                      step="1"
                      value={knockdownAmount}
                      onChange={e => setKnockdownAmount(e.target.value)}
                      placeholder="最少 10 币"
                    />
                  </div>
                  <div className="mq-bet-action-row">
                    <button
                      onClick={() => placeBet('knockdownKing', { value: knockdownGuess, amount: knockdownAmount })}
                      disabled={!knockdownGuess || !knockdownAmount}
                      className="mq-btn-bet"
                    >
                      确认下注
                    </button>
                  </div>
                </>
              )}
              {myBets.knockdownKing && canBet && (
                <div className="mq-bet-locked-row">
                  <span className="mq-current-bet">✅ 已下注：猜 {myBets.knockdownKing.value} 次 · {formatCoins(myBets.knockdownKing.amount)} 币</span>
                  <button onClick={() => cancelBet('knockdownKing')} className="mq-btn-cancel">取消</button>
                </div>
              )}
              {myBets.knockdownKing && !canBet && (
                <div className="mq-current-bet">✅ 已下注：猜 {myBets.knockdownKing.value} 次 · {formatCoins(myBets.knockdownKing.amount)} 币</div>
              )}
            </div>
          ) : null}

          {/* 精准总分 */}
          <div className="mq-bet-card">
            <h4>🎯 精准总分 <span className="mq-bet-odds">赔率 ×20</span></h4>
            <p className="mq-bet-desc">猜测双方总得分之和，猜中即可获得20倍奖励</p>
            {!myBets.preciseTotal && canBet && (
              <>
                <div className="mq-bet-guess-row">
                  <label className="mq-guess-label">🎯 预测总分</label>
                  <input
                    type="number"
                    min="0"
                    value={totalGuess}
                    onChange={e => setTotalGuess(e.target.value)}
                    placeholder="预测总分"
                  />
                </div>
                <div className="mq-bet-amount-row">
                  <label className="mq-amount-label">💰 押注金额</label>
                  <input
                    type="number"
                    min="10"
                    step="1"
                    value={totalAmount}
                    onChange={e => setTotalAmount(e.target.value)}
                    placeholder="最少 10 币"
                  />
                </div>
                <div className="mq-bet-action-row">
                  <button
                    onClick={() => placeBet('preciseTotal', { value: totalGuess, amount: totalAmount })}
                    disabled={!totalGuess || !totalAmount}
                    className="mq-btn-bet"
                  >
                    确认下注
                  </button>
                </div>
              </>
            )}
            {myBets.preciseTotal && canBet && (
              <div className="mq-bet-locked-row">
                <span className="mq-current-bet">✅ 已下注：猜 {myBets.preciseTotal.value} 分 · {formatCoins(myBets.preciseTotal.amount)} 币</span>
                <button onClick={() => cancelBet('preciseTotal')} className="mq-btn-cancel">取消</button>
              </div>
            )}
            {myBets.preciseTotal && !canBet && (
              <div className="mq-current-bet">✅ 已下注：猜 {myBets.preciseTotal.value} 分 · {formatCoins(myBets.preciseTotal.amount)} 币</div>
            )}
          </div>

          {/* 精准分差 */}
          <div className="mq-bet-card">
            <h4>📊 精准分差 <span className="mq-bet-odds">赔率 ×15</span></h4>
            <p className="mq-bet-desc">猜测双方得分的分差，猜中即可获得15倍奖励</p>
            {!myBets.preciseDiff && canBet && (
              <>
                <div className="mq-bet-guess-row">
                  <label className="mq-guess-label">🎯 预测分差</label>
                  <input
                    type="number"
                    min="0"
                    value={diffGuess}
                    onChange={e => setDiffGuess(e.target.value)}
                    placeholder="预测分差"
                  />
                </div>
                <div className="mq-bet-amount-row">
                  <label className="mq-amount-label">💰 押注金额</label>
                  <input
                    type="number"
                    min="10"
                    step="1"
                    value={diffAmount}
                    onChange={e => setDiffAmount(e.target.value)}
                    placeholder="最少 10 币"
                  />
                </div>
                <div className="mq-bet-action-row">
                  <button
                    onClick={() => placeBet('preciseDiff', { value: diffGuess, amount: diffAmount })}
                    disabled={!diffGuess || !diffAmount}
                    className="mq-btn-bet"
                  >
                    确认下注
                  </button>
                </div>
              </>
            )}
            {myBets.preciseDiff && canBet && (
              <div className="mq-bet-locked-row">
                <span className="mq-current-bet">✅ 已下注：猜 {myBets.preciseDiff.value} 分差 · {formatCoins(myBets.preciseDiff.amount)} 币</span>
                <button onClick={() => cancelBet('preciseDiff')} className="mq-btn-cancel">取消</button>
              </div>
            )}
            {myBets.preciseDiff && !canBet && (
              <div className="mq-current-bet">✅ 已下注：猜 {myBets.preciseDiff.value} 分差 · {formatCoins(myBets.preciseDiff.amount)} 币</div>
            )}
          </div>
        </div>
      )}

      {/* 段位排行 */}
      <div className="mq-rankings">
        <h4>🏅 竞猜段位名次</h4>
        {rankings.length === 0 ? (
          <p className="mq-empty">暂无排行数据</p>
        ) : (
          <div className="mq-rank-list">
            {rankings.map((r, i) => (
              <div key={r.name} className={`mq-rank-item ${r.name === user.name ? 'is-me' : ''}`}>
                <span className="mq-rank-pos">{i + 1}</span>
                <span className="mq-rank-icon">{r.tier.icon}</span>
                <div className="mq-rank-info">
                  <span className="mq-rank-name">{r.name}</span>
                  <span className="mq-rank-tier">{r.tier.name}</span>
                </div>
                <div className="mq-rank-coins-col">
                  <span className="mq-rank-winnings">历史累计赢 {formatCoins(r.name === user.name ? user.totalWinnings : r.totalWinnings)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 金币动画层 */}
      {coinParticles.length > 0 && (
        <div className="mq-coin-anim-layer">
          {coinParticles.map(p => (
            <div
              key={p.id}
              className="mq-coin-particle"
              style={{
                left: p.startX,
                top: p.startY,
                '--fly-x': `${p.tx - p.startX}px`,
                '--fly-y': `${p.ty - p.startY}px`,
                animationDelay: `${p.delay}ms`,
                animationDuration: `${p.duration}ms`,
              }}
            >💰</div>
          ))}
        </div>
      )}
    </div>
  );
}

export default QuizPage;
