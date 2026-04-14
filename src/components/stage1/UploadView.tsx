import { useRef, useState, useCallback } from 'react';
import { templateDownloadUrl } from '../../api/client';

interface UploadViewProps {
  onUpload: (file: File) => void;
}

export default function UploadView({ onUpload }: UploadViewProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleFile = useCallback((file: File) => {
    const validTypes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
      'text/csv',
    ];
    const validExts = ['.xlsx', '.xls', '.csv'];
    const ext = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();

    if (!validTypes.includes(file.type) && !validExts.includes(ext)) {
      alert('请上传 .xlsx / .xls / .csv 格式的文件');
      return;
    }
    onUpload(file);
  }, [onUpload]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  }, [handleFile]);

  return (
    <div className="fade-enter">
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 8 }}>薪酬诊断</h1>
      <p style={{ fontSize: 14, color: 'var(--text-muted)', marginBottom: 32 }}>
        上传薪酬数据，获取 AI 驱动的薪酬健康诊断报告
      </p>
      <div
        className={`upload-zone ${isDragging ? 'dragging' : ''}`}
        onClick={() => fileInputRef.current?.click()}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx,.xls,.csv"
          style={{ display: 'none' }}
          onChange={handleInputChange}
        />
        <div className="upload-icon">
          <svg width="56" height="56" viewBox="0 0 56 56" fill="none">
            <path d="M28 8v28M18 18l10-10 10 10" stroke="#0A66C2" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M8 38c0 0-1 10 10 10h20c11 0 10-10 10-10" stroke="#0A66C2" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.4"/>
          </svg>
        </div>
        <div className="upload-main-text">{isDragging ? '松开鼠标上传' : '拖拽文件至此，或点击上传'}</div>
        <div className="upload-sub-text">支持 .xlsx / .xls / .csv</div>
        <button className="upload-btn" onClick={e => { e.stopPropagation(); fileInputRef.current?.click(); }}>选择文件</button>
      </div>
      <div style={{ textAlign: 'center', marginTop: 16, fontSize: 12, color: 'var(--text-muted)' }}>
        <a
          href={templateDownloadUrl()}
          download
          className="template-link"
          style={{ color: 'var(--brand)', textDecoration: 'none', marginRight: 12 }}
        >
          下载标准模板 ↓
        </a>
        <span>也可以直接上传你们现有的花名册，系统会自动识别字段</span>
      </div>
      <div className="features-row">
        <span className="feature-item">5 分钟完成诊断</span>
        <span className="feature-item">数据加密传输</span>
        <span className="feature-item">五模块专业诊断</span>
      </div>
    </div>
  );
}
