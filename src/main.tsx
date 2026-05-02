import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import './index.css';
import { AuthProvider } from './auth/AuthContext';
import LoginPage from './auth/LoginPage';
import RegisterPage from './auth/RegisterPage';
import ProtectedRoute from './auth/ProtectedRoute';
import WorkspaceShell from './layout/WorkspaceShell';
import App from './App';
import JeApp from './je/JeApp';
import SdApp from './sd/SdApp';
import ScApp from './sc/ScApp';
import OdApp from './od/OdApp';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route element={<ProtectedRoute><WorkspaceShell /></ProtectedRoute>}>
            <Route path="/" element={<Navigate to="/diagnosis" replace />} />
            <Route path="/diagnosis/*" element={<App />} />
            <Route path="/je/*" element={<JeApp />} />
            <Route path="/sd/*" element={<SdApp />} />
            <Route path="/sc/*" element={<ScApp />} />
            <Route path="/od/*" element={<OdApp />} />
            {/* 未来：/design/* /assessment/* */}
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
);
