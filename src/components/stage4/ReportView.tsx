import { useState } from 'react';
import ReportOverview from './ReportOverview';
import TabExternalComp from './TabExternalComp';
import TabInternalEquity from './TabInternalEquity';
import TabPayPerformance from './TabPayPerformance';
import TabFixVariable from './TabFixVariable';
import TabLaborCost from './TabLaborCost';
import type { ReportData } from '../../types';

const tabs = [
  { label: '外部竞争力', moduleKey: 'external_competitiveness' },
  { label: '内部公平性', moduleKey: 'internal_equity' },
  { label: '薪酬绩效相关性', moduleKey: 'pay_performance' },
  { label: '薪酬固浮比', moduleKey: 'fix_variable_ratio' },
  { label: '人工成本', moduleKey: 'labor_cost' },
];

interface ReportViewProps {
  reportData?: ReportData | null;
}

export default function ReportView({ reportData }: ReportViewProps) {
  const [activeTab, setActiveTab] = useState(0);

  const modules = reportData?.modules || {};

  const tabContent = [
    <TabExternalComp key={0} data={modules.external_competitiveness} />,
    <TabInternalEquity key={1} data={modules.internal_equity} />,
    <TabPayPerformance key={2} data={modules.pay_performance} />,
    <TabFixVariable key={3} data={modules.fix_variable_ratio} />,
    <TabLaborCost key={4} data={modules.labor_cost} />,
  ];

  return (
    <div className="fade-enter">
      {/* Overview */}
      <ReportOverview reportData={reportData} />

      {/* Tab bar */}
      <div className="tab-bar">
        {tabs.map((t, i) => (
          <div key={i} className={`tab-item ${activeTab === i ? 'active' : ''}`} onClick={() => setActiveTab(i)}>
            {t.label}
          </div>
        ))}
      </div>

      {/* Tab content */}
      {tabContent[activeTab]}
    </div>
  );
}
