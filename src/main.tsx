import React from 'react';
import ReactDOM from 'react-dom/client';
import './i18n'; // Must run before App / settingsStore (localStorage language)
import App from './App';
import { ErrorBoundary } from '@/components/shared/ErrorBoundary';
import '@/styles/index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);
