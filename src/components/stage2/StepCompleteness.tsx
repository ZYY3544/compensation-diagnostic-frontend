import type { ParseResult } from '../../types';

interface StepCompletenessProps {
  onAccept: () => void;
  onReupload: () => void;
  parseResult?: ParseResult | null;
}

/** 把行号数组压缩成范围字符串，如 [32,33,34,35,36,37,39] → "第 32-37, 39 行" */
function formatRowRanges(rows: number[]): string {
  if (rows.length === 0) return '';
  const sorted = [...rows].sort((a, b) => a - b);
  const ranges: string[] = [];
  let start = sorted[0], end = sorted[0];

  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] === end + 1) {
      end = sorted[i];
    } else {
      ranges.push(start === end ? `${start}` : `${start}-${end}`);
      start = end = sorted[i];
    }
  }
  ranges.push(start === end ? `${start}` : `${start}-${end}`);
  return `第 ${ranges.join(', ')} 行`;
}

export default function StepCompleteness({ onAccept, onReupload, parseResult }: StepCompletenessProps) {
  const rowMissing = parseResult?.completeness_issues?.row_missing ?? [];
  const colMissing = parseResult?.completeness_issues?.column_missing ?? [];

  // 按字段分组
  const grouped: Record<string, number[]> = {};
  for (const item of rowMissing) {
    if (!grouped[item.field]) grouped[item.field] = [];
    grouped[item.field].push(item.row);
  }
  const fieldGroups = Object.entries(grouped).map(([field, rows]) => ({
    field,
    rows: [...new Set(rows)],
  }));

  // 去重行数
  const uniqueRows = new Set(rowMissing.map(r => r.row));
  const totalAffected = uniqueRows.size;

  // Sheet 2 经营数据状态
  const sheet2 = parseResult?.sheet2_summary;
  const sheetCount = parseResult?.sheet_count || 1;
  const hasSheet2 = sheetCount >= 2;
  const sheet2HasData = hasSheet2 && sheet2 && sheet2.metrics.some(m => m.has_data);
  const sheet2FilledMetrics = sheet2?.metrics.filter(m => m.has_data).length || 0;
  const sheet2Years = sheet2?.years || [];
  // 如果有年份数据，检查哪些年有数据（简化：直接用 year_count）
  const noSheet2 = !hasSheet2 || !sheet2HasData;

  const hasRowIssues = fieldGroups.length > 0;
  const hasColIssues = colMissing.length > 0 || noSheet2;
  const noIssues = !hasRowIssues && !hasColIssues;

  return (
    <div className="wizard-content">
      <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 6 }}>完整性检查</h3>
      <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 20 }}>
        基于你上传的数据，以下是字段填写情况
      </div>

      {noIssues && (
        <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--green)', fontSize: 15 }}>
          所有必填字段和可选字段都填写完整，数据质量很好！
        </div>
      )}

      {/* 关键字段缺失 */}
      {hasRowIssues && (
        <div className="completeness-section">
          <div className="completeness-section-header">
            <span className="completeness-section-title">关键字段缺失</span>
            <span className="completeness-badge">{fieldGroups.length} 个字段 · {totalAffected} 条记录</span>
          </div>
          <div className="completeness-desc">以下记录缺少必填字段，将被排除出分析</div>

          {fieldGroups.map((g, i) => (
            <div key={i} className="completeness-item">
              <div className="completeness-item-left">
                <span className="completeness-warn-icon">&#9888;</span>
                {g.field}为空
              </div>
              <div className="completeness-item-right">
                {formatRowRanges(g.rows)} · 共 {g.rows.length} 条
              </div>
            </div>
          ))}

          <div className="completeness-footer">
            去重后共影响 {totalAffected} 条记录（部分记录多个字段同时为空）
          </div>
        </div>
      )}

      {/* 可选字段未填写 + Sheet 2 状态 */}
      {hasColIssues && (
        <div className="optional-section">
          <div className="optional-section-header">
            <span className="optional-section-title">可选字段未填写</span>
            <span className="optional-badge">{colMissing.length + (noSheet2 ? 1 : 0)} 项</span>
          </div>
          <div className="optional-desc">以下字段整列未填写，对应的深度分析将不可用</div>

          {colMissing.map((item, i) => (
            <div key={i} className="optional-item">
              <div className="optional-item-left">
                <span style={{ color: 'var(--text-muted)' }}>○</span>
                {item.field}
              </div>
              <div className="optional-item-right">{item.impact}</div>
            </div>
          ))}

          {noSheet2 && (
            <div className="optional-item">
              <div className="optional-item-left">
                <span style={{ color: 'var(--text-muted)' }}>○</span>
                未检测到经营数据
              </div>
              <div className="optional-item-right">人工成本趋势分析不可用</div>
            </div>
          )}

          <div className="optional-footer">
            不影响核心诊断（外部竞争力、内部公平性等），仅影响部分深度分析
          </div>
        </div>
      )}

      {/* Sheet 2 有数据时一行展示 */}
      {sheet2HasData && (
        <div style={{ fontSize: 13, color: 'var(--text-secondary)', margin: '0 0 20px 0', display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ color: 'var(--green)', fontWeight: 600 }}>✓</span>
          公司经营数据（Sheet 2）：已识别 {sheet2FilledMetrics} 项指标
          {sheet2Years.length > 0 && `，${sheet2Years[0]}-${sheet2Years[sheet2Years.length - 1]} 有数据`}
        </div>
      )}

      {/* 底部按钮 */}
      {hasRowIssues ? (
        <div className="completeness-actions">
          <button className="completeness-btn-outline" onClick={onReupload}>补充数据，重新上传</button>
          <button className="completeness-btn-primary" onClick={onAccept}>跳过，排除缺失记录继续 →</button>
        </div>
      ) : (
        <button className="next-step-btn" onClick={onAccept} style={{ marginTop: 16 }}>确认，下一步 →</button>
      )}
    </div>
  );
}
