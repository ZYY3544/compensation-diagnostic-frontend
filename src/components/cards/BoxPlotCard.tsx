/**
 * BoxPlotCard: 箱线图（用 SVG 手画，Recharts 不直接支持）
 * 声明式 props：
 * {
 *   type: 'BoxPlotCard',
 *   title: '各层级薪酬分布',
 *   data_field: 'boxplot',  // [{grade, min, q1, median, q3, max, status}]
 *   x_field: 'grade',
 *   highlight_field: 'status',  // 字段值为 'high' 时标红
 *   footer: '可选说明'
 * }
 */
import { getValueByPath } from './utils';
import { useMemo } from 'react';

interface Props {
  config: {
    type: 'BoxPlotCard';
    title?: string;
    data_field: string;
    x_field: string;
    highlight_field?: string;
    footer?: string;
  };
  data: any;
}

export default function BoxPlotCard({ config, data }: Props) {
  const rows: any[] = getValueByPath(data, config.data_field) || [];

  const { chartWidth, chartHeight, padding, maxVal, minVal } = useMemo(() => {
    const allVals: number[] = [];
    for (const r of rows) {
      ['min', 'q1', 'median', 'q3', 'max'].forEach(k => {
        if (typeof r[k] === 'number') allVals.push(r[k]);
      });
    }
    return {
      chartWidth: 600,
      chartHeight: 240,
      padding: { top: 16, right: 20, bottom: 36, left: 60 },
      maxVal: Math.max(...allVals, 0),
      minVal: Math.min(...allVals, 0),
    };
  }, [rows]);

  if (rows.length === 0) {
    return (
      <div>
        {config.title && <div style={{ fontSize: 15, fontWeight: 500, marginBottom: 12 }}>{config.title}</div>}
        <div style={{ fontSize: 13, color: '#a0a0b0', textAlign: 'center', padding: '20px 0' }}>暂无数据</div>
      </div>
    );
  }

  const innerW = chartWidth - padding.left - padding.right;
  const innerH = chartHeight - padding.top - padding.bottom;
  const range = maxVal - minVal || 1;
  const yScale = (v: number) => padding.top + innerH - ((v - minVal) / range) * innerH;
  const boxW = Math.min(40, (innerW / rows.length) * 0.5);
  const xScale = (i: number) => padding.left + (i + 0.5) * (innerW / rows.length);

  return (
    <div>
      {config.title && (
        <div style={{ fontSize: 15, fontWeight: 500, marginBottom: 12 }}>{config.title}</div>
      )}
      <svg width="100%" viewBox={`0 0 ${chartWidth} ${chartHeight}`} preserveAspectRatio="xMidYMid meet">
        {/* Y 轴参考线 */}
        {[0, 0.25, 0.5, 0.75, 1].map(r => {
          const y = padding.top + innerH * (1 - r);
          const val = minVal + range * r;
          return (
            <g key={r}>
              <line x1={padding.left} x2={chartWidth - padding.right} y1={y} y2={y} stroke="#f0f0f4" strokeDasharray="3 3" />
              <text x={padding.left - 6} y={y + 4} textAnchor="end" fontSize={10} fill="#a0a0b0">
                {_format(val)}
              </text>
            </g>
          );
        })}

        {/* 箱线 */}
        {rows.map((r, i) => {
          const isHigh = config.highlight_field && r[config.highlight_field] === 'high';
          const color = isHigh ? '#dc3545' : '#2563eb';
          const cx = xScale(i);
          const yMin = yScale(r.min || 0);
          const yMax = yScale(r.max || 0);
          const yQ1 = yScale(r.q1 || 0);
          const yQ3 = yScale(r.q3 || 0);
          const yMed = yScale(r.median || 0);

          return (
            <g key={i}>
              {/* whisker min-max */}
              <line x1={cx} x2={cx} y1={yMin} y2={yMax} stroke={color} strokeWidth={1} />
              <line x1={cx - boxW / 2} x2={cx + boxW / 2} y1={yMin} y2={yMin} stroke={color} />
              <line x1={cx - boxW / 2} x2={cx + boxW / 2} y1={yMax} y2={yMax} stroke={color} />
              {/* box q1-q3 */}
              <rect
                x={cx - boxW / 2} y={yQ3}
                width={boxW} height={Math.max(1, yQ1 - yQ3)}
                fill={isHigh ? '#fde8e8' : '#e0e8ff'}
                stroke={color} strokeWidth={1}
              />
              {/* median */}
              <line x1={cx - boxW / 2} x2={cx + boxW / 2} y1={yMed} y2={yMed} stroke={color} strokeWidth={2} />
              {/* X label */}
              <text x={cx} y={chartHeight - padding.bottom + 18} textAnchor="middle" fontSize={11} fill="#6b6b7e" fontWeight={isHigh ? 500 : 400}>
                {r[config.x_field]}
              </text>
            </g>
          );
        })}
      </svg>
      {config.footer && (
        <div style={{ fontSize: 11, color: '#a0a0b0', marginTop: 8 }}>{config.footer}</div>
      )}
    </div>
  );
}

function _format(v: number): string {
  if (v >= 10000) return `${(v / 10000).toFixed(0)}万`;
  if (v >= 1000) return `${(v / 1000).toFixed(1)}k`;
  return String(Math.round(v));
}
