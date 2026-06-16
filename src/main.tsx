import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { DataLayerProvider } from './contexts/DataLayerContext';
import { LocalDataLayerProvider } from './contexts/LocalDataLayerContext';
import { I18nProvider } from './i18n/I18nProvider';
import './styles.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <I18nProvider>
      <DataLayerProvider>
        <LocalDataLayerProvider>
          <BrowserRouter basename={import.meta.env.BASE_URL}>
            <App />
          </BrowserRouter>
        </LocalDataLayerProvider>
      </DataLayerProvider>
    </I18nProvider>
  </StrictMode>,
);
