/**
 * BoxPlotCard: 箱线图（用 SVG 手画，Recharts 不直接支持）
 * 声明式 props：
 * {
 *   type: 'BoxPlotCard',
 *   title: '各层级薪酬分布',
 *   data_field: 'boxplot',  // [{grade, min, q1, median, q3, max, status, outliers?}]
 *   x_field: 'grade',
 *   highlight_field: 'status',  // 字段值为 'high' 时标红
 *   footer: '可选说明'
 * }
 *
 * Outlier 裁剪：
 * - 对每行计算 IQR = q3 - q1、上下 fence = q3 + 1.5*IQR / q1 - 1.5*IQR
 * - max / min 超过 fence 视为离群，whisker 画到 fence 内的真实值，离群值另行画点
 * - Y 轴范围按所有行"主体数据"（裁剪后的 whisker min/max）计算，不被异常值撑破
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

type Row = {
  min: number; q1: number; median: number; q3: number; max: number;
  whiskerLow: number; whiskerHigh: number;
  outliers: number[];
  raw: any;
};

export default function BoxPlotCard({ config, data }: Props) {
  const rowsRaw: any[] = getValueByPath(data, config.data_field) || [];

  const { rows, chartWidth, chartHeight, padding, maxVal, minVal } = useMemo(() => {
    const processed: Row[] = [];
    const coreVals: number[] = [];

    for (const r of rowsRaw) {
      if (typeof r.q1 !== 'number' || typeof r.q3 !== 'number') {
        processed.push({
          min: r.min ?? 0, q1: r.q1 ?? 0, median: r.median ?? 0, q3: r.q3 ?? 0, max: r.max ?? 0,
          whiskerLow: r.min ?? 0, whiskerHigh: r.max ?? 0, outliers: [], raw: r,
        });
        continue;
      }
      const iqr = r.q3 - r.q1;
      const upperFence = r.q3 + 1.5 * iqr;
      const lowerFence = r.q1 - 1.5 * iqr;

      // whisker 画到 fence 内最远的真实值（即 max/min 如果在 fence 内则用它，否则用 fence）
      const whiskerHigh = Math.min(r.max ?? r.q3, upperFence);
      const whiskerLow = Math.max(r.min ?? r.q1, lowerFence);

      const outliers: number[] = [];
      // backend 如果给了明细 outliers 数组就用它；否则根据 min/max 超 fence 推断
      if (Array.isArray(r.outliers)) {
        for (const v of r.outliers) {
          if (typeof v === 'number' && (v > upperFence || v < lowerFence)) outliers.push(v);
        }
      } else {
        if (typeof r.max === 'number' && r.max > upperFence) outliers.push(r.max);
        if (typeof r.min === 'number' && r.min < lowerFence) outliers.push(r.min);
      }

      processed.push({
        min: r.min ?? 0, q1: r.q1, median: r.median ?? r.q1, q3: r.q3, max: r.max ?? r.q3,
        whiskerLow, whiskerHigh, outliers, raw: r,
      });

      coreVals.push(whiskerLow, r.q1, r.median ?? r.q1, r.q3, whiskerHigh);
    }

    return {
      rows: processed,
      chartWidth: 600,
      chartHeight: 260,
      padding: { top: 20, right: 20, bottom: 40, left: 64 },
      maxVal: coreVals.length ? Math.max(...coreVals) : 1,
      minVal: coreVals.length ? Math.min(...coreVals, 0) : 0,
    };
  }, [rowsRaw]);

  if (rowsRaw.length === 0) {
    return (
      <div>
        {config.title && <div style={{ fontSize: 15, fontWeight: 500, marginBottom: 12 }}>{config.title}</div>}
        <div style={{ fontSize: 13, color: '#a0a0b0', textAlign: 'center', padding: '20px 0' }}>暂无数据</div>
      </div>
    );
  }

  const innerW = chartWidth - padding.left - padding.right;
  const innerH = chartHeight - padding.top - padding.bottom;
  // 给 Y 轴留 5% headroom，避免 whiskerHigh 压在上边沿
  const yMax = maxVal + (maxVal - minVal) * 0.05;
  const yMin = minVal;
  const range = yMax - yMin || 1;
  const yScale = (v: number) => padding.top + innerH - ((v - yMin) / range) * innerH;
  // 离群点若超出 Y 轴顶，clamp 到顶部并用箭头标
  const clampY = (v: number) => Math.max(padding.top - 4, Math.min(padding.top + innerH + 4, yScale(v)));

  const boxW = Math.min(40, (innerW / rows.length) * 0.5);
  const xScale = (i: number) => padding.left + (i + 0.5) * (innerW / rows.length);

  const hasClippedOutliers = rows.some(r => r.outliers.some(v => v > yMax));

  return (
    <div>
      {config.title && (
        <div style={{ fontSize: 15, fontWeight: 500, marginBottom: 12 }}>{config.title}</div>
      )}
      <svg width="100%" viewBox={`0 0 ${chartWidth} ${chartHeight}`} preserveAspectRatio="xMidYMid meet">
        {/* Y 轴参考线 */}
        {[0, 0.25, 0.5, 0.75, 1].map(r => {
          const y = padding.top + innerH * (1 - r);
          const val = yMin + range * r;
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
          const isHigh = config.highlight_field && r.raw[config.highlight_field] === 'high';
          const color = isHigh ? '#dc3545' : '#2563eb';
          const cx = xScale(i);
          const yWLow = yScale(r.whiskerLow);
          const yWHigh = yScale(r.whiskerHigh);
          const yQ1 = yScale(r.q1);
          const yQ3 = yScale(r.q3);
          const yMed = yScale(r.median);

          return (
            <g key={i}>
              {/* whisker low-high */}
              <line x1={cx} x2={cx} y1={yWLow} y2={yWHigh} stroke={color} strokeWidth={1} />
              <line x1={cx - boxW / 2} x2={cx + boxW / 2} y1={yWLow} y2={yWLow} stroke={color} />
              <line x1={cx - boxW / 2} x2={cx + boxW / 2} y1={yWHigh} y2={yWHigh} stroke={color} />
              {/* box q1-q3 */}
              <rect
                x={cx - boxW / 2} y={yQ3}
                width={boxW} height={Math.max(1, yQ1 - yQ3)}
                fill={isHigh ? '#fde8e8' : '#e0e8ff'}
                stroke={color} strokeWidth={1}
              />
              {/* median */}
              <line x1={cx - boxW / 2} x2={cx + boxW / 2} y1={yMed} y2={yMed} stroke={color} strokeWidth={2} />
              {/* 离群点：空心圆，超出顶部的 clamp 到顶并改成倒三角 */}
              {r.outliers.map((v, oi) => {
                const over = v > yMax;
                const y = clampY(v);
                if (over) {
                  return (
                    <polygon
                      key={oi}
                      points={`${cx - 4},${y} ${cx + 4},${y} ${cx},${y + 6}`}
                      fill={color}
                    >
                      <title>{`离群值: ${_format(v)}`}</title>
                    </polygon>
                  );
                }
                return (
                  <circle key={oi} cx={cx} cy={y} r={3} fill="#fff" stroke={color} strokeWidth={1}>
                    <title>{`离群值: ${_format(v)}`}</title>
                  </circle>
                );
              })}
              {/* X label */}
              <text x={cx} y={chartHeight - padding.bottom + 18} textAnchor="middle" fontSize={11} fill="#6b6b7e" fontWeight={isHigh ? 500 : 400}>
                {r.raw[config.x_field]}
              </text>
            </g>
          );
        })}
      </svg>
      {(hasClippedOutliers || config.footer) && (
        <div style={{ fontSize: 11, color: '#a0a0b0', marginTop: 8 }}>
          {hasClippedOutliers && <span style={{ marginRight: 12 }}>▼ 表示超出主体数据范围的离群值</span>}
          {config.footer}
        </div>
      )}
    </div>
  );
}

function _format(v: number): string {
  if (v >= 10000) return `${(v / 10000).toFixed(v >= 100000 ? 0 : 1)}万`;
  if (v >= 1000) return `${(v / 1000).toFixed(1)}k`;
  return String(Math.round(v));
}
