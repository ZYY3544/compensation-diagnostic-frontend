/**
 * Hay 8 因子档位定义。
 *
 * 用途：FactorTable 下拉项 hover 时浮出该档完整定义；当前选中档+上下相邻 1 档默认展开。
 *
 * 来源：基于后端 prompts/extract_pk.py 的 PK_LEVEL_GUIDE + Hay 标准方法论编写。
 * 这里只覆盖每个因子的"基础档位"（不带 ± 符号），符号档位 hover 时会自动 fallback
 * 到对应基础档（例如 D- 显示 D 的定义 + "偏弱"标记）。
 *
 * 注：版权问题用户已确认先不用管，这里直接展示给最终用户。
 */

export interface FactorLevelDef {
  level: string;       // 基础档位（'A' 'B' '1' 'I' 等，不带 ± 符号）
  label: string;       // 一句话标题
  description: string; // 完整描述（可多行）
}

/** Practical Knowledge（专业知识技能 PK）：27 档 = 9 字母 × 3 符号 */
export const PK_DEFINITIONS: FactorLevelDef[] = [
  { level: 'A', label: '操作工 / 前台', description: '体力劳动 / 简单服务 / 流水线作业；几乎不需要专业训练，按既定流程执行。' },
  { level: 'B', label: '基础事务', description: '高中以上即可，掌握简单办公或固定流程。例：出纳、文员、客服、初级行政。' },
  { level: 'C', label: '专业入门', description: '大专 / 本科基础专业知识，2 年内能上手。例：初级工程师、会计、HR 专员。' },
  { level: 'D', label: '专业熟练', description: '本科 + 3-5 年专业经验，能独立承担岗位职责。例：资深工程师、财务经理、HR 经理。' },
  { level: 'E', label: '专业骨干', description: '6-10 年深度积累，能解决复杂专业问题。例：专家级工程师、总监级专业岗。' },
  { level: 'F', label: '领域专家', description: '10+ 年深度专精，行业内有声誉，能引领专业方向。例：首席专家、总经理级。' },
  { level: 'G', label: '跨域专家', description: '跨多个专业领域的深度整合，公司级技术 / 业务领头人。例：VP 级。' },
  { level: 'H', label: '战略级', description: '多业务单元 / 大集团核心专业领导。例：CTO / CFO / COO 级。' },
  { level: 'I', label: '顶级权威', description: '行业级或国家级权威，几乎不存在于普通公司。例：首席科学家、院士。' },
];

/** Managerial Knowledge（管理知识 MK）：T + I-IX 共 10 档 */
export const MK_DEFINITIONS: FactorLevelDef[] = [
  { level: 'T', label: '基础任务', description: '只对单一任务负责，不需要协调他人。例：流水线工人、单一岗位执行者。' },
  { level: 'I', label: '同质活动', description: '负责性质相似的若干任务，需基础时间安排。例：行政专员、初级工程师。' },
  { level: 'II', label: '相关活动', description: '协调若干相关但不同性质的活动。例：团队主管、项目协调员。' },
  { level: 'III', label: '同类业务', description: '管理同一职能内的多个活动，理解整体业务流程。例：部门经理。' },
  { level: 'IV', label: '相异活动', description: '横跨若干不同职能 / 业务领域，需要业务整合能力。例：资深经理、跨职能负责人。' },
  { level: 'V', label: '业务单元', description: '负责一个完整业务单元的运营，需理解多职能协同。例：BU 总监、事业部副总。' },
  { level: 'VI', label: '战略业务', description: '管理多个业务单元，需要战略思维和资源调配能力。例：VP 级、子公司总经理。' },
  { level: 'VII', label: '集团核心', description: '负责集团级核心业务板块，影响公司整体战略。例：集团高级 VP、CXO。' },
  { level: 'VIII', label: '集团战略', description: '集团战略与多业务板块统筹，董事会下战略决策层。例：CEO 候选层。' },
  { level: 'IX', label: '顶级领导', description: '集团最高决策者，对整个组织战略与生存负责。例：董事长、CEO。' },
];

