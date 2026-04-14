/**
 * StackedBarCard: 堆叠柱状图
 * 声明式 props：
 * {
 *   type: 'StackedBarCard',
 *   title: '各层级固浮比',
 *   data_field: 'pay_mix_by_grade',
 *   x_field: 'grade',
 *   series: [
 *     { field: 'fixed', label: '固定', color: '#2563eb' },
 *     { field: 'variable', label: '浮动', color: '#e67e22' }
 *   ],
 *   orientation: 'vertical' | 'horizontal',
 *   footer: '可选说明'
 * }
 */
import { getValueByPath } from './utils';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface Series {
  field: string;
  label: string;
  color?: string;
}

interface Props {
  config: {
    type: 'StackedBarCard';
    title?: string;
    data_field: string;
    x_field: string;
    series: Series[];
    orientation?: 'vertical' | 'horizontal';
    footer?: string;
  };
  data: any;
}

const DEFAULT_COLORS = ['#2563eb', '#e67e22', '#27ae60', '#dc3545'];

export default function StackedBarCard({ config, data }: Props) {
  const rows: any[] = getValueByPath(data, config.data_field) || [];
  const horizontal = config.orientation === 'horizontal';

  if (rows.length === 0) {
    return (
      <div>
        {config.title && <div style={{ fontSize: 15, fontWeight: 500, marginBottom: 12 }}>{config.title}</div>}
        <div style={{ fontSize: 13, color: '#a0a0b0', textAlign: 'center', padding: '20px 0' }}>暂无数据</div>
      </div>
    );
  }

  return (
    <div>
      {config.title && (
        <div style={{ fontSize: 15, fontWeight: 500, marginBottom: 12 }}>{config.title}</div>
      )}
      <ResponsiveContainer width="100%" height={280}>
        <BarChart data={rows} layout={horizontal ? 'vertical' : 'horizontal'} margin={{ top: 10, right: 20, left: horizontal ? 60 : 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f4" />
          {horizontal ? (
            <>
              <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v: number) => _formatAxis(v)} />
              <YAxis type="category" dataKey={config.x_field} tick={{ fontSize: 12 }} width={80} />
            </>
          ) : (
            <>
              <XAxis dataKey={config.x_field} tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(v: number) => _formatAxis(v)} />
            </>
          )}
          <Tooltip formatter={(v: any) => [_formatTooltip(v), '']} />
          <Legend />
          {config.series.map((s, i) => (
            <Bar
              key={s.field}
              dataKey={s.field}
              name={s.label}
              stackId="stack"
              fill={s.color || DEFAULT_COLORS[i % DEFAULT_COLORS.length]}
              radius={i === config.series.length - 1 ? (horizontal ? [0, 4, 4, 0] : [4, 4, 0, 0]) : 0}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
      {config.footer && (
        <div style={{ fontSize: 11, color: '#a0a0b0', marginTop: 8 }}>{config.footer}</div>
      )}
    </div>
  );
}

function _formatAxis(v: number): string {
  if (v >= 10000) return `${(v / 10000).toFixed(0)}万`;
  return String(v);
}

function _formatTooltip(v: any): string {
  const num = Number(v);
  if (isNaN(num)) return String(v ?? '—');
  if (num >= 10000) return `¥${(num / 10000).toFixed(1)}万`;
  return `¥${num.toLocaleString()}`;
}
