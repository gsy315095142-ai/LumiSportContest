import { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';

const GAME_TYPE_NAMES = { hockey: '魔法冰球', boxing: '魔法拳王' };

function JoinPage({ user, setUser }) {
  const socketRef = useRef(null);
  const [gameInfo, setGameInfo] = useState(null);
  const [contestStatus, setContestStatus] = useState(null);
  const [selectedSide, setSelectedSide] = useState(''); // 'red' | 'blue' | ''
  const [error, setError] = useState('');
  const [showMatchHistory, setShowMatchHistory] = useState(false);
  const [matchHistoryData, setMatchHistoryData] = useState([]);
  const [matchHistoryLoading, setMatchHistoryLoading] = useState(false);
  const [ratingRankings, setRatingRankings] = useState([]);

  useEffect(() => {
    const socket = io();
    socketRef.current = socket;

    socket.on('connect', () => {
      socket.emit('bet:getMyBets', { username: user.name });
    });

    socket.on('game:update', (info) => {
      setGameInfo(info);
      if (info.status === 'settled') {
        fetch('/api/rating-rankings')
          .then(r => r.json())
          .then(data => setRatingRankings(data.rankings || []))
          .catch(() => {});
      }
    });

    socket.on('contest:update', (status) => {
      setContestStatus(status);
    });

    socket.on('contest:error', (data) => {
      setError(data.message || '操作失败');
      setTimeout(() => setError(''), 3000);
    });

    return () => { socket.disconnect(); };
  }, [user.name]);

  // 初始加载：从 REST 获取当前状态
  useEffect(() => {
    const fetchGame = () =>
      fetch('/api/game')
        .then(r => r.json())
        .then(data => {
          setGameInfo(data.gameInfo);
          setContestStatus(data.contestStatus || {});
        })
        .catch(() => {});
    fetchGame();
  }, []);

  // 当 settled 时若缺少选手或分数，主动拉取最新 gameInfo
  useEffect(() => {
    if (gameInfo?.status !== 'settled') return;
    const needRefresh = (gameInfo?.redPlayer == null && gameInfo?.bluePlayer == null) ||
      (gameInfo?.redScore == null && gameInfo?.blueScore == null);
    if (!needRefresh) return;
    fetch('/api/game')
      .then(r => r.json())
      .then(data => {
        if (data.gameInfo) setGameInfo(data.gameInfo);
        if (data.contestStatus) setContestStatus(data.contestStatus);
      })
      .catch(() => {});
  }, [gameInfo?.status, gameInfo?.redPlayer, gameInfo?.bluePlayer, gameInfo?.redScore, gameInfo?.blueScore]);

  // 进入参赛页时刷新用户信息（含竞猜币、选手积分）
  useEffect(() => {
    fetch(`/api/user/${user.name}`)
      .then(r => r.json())
      .then(data => data.user && setUser(data.user))
      .catch(() => {});
  }, [user.name, setUser]);

  // 加载选手积分排行
  useEffect(() => {
    fetch('/api/rating-rankings')
      .then(r => r.json())
      .then(data => setRatingRankings(data.rankings || []))
      .catch(() => setRatingRankings([]));
  }, []);

  const handleConfirm = () => {
    if (!selectedSide) {
      setError('请选择红方或蓝方');
      setTimeout(() => setError(''), 3000);
      return;
    }
    socketRef.current?.emit('contest:confirm', { name: user.name, side: selectedSide });
  };

  const handleCancel = () => {
    socketRef.current?.emit('contest:cancel', { name: user.name });
  };

  const openMatchHistory = async () => {
    setShowMatchHistory(true);
    setMatchHistoryLoading(true);
    try {
      const res = await fetch(`/api/match-history/${user.name}`);
      if (res.ok) {
        const data = await res.json();
        setMatchHistoryData(data.history || []);
      }
    } catch {
      setMatchHistoryData([]);
    }
    setMatchHistoryLoading(false);
  };

  const status = gameInfo?.status || 'waiting';
  const canOperate = status === 'betting';
  const gameTypeName = GAME_TYPE_NAMES[gameInfo?.gameType] || '魔法冰球';
  const redAvailable = contestStatus?.redAvailable !== false;
  const blueAvailable = contestStatus?.blueAvailable !== false;
  const amIRed = contestStatus?.redPlayer === user?.name;
  const amIBlue = contestStatus?.bluePlayer === user?.name;
  const amIParticipating = amIRed || amIBlue;

  const statusMsg = {
    waiting: '新一轮报名尚未开始',
    started: '比赛正在进行中',
    settled: '比赛已结束',
  }[status] || '';

  return (
    <div className="mobile-quiz mobile-join">
      {/* 账号信息模块（与竞猜页布局一致） */}
      <div className="mq-header">
        <div className="mq-user-info">
          <span className="mq-username">👤 {user?.name}</span>
          <span className="mq-rating">🏆 {user?.rating ?? 1500} 分</span>
        </div>
        <div className="mq-actions">
          <div className="mq-actions-row">
            <button onClick={openMatchHistory} className="mq-btn-small mq-btn-history">
              📋 历史战绩
            </button>
          </div>
        </div>
      </div>

      {/* 错误提示 */}
      {error && <div className="mq-error-toast">{error}</div>}

      {/* 主内容 */}
      <div className="mq-game-status">
        <div className="mq-match-name">🏆 我要参赛</div>
        {gameInfo?.matchName && (
          <div className="mq-match-sub" style={{ fontSize: 14, color: '#aaa', marginBottom: 8 }}>
            {gameInfo.matchName}
          </div>
        )}
        {status !== 'waiting' && (
          <div className="mq-game-type-badge" style={{ marginBottom: 16 }}>
            {(gameInfo?.gameType === 'hockey' ? '🏒' : '🥊')} {gameTypeName}
          </div>
        )}

        {/* 比赛结束后、下一局开始前/中：展示上一局结果（含分数） */}
        {(status === 'waiting' || status === 'betting') && gameInfo?.lastSettledMatch && (
          <div className="mq-join-result-block" style={{ marginBottom: 16, padding: 12, background: 'rgba(255,255,255,0.06)', borderRadius: 12 }}>
            <div style={{ fontSize: 12, color: '#888', marginBottom: 8 }}>
              上一局结果
              {gameInfo.lastSettledMatch.matchName && ` · ${gameInfo.lastSettledMatch.matchName}`}
            </div>
            <div className="mq-players-odds" style={{ marginBottom: 0 }}>
              <div className="mq-player-box blue">
                <div className="mq-player-side blue">
                  <div className="mq-player-label">🔵 蓝方</div>
                  <div className="mq-player-name">{gameInfo.lastSettledMatch.bluePlayer || '—'}</div>
                  <div className="mq-player-rating mq-score">{gameInfo.lastSettledMatch.blueScore ?? '?'}</div>
                </div>
              </div>
              <span className="mq-vs-sep mq-vs-gold">:</span>
              <div className="mq-player-box red">
                <div className="mq-player-side red">
                  <div className="mq-player-label">🔴 红方</div>
                  <div className="mq-player-name">{gameInfo.lastSettledMatch.redPlayer || '—'}</div>
                  <div className="mq-player-rating mq-score">{gameInfo.lastSettledMatch.redScore ?? '?'}</div>
                </div>
              </div>
            </div>
            <div className="mq-status-msg settled" style={{ marginTop: 8 }}>
              比分 {gameInfo.lastSettledMatch.blueScore ?? '?'} : {gameInfo.lastSettledMatch.redScore ?? '?'} · {gameInfo.lastSettledMatch.result || '已开奖'}
            </div>
          </div>
        )}

        {/* 报名中/比赛进行中：展示对战双方（左蓝方 VS 右红方，选手也可见） */}
        {(status === 'betting' || status === 'started') && (
          <div className="mq-players-odds" style={{ marginBottom: 16 }}>
            <div className="mq-player-box blue">
              <div className="mq-player-side blue">
                <div className="mq-player-label">🔵 蓝方</div>
                <div className="mq-player-name">{gameInfo?.bluePlayer || contestStatus?.bluePlayer || '等待选手报名'}</div>
                <div className="mq-player-rating">{gameInfo?.blueRating || 0}分</div>
              </div>
            </div>
            <span className="mq-vs-sep mq-vs-gold">VS</span>
            <div className="mq-player-box red">
              <div className="mq-player-side red">
                <div className="mq-player-label">🔴 红方</div>
                <div className="mq-player-name">{gameInfo?.redPlayer || contestStatus?.redPlayer || '等待选手报名'}</div>
                <div className="mq-player-rating">{gameInfo?.redRating || 0}分</div>
              </div>
            </div>
          </div>
        )}

        {/* 比赛已结束：展示胜负结果（左蓝方 VS 右红方，含选手与比分） */}
        {status === 'settled' && (gameInfo?.redPlayer || gameInfo?.bluePlayer || contestStatus?.redPlayer || contestStatus?.bluePlayer || gameInfo?.redScore != null || gameInfo?.blueScore != null) && (
          <div className="mq-join-result-block" style={{ marginBottom: 16, padding: 12, background: 'rgba(255,255,255,0.06)', borderRadius: 12 }}>
            <div className="mq-players-odds" style={{ marginBottom: 8 }}>
              <div className="mq-player-box blue">
                <div className="mq-player-side blue">
                  <div className="mq-player-label">🔵 蓝方</div>
                  <div className="mq-player-name">{gameInfo?.bluePlayer || contestStatus?.bluePlayer || '—'}</div>
                  <div className="mq-player-rating mq-score">{gameInfo?.blueScore ?? '?'}</div>
                </div>
              </div>
              <span className="mq-vs-sep mq-vs-gold">:</span>
              <div className="mq-player-box red">
                <div className="mq-player-side red">
                  <div className="mq-player-label">🔴 红方</div>
                  <div className="mq-player-name">{gameInfo?.redPlayer || contestStatus?.redPlayer || '—'}</div>
                  <div className="mq-player-rating mq-score">{gameInfo?.redScore ?? '?'}</div>
                </div>
              </div>
            </div>
            <div className="mq-status-msg settled">比分 {gameInfo?.blueScore ?? '?'} : {gameInfo?.redScore ?? '?'} · {gameInfo?.result || '已开奖'}</div>
          </div>
        )}

        {!canOperate ? (
          <div className={`mq-status-msg mq-join-status ${status}`} style={{ marginTop: 8, display: 'block', width: '100%', textAlign: 'center' }}>
            {status === 'started' ? `${gameInfo?.gameType === 'boxing' ? '🥊' : '🏒'} 比赛进行中` : statusMsg}
          </div>
        ) : (
          <>
            {amIParticipating ? (
              <div className="mq-join-confirmed">
                <p className="mq-join-confirmed-msg">
                  已报名 <span className={amIRed ? 'red-text' : 'blue-text'}>{amIRed ? '红方' : '蓝方'}</span>
                </p>
                <button onClick={handleCancel} className="mq-btn-cancel mq-btn-join-cancel">
                  撤销参赛
                </button>
              </div>
            ) : (
              <div className="mq-join-select">
                <p className="mq-join-hint">选择阵营（每方限 1 人）</p>
                <div className="mq-side-buttons mq-join-sides">
                  <button
                    type="button"
                    className={`mq-side-btn blue ${selectedSide === 'blue' ? 'selected' : ''}`}
                    onClick={() => blueAvailable && setSelectedSide('blue')}
                    disabled={!blueAvailable}
                  >
                    🔵 蓝方
                    {!blueAvailable && <span className="mq-join-taken">（已占）</span>}
                  </button>
                  <button
                    type="button"
                    className={`mq-side-btn red ${selectedSide === 'red' ? 'selected' : ''}`}
                    onClick={() => redAvailable && setSelectedSide('red')}
                    disabled={!redAvailable}
                  >
                    🔴 红方
                    {!redAvailable && <span className="mq-join-taken">（已占）</span>}
                  </button>
                </div>
                <button
                  onClick={handleConfirm}
                  className="mq-btn-bet mq-btn-join-confirm"
                  disabled={!selectedSide}
                >
                  确认
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* 选手积分名次 */}
      <div className="mq-rankings">
        <h4>🏅 选手积分名次</h4>
        {ratingRankings.length === 0 ? (
          <p className="mq-empty">暂无排行数据</p>
        ) : (
          <div className="mq-rank-list">
            {ratingRankings.map((r, i) => (
              <div key={r.name} className={`mq-rank-item mq-rank-item-rating ${r.name === user?.name ? 'is-me' : ''}`}>
                <span className="mq-rank-pos">{i + 1}</span>
                <span className="mq-rank-icon">{['🥇', '🥈', '🥉'][i] || '🏆'}</span>
                <div className="mq-rank-info">
                  <span className="mq-rank-name">{r.name}</span>
                </div>
                <div className="mq-rank-coins-col">
                  <span className="mq-rank-winnings">{r.rating} 分</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 历史战绩弹窗 */}
      {showMatchHistory && (
        <div className="mq-modal-overlay" onClick={() => setShowMatchHistory(false)}>
          <div className="mq-history-modal" onClick={e => e.stopPropagation()}>
            <div className="mq-history-header">
              <h3>📋 历史战绩</h3>
              <button onClick={() => setShowMatchHistory(false)} className="mq-btn-close-x">✕</button>
            </div>
            <div className="mq-history-body">
              {matchHistoryLoading && <p className="mq-empty">加载中...</p>}
              {!matchHistoryLoading && matchHistoryData.length === 0 && (
                <p className="mq-empty">暂无参赛记录</p>
              )}
              {!matchHistoryLoading && matchHistoryData.map((m, idx) => {
                const dt = new Date(m.time);
                const timeStr = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')} ${String(dt.getHours()).padStart(2, '0')}:${String(dt.getMinutes()).padStart(2, '0')}`;
                const vs = `${m.redPlayer || '—'} vs ${m.bluePlayer || '—'}`;
                const score = `${m.redScore ?? '?'} : ${m.blueScore ?? '?'}`;
                const redChange = m.redRatingChange != null ? (m.redRatingChange >= 0 ? `+${m.redRatingChange}` : m.redRatingChange) : '';
                const blueChange = m.blueRatingChange != null ? (m.blueRatingChange >= 0 ? `+${m.blueRatingChange}` : m.blueRatingChange) : '';
                return (
                  <div key={idx} className="mq-history-item mq-match-history-item">
                    <div className="mq-history-item-head">
                      <span className="mq-history-time">{timeStr}</span>
                      <span className="mq-history-won">{m.result}</span>
                    </div>
                    <div className="mq-history-match">
                      {(m.gameType === 'hockey' ? '🏒' : '🥊')} {m.matchName || '赛事'}
                      <span className="mq-history-vs">{vs}</span>
                    </div>
                    <div className="mq-match-score">比分 {score}</div>
                    {(redChange || blueChange) && (
                      <div className="mq-match-rating-change">
                        {redChange && <span className="red-text">红 {redChange}</span>}
                        {redChange && blueChange && ' · '}
                        {blueChange && <span className="blue-text">蓝 {blueChange}</span>}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default JoinPage;
