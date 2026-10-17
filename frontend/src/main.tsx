import { ErrorBoundary } from './app/ErrorBoundary';
import React from 'react';
import { createRoot } from 'react-dom/client';
import { AuthGate } from './features/auth/AuthGate';
import './style.css';
createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <AuthGate />
    </ErrorBoundary>
  </React.StrictMode>,
);
