import { LineChart, Line, ResponsiveContainer, AreaChart, Area } from 'recharts';

interface MiniChartProps {
  data: any[];
  dataKey: string;
  color: string;
  type?: 'line' | 'area';
}

export function MiniChart({ data, dataKey, color, type = 'line' }: MiniChartProps) {
  return (
    <ResponsiveContainer width="100%" height={40}>
      {type === 'area' ? (
        <AreaChart data={data}>
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
