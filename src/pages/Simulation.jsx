import { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import { QRCodeSVG } from 'qrcode.react';
import { oddsData } from '../data/rulesData';

const TIERS = ['新手', '青铜', '白银', '黄金', '钻石', '铂金', '王者'];

function Simulation() {
  const socketRef = useRef(null);
  const [connected, setConnected] = useState(false);
  const [gameInfo, setGameInfo] = useState(null);
  const [betSummary, setBetSummary] = useState(null);
  const [rankings, setRankings] = useState([]);
  const [resultData, setResultData] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [confirmNext, setConfirmNext] = useState(false);
  const [bottomTab, setBottomTab] = useState('bets');

  // 本地表单
  const [gameType, setGameType] = useState('hockey');
  const [matchName, setMatchName] = useState('');
  const [redTier, setRedTier] = useState('新手');
  const [blueTier, setBlueTier] = useState('新手');
  const [redScore, setRedScore] = useState('');
  const [blueScore, setBlueScore] = useState('');
  const [iceBalls, setIceBalls] = useState('');
  const [fireBalls, setFireBalls] = useState('');
  const [windBalls, setWindBalls] = useState('');
  const [totalKnockdowns, setTotalKnockdowns] = useState('');

  // 获取局域网地址（从后端获取真实 IP，避免 localhost）
  const [mobileUrl, setMobileUrl] = useState('');
  useEffect(() => {
    const port = window.location.port || '5173';
    fetch('/api/server-info')
      .then(r => r.json())
      .then(data => {
        const ip = data.ip || window.location.hostname;
        setMobileUrl(`http://${ip}:${port}/mobile`);
      })
      .catch(() => {
        const host = window.location.hostname;
        setMobileUrl(`http://${host}:${port}/mobile`);
      });
  }, []);

  // Socket 连接
  useEffect(() => {
    const socket = io();
    socketRef.current = socket;

    socket.on('connect', () => setConnected(true));
    socket.on('disconnect', () => setConnected(false));

    socket.on('game:update', (info) => {
      setGameInfo(info);
      if (info.gameType) setGameType(info.gameType);
      if (info.matchName !== undefined) setMatchName(info.matchName);
      if (info.redTier) setRedTier(info.redTier);
      if (info.blueTier) setBlueTier(info.blueTier);
      if (info.status === 'betting' || info.status === 'waiting') {
        setResultData(null);
      }
    });
    socket.on('game:start', () => {});
    socket.on('game:result', (data) => setResultData(data));
    socket.on('game:next', (info) => {
      setGameInfo(info);
      if (info.gameType) setGameType(info.gameType);
      if (info.matchName !== undefined) setMatchName(info.matchName);
      if (info.redTier) setRedTier(info.redTier);
      if (info.blueTier) setBlueTier(info.blueTier);
      setResultData(null);
      setRedScore('');
      setBlueScore('');
      setIceBalls('');
      setFireBalls('');
      setWindBalls('');
      setTotalKnockdowns('');
      setConfirmNext(false);
    });
    socket.on('bet:update', (summary) => setBetSummary(summary));
    socket.on('rank:update', (data) => setRankings(data));
    socket.on('game:error', (data) => {
      if (data.needConfirm) {
        setConfirmNext(true);
      } else {
        setErrorMsg(data.message);
        setTimeout(() => setErrorMsg(''), 4000);
      }
    });

    return () => { socket.disconnect(); };
  }, []);

  const status = gameInfo?.status || 'waiting';

  const handleConfigUpdate = () => {
    socketRef.current?.emit('game:config', { matchName, redTier, blueTier, gameType });
  };

  const handleOpenBetting = () => {
    socketRef.current?.emit('game:config', { matchName, redTier, blueTier, gameType });
    socketRef.current?.emit('game:openBetting');
  };

  const handleStart = () => {
    socketRef.current?.emit('game:start');
  };

  const handleSettle = () => {
    socketRef.current?.emit('game:settle', {
      redScore, blueScore, iceBalls, fireBalls, windBalls, totalKnockdowns,
    });
  };

  const handleNext = (force = false) => {
    socketRef.current?.emit('game:next', { force });
    setConfirmNext(false);
  };

  const activeGameType = gameInfo?.gameType || gameType;
  const isHockey = activeGameType === 'hockey';

  // 当前赔率
  const ri = TIERS.indexOf(gameInfo?.redTier || redTier);
  const bi = TIERS.indexOf(gameInfo?.blueTier || blueTier);
  const currentRedOdds = oddsData.matrix[ri]?.[bi] || '—';
  const currentBlueOdds = oddsData.matrix[bi]?.[ri] || '—';

  const statusLabel = {
    waiting: '⏳ 等待配置',
    betting: '🎯 竞猜中（可下注）',
    started: '🏒 比赛进行中（下注已锁定）',
    settled: '🏆 已开奖',
  };

  return (
    <div className="section-content simulation-page">
      {/* 二维码区域 */}
      <div className="sim-qr-section">
        <div className="sim-qr-hint">📱 请确保手机连接公司局域网（同一WiFi），扫码进入竞猜页面</div>
        {mobileUrl && (
          <div className="sim-qr-wrapper">
            <QRCodeSVG value={mobileUrl} size={180} level="M" />
            <div className="sim-qr-url">{mobileUrl}</div>
          </div>
        )}
      </div>

      {/* 连接状态 */}
      <div className="sim-status-bar">
        <span className={`sim-conn-dot ${connected ? 'on' : 'off'}`}></span>
        <span>{connected ? '服务器已连接' : '未连接'}</span>
        <span className="sim-status-label">{statusLabel[status] || status}</span>
        <span className="sim-round">第 {gameInfo?.round || 1} 局</span>
      </div>

      {/* 错误提示 */}
      {errorMsg && <div className="sim-error">{errorMsg}</div>}

      {/* 确认弹窗 */}
      {confirmNext && (
        <div className="sim-modal-overlay">
          <div className="sim-modal">
            <p>⚠️ 本局尚未开奖，确定要进入下一局吗？</p>
            <p style={{ fontSize: '14px', color: '#ffd93d', margin: '8px 0 0' }}>
              一旦进入下一局，本局所有用户的押注将作废，竞猜币全部回退。
            </p>
            <div className="sim-modal-buttons">
              <button className="btn-cancel" onClick={() => setConfirmNext(false)}>取消</button>
              <button className="btn-danger" onClick={() => handleNext(true)}>确定跳过</button>
            </div>
          </div>
        </div>
      )}

      {/* 开奖台 */}
      <div className="sim-control-panel">
        <h3>🎮 开奖台</h3>

        <div className="sim-form-grid">
          <div className="sim-form-row">
            <label>赛事类型</label>
            <select
              value={gameType}
              onChange={e => { setGameType(e.target.value); }}
              onBlur={handleConfigUpdate}
              disabled={status !== 'waiting'}
            >
              <option value="hockey">🏒 魔法冰球</option>
              <option value="boxing">🥊 魔法拳王</option>
            </select>
          </div>

          <div className="sim-form-row">
            <label>赛事名称</label>
            <input
              type="text"
              value={matchName}
              onChange={e => setMatchName(e.target.value)}
              onBlur={handleConfigUpdate}
              placeholder="输入赛事名称"
              disabled={status !== 'waiting'}
            />
          </div>

          <div className="sim-form-row">
            <label>蓝方段位</label>
            <select
              value={blueTier}
              onChange={e => { setBlueTier(e.target.value); }}
              onBlur={handleConfigUpdate}
              disabled={status !== 'waiting'}
            >
              {TIERS.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>

          <div className="sim-form-row">
            <label>红方段位</label>
            <select
              value={redTier}
              onChange={e => { setRedTier(e.target.value); }}
              onBlur={handleConfigUpdate}
              disabled={status !== 'waiting'}
            >
              {TIERS.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>

          <div className="sim-odds-display">
            <span>当前赔率：蓝方 <strong className="blue-text">×{currentBlueOdds}</strong> | 红方 <strong className="red-text">×{currentRedOdds}</strong></span>
          </div>
        </div>

        <div className="sim-divider"></div>

        <div className="sim-form-grid">
          <div className="sim-form-row half">
            <label>🔵 蓝方分数</label>
            <input type="number" min="0" value={blueScore} onChange={e => setBlueScore(e.target.value)} disabled={status !== 'started'} />
          </div>
          <div className="sim-form-row half">
            <label>🔴 红方分数</label>
            <input type="number" min="0" value={redScore} onChange={e => setRedScore(e.target.value)} disabled={status !== 'started'} />
          </div>
          {isHockey ? (
            <>
              <div className="sim-form-row third">
                <label>❄️ 冰球</label>
                <input type="number" min="0" value={iceBalls} onChange={e => setIceBalls(e.target.value)} disabled={status !== 'started'} />
              </div>
              <div className="sim-form-row third">
                <label>🔥 火球</label>
                <input type="number" min="0" value={fireBalls} onChange={e => setFireBalls(e.target.value)} disabled={status !== 'started'} />
              </div>
              <div className="sim-form-row third">
                <label>🌪️ 风球</label>
                <input type="number" min="0" value={windBalls} onChange={e => setWindBalls(e.target.value)} disabled={status !== 'started'} />
              </div>
            </>
          ) : (
            <div className="sim-form-row">
              <label>🤸 双方倒地次数总和</label>
              <input type="number" min="0" value={totalKnockdowns} onChange={e => setTotalKnockdowns(e.target.value)} disabled={status !== 'started'} />
            </div>
          )}
        </div>

        {/* 操作按钮 */}
        <div className="sim-actions">
          <button
            className="btn-open-betting"
            onClick={handleOpenBetting}
            disabled={status !== 'waiting'}
          >
            🎯 开始竞猜
          </button>
          <button
            className="btn-primary"
            onClick={handleStart}
            disabled={status !== 'betting'}
          >
            🏒 比赛开始
          </button>
          <button
            className="btn-success"
            onClick={handleSettle}
            disabled={status !== 'started'}
          >
            ✅ 确认开奖
          </button>
          <button
            className="btn-secondary"
            onClick={() => handleNext(false)}
            disabled={status === 'waiting'}
          >
            ⏭️ 进入下一局
          </button>
        </div>
      </div>

      {/* 开奖结果 */}
      {resultData && (
        <div className="sim-result-panel">
          <h3>🏆 开奖结果（第 {(gameInfo?.round || 1)} 局）</h3>
          <div className="sim-result-scores">
            <span className="blue-text">🔵 蓝方 {resultData.blueScore}</span>
            <span> : </span>
            <span className="red-text">{resultData.redScore} 红方 🔴</span>
          </div>
          <div className="sim-result-details">
            <span>胜方：{resultData.winSide === 'blue' ? '🔵 蓝方' : resultData.winSide === 'red' ? '🔴 红方' : '⚖️ 平局'}</span>
            {resultData.gameType === 'hockey'
              ? <span>元素之王：{{ ice: '❄️ 冰球', fire: '🔥 火球', wind: '🌪️ 风球' }[resultData.elementWinner]}</span>
              : <span>倒地次数总和：{resultData.totalKnockdowns}</span>
            }
            <span>总分：{resultData.totalScore} | 分差：{resultData.scoreDiff}</span>
          </div>
          {resultData.settlements.length > 0 && (
            <div className="sim-settlements">
              <h4>💰 结算详情</h4>
              {resultData.settlements.map((s, i) => (
                <div key={i} className="sim-settlement-item">
                  <span className="sim-settle-name">{s.username}</span>
                  <span className={`sim-settle-result ${s.totalWon > 0 ? 'won' : ''}`}>
                    {s.totalWon > 0 ? `+${s.totalWon} 币` : '未中奖'}
                  </span>
                  <span className="sim-settle-balance">余额: {s.newCoins} 币</span>
                  <div className="sim-settle-details">
                    {s.details.map((d, j) => (
                      <span key={j} className={d.result === '猜中' ? 'win' : d.result === '平局' ? 'draw' : 'lose'}>
                        {d.type}: {d.result}{d.won ? ` +${d.won}` : ''}{d.refund ? ` 退${d.refund}` : ''}{d.lost ? ` -${d.lost}` : ''}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 底部分页：下注情况 / 段位排行 */}
      <div className="sim-bottom-section">
        <div className="sim-bottom-tabs">
          <button className={bottomTab === 'bets' ? 'active' : ''} onClick={() => setBottomTab('bets')}>
            📊 当前下注情况
          </button>
          <button className={bottomTab === 'rank' ? 'active' : ''} onClick={() => setBottomTab('rank')}>
            🏅 竞猜段位排行
          </button>
        </div>

        {bottomTab === 'bets' && betSummary && (
          <div className="sim-bets-panel">
            <BetCategory title="🏒 胜负竞猜 - 蓝方胜" data={betSummary.winBet.blue} />
            <BetCategory title="🏒 胜负竞猜 - 红方胜" data={betSummary.winBet.red} />
            {isHockey ? (
              <>
                <BetCategory title="❄️🔥🌪️ 元素之王 - 冰球" data={betSummary.elementKing.ice} />
                <BetCategory title="❄️🔥🌪️ 元素之王 - 火球" data={betSummary.elementKing.fire} />
                <BetCategory title="❄️🔥🌪️ 元素之王 - 风球" data={betSummary.elementKing.wind} />
              </>
            ) : (
              <BetCategoryWithValue title="🤸 躺平之王" data={betSummary.knockdownKing} />
            )}
            <BetCategoryWithValue title="🎯 精准总分" data={betSummary.preciseTotal} />
            <BetCategoryWithValue title="📊 精准分差" data={betSummary.preciseDiff} />
          </div>
        )}

        {bottomTab === 'rank' && (
          <div className="sim-rank-panel">
            {rankings.length === 0 ? (
              <p className="sim-empty">暂无用户</p>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>名次</th>
                    <th>用户</th>
                    <th>竞猜段位</th>
                    <th>累计赢得</th>
                    <th>当前余额</th>
                  </tr>
                </thead>
                <tbody>
                  {rankings.map((r, i) => (
                    <tr key={r.name}>
                      <td>{i + 1}</td>
                      <td>{r.name}</td>
                      <td>{r.tier.icon} {r.tier.name}</td>
                      <td className="win">{r.totalWinnings} 币</td>
                      <td>{r.coins} 币</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function BetCategory({ title, data }) {
  const [open, setOpen] = useState(false);
  if (!data) return null;
  return (
    <div className="sim-bet-category">
      <div className="sim-bet-header" onClick={() => setOpen(!open)}>
        <span className="sim-bet-toggle">{open ? '▼' : '▶'}</span>
        <span className="sim-bet-title">{title}</span>
        <span className="sim-bet-stats">{data.count}人 · {data.total}币</span>
      </div>
      {open && data.details.length > 0 && (
        <div className="sim-bet-details">
          {data.details.map((d, i) => (
            <div key={i} className="sim-bet-detail-row">
              <span>{d.name}</span>
              <span>{d.amount} 币</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function BetCategoryWithValue({ title, data }) {
  const [open, setOpen] = useState(false);
  if (!data) return null;
  return (
    <div className="sim-bet-category">
      <div className="sim-bet-header" onClick={() => setOpen(!open)}>
        <span className="sim-bet-toggle">{open ? '▼' : '▶'}</span>
        <span className="sim-bet-title">{title}</span>
        <span className="sim-bet-stats">{data.count}人 · {data.total}币</span>
      </div>
      {open && data.details.length > 0 && (
        <div className="sim-bet-details">
          {data.details.map((d, i) => (
            <div key={i} className="sim-bet-detail-row">
              <span>{d.name}</span>
              <span>猜 {d.value}</span>
              <span>{d.amount} 币</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default Simulation;