/** Communication（沟通 Comm）：1 / 2 / 3 共 3 档 */
export const COMM_DEFINITIONS: FactorLevelDef[] = [
  { level: '1', label: '基础沟通', description: '常规事务性沟通，传达信息、倾听需求。例：内部协作、客户答疑。' },
  { level: '2', label: '影响沟通', description: '需要说服、协商、解释复杂议题。例：销售谈判、项目推进、跨部门协调。' },
  { level: '3', label: '战略沟通', description: '高阶谈判、对外代表组织、塑造关键关系。例：高管层谈判、公关代言、董事会沟通。' },
];

/** Thinking Challenge（思维挑战 TC）：1-5 共 5 档 */
export const TC_DEFINITIONS: FactorLevelDef[] = [
  { level: '1', label: '重复 / 简单', description: '执行高度结构化、有明确答案的任务。例：标准操作、按 SOP 处理。' },
  { level: '2', label: '模式选择', description: '在已知方案中选择应用，需基本判断。例：常规问题诊断、标准流程优化。' },
  { level: '3', label: '解释适配', description: '需要解读情境、调整既有方法适配新场景。例：项目管理决策、专业问题分析。' },
  { level: '4', label: '分析创新', description: '处理无明显先例的复杂问题，需要分析框架和创造性思考。例：战略规划、商业模式设计。' },
  { level: '5', label: '前瞻战略', description: '面对完全未知 / 高度不确定情境，需开创性思维。例：颠覆性创新、行业重塑。' },
];

/** Thinking Environment（思维环境 TE）：A-H 共 8 档 */
export const TE_DEFINITIONS: FactorLevelDef[] = [
  { level: 'A', label: '严格规则', description: '在严格规则、SOP 之内思考，几乎无自主判断空间。' },
  { level: 'B', label: '常规指引', description: '在常规指引下思考，少量自主判断。' },
  { level: 'C', label: '基础流程', description: '在基础流程框架内思考，对方法选择有一定自主权。' },
  { level: 'D', label: '专业方法', description: '在专业方法论框架内思考，可基于专业判断决策。' },
  { level: 'E', label: '功能政策', description: '在职能政策范围内思考，需要理解业务原则。' },
  { level: 'F', label: '业务策略', description: '在业务策略框架内思考，对业务方向有判断空间。' },
  { level: 'G', label: '组织战略', description: '在组织整体战略下思考，影响关键资源和方向。' },
  { level: 'H', label: '哲学愿景', description: '在最高层战略愿景层面思考，需开创新方向。' },
];

/** Freedom to Act（行动自由度 FTA）：A-I 共 9 档 */
export const FTA_DEFINITIONS: FactorLevelDef[] = [
  { level: 'A', label: '严格指令', description: '在严格指令下行动，每个决策都需上级确认。' },
  { level: 'B', label: '常规监督', description: '在常规监督下，按 SOP 自主执行。' },
  { level: 'C', label: '专业指引', description: '按专业指引行动，常规决策可自主。' },
  { level: 'D', label: '一般指导', description: '在一般指导下行动，结果责任开始上升。' },
  { level: 'E', label: '方向指引', description: '只接受方向性指引，自主完成全程。' },
  { level: 'F', label: '广泛授权', description: '在广泛授权下行动，对结果负总责。' },
  { level: 'G', label: '战略目标', description: '只接受战略目标，自主决定路径和资源。' },
  { level: 'H', label: '愿景框架', description: '在愿景框架下完全自主，对组织方向负责。' },
  { level: 'I', label: '完全自主', description: '不接受外部指示，自主定义目标本身。' },
];

/** Magnitude（影响范围 Mag）：N + 1-5 共 6 档 */
export const MAG_DEFINITIONS: FactorLevelDef[] = [
  { level: 'N', label: '不可量化', description: '岗位影响无法用具体数额衡量；适用于非营收类岗位。' },
  { level: '1', label: '小规模', description: '影响金额量级在小数额范围（具体阈值随公司规模不同）。' },
  { level: '2', label: '部门级', description: '影响金额覆盖部门级营收 / 成本。' },
  { level: '3', label: '业务单元', description: '影响金额覆盖一个业务单元的营收 / 成本。' },
  { level: '4', label: '公司级', description: '影响金额覆盖公司整体营收 / 成本。' },
  { level: '5', label: '集团级', description: '影响金额覆盖集团整体或行业级。' },
];

