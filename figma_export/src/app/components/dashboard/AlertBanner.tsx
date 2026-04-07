import { AlertTriangle, Info, XCircle } from 'lucide-react';
import { Alert } from '../../utils/mockData';

interface AlertBannerProps {
  alerts: Alert[];
}

export function AlertBanner({ alerts }: AlertBannerProps) {
  if (alerts.length === 0) return null;
  
  return (
    <div className="space-y-2">
      {alerts.map((alert, index) => {
        const Icon = alert.type === 'critical' ? XCircle : alert.type === 'warning' ? AlertTriangle : Info;
        const bgColor = alert.type === 'critical' ? 'bg-red-50 border-red-200' : alert.type === 'warning' ? 'bg-amber-50 border-amber-200' : 'bg-blue-50 border-blue-200';
        const textColor = alert.type === 'critical' ? 'text-red-800' : alert.type === 'warning' ? 'text-amber-800' : 'text-blue-800';
        const iconColor = alert.type === 'critical' ? 'text-red-600' : alert.type === 'warning' ? 'text-amber-600' : 'text-blue-600';
        
        return (
          <div key={index} className={`flex items-start gap-3 p-4 rounded-lg border ${bgColor}`}>
            <Icon className={`size-5 ${iconColor} mt-0.5 flex-shrink-0`} />
            <div className="flex-1">
              <p className={`font-medium ${textColor}`}>{alert.variable}</p>
              <p className={`text-sm ${textColor} mt-1`}>
                {alert.message}: {alert.value.toFixed(1)} (esperado: {alert.expected})
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
