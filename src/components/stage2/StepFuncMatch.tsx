interface StepFuncMatchProps {
  funcChoice: string | null;
  onFuncChoice: (choice: string) => void;
}

export default function StepFuncMatch({ funcChoice, onFuncChoice }: StepFuncMatchProps) {
  return (
    <div className="wizard-content">
      <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>职能匹配</h3>
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="match-item">
          <span>软件工程师 <span className="match-arrow">→</span> 技术研发-软件开发</span>
          <span style={{ color: 'var(--green)' }}>✓</span>
        </div>
        <div className="match-item">
          <span>HRBP 经理 <span className="match-arrow">→</span> 人力资源-HRBP</span>
          <span style={{ color: 'var(--green)' }}>✓</span>
        </div>
        <div className="match-item" style={{ background: '#FEF3C7', margin: '0 -20px', padding: '10px 20px', borderRadius: 0 }}>
          <span>增长黑客 <span className="match-arrow">→</span> {funcChoice === 'digital' ? '数字营销' : funcChoice === 'growth' ? '用户增长' : <span style={{ color: 'var(--amber)' }}>？待确认 ⚠</span>}</span>
          {funcChoice ? (
            <span style={{ color: 'var(--green)' }}>✓</span>
          ) : null}
        </div>
        {!funcChoice && (
          <div style={{ padding: '12px 16px', background: '#FEF3C7', borderRadius: '0 0 6px 6px', margin: '0 -20px', paddingBottom: 16 }}>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 8 }}>"增长黑客" 的职能是？</div>
            <div className="confirm-bar-btns">
              <button className="confirm-bar-btn" onClick={() => onFuncChoice('digital')}>数字营销</button>
              <button className="confirm-bar-btn" onClick={() => onFuncChoice('growth')}>用户增长</button>
            </div>
          </div>
        )}
        <div className="match-item">
          <span>销售总监 <span className="match-arrow">→</span> 销售-大客户销售</span>
          <span style={{ color: 'var(--green)' }}>✓</span>
        </div>
        <div className="match-item">
          <span>财务主管 <span className="match-arrow">→</span> 财务-财务管理</span>
          <span style={{ color: 'var(--green)' }}>✓</span>
        </div>
      </div>
    </div>
  );
}
