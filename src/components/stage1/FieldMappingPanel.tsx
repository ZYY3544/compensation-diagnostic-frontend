/**
 * 字段映射确认面板（Path B：自由上传后）
 *
 * 渲染一张表，左列是用户 Excel 的列名 + 前几行样本，中间列是下拉框
 * 让用户确认/修改 AI 识别出来的标准字段，右列是状态（已匹配 / 缺失必填 / 忽略）。
 */
import { useMemo, useState } from 'react';

export interface StandardField {
  key: string;
  label: string;
  required: boolean;
  hint?: string;
  optional_for?: string[];
}

export interface MappingSuggestion {
  mappings: Array<{ user_column: string; system_field: string; confidence: number }>;
  unmapped: string[];
  missing_required: string[];
  missing_optional: string[];
}

interface Props {
  columns: string[];
  sampleRows: Array<Record<string, any>>;
  suggestion: MappingSuggestion;
  standardFields: StandardField[];
  onConfirm: (mappings: Array<{ user_column: string; system_field: string }>) => void;
  submitting?: boolean;
}

const IGNORE = '__ignore__';

export default function FieldMappingPanel({
  columns, sampleRows, suggestion, standardFields, onConfirm, submitting,
}: Props) {
  // 当前每列选中的 system_field（或 IGNORE）
  const [selection, setSelection] = useState<Record<string, string>>(() => {
    const s: Record<string, string> = {};
    for (const c of columns) s[c] = IGNORE;
    for (const m of suggestion.mappings) s[m.user_column] = m.system_field;
    return s;
  });

  const confidenceByCol = useMemo(() => {
    const c: Record<string, number> = {};
    for (const m of suggestion.mappings) c[m.user_column] = m.confidence;
    return c;
  }, [suggestion.mappings]);

  const fieldByKey = useMemo(() => {
    const m: Record<string, StandardField> = {};
    for (const f of standardFields) m[f.key] = f;
    return m;
  }, [standardFields]);

  // 重新计算缺失字段
  const { missingRequired, missingOptional, duplicateFields } = useMemo(() => {
    const usedCount: Record<string, number> = {};
    for (const c of columns) {
      const s = selection[c];
      if (s && s !== IGNORE) usedCount[s] = (usedCount[s] || 0) + 1;
    }
    const mr: string[] = [];
    const mo: string[] = [];
    for (const f of standardFields) {
      if (!usedCount[f.key]) {
        (f.required ? mr : mo).push(f.key);
      }
    }
    const dup = Object.entries(usedCount).filter(([, v]) => v > 1).map(([k]) => k);
    return { missingRequired: mr, missingOptional: mo, duplicateFields: dup };
  }, [selection, columns, standardFields]);

  const canSubmit = missingRequired.length === 0 && duplicateFields.length === 0;

  const sampleOf = (col: string) => {
    const vals = sampleRows
      .map(r => r?.[col])
      .filter(v => v !== null && v !== undefined && String(v).trim() !== '')
      .slice(0, 3)
      .map(v => String(v));
    return vals.length ? vals.join('、') : '—';
  };

  const handleSubmit = () => {
    const finalMappings: Array<{ user_column: string; system_field: string }> = [];
    for (const c of columns) {
      const s = selection[c];
      if (s && s !== IGNORE) finalMappings.push({ user_column: c, system_field: s });
    }
    onConfirm(finalMappings);
  };

  return (
    <div className="fade-enter">
      <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 6 }}>字段映射确认</h2>
      <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 20, lineHeight: 1.6 }}>
        我看了一下你的数据，已经识别出 {suggestion.mappings.length} 个字段。
        左边是你的列名，中间是系统识别的对应标准字段，右边是状态。
        识别错的可以改下拉框；不用的列保留"忽略"就行。
      </p>

      <div style={{ overflowX: 'auto', background: 'var(--panel-bg)', border: '1px solid var(--border)', borderRadius: 12 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: 'var(--hover)' }}>
              <th style={thStyle}>你的列名</th>
              <th style={thStyle}>样本数据</th>
              <th style={thStyle}>识别为</th>
              <th style={thStyle}>状态</th>
            </tr>
          </thead>
          <tbody>
            {columns.map(col => {
              const sel = selection[col] || IGNORE;
              const isIgnored = sel === IGNORE;
              const conf = confidenceByCol[col];
              const isLowConf = !isIgnored && conf !== undefined && conf < 0.7;
              const isDup = !isIgnored && duplicateFields.includes(sel);
              return (
                <tr key={col} style={{ borderTop: '1px solid var(--border)' }}>
                  <td style={{ ...tdStyle, fontWeight: 500 }}>{col}</td>
                  <td style={{ ...tdStyle, color: 'var(--text-muted)' }}>{sampleOf(col)}</td>
                  <td style={tdStyle}>
                    <select
                      value={sel}
                      onChange={e => setSelection(prev => ({ ...prev, [col]: e.target.value }))}
                      style={{
                        fontSize: 13, padding: '6px 8px',
                        border: `1px solid ${isDup ? 'var(--red)' : 'var(--border)'}`,
                        borderRadius: 6, background: '#fff', minWidth: 200,
                        color: isIgnored ? 'var(--text-muted)' : 'var(--text-primary)',
                        cursor: 'pointer',
                      }}
                    >
                      <option value={IGNORE}>— 忽略此列 —</option>
                      {standardFields.map(f => (
                        <option key={f.key} value={f.key}>
                          {f.label}{f.required ? ' (必填)' : ''}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td style={tdStyle}>
                    {isIgnored ? (
                      <span style={{ color: 'var(--text-muted)' }}>未识别（忽略）</span>
                    ) : isDup ? (
                      <span style={{ color: 'var(--red)', fontWeight: 500 }}>⚠ 字段重复</span>
                    ) : isLowConf ? (
                      <span style={{ color: 'var(--amber)' }}>⚠ 置信度低，请确认</span>
                    ) : (
                      <span style={{ color: 'var(--green)' }}>✓ 已匹配</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* 缺失字段提示 */}
      {(missingRequired.length > 0 || missingOptional.length > 0) && (
        <div style={{
          marginTop: 16, padding: '12px 16px',
          background: missingRequired.length > 0 ? '#FEE2E2' : 'var(--hover)',
          border: `1px solid ${missingRequired.length > 0 ? '#FCA5A5' : 'var(--border)'}`,
          borderRadius: 8, fontSize: 13, lineHeight: 1.7,
        }}>
          {missingRequired.length > 0 && (
            <div style={{ color: '#991B1B', marginBottom: missingOptional.length ? 8 : 0 }}>
              <strong>缺失必填字段：</strong>{missingRequired.map(k => fieldByKey[k]?.label || k).join('、')}。
              这些字段没有的话没法做任何分析，需要在数据里补上这些列再重新上传。
            </div>
          )}
          {missingOptional.length > 0 && (
            <div style={{ color: 'var(--text-secondary)' }}>
              <strong>缺失可选字段：</strong>{missingOptional.slice(0, 6).map(k => fieldByKey[k]?.label || k).join('、')}
              {missingOptional.length > 6 ? ' 等' : ''}。
              对应分析模块会自动禁用（
              {Array.from(new Set(
                missingOptional.flatMap(k => fieldByKey[k]?.optional_for || []),
              )).slice(0, 3).join('、') || '部分模块'}
              ）。
            </div>
          )}
        </div>
      )}

      {duplicateFields.length > 0 && (
        <div style={{
          marginTop: 12, padding: '10px 14px', background: '#FEE2E2',
          border: '1px solid #FCA5A5', borderRadius: 8, fontSize: 13, color: '#991B1B',
        }}>
          有多个列映射到了同一标准字段（{duplicateFields.map(k => fieldByKey[k]?.label || k).join('、')}），
          请确保一个标准字段只对应一列。
        </div>
      )}

      <div style={{ marginTop: 20, display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
        <button
          onClick={handleSubmit}
          disabled={!canSubmit || submitting}
          style={{
            padding: '10px 24px', borderRadius: 10,
            border: 'none', background: canSubmit ? 'var(--brand)' : '#D1D5DB',
            color: '#fff', fontSize: 14, fontWeight: 500,
            cursor: canSubmit ? 'pointer' : 'not-allowed',
            fontFamily: 'inherit',
          }}
        >
          {submitting ? '正在处理...' : '确认映射，继续 →'}
        </button>
      </div>
    </div>
  );
}

const thStyle: React.CSSProperties = {
  textAlign: 'left', padding: '10px 14px', fontSize: 12, fontWeight: 500,
  color: 'var(--text-muted)', borderBottom: '1px solid var(--border)',
};
const tdStyle: React.CSSProperties = {
  padding: '10px 14px', verticalAlign: 'middle',
};
