import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface TimeSeriesChartProps {
  data: any[];
  lines: {
    dataKey: string;
    name: string;
    color: string;
    strokeDash?: string;
  }[];
  xAxisKey?: string;
  yAxisLabel?: string;
  height?: number;
  showLegend?: boolean;
  variant?: 'default' | 'business';
}

export function TimeSeriesChart({
  data,
  lines,
  xAxisKey = 'timestamp',
  yAxisLabel,
  height = 300,
  showLegend = true,
  variant = 'default',
}: TimeSeriesChartProps) {
  const formatXAxis = (timestamp: any) => {
    if (timestamp instanceof Date) {
      return format(timestamp, 'HH:mm', { locale: ptBR });
    }
    return timestamp;
  };
  
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke={variant === 'business' ? '#e0e7ff' : '#f0f0f0'} />
        <XAxis
          dataKey={xAxisKey}
          tickFormatter={formatXAxis}
          stroke={variant === 'business' ? '#64748b' : '#666'}
          fontSize={12}
        />
        <YAxis
          label={yAxisLabel ? { value: yAxisLabel, angle: -90, position: 'insideLeft' } : undefined}
          stroke={variant === 'business' ? '#64748b' : '#666'}
          fontSize={12}
        />
        <Tooltip
          labelFormatter={formatXAxis}
          contentStyle={{
            backgroundColor: 'white',
            border: `1px solid ${variant === 'business' ? '#cbd5e1' : '#e5e7eb'}`,
            borderRadius: '8px',
          }}
        />
        {showLegend && <Legend />}
        {lines.map((line, index) => (
          <Line
            key={`${line.dataKey}-${index}`}
            type="monotone"
            dataKey={line.dataKey}
            name={line.name}
            stroke={line.color}
            strokeWidth={2}
            dot={false}
            strokeDasharray={line.strokeDash}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}