import { useState } from 'react';
import ReportOverview from './ReportOverview';
import TabExternalComp from './TabExternalComp';
import TabInternalEquity from './TabInternalEquity';
import TabPayPerformance from './TabPayPerformance';
import TabFixVariable from './TabFixVariable';
import TabLaborCost from './TabLaborCost';

const tabs = [
  { label: '外部竞争力' },
  { label: '内部公平性' },
  { label: '薪酬绩效相关性' },
  { label: '薪酬固浮比' },
  { label: '人工成本' },
];

export default function ReportView() {
  const [activeTab, setActiveTab] = useState(0);

  const tabContent = [
    <TabExternalComp key={0} />,
    <TabInternalEquity key={1} />,
    <TabPayPerformance key={2} />,
    <TabFixVariable key={3} />,
    <TabLaborCost key={4} />,
  ];

  return (
    <div className="fade-enter">
      {/* Overview */}
      <ReportOverview />

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
