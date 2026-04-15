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

interface ReportViewProps {
  reportData?: ReportData | null;
  adviceData?: { advice: any[]; closing: string } | null;
  setAdviceData?: (d: { advice: any[]; closing: string } | null) => void;
  sessionId?: string | null;
  streamMsg?: (text: string) => void;
}

export default function ReportView({ reportData, adviceData, setAdviceData, sessionId, streamMsg }: ReportViewProps) {
  const [activeModule, setActiveModule] = useState<string | null>(null);
  const [moduleInsights, setModuleInsights] = useState<Record<string, string>>({});
  const [insightLoadingKey, setInsightLoadingKey] = useState<string | null>(null);
  const [adviceLoading, setAdviceLoading] = useState(false);
  const [findingsText, setFindingsText] = useState<string>('');
  const [findingsLoading, setFindingsLoading] = useState(true);
  const summaryFired = useRef(false);
  const insightAttempted = useRef<Set<string>>(new Set());

  // 分析跑完：拉 5 维度关键发现（显示在右侧 DiagnosisSummary），同时给左侧 chat 发一条固定引导
  // 5 维度文本不适合塞进 chat 气泡（太长、结构化），所以 chat 走简单模板，AI 输出留给右侧
  useEffect(() => {
    if (!sessionId || !reportData || summaryFired.current) return;
    summaryFired.current = true;

    streamMsg?.('诊断已完成，五个维度的关键发现已经放在右侧报告里。想深入聊哪个维度，直接告诉我就行。');

    (async () => {
      try {
        const res = await getDiagnosisSummary(sessionId);
        setFindingsText(res.data?.opening || '');
      } catch (e) {
        console.warn('[ReportView] getDiagnosisSummary failed', e);
      } finally {
        setFindingsLoading(false);
      }
    })();
  }, [sessionId, reportData, streamMsg]);

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

  const loadAdvice = async () => {
    if (!sessionId || adviceLoading || adviceData) return;
    setAdviceLoading(true);
    try {
      const res = await getDiagnosisAdvice(sessionId);
      setAdviceData?.(res.data || null);
    } catch (e) {
      console.warn('[ReportView] getDiagnosisAdvice failed', e);
    } finally {
      setAdviceLoading(false);
    }
  };

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
        return <ModuleExternalComp data={data} insight={insight} insightLoading={loading} />;
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
      {/* 诊断关键发现：按 5 维度展示 AI 输出，loading 时占位 */}
      <DiagnosisSummary findings_text={findingsText} loading={findingsLoading} />

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

      {/* 诊断建议——按需触发。已加载就直接渲染，未加载显示占位 + 按钮 */}
      {adviceData && adviceData.advice?.length > 0 ? (
        <DiagnosisAdvice advice={adviceData.advice} closing={adviceData.closing} />
      ) : (
        <div style={{
          marginTop: 24,
          padding: '20px 24px',
          background: '#fff',
          border: '1px dashed var(--border)',
          borderRadius: 8,
          textAlign: 'center',
        }}>
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 12 }}>
            想要 AI 基于这份报告给出具体的行动建议？
          </div>
          <button
            onClick={loadAdvice}
            disabled={adviceLoading}
            style={{
              padding: '10px 24px',
              borderRadius: 8,
              border: 'none',
              background: adviceLoading ? '#cbd5e1' : 'var(--brand)',
              color: '#fff',
              fontSize: 13,
              fontWeight: 600,
              cursor: adviceLoading ? 'not-allowed' : 'pointer',
              transition: 'all 0.15s',
            }}
          >
            {adviceLoading ? 'Sparky 正在思考...' : '生成 AI 行动建议'}
          </button>
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
