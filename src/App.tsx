import { useLocation } from 'react-router-dom';
import { PassportPage } from './pages/PassportPage';
import { WelcomePage } from './pages/WelcomePage';

function App() {
  const location = useLocation();
  const isKidPage = location.pathname === '/passport';

  return (
    <div className={isKidPage ? 'app-shell kid-shell' : 'app-shell'}>
      <main className={isKidPage ? 'kid-page' : 'welcome-card'}>
        {isKidPage ? <PassportPage /> : <WelcomePage />}
      </main>
    </div>
  );
}

export default App;
