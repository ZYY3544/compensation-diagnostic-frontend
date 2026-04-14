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
 *   footer: '可选说明'
 * }
 */
import { getValueByPath, formatValue } from './utils';

interface Props {
  config: {
    type: 'ComparisonTable';
    title?: string;
    columns: string[];
    column_fields?: string[];
    data_field: string;
    column_formats?: string[];
    highlight_rule?: any;
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
                      return (
                        <td
                          key={ci}
                          style={{
                            padding: '10px', borderBottom: '1px solid #f0f0f4',
                            fontWeight: ci === 0 ? 500 : 400,
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
