import { LineChart, Line, ResponsiveContainer, AreaChart, Area, YAxis } from 'recharts';

type ChartPoint = object;

interface MiniChartProps {
  data: ChartPoint[];
  dataKey: string;
  color: string;
  type?: 'line' | 'area';
  domain?: [number, number];
}

export function MiniChart({
  data,
  dataKey,
  color,
  type = 'line',
  domain,
}: MiniChartProps) {
  return (
    <ResponsiveContainer width="100%" height={40}>
      {type === 'area' ? (
        <AreaChart data={data}>
          <YAxis hide domain={domain} />
          <Area
            type="monotone"
            dataKey={dataKey}
            stroke={color}
            fill={color}
            fillOpacity={0.2}
            strokeWidth={1.5}
            dot={false}
            isAnimationActive={false}
          />
        </AreaChart>
      ) : (
        <LineChart data={data}>
          <YAxis hide domain={domain} />
          <Line
            type="monotone"
            dataKey={dataKey}
            stroke={color}
            strokeWidth={1.5}
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      )}
    </ResponsiveContainer>
  );
}
