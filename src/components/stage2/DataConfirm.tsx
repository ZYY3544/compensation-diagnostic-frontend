interface DataConfirmProps {
  onComplete: () => void;
}

export default function DataConfirm({ onComplete }: DataConfirmProps) {
  return (
    <div>
      <h2>数据确认</h2>
      <p>Stage 2 - 六步进度条流程（待实现）</p>
      <button onClick={onComplete} style={{marginTop: 20, padding: '10px 24px', background: '#0A66C2', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer'}}>
        下一步：业务访谈 →
      </button>
    </div>
  );
}
