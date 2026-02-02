import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { MainLayout } from '@/components/layout/MainLayout';
import { useAuthStore } from '@/store/auth.store';
import { authApi } from '@/services/api';
import { DashboardPage } from '@/pages/Dashboard';
import { PlanningPage } from '@/pages/Planning';
import { ClientsPage } from '@/pages/Clients';
import { ContratsPage } from '@/pages/Contrats';
import { ContratDetailPage } from '@/pages/ContratDetail';
import { ImportExportPage } from '@/pages/ImportExport';
import { ParametresPage } from '@/pages/Parametres';
import { LoginPage } from '@/pages/Login';
import { PrestationsPage } from '@/pages/Prestations';
import StocksPage from '@/pages/Stocks';
import RHPage from '@/pages/RH';

function RequireAuth() {
  const { isAuthenticated } = useAuthStore();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}

export default function App() {
  const { token, user, login, logout } = useAuthStore();
  const [checkingAuth, setCheckingAuth] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const initAuth = async () => {
      if (!token) {
        if (isMounted) setCheckingAuth(false);
        return;
      }

      if (user) {
        if (isMounted) setCheckingAuth(false);
        return;
      }

      try {
        const me = await authApi.me();
        login(token, me);
      } catch {
        logout();
      } finally {
        if (isMounted) setCheckingAuth(false);
      }
    };

    initAuth();

    return () => {
      isMounted = false;
    };
  }, [token, user, login, logout]);

  if (checkingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center text-muted-foreground">
        Chargement...
      </div>
    );
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route
          path="/login"
          element={token && user ? <Navigate to="/" replace /> : <LoginPage />}
        />

        <Route element={<RequireAuth />}>
          <Route element={<MainLayout />}>
            <Route index element={<DashboardPage />} />
            <Route path="/planning" element={<PlanningPage />} />
            <Route path="/clients" element={<ClientsPage />} />
            <Route path="/contrats" element={<ContratsPage />} />
            <Route path="/contrats/:id" element={<ContratDetailPage />} />
            <Route path="/import-export" element={<ImportExportPage />} />
            <Route path="/prestations" element={<PrestationsPage />} />
            <Route path="/stocks" element={<StocksPage />} />
            <Route path="/rh" element={<RHPage />} />
            <Route path="/parametres" element={<ParametresPage />} />
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
