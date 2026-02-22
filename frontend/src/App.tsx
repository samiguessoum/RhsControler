import { lazy, Suspense, useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { MainLayout } from '@/components/layout/MainLayout';
import { useAuthStore } from '@/store/auth.store';
import { authApi } from '@/services/api';

const DashboardPage = lazy(() => import('@/pages/Dashboard').then((m) => ({ default: m.DashboardPage })));
const PlanningPage = lazy(() => import('@/pages/Planning').then((m) => ({ default: m.PlanningPage })));
const ClientsPage = lazy(() => import('@/pages/Clients').then((m) => ({ default: m.ClientsPage })));
const ContratsPage = lazy(() => import('@/pages/Contrats').then((m) => ({ default: m.ContratsPage })));
const ContratDetailPage = lazy(() => import('@/pages/ContratDetail').then((m) => ({ default: m.ContratDetailPage })));
const ImportExportPage = lazy(() => import('@/pages/ImportExport').then((m) => ({ default: m.ImportExportPage })));
const ParametresPage = lazy(() => import('@/pages/Parametres').then((m) => ({ default: m.ParametresPage })));
const LoginPage = lazy(() => import('@/pages/Login').then((m) => ({ default: m.LoginPage })));
const PrestationsPage = lazy(() => import('@/pages/Prestations').then((m) => ({ default: m.PrestationsPage })));
const StocksPage = lazy(() => import('@/pages/Stocks'));
const RHPage = lazy(() => import('@/pages/RH'));
const TiersPage = lazy(() => import('@/pages/Tiers'));
const ProduitsServicesPage = lazy(() => import('@/pages/ProduitsServices'));
const CommercePage = lazy(() => import('@/pages/Commerce'));
const FacturationPage = lazy(() => import('@/pages/Facturation'));
const FinancePage = lazy(() => import('@/pages/Finance'));
const EntrepotsPage = lazy(() => import('@/pages/Entrepots'));

const AUTH_BOOT_TIMEOUT_MS = 2500;

function RequireAuth() {
  const { isAuthenticated } = useAuthStore();

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}

function PageFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center text-muted-foreground">
      Chargement...
    </div>
  );
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
        const me = await Promise.race([
          authApi.me(),
          new Promise<never>((_, reject) => {
            setTimeout(() => reject(new Error('Auth bootstrap timeout')), AUTH_BOOT_TIMEOUT_MS);
          }),
        ]);
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
          element={token && user ? <Navigate to="/" replace /> : <Suspense fallback={<PageFallback />}><LoginPage /></Suspense>}
        />

        <Route element={<RequireAuth />}>
          <Route element={<MainLayout />}>
            <Route index element={<Suspense fallback={<PageFallback />}><DashboardPage /></Suspense>} />
            <Route path="/planning" element={<Suspense fallback={<PageFallback />}><PlanningPage /></Suspense>} />
            <Route path="/clients" element={<Suspense fallback={<PageFallback />}><ClientsPage /></Suspense>} />
            <Route path="/tiers" element={<Suspense fallback={<PageFallback />}><TiersPage /></Suspense>} />
            <Route path="/contrats" element={<Suspense fallback={<PageFallback />}><ContratsPage /></Suspense>} />
            <Route path="/contrats/:id" element={<Suspense fallback={<PageFallback />}><ContratDetailPage /></Suspense>} />
            <Route path="/import-export" element={<Suspense fallback={<PageFallback />}><ImportExportPage /></Suspense>} />
            <Route path="/prestations" element={<Suspense fallback={<PageFallback />}><PrestationsPage /></Suspense>} />
            <Route path="/stocks" element={<Suspense fallback={<PageFallback />}><StocksPage /></Suspense>} />
            <Route path="/entrepots" element={<Suspense fallback={<PageFallback />}><EntrepotsPage /></Suspense>} />
            <Route path="/produits-services" element={<Suspense fallback={<PageFallback />}><ProduitsServicesPage /></Suspense>} />
            <Route path="/commerce" element={<Suspense fallback={<PageFallback />}><CommercePage /></Suspense>} />
            <Route path="/facturation" element={<Suspense fallback={<PageFallback />}><FacturationPage /></Suspense>} />
            <Route path="/finance" element={<Suspense fallback={<PageFallback />}><FinancePage /></Suspense>} />
            <Route path="/rh" element={<Suspense fallback={<PageFallback />}><RHPage /></Suspense>} />
            <Route path="/parametres" element={<Suspense fallback={<PageFallback />}><ParametresPage /></Suspense>} />
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