/** Nature of Impact（影响性质 NoI）：I-VI + R/C/S/P 共 10 档 */
export const NOI_DEFINITIONS: FactorLevelDef[] = [
  { level: 'I', label: '辅助性', description: '提供辅助服务，对结果有间接、低影响。' },
  { level: 'II', label: '解释性', description: '解释信息、传递知识，影响决策但不直接造成结果。' },
  { level: 'III', label: '咨询贡献', description: '提供专业咨询和分析，明显影响业务决策。' },
  { level: 'IV', label: '共担责任', description: '与他人共同对结果负责，是关键贡献者之一。' },
  { level: 'V', label: '主要责任', description: '主要负责结果，承担主要责任。' },
  { level: 'VI', label: '完全责任', description: '完全负责结果，承担所有责任。' },
  { level: 'R', label: '远程贡献', description: '通过较远距离 / 间接方式对营收类目标产生贡献。' },
  { level: 'C', label: '协同贡献', description: '通过协同合作对营收类目标产生贡献。' },
  { level: 'S', label: '共享贡献', description: '通过共享资源 / 渠道对营收类目标产生贡献。' },
  { level: 'P', label: '主要贡献', description: '直接对营收类目标产生主要贡献，结果可量化归因。' },
];

// ---- 因子 → 定义表的映射 ----
const FACTOR_DEFS: Record<string, FactorLevelDef[]> = {
  practical_knowledge: PK_DEFINITIONS,
  managerial_knowledge: MK_DEFINITIONS,
  communication: COMM_DEFINITIONS,
  thinking_challenge: TC_DEFINITIONS,
  thinking_environment: TE_DEFINITIONS,
  freedom_to_act: FTA_DEFINITIONS,
  magnitude: MAG_DEFINITIONS,
  nature_of_impact: NOI_DEFINITIONS,
};

/**
 * 取一个档位的定义。优先精确匹配（完全相同的字符串），否则去掉 ± 符号取基础档。
 * 找不到返回 null（前端兜底显示"暂无定义"）。
 */
export function getLevelDefinition(factor: string, level: string): FactorLevelDef | null {
  const defs = FACTOR_DEFS[factor];
  if (!defs) return null;

  // 精确匹配
  const exact = defs.find(d => d.level === level);
  if (exact) return exact;

  // 去 ± 符号匹配基础档
  const baseLevel = level.replace(/[+-]$/, '');
  const base = defs.find(d => d.level === baseLevel);
  if (!base) return null;

  // 加上 ± 标识返回（保持原 description，仅 label 加偏强 / 偏弱）
  const suffix = level.endsWith('+') ? '（偏强）' : level.endsWith('-') ? '（偏弱）' : '';
  return suffix
    ? { ...base, label: base.label + suffix }
    : base;
}

/**
 * 取一个档位的"上下相邻 1 档"定义，用于 FactorTable 默认展开当前档 + 邻档对比。
 * 返回 [上一档, 当前档, 下一档]（每个可能为 null）。
 */
export function getAdjacentDefinitions(factor: string, level: string): {
  prev: FactorLevelDef | null;
  current: FactorLevelDef | null;
  next: FactorLevelDef | null;
} {
  const defs = FACTOR_DEFS[factor];
  if (!defs) return { prev: null, current: null, next: null };

  const baseLevel = level.replace(/[+-]$/, '');
  const idx = defs.findIndex(d => d.level === baseLevel);
  if (idx < 0) return { prev: null, current: null, next: null };

  return {
    prev: idx > 0 ? defs[idx - 1] : null,
    current: getLevelDefinition(factor, level),
    next: idx < defs.length - 1 ? defs[idx + 1] : null,
  };
}
