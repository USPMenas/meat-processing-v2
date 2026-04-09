import { Info, LucideIcon } from 'lucide-react';
import { ReactNode, useState } from 'react';
import { MiniChart } from './MiniChart';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';

type ChartPoint = object;

interface MetricCardWithChartProps {
  title: string;
  value: string | number;
  unit?: string;
  icon: LucideIcon;
  trend?: {
    value: number;
    direction: 'up' | 'down';
  };
  status?: 'normal' | 'warning' | 'critical';
  variant?: 'default' | 'business';
  miniChartData?: ChartPoint[];
  miniChartDataKey?: string;
  miniChartColor?: string;
  miniChartType?: 'line' | 'area';
  detailContent?: ReactNode;
  detailTitle?: string;
  subtitle?: string;
  footer?: ReactNode;
  infoContent?: ReactNode;
  infoTitle?: string;
}

export function MetricCardWithChart({
  title,
  value,
  unit,
  icon: Icon,
  trend,
  status = 'normal',
  variant = 'default',
  miniChartData,
  miniChartDataKey,
  miniChartColor = '#3b82f6',
  miniChartType = 'line',
  detailContent,
  detailTitle,
  subtitle,
  footer,
  infoContent,
  infoTitle,
}: MetricCardWithChartProps) {
  const [isOpen, setIsOpen] = useState(false);
  
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
  
  const hasDetails = !!detailContent;
  const hasInfo = !!infoContent;
  
  return (
    <>
      <div
        className={`rounded-xl border p-4 ${
          variant === 'business' 
            ? 'bg-gradient-to-br from-white to-blue-50/50 border-blue-200 shadow-md' 
            : 'bg-white border-gray-200'
        } ${
          hasDetails ? 'cursor-pointer hover:shadow-lg transition-all' : ''
        }`}
        onClick={() => hasDetails && setIsOpen(true)}
      >
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="mb-1 flex items-center gap-1">
              <p className={`text-xs ${variant === 'business' ? 'text-blue-600 font-medium' : 'text-gray-500'}`}>
                {title}
              </p>
              {hasInfo && (
                <Popover>
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      aria-label={`Como calculamos ${title}`}
                      className="inline-flex size-4 items-center justify-center rounded-full text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
                      onClick={(event) => {
                        event.stopPropagation();
                      }}
                    >
                      <Info className="size-3.5" />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent
                    align="start"
                    className="w-80 space-y-2 border-gray-200 bg-white text-sm"
                    onClick={(event) => {
                      event.stopPropagation();
                    }}
                  >
                    <p className="font-semibold text-gray-900">
                      {infoTitle ?? title}
                    </p>
                    <div className="space-y-2 text-xs leading-relaxed text-gray-600">
                      {infoContent}
                    </div>
                  </PopoverContent>
                </Popover>
              )}
            </div>
            <div className="flex items-baseline gap-2">
              <span className={`text-2xl font-semibold ${variant === 'business' ? 'text-gray-900' : 'text-gray-900'}`}>
                {typeof value === 'number' ? value.toFixed(1) : value}
              </span>
              {unit && <span className="text-sm text-gray-500">{unit}</span>}
            </div>
            {subtitle && (
              <p className="text-xs text-gray-600 mt-1">{subtitle}</p>
            )}
            {trend && (
              <div className="flex items-center gap-1 mt-1">
                <span className={`text-xs font-medium ${
                  trend.direction === 'up' ? 'text-green-600' : 'text-red-600'
                }`}>
                  {trend.direction === 'up' ? '↑' : '↓'} {Math.abs(trend.value)}%
                </span>
                <span className="text-xs text-gray-500">vs. esperado</span>
              </div>
            )}
          </div>
          
          <div className={`p-2 rounded-lg ${iconBgColors[status]}`}>
            <Icon className={`size-5 ${statusColors[status]}`} />
          </div>
        </div>
        
        {miniChartData && miniChartDataKey && (
          <div className="mt-2 -mx-1">
            <MiniChart
              data={miniChartData}
              dataKey={miniChartDataKey}
              color={miniChartColor}
              type={miniChartType}
            />
          </div>
        )}
        
        {footer && (
          <div className="pt-3 border-t border-gray-100">
            {footer}
          </div>
        )}
      </div>
      
      {hasDetails && (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{detailTitle || title}</DialogTitle>
            </DialogHeader>
            <div className="mt-4">
              {detailContent}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
