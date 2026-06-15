import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { ActivityPage } from './pages/ActivityPage';
import { ActivityLeadPage } from './pages/ActivityLeadPage';
import { DeskPage } from './pages/DeskPage';
import { PassportPage } from './pages/PassportPage';
import { RegistrationRequestPage } from './pages/RegistrationRequestPage';
import { WelcomePage } from './pages/WelcomePage';
import { WheelPage } from './pages/WheelPage';

function App() {
  const location = useLocation();
  const isKidPage = location.pathname === '/passport';
  const isWheelPage = location.pathname === '/wheel';

  return (
    <div className={isKidPage || isWheelPage ? 'app-shell kid-shell' : 'app-shell'}>
      <main
        className={
          isKidPage ? 'kid-page' : isWheelPage ? 'wheel-page' : 'welcome-card'
        }
      >
        <Routes>
          <Route path="/" element={<WelcomePage />} />
          <Route path="/activity" element={<ActivityPage />} />
          <Route path="/desk" element={<DeskPage />} />
          <Route path="/lead" element={<ActivityLeadPage />} />
          <Route path="/passport" element={<PassportPage />} />
          <Route path="/register" element={<RegistrationRequestPage />} />
          <Route path="/wheel" element={<WheelPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
}

export default App;
