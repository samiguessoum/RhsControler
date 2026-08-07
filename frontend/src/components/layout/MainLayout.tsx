import { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Menu } from 'lucide-react';
import { Sidebar } from './Sidebar';
import { dashboardApi } from '@/services/api';
import { Toaster } from 'sonner';

export function MainLayout() {
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const { data: stats } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: dashboardApi.stats,
    refetchInterval: 60000,
  });

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Mobile top bar */}
      <header className="md:hidden fixed top-0 left-0 right-0 z-40 h-14 bg-white border-b border-gray-200 flex items-center px-4 gap-3 shadow-sm">
        <button
          onClick={() => setMobileNavOpen(true)}
          className="p-2 rounded-md text-gray-600 hover:bg-gray-100 transition-colors"
          aria-label="Menu"
        >
          <Menu className="h-5 w-5" />
        </button>
        <span className="font-bold text-primary text-base">RHS Controler</span>
      </header>

      <Sidebar stats={stats} mobileOpen={mobileNavOpen} onMobileClose={() => setMobileNavOpen(false)} />

      <main className="md:ml-64 pt-14 md:pt-0 p-4 md:p-6">
        <Outlet />
      </main>
      <Toaster position="top-right" richColors />
    </div>
  );
}
