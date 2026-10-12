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
import { useI18n } from '@/i18n/i18n';

const reducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export function WeightByMineralChart({ data }: { data: DashboardSummary['weightByMineral'] }) {
  const { t, locale } = useI18n();
  const kg = new Intl.NumberFormat(locale, { maximumFractionDigits: 0 });
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
              formatter={(v) => [`${kg.format(Number(v))} kg`, t('dashboard.chart.weight')]}
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
        <caption>{t('dashboard.chart.caption')}</caption>
        <thead>
          <tr>
            <th>{t('dashboard.chart.mineral')}</th>
            <th>{t('dashboard.chart.weightKg')}</th>
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
