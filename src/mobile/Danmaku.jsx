import { useState, useEffect, useCallback, useRef, useReducer, useLayoutEffect } from 'react';
import { useMobileSocket } from './SocketContext.jsx';

const DANMAKU_QUICK_EMOJIS = ['😀', '👍', '🔥', '❤️', '🎉', '😂', '👏', '💪', '🏆', '✨'];

/** 同时可见飘字上限，避免短时大量弹幕撑爆 DOM */
const DANMAKU_MAX_VISIBLE = 20;
/** 排队上限，超出则丢弃最旧（防止内存无限增长） */
const DANMAKU_MAX_QUEUE = 500;

/** 非 HTTPS / 部分 WebView 下无 randomUUID，需 fallback 避免 reducer 抛错导致白屏 */
function newFlyRowId(seq) {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    try {
      return `dm-${seq}-${crypto.randomUUID()}`;
    } catch {
      /* fall through */
    }
  }
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    try {
      const buf = new Uint8Array(16);
      crypto.getRandomValues(buf);
      const hex = Array.from(buf, (b) => b.toString(16).padStart(2, '0')).join('');
      return `dm-${seq}-${hex}`;
    } catch {
      /* fall through */
    }
  }
  const t = Date.now().toString(36);
  const r = Math.random().toString(36).slice(2, 12);
  return `dm-${seq}-${t}-${r}`;
}

const initialFlyState = { rows: [], pending: [] };

function danmakuFlyReducer(state, action) {
  switch (action.type) {
    case 'reset':
      return initialFlyState;
    case 'incoming': {
      const payload = action.payload;
      if (state.rows.length >= DANMAKU_MAX_VISIBLE) {
        let pending = state.pending.concat(payload);
        if (pending.length > DANMAKU_MAX_QUEUE) {
          pending = pending.slice(-DANMAKU_MAX_QUEUE);
        }
        return { ...state, pending };
      }
      const id = newFlyRowId(payload.seq);
      return {
        ...state,
        rows: [...state.rows, { id, ...payload }],
      };
    }
    case 'removeExpired': {
      const { id } = action;
      const without = state.rows.filter((r) => r.id !== id);
      const slots = DANMAKU_MAX_VISIBLE - without.length;
      const take = Math.min(slots, state.pending.length);
      if (take === 0) {
        return { ...state, rows: without };
      }
      const taken = state.pending.slice(0, take);
      const rest = state.pending.slice(take);
      const additions = taken.map((p) => ({
        id: newFlyRowId(p.seq),
        ...p,
      }));
      return {
        rows: [...without, ...additions],
        pending: rest,
      };
    }
    default:
      return state;
  }
}

/** 上半屏飘字层：仅展示，pointer-events: none */
export function DanmakuFlyLayer() {
  const socket = useMobileSocket();
  const [state, dispatch] = useReducer(danmakuFlyReducer, initialFlyState);
  const { rows } = state;
  /** 已展示的 seq，避免重复事件 / StrictMode 双订阅导致同条飘两次 */
  const seenSeqRef = useRef(new Set());
  /** 上一场最大序号；序号回退视为新场次，需清空 Set（避免与新场次 seq 碰撞） */
  const lastSeqRef = useRef(0);
  const layerMountedRef = useRef(true);
  const timersScheduledRef = useRef(new Set());
  const dispatchRef = useRef(dispatch);
  dispatchRef.current = dispatch;
  const scheduleRemoveRef = useRef(() => {});
  /** 飘字 removal 的 setTimeout id，socket 重连/卸载时需 clear，避免旧定时器误 dispatch */
  const removeTimeoutIdsRef = useRef(new Set());

  /** 须在「按 rows 注册定时器」的 layout effect 之前赋值（layout 先于 useEffect） */
  useLayoutEffect(() => {
    scheduleRemoveRef.current = (id, durationSec) => {
      const ms = durationSec * 1000 + 300;
      const tid = window.setTimeout(() => {
        removeTimeoutIdsRef.current.delete(tid);
        if (!layerMountedRef.current) return;
        dispatchRef.current({ type: 'removeExpired', id });
      }, ms);
      removeTimeoutIdsRef.current.add(tid);
    };
  }, []);

  useEffect(() => {
    layerMountedRef.current = true;
    return () => {
      layerMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!socket) return;

    const onMsg = (item) => {
      if (!item || item.seq == null) return;
      const seq = item.seq;
      if (lastSeqRef.current > 0 && seq < lastSeqRef.current) {
        seenSeqRef.current.clear();
      }
      if (seenSeqRef.current.has(seq)) return;
      seenSeqRef.current.add(seq);
      lastSeqRef.current = seq;

      const payload = {
        seq: item.seq,
        username: item.username,
        text: item.text,
        topPct: 6 + Math.random() * 38,
        durationSec: 10 + Math.random() * 4,
      };

      dispatch({ type: 'incoming', payload });
    };

    socket.on('danmaku:message', onMsg);
    return () => {
      socket.off('danmaku:message', onMsg);
      for (const tid of removeTimeoutIdsRef.current) {
        clearTimeout(tid);
      }
      removeTimeoutIdsRef.current.clear();
      dispatch({ type: 'reset' });
    };
  }, [socket]);

  useLayoutEffect(() => {
    const idsInState = new Set(rows.map((r) => r.id));
    for (const r of rows) {
      if (!timersScheduledRef.current.has(r.id)) {
        timersScheduledRef.current.add(r.id);
        scheduleRemoveRef.current(r.id, r.durationSec);
      }
    }
    for (const tid of timersScheduledRef.current) {
      if (!idsInState.has(tid)) {
        timersScheduledRef.current.delete(tid);
      }
    }
  }, [rows]);

  return (
    <div className="mobile-danmaku-layer" aria-hidden>
      {rows.map((r) => (
        <div
          key={r.id}
          className="mobile-danmaku-fly-wrap"
          style={{
            top: `${r.topPct}%`,
            animationDuration: `${r.durationSec}s`,
          }}
        >
          <span className="mobile-danmaku-fly-text">
            <span className="mobile-danmaku-user">{r.username}</span>
            <span className="mobile-danmaku-sep">：</span>
            <span>{r.text}</span>
          </span>
        </div>
      ))}
    </div>
  );
}

