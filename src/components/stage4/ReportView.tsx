import { useState, useEffect, useRef } from 'react';
import {
  getReportPdfUrl,
  getModuleInsight,
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

/**
 * 三大块之间的视觉分隔：上方一条横线 + 加宽的上下间距 + section 标题
 * 让"诊断关键发现 / 维度详情 / 行动建议"三段在长报告里清晰可辨
 */
function SectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div style={{
      marginTop: 36,
      marginBottom: 20,
      paddingTop: 24,
      borderTop: '1px solid var(--border)',
    }}>
      <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>
        {title}
      </div>
      {subtitle && (
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
          {subtitle}
        </div>
      )}
    </div>
  );
}

interface ReportViewProps {
  reportData?: ReportData | null;
  adviceData?: { advice: any[]; closing: string } | null;
  findingsText?: string;            // 由 App.tsx 在 analyze 流程里预先拉好
  sessionId?: string | null;
}

export default function ReportView({ reportData, adviceData, findingsText, sessionId }: ReportViewProps) {
  const [activeModule, setActiveModule] = useState<string | null>(null);
  const [moduleInsights, setModuleInsights] = useState<Record<string, string>>({});
  const [insightLoadingKey, setInsightLoadingKey] = useState<string | null>(null);
  const insightAttempted = useRef<Set<string>>(new Set());

  // 用户切到某个模块时按需 fetch 该模块的 AI 解读（只显示在右侧，不再 stream 到 chat）
  const currentModule = activeModule || MODULE_KEYS[0].key;
  useEffect(() => {
    if (!currentModule || !sessionId) return;
    if (insightAttempted.current.has(currentModule)) return;
    insightAttempted.current.add(currentModule);

    setInsightLoadingKey(currentModule);
    (async () => {
      try {
        const res = await getModuleInsight(sessionId, currentModule);
        setModuleInsights(prev => ({ ...prev, [currentModule]: res.data?.insight || '' }));
      } catch (e) {
        console.warn(`[ReportView] getModuleInsight(${currentModule}) failed`, e);
        setModuleInsights(prev => ({ ...prev, [currentModule]: '' }));
      } finally {
        setInsightLoadingKey(prev => (prev === currentModule ? null : prev));
      }
    })();
  }, [currentModule, sessionId]);

  if (!reportData) {
    return (
      <div className="fade-enter" style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '60px 0' }}>
        正在生成诊断报告...
      </div>
    );
  }

  const modules = reportData.modules || {};

  const renderModule = () => {
    const data = modules[currentModule];
    if (!data) return <div style={{ color: 'var(--text-muted)', padding: 40, textAlign: 'center' }}>暂无数据</div>;

    const insight = moduleInsights[currentModule];
    const loading = insightLoadingKey === currentModule;

    switch (currentModule) {
      case 'external_competitiveness':
        return <ModuleExternalComp data={data} insight={insight} insightLoading={loading}
          gradeTrendTcc={reportData?.grade_trend_tcc} gradeTrendBase={reportData?.grade_trend_base} />;
      case 'internal_equity':
        return <ModuleInternalEquity data={data} insight={insight} insightLoading={loading} />;
      case 'pay_performance':
        return <ModulePayPerformance data={data} insight={insight} insightLoading={loading} />;
      case 'fix_variable_ratio':
        return <ModuleFixVariable data={data} insight={insight} insightLoading={loading} />;
      case 'labor_cost':
        return <ModuleLaborCost data={data} insight={insight} insightLoading={loading} />;
      default:
        return null;
    }
  };

  return (
    <div className="fade-enter">
      {/* === Section 1: 诊断关键发现（findingsText 由 App 在 analyze 流程里预先拉好）=== */}
      <DiagnosisSummary findings_text={findingsText} loading={!findingsText} />

      {/* === Section 2: 维度详情 === */}
      <SectionHeader title="维度详情" subtitle="点击下方任一维度查看图表与 AI 解读" />

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

      {/* === Section 3: 行动建议 === */}
      <SectionHeader title="行动建议" subtitle="基于以上发现给出具体的执行方向" />

      {/* 行动建议：App 在 analyze 流程里预先拉好。万一 advice 未拉到（fallback）显示提示 */}
      {adviceData && adviceData.advice?.length > 0 ? (
        <DiagnosisAdvice advice={adviceData.advice} closing={adviceData.closing} />
      ) : (
        <div style={{
          padding: '20px 24px',
          background: '#fff',
          border: '1px dashed var(--border)',
          borderRadius: 8,
          textAlign: 'center',
          fontSize: 13,
          color: 'var(--text-muted)',
        }}>
          暂时没有生成行动建议，请稍后刷新或重新跑诊断。
        </div>
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
