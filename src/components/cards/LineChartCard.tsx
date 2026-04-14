/**
 * LineChartCard: 折线图（支持多系列）
 * 声明式 props：
 * {
 *   type: 'LineChartCard',
 *   title: '人工成本 vs 营收趋势',
 *   data_field: 'trend',          // 数组字段路径
 *   x_field: 'year',              // X 轴字段
 *   series: [
 *     { field: 'cost', label: '人工成本', color: '#2563eb', format: 'currency' },
 *     { field: 'revenue', label: '营收', color: '#27ae60', format: 'currency' },
 *   ],
 *   footer: '可选说明'
 * }
 */
import { getValueByPath } from './utils';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface Series {
  field: string;
  label: string;
  color?: string;
  format?: string;
}

interface Props {
  config: {
    type: 'LineChartCard';
    title?: string;
    data_field: string;
    x_field: string;
    series: Series[];
    footer?: string;
  };
  data: any;
}

export default function LineChartCard({ config, data }: Props) {
  const rows: any[] = getValueByPath(data, config.data_field) || [];

  if (rows.length === 0) {
    return (
      <div>
        {config.title && <div style={{ fontSize: 15, fontWeight: 500, marginBottom: 12 }}>{config.title}</div>}
        <div style={{ fontSize: 13, color: '#a0a0b0', textAlign: 'center', padding: '20px 0' }}>暂无趋势数据</div>
      </div>
    );
  }

  return (
    <div>
      {config.title && (
        <div style={{ fontSize: 15, fontWeight: 500, marginBottom: 12 }}>{config.title}</div>
      )}
      <ResponsiveContainer width="100%" height={260}>
        <LineChart data={rows} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f4" />
          <XAxis dataKey={config.x_field} tick={{ fontSize: 12 }} />
          <YAxis tick={{ fontSize: 11 }} tickFormatter={(v: number) => _formatAxis(v)} />
          <Tooltip formatter={(v: any) => [_formatTooltip(v), '']} />
          <Legend />
          {config.series.map((s, i) => (
            <Line
              key={i}
              type="monotone"
              dataKey={s.field}
              name={s.label}
              stroke={s.color || ['#2563eb', '#27ae60', '#e67e22', '#dc3545'][i % 4]}
              strokeWidth={2}
              dot={{ r: 4 }}
            />
          ))}
        </LineChart>
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
