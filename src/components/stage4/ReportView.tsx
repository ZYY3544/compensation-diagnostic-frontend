import { useState, useEffect, useRef } from 'react';
import {
  getReportPdfUrl,
  getDiagnosisSummary,
  getModuleInsight,
  getDiagnosisAdvice,
} from '../../api/client';
import type { ReportData } from '../../types';
import DiagnosisSummary from './DiagnosisSummary';
import DiagnosisAdvice from './DiagnosisAdvice';
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

// Sparky 在各模块之间的停顿（毫秒），让用户有时间读
const BETWEEN_INSIGHTS_MS = 2500;

interface ReportViewProps {
  reportData?: ReportData | null;
  adviceData?: { advice: any[]; closing: string } | null;
  setAdviceData?: (d: { advice: any[]; closing: string } | null) => void;
  sessionId?: string | null;
  streamMsg?: (text: string) => void;
}

export default function ReportView({ reportData, adviceData, setAdviceData, sessionId, streamMsg }: ReportViewProps) {
  const [activeModule, setActiveModule] = useState<string | null>(null);
  const [opening, setOpening] = useState<string>('');
  const [moduleInsights, setModuleInsights] = useState<Record<string, string>>({});
  const aiTriggered = useRef(false);

  // 挂载时拉三段 AI 叙事：开场 → 逐模块解读 → 诊断建议
  useEffect(() => {
    if (!sessionId || !reportData || aiTriggered.current) return;
    aiTriggered.current = true;

    (async () => {
      // 1. 诊断摘要 opening
      try {
        const res = await getDiagnosisSummary(sessionId);
        const text = res.data?.opening || '';
        if (text) {
          setOpening(text);
          streamMsg?.(text);
        }
      } catch (e) {
        console.warn('[ReportView] getDiagnosisSummary failed', e);
      }

      // 2. 逐模块解读：Sparky 边讲边出
      for (const mk of MODULE_KEYS) {
        await new Promise(r => setTimeout(r, BETWEEN_INSIGHTS_MS));
        try {
          const res = await getModuleInsight(sessionId, mk.key);
          const text = res.data?.insight || '';
          if (text) {
            setModuleInsights(prev => ({ ...prev, [mk.key]: text }));
            streamMsg?.(`【${mk.label}】${text}`);
          }
        } catch (e) {
          console.warn(`[ReportView] getModuleInsight(${mk.key}) failed`, e);
        }
      }

      // 3. 诊断建议
      await new Promise(r => setTimeout(r, BETWEEN_INSIGHTS_MS));
      try {
        const res = await getDiagnosisAdvice(sessionId);
        setAdviceData?.(res.data || null);
        if (res.data?.closing) streamMsg?.(res.data.closing);
      } catch (e) {
        console.warn('[ReportView] getDiagnosisAdvice failed', e);
      }
    })();
  }, [sessionId, reportData, streamMsg, setAdviceData]);

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

    const insight = moduleInsights[currentModule] || '';

    switch (currentModule) {
      case 'external_competitiveness':
        return <ModuleExternalComp data={data} insight={insight} />;
      case 'internal_equity':
        return <ModuleInternalEquity data={data} insight={insight} />;
      case 'pay_performance':
        return <ModulePayPerformance data={data} insight={insight} />;
      case 'fix_variable_ratio':
        return <ModuleFixVariable data={data} insight={insight} />;
      case 'labor_cost':
        return <ModuleLaborCost data={data} insight={insight} />;
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
        opening={opening}
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

      {/* 诊断建议 */}
      {adviceData && adviceData.advice?.length > 0 && (
        <DiagnosisAdvice advice={adviceData.advice} closing={adviceData.closing} />
      )}

      {/* 导出 */}
      {sessionId && (
        <div style={{ marginTop: 24, textAlign: 'center' }}>
          <a
            href={getReportPdfUrl(sessionId)}
            download
            style={{
              display: 'inline-block', padding: '12px 32px',
              borderRadius: 8, background: 'var(--blue)', color: '#fff',
              fontSize: 14, fontWeight: 600, textDecoration: 'none',
              cursor: 'pointer',
            }}
          >
            导出诊断报告 PDF
          </a>
        </div>
      )}
    </div>
  );
}
