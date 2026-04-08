interface UploadViewProps {
  onUpload: () => void;
}

export default function UploadView({ onUpload }: UploadViewProps) {
  return (
    <div className="fade-enter">
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>薪酬诊断</h1>
      <p style={{ fontSize: 14, color: 'var(--text-muted)', marginBottom: 32 }}>
        上传薪酬数据，获取 AI 驱动的薪酬健康诊断报告
      </p>
      <div className="upload-zone" onClick={onUpload}>
        <div className="upload-icon">
          <svg width="56" height="56" viewBox="0 0 56 56" fill="none">
            <path d="M28 8v28M18 18l10-10 10 10" stroke="#0A66C2" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M8 38c0 0-1 10 10 10h20c11 0 10-10 10-10" stroke="#0A66C2" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.4"/>
          </svg>
        </div>
        <div className="upload-main-text">拖拽文件至此，或点击上传</div>
        <div className="upload-sub-text">支持 .xlsx / .xls / .csv</div>
        <button className="upload-btn" onClick={e => { e.stopPropagation(); onUpload(); }}>选择文件</button>
      </div>
      <div style={{ textAlign: 'center', marginTop: 16 }}>
        <span className="template-link">下载数据模板 ↓</span>
      </div>
      <div className="features-row">
        <span className="feature-item">5 分钟完成诊断</span>
        <span className="feature-item">数据加密传输</span>
        <span className="feature-item">五模块专业诊断</span>
      </div>
    </div>
  );
}
