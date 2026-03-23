import { useState, useEffect, useCallback, useRef } from 'react';
import { io } from 'socket.io-client';

const DANMAKU_QUICK_EMOJIS = ['😀', '👍', '🔥', '❤️', '🎉', '😂', '👏', '💪', '🏆', '✨'];

/** 上半屏飘字层：仅展示，pointer-events: none */
export function DanmakuFlyLayer() {
  const [rows, setRows] = useState([]);
  const idRef = useRef(0);

  useEffect(() => {
    const socket = io();
    const onMsg = (item) => {
      if (!item || item.seq == null) return;
      idRef.current += 1;
      const id = `dm-${item.seq}-${idRef.current}`;
      const topPct = 6 + Math.random() * 38;
      const durationSec = 10 + Math.random() * 4;
      setRows((prev) => [
        ...prev,
        {
          id,
          seq: item.seq,
          username: item.username,
          text: item.text,
          topPct,
          durationSec,
        },
      ]);
      const ms = durationSec * 1000;
      window.setTimeout(() => {
        setRows((prev) => prev.filter((r) => r.id !== id));
      }, ms + 300);
    };
    socket.on('danmaku:message', onMsg);
    return () => {
      socket.off('danmaku:message', onMsg);
      socket.disconnect();
    };
  }, []);

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

export function DanmakuInputModal({ user, open, onClose }) {
  const [text, setText] = useState('');
  const [err, setErr] = useState('');
  const [sending, setSending] = useState(false);
  const maxLen = 40;

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
