import { useState } from 'react';

function Login({ onLogin }) {
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    const trimmed = name.trim();
    if (!trimmed) {
      setError('请输入账号');
      return;
    }
    if (!/^[\u4e00-\u9fa5a-zA-Z]+$/.test(trimmed)) {
      setError('账号只支持中文或英文，不支持特殊符号和空格');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: trimmed }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || '登录失败');
        return;
      }
      onLogin(data.user);
    } catch (err) {
      setError('网络错误，请检查局域网连接');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mobile-login">
      <div className="login-card">
        <div className="login-logo">🏒</div>
        <h1>魔法冰球竞猜</h1>
        <p className="login-subtitle">输入账号即可参与竞猜</p>
        <form onSubmit={handleSubmit}>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="输入中文或英文账号"
            autoFocus
          />
          {error && <div className="login-error">{error}</div>}
          <button type="submit" disabled={loading}>
            {loading ? '登录中...' : '进入竞猜'}
          </button>
        </form>
        <p className="login-hint">首次输入的账号将自动注册，赠送 100 竞猜币</p>
      </div>
    </div>
  );
}

export default Login;
