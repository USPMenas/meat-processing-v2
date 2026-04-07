import { LucideIcon } from 'lucide-react';
import { ReactNode } from 'react';

interface MetricCardProps {
  title: string;
  value: string | number;
  unit?: string;
  icon: LucideIcon;
  trend?: {
    value: number;
    direction: 'up' | 'down';
  };
  status?: 'normal' | 'warning' | 'critical';
  subtitle?: string;
  children?: ReactNode;
  variant?: 'default' | 'business';
}

export function MetricCard({
  title,
  value,
  unit,
  icon: Icon,
  trend,
  status = 'normal',
  subtitle,
  children,
  variant = 'default',
}: MetricCardProps) {
  const statusColors = {
    normal: variant === 'business' ? 'bg-blue-50 text-blue-700' : 'bg-green-50 text-green-700',
    warning: 'bg-amber-50 text-amber-700',
    critical: 'bg-red-50 text-red-700',
  };
  
  const iconBgColors = {
    normal: variant === 'business' ? 'bg-blue-100' : 'bg-green-100',
    warning: 'bg-amber-100',
    critical: 'bg-red-100',
  };
  
  return (
    <div className={`bg-white rounded-xl border ${variant === 'business' ? 'border-blue-100 shadow-sm' : 'border-gray-200'} p-6`}>
      <div className="flex items-start justify-between mb-4">
        <div>
          <p className="text-sm text-gray-500 mb-1">{title}</p>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-semibold text-gray-900">
              {typeof value === 'number' ? value.toFixed(1) : value}
            </span>
            {unit && <span className="text-lg text-gray-500">{unit}</span>}
          </div>
          {subtitle && (
            <p className="text-sm text-gray-600 mt-1">{subtitle}</p>
          )}
        </div>
        
        <div className={`p-3 rounded-lg ${iconBgColors[status]}`}>
          <Icon className={`size-6 ${statusColors[status]}`} />
        </div>
      </div>
      
      {trend && (
        <div className="flex items-center gap-2">
          <span className={`text-sm font-medium ${
            trend.direction === 'up' ? 'text-green-600' : 'text-red-600'
          }`}>
            {trend.direction === 'up' ? '↑' : '↓'} {Math.abs(trend.value)}%
          </span>
          <span className="text-sm text-gray-500">vs. esperado</span>
        </div>
      )}
      
      {children && (
        <div className="mt-4 pt-4 border-t border-gray-100">
          {children}
        </div>
      )}
    </div>
  );
}
