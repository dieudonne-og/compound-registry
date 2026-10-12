import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { DashboardSummary } from '@cr/contracts';

const kg = new Intl.NumberFormat('en-GB', { maximumFractionDigits: 0 });
const reducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export function WeightByMineralChart({ data }: { data: DashboardSummary['weightByMineral'] }) {
  const rows = data.map((d) => ({ name: d.name, kg: Number(d.weightKg) }));
  return (
    <figure>
      <div className="h-64" aria-hidden>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} layout="vertical" margin={{ left: 8, right: 56, top: 4, bottom: 4 }}>
            <CartesianGrid horizontal={false} stroke="var(--border)" />
            <XAxis type="number" hide />
            <YAxis
              type="category"
              dataKey="name"
              width={120}
              tickLine={false}
              axisLine={false}
              tick={{ fill: 'var(--muted-foreground)', fontSize: 12 }}
            />
            <Tooltip
              cursor={{ fill: 'var(--muted)' }}
              formatter={(v) => [`${kg.format(Number(v))} kg`, 'Weight']}
              contentStyle={{
                background: 'var(--popover)',
                border: '1px solid var(--border)',
                borderRadius: 8,
                color: 'var(--popover-foreground)',
              }}
            />
            <Bar
              dataKey="kg"
              fill="var(--chart-1)"
              radius={[0, 4, 4, 0]}
              barSize={18}
              animationDuration={500}
              isAnimationActive={!reducedMotion()}
            >
              <LabelList
                dataKey="kg"
                position="right"
                formatter={(v) => `${kg.format(Number(v))} kg`}
                style={{ fill: 'var(--foreground)', fontSize: 12, fontFamily: 'var(--font-mono)' }}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <table className="sr-only">
        <caption>Total production weight by mineral type</caption>
        <thead>
          <tr>
            <th>Mineral</th>
            <th>Weight (kg)</th>
          </tr>
        </thead>
        <tbody>
          {data.map((d) => (
            <tr key={d.code}>
              <td>{d.name}</td>
              <td>{d.weightKg}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
