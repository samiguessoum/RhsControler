import { Outlet } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Sidebar } from './Sidebar';
import { dashboardApi } from '@/services/api';
import { Toaster } from 'sonner';

export function MainLayout() {
  const { data: stats } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: dashboardApi.stats,
    refetchInterval: 60000, // Refresh every minute
  });

  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar stats={stats} />
      <main className="ml-64 p-6">
        <Outlet />
      </main>
      <Toaster position="top-right" richColors />
    </div>
  );
}
