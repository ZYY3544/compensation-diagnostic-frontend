import { useState } from 'react';

interface GradeTableRow {
  company_grade: string;
  count: number;
  standard_grade: string;
  status: string;
}

interface EmployeeRow {
  row_number: number;
  id: string;
  job_title: string;
  performance: string;
  mapped_grade: string;
  suggested_grade: string | null;
  adjust_reason: string | null;
  signals: string[];
  has_suggestion: boolean;
}

interface GradeGroup {
  employees: EmployeeRow[];
  suggestion_count: number;
  total: number;
}

interface StepGradeMatchProps {
  gradeData: {
    grade_table: GradeTableRow[];
    employees_by_grade: Record<string, GradeGroup>;
    standard_grades: string[];
    standard_grade_definitions: Record<string, string>;
  } | null;
  onGradeChange?: (companyGrade: string, newStandardGrade: string) => void;
  onNext: () => void;
}

export default function StepGradeMatch({ gradeData, onGradeChange, onNext }: StepGradeMatchProps) {
  const [expandedGrades, setExpandedGrades] = useState<Set<string>>(new Set());
  const [showDefinitions, setShowDefinitions] = useState(false);
  const [showAllEmployees, setShowAllEmployees] = useState<Set<string>>(new Set());
  const [localMapping, setLocalMapping] = useState<Record<string, string>>({});
  const [editingRow, setEditingRow] = useState<number | null>(null);

  if (!gradeData) {
    return (
      <div className="wizard-content">
        <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 6 }}>职级匹配</h3>
        <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '60px 0' }}>Sparky 正在匹配职级...</div>
      </div>
    );
  }

  const { grade_table, employees_by_grade, standard_grades, standard_grade_definitions } = gradeData;
  const THRESHOLD = 15;

  const getStandardGrade = (companyGrade: string, original: string) => {
    return localMapping[companyGrade] ?? original;
  };

  const handleGradeSelect = (companyGrade: string, value: string, _original: string) => {
    setLocalMapping(prev => ({ ...prev, [companyGrade]: value }));
    onGradeChange?.(companyGrade, value);
  };

  const toggleGrade = (g: string) => {
    setExpandedGrades(prev => {
      const next = new Set(prev);
      if (next.has(g)) next.delete(g); else next.add(g);
      return next;
    });
  };

  return (
    <div className="wizard-content">
      <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>职级匹配</h3>
      <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 24 }}>
        将你们的职级体系与铭曦标准职级对应，用于后续市场薪酬对标
      </div>

      {/* ===== 区块一：职级映射总览 ===== */}
      <div style={{ background: '#FAFAFA', border: '1px solid var(--border)', borderRadius: 8, padding: '20px 24px', marginBottom: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <span style={{ fontSize: 15, fontWeight: 700 }}>职级映射总览</span>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>AI 已预匹配，请确认或调整</span>
        </div>

        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border)' }}>
              <th style={{ textAlign: 'left', padding: '8px 0', fontSize: 12, color: 'var(--text-muted)', fontWeight: 500 }}>公司职级</th>
              <th style={{ textAlign: 'center', padding: '8px 0', fontSize: 12, color: 'var(--text-muted)', fontWeight: 500 }}>人数</th>
              <th style={{ textAlign: 'left', padding: '8px 0', fontSize: 12, color: 'var(--text-muted)', fontWeight: 500 }}>标准职级</th>
              <th style={{ textAlign: 'right', padding: '8px 0', fontSize: 12, color: 'var(--text-muted)', fontWeight: 500 }}>状态</th>
            </tr>
          </thead>
          <tbody>
            {grade_table.map(g => {
              const current = getStandardGrade(g.company_grade, g.standard_grade);
              const isAdjusted = localMapping[g.company_grade] && localMapping[g.company_grade] !== g.standard_grade;
              return (
                <tr key={g.company_grade} style={{ borderBottom: '1px solid #f0f0f0' }}>
                  <td style={{ padding: '14px 0', fontWeight: 600, fontSize: 14 }}>{g.company_grade}</td>
                  <td style={{ textAlign: 'center', color: 'var(--text-secondary)', fontSize: 13 }}>{g.count} 人</td>
                  <td style={{ padding: '14px 0' }}>
                    <select
                      value={current}
                      onChange={e => handleGradeSelect(g.company_grade, e.target.value, g.standard_grade)}
                      style={{
                        width: '100%', padding: '8px 12px', border: '1px solid var(--border)',
                        borderRadius: 6, fontSize: 13, background: '#fff', cursor: 'pointer',
                      }}
                    >
                      {standard_grades.map(sg => (
                        <option key={sg} value={sg}>{sg}</option>
                      ))}
                    </select>
                  </td>
                  <td style={{ textAlign: 'right', fontSize: 12 }}>
                    {isAdjusted
                      ? <span style={{ color: '#b45309' }}>✎ 已调整</span>
                      : <span style={{ color: 'var(--green)' }}>✓ 已匹配</span>
                    }
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {/* 展开定义 */}
        <div style={{ marginTop: 16, borderTop: '1px solid var(--border)', paddingTop: 12 }}>
          <span
            style={{ fontSize: 12, color: 'var(--blue)', cursor: 'pointer' }}
            onClick={() => setShowDefinitions(!showDefinitions)}
          >
            {showDefinitions ? '▾' : '▸'} 查看铭曦标准职级定义
          </span>
          {showDefinitions && (
            <div style={{ marginTop: 10 }}>
              {standard_grades.map(sg => (
                <div key={sg} style={{ fontSize: 12, padding: '4px 0', color: 'var(--text-secondary)' }}>
                  <strong>{sg}</strong>：{standard_grade_definitions[sg] || ''}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ===== 区块二：人员级别明细 ===== */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <span style={{ fontSize: 15, fontWeight: 700 }}>人员级别明细</span>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>基于绩效数据，AI 建议部分员工调整对标级别</span>
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 16 }}>
          点击职级行展开查看该级别下的员工明细
        </div>

        {grade_table.map(g => {
          const group = employees_by_grade[g.company_grade];
          if (!group) return null;
          const isOpen = expandedGrades.has(g.company_grade);
          const showAll = showAllEmployees.has(g.company_grade);
          const std = getStandardGrade(g.company_grade, g.standard_grade);
          const sugCount = group.suggestion_count;
          const noSuggestion = sugCount === 0;

          // 超过阈值时，默认只展示有建议的 + 部分
          const displayEmps = showAll ? group.employees
            : group.total > THRESHOLD
              ? group.employees.filter(e => e.has_suggestion)
              : group.employees;
          const hiddenCount = group.total - displayEmps.length;

          return (
            <div key={g.company_grade} style={{ border: '1px solid var(--border)', borderRadius: 8, marginBottom: 8, overflow: 'hidden' }}>
              {/* 折叠头 */}
              <div
                style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '12px 16px', cursor: 'pointer',
                  background: isOpen ? '#FEFCF8' : '#fff',
                }}
                onClick={() => toggleGrade(g.company_grade)}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 10, color: 'var(--text-muted)', transform: isOpen ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s' }}>▶</span>
                  <span style={{ fontWeight: 600 }}>{g.company_grade}</span>
                  <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>→ {std}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 12 }}>
                  {noSuggestion
                    ? <span style={{ color: 'var(--green)' }}>无调整建议</span>
                    : <span style={{ color: '#b45309' }}>{sugCount} 人建议调整</span>
                  }
                  <span style={{ color: 'var(--text-muted)' }}>{group.total} 人</span>
                </div>
              </div>

              {/* 展开内容 */}
              {isOpen && (
                <div style={{ borderTop: '1px solid var(--border)' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ background: '#f9fafb' }}>
                        <th style={{ textAlign: 'left', padding: '8px 16px', fontSize: 11, color: 'var(--text-muted)', fontWeight: 500 }}>工号</th>
                        <th style={{ textAlign: 'left', padding: '8px', fontSize: 11, color: 'var(--text-muted)', fontWeight: 500 }}>岗位</th>
                        <th style={{ textAlign: 'center', padding: '8px', fontSize: 11, color: 'var(--text-muted)', fontWeight: 500 }}>绩效</th>
                        <th style={{ textAlign: 'left', padding: '8px', fontSize: 11, color: 'var(--text-muted)', fontWeight: 500 }}>对标级别</th>
                        <th style={{ textAlign: 'right', padding: '8px 16px', fontSize: 11, color: 'var(--text-muted)', fontWeight: 500 }}>调整原因</th>
                      </tr>
                    </thead>
                    <tbody>
                      {displayEmps.map(emp => {
                        const isEditing = editingRow === emp.row_number;
                        const displayGrade = emp.suggested_grade || emp.mapped_grade;

                        return (
                          <tr
                            key={emp.row_number}
                            style={{
                              background: emp.has_suggestion ? '#FFFBEB' : '#fff',
                              borderBottom: '1px solid #f5f5f5',
                              cursor: 'pointer',
                            }}
                            onClick={() => setEditingRow(emp.row_number)}
                          >
                            <td style={{ padding: '10px 16px', fontSize: 12 }}>{emp.id}</td>
                            <td style={{ padding: '10px 8px', fontSize: 12 }}>{emp.job_title}</td>
                            <td style={{ textAlign: 'center', padding: '10px 8px', fontSize: 12, fontWeight: emp.performance === 'A' || emp.performance === 'C' ? 600 : 400, color: emp.performance === 'A' ? 'var(--green)' : emp.performance === 'C' ? 'var(--red)' : 'var(--text-secondary)' }}>
                              {emp.performance}
                            </td>
                            <td style={{ padding: '10px 8px' }}>
                              {emp.has_suggestion || isEditing ? (
                                <select
                                  defaultValue={displayGrade}
                                  style={{ padding: '4px 8px', border: '1px solid var(--border)', borderRadius: 4, fontSize: 12, background: '#fff' }}
                                  onClick={e => e.stopPropagation()}
                                >
                                  {emp.suggested_grade && emp.suggested_grade !== emp.mapped_grade && (
                                    <option value={emp.suggested_grade}>
                                      {emp.suggested_grade.includes('高') || (standard_grades.indexOf(emp.suggested_grade) > standard_grades.indexOf(emp.mapped_grade)) ? '↑' : '↓'} {emp.suggested_grade}
                                    </option>
                                  )}
                                  <option value={emp.mapped_grade}>{emp.mapped_grade}</option>
                                  {standard_grades.filter(sg => sg !== emp.mapped_grade && sg !== emp.suggested_grade).map(sg => (
                                    <option key={sg} value={sg}>{sg}</option>
                                  ))}
                                </select>
                              ) : (
                                <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{emp.mapped_grade}</span>
                              )}
                            </td>
                            <td style={{ textAlign: 'right', padding: '10px 16px' }}>
                              {emp.signals.length > 0 && (
                                <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 10, background: '#FEF3C7', color: '#92400E' }}>
                                  {emp.signals[0]}
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>

                  {!showAll && hiddenCount > 0 && (
                    <div
                      style={{ padding: '10px 16px', fontSize: 12, color: 'var(--text-muted)', cursor: 'pointer', textAlign: 'center', borderTop: '1px solid #f5f5f5' }}
                      onClick={(e) => { e.stopPropagation(); setShowAllEmployees(prev => { const n = new Set(prev); n.add(g.company_grade); return n; }); }}
                    >
                      ... 另有 {hiddenCount} 名员工维持"{std}"不变，点击展开
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <button className="next-step-btn" onClick={onNext}>确认匹配，下一步 →</button>
    </div>
  );
}
