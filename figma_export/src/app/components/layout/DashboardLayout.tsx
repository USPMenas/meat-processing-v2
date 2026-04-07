import { ReactNode } from 'react';
import { Link, useLocation } from 'react-router';
import { Thermometer, LayoutDashboard, TrendingUp, Snowflake } from 'lucide-react';

interface DashboardLayoutProps {
  children: ReactNode;
  variant?: 'operational' | 'logistics' | 'business';
}

export function DashboardLayout({ children, variant = 'operational' }: DashboardLayoutProps) {
  const location = useLocation();
  
  const navItems = [
    { path: '/', label: 'Operacional', icon: LayoutDashboard },
    { path: '/logistics', label: 'Logística', icon: Thermometer },
    { path: '/business', label: 'Negócios', icon: TrendingUp },
  ];
  
  const isBusinessVariant = variant === 'business';
  
  return (
    <div className={`min-h-screen ${isBusinessVariant ? 'bg-gradient-to-br from-blue-50 via-indigo-50 to-slate-100' : 'bg-gray-50'}`}>
      {/* Header */}
      <header className={`border-b ${isBusinessVariant ? 'bg-white/90 backdrop-blur-md border-blue-200 shadow-sm' : 'bg-white border-gray-200'}`}>
        <div className="mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${isBusinessVariant ? 'bg-blue-600' : 'bg-blue-500'}`}>
                <Snowflake className="size-6 text-white" />
              </div>
              <div>
                <h1 className={isBusinessVariant ? 'text-xl font-semibold text-gray-900' : 'text-xl font-semibold text-gray-900'}>
                  Frigorífico - Monitoramento
                </h1>
                <p className="text-sm text-gray-500">
                  {variant === 'operational' && 'Dashboard Operacional'}
                  {variant === 'logistics' && 'Dashboard de Logística'}
                  {variant === 'business' && 'Dashboard Executivo'}
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = location.pathname === item.path;
                const isBusinessNav = item.path === '/business';
                
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                      isActive
                        ? isBusinessNav
                          ? 'bg-blue-600 text-white'
                          : 'bg-blue-500 text-white'
                        : isBusinessNav
                          ? 'text-gray-600 hover:bg-blue-50'
                          : 'text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    <Icon className="size-4" />
                    <span className="text-sm font-medium">{item.label}</span>
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      </header>
      
      {/* Main Content */}
      <main className="mx-auto px-6 py-6">
        {children}
      </main>
    </div>
  );
}
