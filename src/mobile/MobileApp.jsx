import { useState } from 'react';
import Login from './Login';
import QuizPage from './QuizPage';
import './MobileApp.css';

function MobileApp() {
  const [user, setUser] = useState(null);

  if (!user) {
    return <Login onLogin={setUser} />;
  }

  return <QuizPage user={user} setUser={setUser} />;
}

export default MobileApp;
