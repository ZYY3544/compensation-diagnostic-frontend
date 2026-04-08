interface UploadViewProps {
  onUpload: () => void;
}

export default function UploadView({ onUpload }: UploadViewProps) {
  return (
    <div className="upload-container">
      <h1 className="upload-title">薪酬诊断</h1>
      <p className="upload-subtitle">上传薪酬数据，获取 AI 驱动的薪酬健康诊断报告</p>

      <div className="upload-area" onClick={onUpload}>
        <div className="upload-icon">📄</div>
        <div className="upload-text">拖拽文件至此，或点击上传</div>
        <div className="upload-hint">支持 .xlsx / .xls / .csv</div>
        <button className="upload-btn">选择文件</button>
      </div>

      <a className="template-link" href="#">下载数据模板 ↓</a>

      <div className="upload-features">
        <div className="feature-item">📊 5 分钟完成诊断</div>
        <div className="feature-item">🔒 数据加密传输</div>
        <div className="feature-item">📋 五模块专业诊断</div>
      </div>
    </div>
  );
}
