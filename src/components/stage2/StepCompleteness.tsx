import type { ParseResult } from '../../types';

interface StepCompletenessProps {
  onAccept: () => void;
  onReupload: () => void;
  parseResult?: ParseResult | null;
}

export default function StepCompleteness({ onAccept, onReupload, parseResult }: StepCompletenessProps) {
  const rowMissing = parseResult?.completeness_issues?.row_missing ?? [];
  const colMissing = parseResult?.completeness_issues?.column_missing ?? [];

  if (rowMissing.length === 0 && colMissing.length === 0) {
    return (
      <div className="wizard-content">
        <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>完整性检查</h3>
        <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '40px 0' }}>暂无完整性问题</div>
      </div>
    );
  }

  return (
    <div className="wizard-content">
      <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>完整性检查</h3>

      {/* 单行缺失 */}
      {rowMissing.length > 0 && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-header">
            <span className="card-title">关键字段缺失</span>
            <span className="badge badge-amber">{rowMissing.length} 条记录</span>
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', padding: '0 0 12px 0' }}>以下记录缺少必填字段，建议在原始 Excel 中补完后重新上传</div>
          {rowMissing.map((item, i) => (
            <div key={i} className="clean-item">
              <span><span style={{ color: 'var(--amber)' }}>⚠</span> 第 {item.row} 行：{item.issue}</span>
            </div>
          ))}
          <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
            <button className="confirm-bar-btn" onClick={onReupload} style={{ flex: 'none', fontSize: 12, padding: '6px 14px' }}>重新上传</button>
            <button className="confirm-bar-btn selected" onClick={onAccept} style={{ flex: 'none', fontSize: 12, padding: '6px 14px' }}>跳过，排除这些记录继续</button>
          </div>
        </div>
      )}

      {/* 整列缺失 */}
      {colMissing.length > 0 && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-header">
            <span className="card-title">缺少以下字段</span>
            <span className="badge" style={{ background: '#F1F5F9', color: 'var(--text-muted)' }}>{colMissing.length} 列</span>
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', padding: '0 0 12px 0' }}>以下字段整列未填写，对应的分析模块将不可用或受限</div>
          {colMissing.map((item, i) => (
            <div key={i} className="clean-item">
              <span><span style={{ color: 'var(--red)' }}>✗</span> {item.field} 标识 — <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>{item.impact}</span></span>
            </div>
          ))}
        </div>
      )}

      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>
        缺失字段不影响核心诊断（外部竞争力、内部公平性等），但部分深度分析将受限。
      </div>
    </div>
  );
}
