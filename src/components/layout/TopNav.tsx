import type { Stage } from '../../types';

interface TopNavProps {
  stage: Stage;
}

const stageLabels: Record<Stage, string> = {
  1: '业务访谈',
  2: '数据上传',
  3: '数据确认',
  4: '诊断报告',
};

export default function TopNav({ stage }: TopNavProps) {
  return (
    <div className="top-nav">
      <div className="brand">
        <div className="brand-icon">铭</div>
        <span className="brand-text">铭曦</span>
      </div>
      <div className="nav-stage">{stageLabels[stage]}</div>
      <div className="nav-right">
        {stage === 4 && <button className="export-btn">导出报告</button>}
      </div>
    </div>
  );
}
