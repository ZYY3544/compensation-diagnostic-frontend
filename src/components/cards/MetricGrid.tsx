/**
 * MetricGrid: 数字卡片网格
 * 声明式 props：
 * {
 *   type: 'MetricGrid',
 *   columns: 3,
 *   metrics: [
 *     { label: '整体市场分位', field: 'summary.avg_percentile', format: 'P{value}', color_rule: '<25 red, 25-50 orange, >50 green' },
 *     { label: '低于P25人数', field: 'summary.below_p25_count', sub_field: 'summary.below_p25_pct', sub_format: '占比 {value}%' }
 *   ]
 * }
 */
import { getValueByPath, formatValue, applyColorRule } from './utils';

interface Metric {
  label: string;
  field: string;
  sub_field?: string;
  format?: string;
  sub_format?: string;
  color_rule?: string;
  highlight?: boolean;
}

interface Props {
  config: {
    type: 'MetricGrid';
    columns?: number;
    metrics: Metric[];
    footer?: string;
  };
  data: any;
}

export default function MetricGrid({ config, data }: Props) {
  const cols = config.columns || config.metrics.length;
  return (
    <div>
      <div style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${cols}, 1fr)`,
        gap: 10,
      }}>
        {config.metrics.map((m, i) => {
          const raw = getValueByPath(data, m.field);
          const displayValue = formatValue(raw, m.format);
          const color = applyColorRule(raw, m.color_rule);
          const subRaw = m.sub_field ? getValueByPath(data, m.sub_field) : null;
          const subDisplay = subRaw != null ? formatValue(subRaw, m.sub_format) : null;

          return (
            <div
              key={i}
              style={{
                background: '#f7f8fa',
                borderRadius: 8,
                padding: '12px 14px',
                border: m.highlight ? '1px solid #d4edda' : 'none',
              }}
            >
              <div style={{ fontSize: 11, color: '#8b8b9e', marginBottom: 3 }}>{m.label}</div>
              <div style={{ fontSize: 20, fontWeight: 500, color }}>
                {displayValue ?? '—'}
              </div>
              {subDisplay && (
                <div style={{ fontSize: 10, color: '#a0a0b0', marginTop: 2 }}>{subDisplay}</div>
              )}
            </div>
          );
        })}
      </div>
      {config.footer && (
        <div style={{ fontSize: 11, color: '#a0a0b0', marginTop: 8 }}>{config.footer}</div>
      )}
    </div>
  );
}
