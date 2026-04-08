interface StepCompletenessProps {
  onAccept: () => void;
  onReupload: () => void;
}

export default function StepCompleteness({ onAccept, onReupload }: StepCompletenessProps) {
  return (
    <div className="wizard-content">
      <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>完整性检查</h3>

      {/* 单行缺失 */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-header">
          <span className="card-title">关键字段缺失</span>
          <span className="badge badge-amber">3 条记录</span>
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', padding: '0 0 12px 0' }}>以下记录缺少必填字段，建议在原始 Excel 中补完后重新上传</div>
        <div className="clean-item">
          <span><span style={{ color: 'var(--amber)' }}>⚠</span> 第 15 行：月薪为空</span>
        </div>
        <div className="clean-item">
          <span><span style={{ color: 'var(--amber)' }}>⚠</span> 第 23 行：职级为空</span>
        </div>
        <div className="clean-item">
          <span><span style={{ color: 'var(--amber)' }}>⚠</span> 第 67 行：岗位名称为空</span>
        </div>
        <div style={{ display: 'flex', gap: 10, marginTop: 14 }}>
          <button className="confirm-bar-btn" onClick={onReupload} style={{ flex: 'none', fontSize: 12, padding: '6px 14px' }}>重新上传</button>
          <button className="confirm-bar-btn selected" onClick={onAccept} style={{ flex: 'none', fontSize: 12, padding: '6px 14px' }}>跳过，排除这些记录继续</button>
        </div>
      </div>

      {/* 整列缺失 */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-header">
          <span className="card-title">缺少以下字段</span>
          <span className="badge" style={{ background: '#F1F5F9', color: 'var(--text-muted)' }}>3 列</span>
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', padding: '0 0 12px 0' }}>以下字段整列未填写，对应的分析模块将不可用或受限</div>
        <div className="clean-item">
          <span><span style={{ color: 'var(--red)' }}>✗</span> 管理岗/专业岗 标识 — <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>管理溢价分析不可用</span></span>
        </div>
        <div className="clean-item">
          <span><span style={{ color: 'var(--red)' }}>✗</span> 是否关键岗位 标识 — <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>关键岗位下钻不可用</span></span>
        </div>
        <div className="clean-item">
          <span><span style={{ color: 'var(--red)' }}>✗</span> 管理复杂度 — <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>管理复杂度定价不可用</span></span>
        </div>
      </div>

      <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 4 }}>
        缺失字段不影响核心诊断（外部竞争力、内部公平性等），但部分深度分析将受限。
      </div>
    </div>
  );
}
