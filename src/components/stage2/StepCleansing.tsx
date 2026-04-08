interface StepCleansingProps {
  taxChoice: string | null;
  onTaxChoice: (choice: string) => void;
  reverted: boolean[];
  onRevert: (idx: number) => void;
}

export default function StepCleansing({ taxChoice, onTaxChoice, reverted, onRevert }: StepCleansingProps) {
  return (
    <div className="wizard-content">
      <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>数据清洗</h3>
      <div className="card" style={{ marginBottom: 16 }}>
        <div className={`clean-item ${reverted[0] ? 'reverted' : ''}`}>
          <span><span className="clean-check">✓</span> 第 5、12、30 行年终奖已年化处理（入司不满 1 年）</span>
          <button className="revert-btn" onClick={() => onRevert(0)}>{reverted[0] ? '已撤回' : '撤回'}</button>
        </div>
        <div className={`clean-item ${reverted[1] ? 'reverted' : ''}`}>
          <span><span className="clean-check">✓</span> 全部员工 13 薪已从年终奖移入固定薪酬</span>
          <button className="revert-btn" onClick={() => onRevert(1)}>{reverted[1] ? '已撤回' : '撤回'}</button>
        </div>
        <div className={`clean-item ${reverted[2] ? 'reverted' : ''}`}>
          <span><span className="clean-check">✓</span> 第 45 行月薪 ¥85,000 已标记为异常值</span>
          <button className="revert-btn" onClick={() => onRevert(2)}>{reverted[2] ? '已撤回' : '撤回'}</button>
        </div>
      </div>

      <div style={{ borderTop: '1px solid var(--border)', paddingTop: 16 }}>
        <div className="confirm-bar">
          <span>⚠ 请确认薪酬数据口径</span>
          <div className="confirm-bar-btns">
            <button
              className={`confirm-bar-btn ${taxChoice === 'pre' ? 'selected' : taxChoice === 'post' ? 'deselected' : ''}`}
              onClick={() => onTaxChoice('pre')}
            >税前</button>
            <button
              className={`confirm-bar-btn ${taxChoice === 'post' ? 'selected' : taxChoice === 'pre' ? 'deselected' : ''}`}
              onClick={() => onTaxChoice('post')}
            >税后</button>
          </div>
        </div>
      </div>

      <div style={{ marginTop: 12, fontSize: 12, color: 'var(--text-muted)', display: 'flex', alignItems: 'center' }}>
        数据完整度 78%
        <span className="progress-bar-track" style={{ marginLeft: 8, width: 120 }}>
          <span className="progress-bar-fill" style={{ width: '78%' }}></span>
        </span>
      </div>
    </div>
  );
}
