/**
 * BarHCard: 水平条形图（分组）
 * 声明式 props：
 * {
 *   type: 'BarHCard',
 *   title: '各层级市场分位值',
 *   group_by: 'department',
 *   bar_label: 'grade',
 *   bar_value: 'percentile',
 *   bar_max: 100,
 *   marker: 50,
 *   color_rule: '<25 red, 25-50 orange, >50 green',
 *   footer: '竖线 = 市场 P50 · 低于 P25 标红',
 * }
 *
 * data 期望有一个数组字段（如 benchmark_results），里面每条记录有 group_by / bar_label / bar_value 字段
 */
import { useState, useMemo } from 'react';
import { applyColorRule } from './utils';

interface Props {
  config: {
    type: 'BarHCard';
    title?: string;
    group_by?: string;
    bar_label: string;
    bar_value: string;
    bar_max?: number;
    marker?: number;
    color_rule?: string;
    footer?: string;
    data_field?: string; // 指定 data 里的哪个数组字段；默认自动猜 benchmark_results/rows
  };
  data: any;
}

export default function BarHCard({ config, data }: Props) {
  // 找到底层数组
  const rows: any[] = useMemo(() => {
    if (config.data_field) return data?.[config.data_field] || [];
    // 常见字段尝试
    return data?.benchmark_results || data?.rows || data?.items || [];
  }, [data, config.data_field]);

  // 按 group_by 分组
  const groups = useMemo(() => {
    if (!config.group_by) return { _all: rows };
    const g: Record<string, any[]> = {};
    for (const r of rows) {
      const key = r[config.group_by!] ?? '其他';
      g[key] = g[key] || [];
      g[key].push(r);
    }
    return g;
  }, [rows, config.group_by]);

  const keys = Object.keys(groups);
  const [activeTab, setActiveTab] = useState(keys[0] || '');

  const activeRows = groups[activeTab] || rows;
  const maxVal = config.bar_max || 100;
  const marker = config.marker;

  return (
    <div>
      {config.title && (
        <div style={{ fontSize: 15, fontWeight: 500, marginBottom: 12 }}>{config.title}</div>
      )}

      {/* Tabs（如果有多组）*/}
      {keys.length > 1 && (
        <div style={{
          display: 'flex', gap: 4, marginBottom: 14,
          background: '#f0f1f4', borderRadius: 8, padding: 3,
        }}>
          {keys.map(k => (
            <div
              key={k}
              onClick={() => setActiveTab(k)}
              style={{
                flex: 1, padding: 7, textAlign: 'center', fontSize: 12,
                borderRadius: 6, cursor: 'pointer',
                background: activeTab === k ? '#fff' : 'transparent',
                color: activeTab === k ? '#1a1a2e' : '#6b6b7e',
                fontWeight: activeTab === k ? 500 : 400,
                boxShadow: activeTab === k ? '0 1px 3px rgba(0,0,0,0.06)' : 'none',
              }}
            >
              {k}
            </div>
          ))}
        </div>
      )}

      {/* 条形图 */}
      <div>
        {activeRows.length === 0 ? (
          <div style={{ fontSize: 13, color: '#a0a0b0', textAlign: 'center', padding: '20px 0' }}>
            暂无数据
          </div>
        ) : activeRows.map((r, i) => {
          const val = Number(r[config.bar_value] ?? 0);
          const pct = (val / maxVal) * 100;
          const color = applyColorRule(val, config.color_rule);
          const isLow = val < 25;

          return (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8,
            }}>
              <div style={{
                width: 50, fontSize: 12, color: isLow ? '#e74c3c' : '#6b6b7e',
                textAlign: 'right', fontWeight: isLow ? 500 : 400,
              }}>
                {r[config.bar_label]}
              </div>
              <div style={{
                flex: 1, height: 22, background: isLow ? '#fef0f0' : '#f0f1f4',
                borderRadius: 4, position: 'relative', overflow: 'hidden',
              }}>
                <div style={{
                  height: '100%', width: `${pct}%`, borderRadius: 4,
                  display: 'flex', alignItems: 'center', paddingLeft: 6,
                  fontSize: 10, color: '#fff', fontWeight: 500,
                  background: color !== 'inherit' ? color : '#2563eb',
                  transition: 'width 0.3s ease',
                }}>
                  P{val}
                </div>
                {marker != null && (
                  <div style={{
                    position: 'absolute', top: 0, height: '100%', width: 2,
                    background: '#1a1a2e', left: `${(marker / maxVal) * 100}%`,
                  }} />
                )}
              </div>
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
