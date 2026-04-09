import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { OperationalChartPeriod } from '../../../domain/types';

type ChartDatum = object;

interface TimeSeriesChartProps {
  data: ChartDatum[];
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
  period?: OperationalChartPeriod;
}

function formatDateTick(
  value: Date,
  period: OperationalChartPeriod,
): string {
  switch (period) {
    case '7d':
      return format(value, "dd/MM HH'h'", { locale: ptBR });
    case '30d':
      return format(value, 'dd/MM', { locale: ptBR });
    default:
      return format(value, 'HH:mm', { locale: ptBR });
  }
}

export function TimeSeriesChart({
  data,
  lines,
  xAxisKey = 'timestamp',
  yAxisLabel,
  height = 300,
  showLegend = true,
  variant = 'default',
  period = '24h',
}: TimeSeriesChartProps) {
  const formatXAxis = (value: unknown) => {
    if (value instanceof Date) {
      return formatDateTick(value, period);
    }

    return typeof value === 'string' || typeof value === 'number'
      ? String(value)
      : '';
  };

  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data}>
        <CartesianGrid
          strokeDasharray="3 3"
          stroke={variant === 'business' ? '#e0e7ff' : '#f0f0f0'}
        />
        <XAxis
          dataKey={xAxisKey}
          tickFormatter={formatXAxis}
          stroke={variant === 'business' ? '#64748b' : '#666'}
          fontSize={12}
          minTickGap={16}
        />
        <YAxis
          label={
            yAxisLabel
              ? { value: yAxisLabel, angle: -90, position: 'insideLeft' }
              : undefined
          }
          stroke={variant === 'business' ? '#64748b' : '#666'}
          fontSize={12}
        />
        <Tooltip
          labelFormatter={formatXAxis}
          contentStyle={{
            backgroundColor: 'white',
            border: `1px solid ${
              variant === 'business' ? '#cbd5e1' : '#e5e7eb'
            }`,
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
            isAnimationActive={false}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}
