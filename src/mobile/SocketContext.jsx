import { createContext, useContext, useEffect, useState } from 'react';
import { io } from 'socket.io-client';

const MobileSocketContext = createContext(null);

/** 手机端全局唯一 Socket.IO 连接，供竞猜 / 参赛 / 弹幕共用 */
export function SocketProvider({ children }) {
  const [socket, setSocket] = useState(null);

  useEffect(() => {
    const s = io();
    setSocket(s);
    return () => {
      s.removeAllListeners();
      s.disconnect();
    };
  }, []);

  return (
    <MobileSocketContext.Provider value={socket}>
      {children}
    </MobileSocketContext.Provider>
  );
}

export function useMobileSocket() {
  return useContext(MobileSocketContext);
}
