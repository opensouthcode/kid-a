import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { DeskPage } from './pages/DeskPage';
import { PassportPage } from './pages/PassportPage';
import { RegistrationPage } from './pages/RegistrationPage';
import { WelcomePage } from './pages/WelcomePage';

function App() {
  const location = useLocation();
  const isKidPage = location.pathname === '/passport';

  return (
    <div className={isKidPage ? 'app-shell kid-shell' : 'app-shell'}>
      <main className={isKidPage ? 'kid-page' : 'welcome-card'}>
        <Routes>
          <Route path="/" element={<WelcomePage />} />
          <Route path="/desk" element={<DeskPage />} />
          <Route path="/passport" element={<PassportPage />} />
          <Route path="/register" element={<RegistrationPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
}

export default App;
