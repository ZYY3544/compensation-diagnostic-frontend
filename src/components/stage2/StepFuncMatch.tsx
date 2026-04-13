import { useState } from 'react';

interface FamilyRow { source_name: string; count: number; standard_family: string; status: string; }
interface EmpRow { row_number: number; id: string; job_title: string; current_subfunction: string; is_mismatch: boolean; suggested_family: string | null; mismatch_reason: string | null; }
interface SubRow { sub_source_name: string; count: number; standard_subfunction: string; available_subfunctions: string[]; mismatch_count: number; employees: EmpRow[]; }
interface SubDetail { family: string; sub_rows: SubRow[]; total: number; mismatch_count: number; }

interface StepFuncMatchProps {
  funcData: {
    family_table: FamilyRow[];
    sub_details: Record<string, SubDetail>;
    standard_families: Record<string, string[]>;
    family_definitions: Record<string, string>;
    subfunction_definitions: Record<string, string>;
    data_source: string;
  } | null;
  onNext: () => void;
}

export default function StepFuncMatch({ funcData, onNext }: StepFuncMatchProps) {
  const [expandedFamilies, setExpandedFamilies] = useState<Set<string>>(new Set());
  const [expandedSubs, setExpandedSubs] = useState<Set<string>>(new Set());
  const [showDefinitions, setShowDefinitions] = useState(false);
  const [editingRow, setEditingRow] = useState<number | null>(null);

  if (!funcData) {
    return (
      <div className="wizard-content">
        <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 6 }}>职能匹配</h3>
        <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '60px 0' }}>Sparky 正在匹配职能...</div>
      </div>
    );
  }

  const { family_table, sub_details, standard_families, family_definitions, subfunction_definitions } = funcData;
  const familyList = Object.keys(standard_families);

  const toggleFamily = (name: string) => {
    setExpandedFamilies(prev => { const n = new Set(prev); n.has(name) ? n.delete(name) : n.add(name); return n; });
  };
  const toggleSub = (key: string) => {
    setExpandedSubs(prev => { const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n; });
  };

  return (
    <div className="wizard-content">
      <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>职能匹配</h3>
      <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 24 }}>
        将岗位归到标准职能类别，用于后续按职能做市场薪酬对标
      </div>

      {/* ===== 区块一：职位族映射总览 ===== */}
      <div style={{ background: '#FAFAFA', border: '1px solid var(--border)', borderRadius: 8, padding: '20px 24px', marginBottom: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <span style={{ fontSize: 15, fontWeight: 700 }}>职位族映射总览</span>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>AI 已预匹配，请确认或调整</span>
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border)' }}>
              <th style={{ textAlign: 'left', padding: '8px 0', fontSize: 12, color: 'var(--text-muted)', fontWeight: 500 }}>来源名称</th>
              <th style={{ textAlign: 'center', padding: '8px 0', fontSize: 12, color: 'var(--text-muted)', fontWeight: 500 }}>人数</th>
              <th style={{ textAlign: 'left', padding: '8px 0', fontSize: 12, color: 'var(--text-muted)', fontWeight: 500 }}>标准职位族</th>
              <th style={{ textAlign: 'right', padding: '8px 0', fontSize: 12, color: 'var(--text-muted)', fontWeight: 500 }}>状态</th>
            </tr>
          </thead>
          <tbody>
            {family_table.map(f => (
              <tr key={f.source_name} style={{ borderBottom: '1px solid #f0f0f0' }}>
                <td style={{ padding: '14px 0', fontWeight: 600, fontSize: 14 }}>{f.source_name}</td>
                <td style={{ textAlign: 'center', color: 'var(--text-secondary)', fontSize: 13 }}>{f.count} 人</td>
                <td style={{ padding: '14px 0' }}>
                  <select defaultValue={f.standard_family} style={{ width: '100%', padding: '8px 12px', border: '1px solid var(--border)', borderRadius: 6, fontSize: 13, background: '#fff' }}>
                    {familyList.map(fam => <option key={fam} value={fam}>{fam}</option>)}
                  </select>
                </td>
                <td style={{ textAlign: 'right', fontSize: 12 }}><span style={{ color: 'var(--green)' }}>✓ 已匹配</span></td>
              </tr>
            ))}
          </tbody>
        </table>

        <div style={{ marginTop: 16, borderTop: '1px solid var(--border)', paddingTop: 12 }}>
          <span style={{ fontSize: 12, color: 'var(--blue)', cursor: 'pointer' }} onClick={() => setShowDefinitions(!showDefinitions)}>
            {showDefinitions ? '▾' : '▸'} 查看铭曦标准职位族/职位类定义
          </span>
          {showDefinitions && (
            <div style={{ marginTop: 10 }}>
              {Object.entries(standard_families).map(([fam, subs]) => (
                <div key={fam} style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{fam} <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}>— {family_definitions[fam] || ''}</span></div>
                  <div style={{ fontSize: 11, color: 'var(--text-secondary)', paddingLeft: 12, lineHeight: 1.8 }}>
                    {subs.map(s => <div key={s}>{s}：{subfunction_definitions[s] || ''}</div>)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ===== 区块二 + 三：职位类明细 + 岗位归属 ===== */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <span style={{ fontSize: 15, fontWeight: 700 }}>职位类明细</span>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>按职位族分组</span>
        </div>

        {family_table.map(f => {
          const detail = sub_details[f.source_name];
          if (!detail) return null;
          const isOpen = expandedFamilies.has(f.source_name);

          return (
            <div key={f.source_name} style={{ border: '1px solid var(--border)', borderRadius: 8, marginBottom: 8, overflow: 'hidden' }}>
              <div
                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', cursor: 'pointer', background: isOpen ? '#FEFCF8' : '#fff' }}
                onClick={() => toggleFamily(f.source_name)}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 10, color: 'var(--text-muted)', transform: isOpen ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s' }}>▶</span>
                  <span style={{ fontWeight: 600 }}>{f.source_name}</span>
                  <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>→ {f.standard_family}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 12 }}>
                  <span style={{ color: 'var(--text-muted)' }}>{detail.sub_rows.length} 个职位类</span>
                  {detail.mismatch_count > 0
                    ? <span style={{ color: '#b45309' }}>{detail.mismatch_count} 人待确认</span>
                    : <span style={{ color: 'var(--green)' }}>无异常</span>}
                  <span style={{ color: 'var(--text-muted)' }}>{detail.total} 人</span>
                </div>
              </div>

              {isOpen && (
                <div style={{ borderTop: '1px solid var(--border)' }}>
                  {detail.sub_rows.map(sub => {
                    const subKey = `${f.source_name}_${sub.sub_source_name}`;
                    const subOpen = expandedSubs.has(subKey);
                    return (
                      <div key={sub.sub_source_name}>
                        <div
                          style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 16px 10px 36px', cursor: 'pointer', borderBottom: '1px solid #f5f5f5' }}
                          onClick={() => toggleSub(subKey)}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ fontSize: 9, color: 'var(--text-muted)', transform: subOpen ? 'rotate(90deg)' : 'none', transition: 'transform 0.2s' }}>▶</span>
                            <span style={{ fontSize: 13 }}>{sub.sub_source_name}</span>
                            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>→</span>
                            <select defaultValue={sub.standard_subfunction} style={{ padding: '4px 8px', border: '1px solid var(--border)', borderRadius: 4, fontSize: 12, background: '#fff' }} onClick={e => e.stopPropagation()}>
                              {sub.available_subfunctions.map(sf => <option key={sf} value={sf}>{sf}</option>)}
                            </select>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
                            {sub.mismatch_count > 0 && <span style={{ color: '#b45309' }}>{sub.mismatch_count} 待确认</span>}
                            <span style={{ color: 'var(--text-muted)' }}>{sub.count} 人</span>
                          </div>
                        </div>

                        {subOpen && (
                          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                              <tr style={{ background: '#f9fafb' }}>
                                <th style={{ textAlign: 'left', padding: '6px 16px 6px 52px', fontSize: 11, color: 'var(--text-muted)', fontWeight: 500 }}>工号</th>
                                <th style={{ textAlign: 'left', padding: '6px 8px', fontSize: 11, color: 'var(--text-muted)', fontWeight: 500 }}>岗位名称</th>
                                <th style={{ textAlign: 'left', padding: '6px 8px', fontSize: 11, color: 'var(--text-muted)', fontWeight: 500 }}>当前职位类</th>
                                <th style={{ textAlign: 'right', padding: '6px 16px', fontSize: 11, color: 'var(--text-muted)', fontWeight: 500 }}>调整原因</th>
                              </tr>
                            </thead>
                            <tbody>
                              {sub.employees.map(emp => {
                                const isEditing = editingRow === emp.row_number;
                                return (
                                  <tr key={emp.row_number} style={{ background: emp.is_mismatch ? '#FFFBEB' : '#fff', borderBottom: '1px solid #f5f5f5', cursor: 'pointer' }} onClick={() => setEditingRow(emp.row_number)}>
                                    <td style={{ padding: '8px 16px 8px 52px', fontSize: 12 }}>{emp.id}</td>
                                    <td style={{ padding: '8px', fontSize: 12 }}>{emp.job_title}</td>
                                    <td style={{ padding: '8px' }}>
                                      {emp.is_mismatch || isEditing ? (
                                        <select defaultValue={emp.current_subfunction} style={{ padding: '3px 6px', border: '1px solid var(--border)', borderRadius: 4, fontSize: 11, background: '#fff' }} onClick={e => e.stopPropagation()}>
                                          {sub.available_subfunctions.map(sf => <option key={sf} value={sf}>{sf}</option>)}
                                        </select>
                                      ) : (
                                        <span style={{ fontSize: 12 }}>{emp.current_subfunction}</span>
                                      )}
                                    </td>
                                    <td style={{ textAlign: 'right', padding: '8px 16px' }}>
                                      {emp.is_mismatch && emp.mismatch_reason && (
                                        <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 10, background: '#FEF3C7', color: '#92400E' }}>{emp.mismatch_reason}</span>
                                      )}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        )}
                      </div>
                    );
                  })}
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
