import { useState } from 'react';
import type { ReportData } from '../../types';
import DiagnosisSummary from './DiagnosisSummary';
import ModuleExternalComp from './ModuleExternalComp';
import ModuleInternalEquity from './ModuleInternalEquity';
import ModulePayPerformance from './ModulePayPerformance';
import ModuleFixVariable from './ModuleFixVariable';
import ModuleLaborCost from './ModuleLaborCost';

const MODULE_KEYS = [
  { key: 'external_competitiveness', label: '外部竞争力' },
  { key: 'internal_equity', label: '内部公平性' },
  { key: 'fix_variable_ratio', label: '薪酬结构' },
  { key: 'pay_performance', label: '绩效关联' },
  { key: 'labor_cost', label: '人工成本' },
];

interface ReportViewProps {
  reportData?: ReportData | null;
}

export default function ReportView({ reportData }: ReportViewProps) {
  const [activeModule, setActiveModule] = useState<string | null>(null);

  if (!reportData) {
    return (
      <div className="fade-enter" style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '60px 0' }}>
        正在生成诊断报告...
      </div>
    );
  }

  const modules = reportData.modules || {};
  const currentModule = activeModule || MODULE_KEYS[0].key;

  const renderModule = () => {
    const data = modules[currentModule];
    if (!data) return <div style={{ color: 'var(--text-muted)', padding: 40, textAlign: 'center' }}>暂无数据</div>;

    switch (currentModule) {
      case 'external_competitiveness':
        return <ModuleExternalComp data={data} />;
      case 'internal_equity':
        return <ModuleInternalEquity data={data} />;
      case 'pay_performance':
        return <ModulePayPerformance data={data} />;
      case 'fix_variable_ratio':
        return <ModuleFixVariable data={data} />;
      case 'labor_cost':
        return <ModuleLaborCost data={data} />;
      default:
        return null;
    }
  };

  return (
    <div className="fade-enter">
      {/* 诊断摘要 */}
      <DiagnosisSummary
        healthScore={reportData.health_score}
        findings={reportData.key_findings}
      />

      {/* 模块导航 chip */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        {MODULE_KEYS.map(m => {
          const status = modules[m.key]?.status;
          const isActive = currentModule === m.key;
          return (
            <button
              key={m.key}
              onClick={() => setActiveModule(m.key)}
              style={{
                padding: '8px 16px',
                borderRadius: 20,
                border: isActive ? '2px solid var(--blue)' : '1px solid var(--border)',
                background: isActive ? '#EFF6FF' : '#fff',
                color: isActive ? 'var(--blue)' : 'var(--text-secondary)',
                fontSize: 13,
                fontWeight: isActive ? 600 : 400,
                cursor: 'pointer',
                transition: 'all 0.15s',
              }}
            >
              {status === 'warning' || status === 'attention' ? '⚠ ' : status === 'unavailable' ? '— ' : ''}
              {m.label}
            </button>
          );
        })}
      </div>

      {/* 当前模块内容 */}
      <div style={{ minHeight: 300 }}>
        {renderModule()}
      </div>
    </div>
  );
}
