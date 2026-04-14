/**
 * ComparisonTable: 对比表格
 * 声明式 props：
 * {
 *   type: 'ComparisonTable',
 *   title: '分层明细',
 *   columns: ['层级', '当前分位', '方案一目标', '方案二目标', '人数', '预算'],
 *   data_field: 'plan_b.details',  // 指向 data 里的数组字段
 *   column_fields: ['grade', 'current', 'target_a', 'target_b', 'headcount', 'budget'], // 每列对应 field（可选；不给则用 columns 作为 field 名）
 *   highlight_rule: '核心骨干层高亮' | {{column: 'status', equals: 'high'}},
 *   cell_color_rules: {{
 *     cr: 'cr_range',   // 预设 cr 规则: <0.85 红 / 0.85-1.15 绿 / 1.15-2.0 橙 / >2.0 深红
 *   }},
 *   footer: '可选说明'
 * }
 */
import { getValueByPath, formatValue } from './utils';

// 内置规则：CR 值分档着色
const COLOR_RULES: Record<string, (v: any) => { bg: string; color: string; fontWeight?: number | string } | null> = {
  cr_range: (v: any) => {
    const n = typeof v === 'number' ? v : parseFloat(v);
    if (!isFinite(n)) return null;
    if (n < 0.85) return { bg: '#FEE2E2', color: '#991B1B' };
    if (n <= 1.15) return { bg: '#D1FAE5', color: '#065F46' };
    if (n <= 2.0) return { bg: '#FEF3C7', color: '#92400E' };
    return { bg: '#FCA5A5', color: '#7F1D1D', fontWeight: 700 };
  },
};

interface Props {
  config: {
    type: 'ComparisonTable';
    title?: string;
    columns: string[];
    column_fields?: string[];
    data_field: string;
    column_formats?: string[];
    highlight_rule?: any;
    cell_color_rules?: Record<string, string>;
    footer?: string;
  };
  data: any;
}

export default function ComparisonTable({ config, data }: Props) {
  const rows: any[] = getValueByPath(data, config.data_field) || [];
  const columns = config.columns;
  // 如果没给 column_fields，按 columns 序号猜常见字段名
  const fields = config.column_fields || columns.map(c => c);
  const formats = config.column_formats || [];

  const isHighlighted = (row: any): boolean => {
    const rule = config.highlight_rule;
    if (!rule) return false;
    if (typeof rule === 'object') {
      if (rule.column && row[rule.column] === rule.equals) return true;
    }
    // 字符串规则暂不解析（仅 UI 提示）
    return !!row._highlight;
  };

  return (
    <div>
      {config.title && (
        <div style={{ fontSize: 15, fontWeight: 500, marginBottom: 12 }}>{config.title}</div>
      )}

      {rows.length === 0 ? (
        <div style={{ fontSize: 13, color: '#a0a0b0', textAlign: 'center', padding: '20px 0' }}>
          暂无数据
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr>
                {columns.map((c, i) => (
                  <th
                    key={i}
                    style={{
                      textAlign: 'left', fontWeight: 500, padding: '8px 10px',
                      borderBottom: '2px solid #e8e8ec', color: '#6b6b7e', fontSize: 12,
                    }}
                  >
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, ri) => {
                const highlight = isHighlighted(row);
                return (
                  <tr key={ri} style={{ background: highlight ? '#fff8f0' : 'transparent' }}>
                    {fields.map((f, ci) => {
                      const raw = row[f];
                      const display = formatValue(raw, formats[ci]);
                      const ruleName = config.cell_color_rules?.[f];
                      const rule = ruleName ? COLOR_RULES[ruleName] : undefined;
                      const colorStyle = rule ? rule(raw) : null;
                      return (
                        <td
                          key={ci}
                          style={{
                            padding: '10px', borderBottom: '1px solid #f0f0f4',
                            fontWeight: colorStyle?.fontWeight ?? (ci === 0 ? 500 : 400),
                            background: colorStyle?.bg,
                            color: colorStyle?.color,
                          }}
                        >
                          {display ?? (raw != null ? String(raw) : '—')}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {config.footer && (
        <div style={{ fontSize: 11, color: '#a0a0b0', marginTop: 8 }}>{config.footer}</div>
      )}
    </div>
  );
}