/** 须与 server `DANMAKU_INTERVAL_MS` 一致 */
const DANMAKU_SEND_MIN_INTERVAL_MS = 5000;

export function DanmakuInputModal({ user, open, onClose }) {
  const [text, setText] = useState('');
  const [err, setErr] = useState('');
  const [sending, setSending] = useState(false);
  const maxLen = 40;
  /** 本页最近一次发送成功时间，用于本地与后端一致的频控提示 */
  const lastSendOkAtRef = useRef(0);

  const appendEmoji = useCallback((emoji) => {
    setText((prev) => {
      if (prev.length + emoji.length > maxLen) return prev;
      return prev + emoji;
    });
    setErr('');
  }, []);

  const submit = useCallback(async () => {
    const raw = text.trim();
    if (!raw.length) {
      setErr('请输入弹幕内容');
      return;
    }
    if (raw.length > maxLen) {
      setErr(`最多 ${maxLen} 字（表情也占长度）`);
      return;
    }
    const lastOk = lastSendOkAtRef.current;
    if (lastOk > 0 && Date.now() - lastOk < DANMAKU_SEND_MIN_INTERVAL_MS) {
      setErr('发送过于频繁，每 5 秒只能发 1 条');
      return;
    }
    setSending(true);
    setErr('');
    try {
      const res = await fetch('/api/danmaku/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: user.name, text: raw }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErr(data.error || '发送失败');
        return;
      }
      lastSendOkAtRef.current = Date.now();
      setText('');
      onClose();
    } catch {
      setErr('网络错误');
    } finally {
      setSending(false);
    }
  }, [text, user.name, onClose, maxLen]);

  useEffect(() => {
    if (!open) {
      setErr('');
      setText('');
    }
  }, [open]);

  if (!open) return null;

  return (
    <div className="mq-modal-overlay" onClick={onClose}>
      <div className="mq-danmaku-modal" onClick={(e) => e.stopPropagation()}>
        <h3 className="mq-danmaku-modal-title">发弹幕</h3>
        {err && <div className="mq-error" style={{ marginBottom: 8 }}>{err}</div>}
        <textarea
          className="mq-danmaku-input"
          rows={3}
          maxLength={maxLen}
          placeholder="文字或表情均可（系统键盘也可输入表情）"
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <div className="mq-danmaku-emoji-row" role="group" aria-label="快捷表情">
          {DANMAKU_QUICK_EMOJIS.map((em) => (
            <button
              key={em}
              type="button"
              className="mq-danmaku-emoji-btn"
              onClick={() => appendEmoji(em)}
              disabled={sending || text.length >= maxLen}
            >
              {em}
            </button>
          ))}
        </div>
        <div className="mq-danmaku-modal-meta">{text.length}/{maxLen}</div>
        <div className="mq-danmaku-modal-actions">
          <button type="button" className="mq-danmaku-modal-btn mq-danmaku-modal-btn-cancel" onClick={onClose} disabled={sending}>
            取消
          </button>
          <button type="button" className="mq-danmaku-modal-btn mq-danmaku-modal-btn-send" onClick={submit} disabled={sending}>
            {sending ? '发送中…' : '发送'}
          </button>
        </div>
      </div>
    </div>
  );
}
