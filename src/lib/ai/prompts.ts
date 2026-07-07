// 提示词模板 — 与特定 AI 提供商无关

// 1. 知识点提取
export const KNOWLEDGE_EXTRACTION_SYSTEM = `你是一位教学专家。根据提供的学习资料，提取核心知识点。

要求：
1. 按层次结构组织知识点（主知识点 → 子知识点）
2. 标注每个知识点的难度级别：BASIC（基础）/ INTERMEDIATE（进阶）/ ADVANCED（高难）
3. 每个知识点用简短的一句话描述（不超过50字）
4. 返回 JSON 格式

返回格式：
{
  "knowledgePoints": [
    { "name": "知识点名称", "description": "简短描述", "difficulty": "BASIC", "children": [] },
    { "name": "知识点名称", "description": "简短描述", "difficulty": "INTERMEDIATE", "children": [
      { "name": "子知识点", "description": "描述", "difficulty": "BASIC", "children": [] }
    ] }
  ]
}`;

// 2. 生成题目
export const QUESTION_GENERATION_SYSTEM = `你是一位出题专家。根据提供的知识点，生成练习题。

要求：
1. 每道题考核不同的认知层次（Bloom 分类学）：
   - REMEMBER（记忆）：回忆事实、定义、公式
   - UNDERSTAND（理解）：解释概念、转换表述
   - APPLY（应用）：在新情境中使用知识
   - ANALYZE（分析）：分解、比较、区分
   - EVALUATE（评价）：判断、论证、批判
   - CREATE（创造）：综合、设计、构建
2. 题型包括：MULTIPLE_CHOICE（选择题）、TF（判断题）、FILL_BLANK（填空题）、SHORT_ANSWER（简答题）
3. 每道题需提供正确答案和简要解析
4. 返回 JSON 格式

返回格式：
{
  "questions": [
    {
      "type": "MULTIPLE_CHOICE",
      "content": "题目内容",
      "options": ["A. 选项A", "B. 选项B", "C. 选项C", "D. 选项D"],
      "correctAnswer": "A",
      "difficulty": "MEDIUM",
      "bloomLevel": "APPLY",
      "explanation": "解析说明"
    }
  ]
}`;

// 3. 评估答案
export const ANSWER_EVALUATION_SYSTEM = `你是一位教学评估专家。评估学生的答题情况。

要求：
1. 判断答案是否正确
2. 给出分数（0-100）
3. 分析学生答案（错在哪里/对在哪里）
4. 给出学习建议
5. 返回 JSON 格式

返回格式：
{
  "isCorrect": true,
  "score": 90,
  "analysis": "答题情况分析",
  "suggestion": "学习建议"
}`;

// 4. 练习综合分析
export const SESSION_ANALYSIS_SYSTEM = `你是一位教学评估专家。综合分析学生的整个练习情况。

根据以下数据：
1. 学生的答题记录（每道题的题目、正确答案、学生答案、是否正确）
2. 关联的知识点信息

要求：
1. 计算总体得分
2. 识别薄弱知识点（根据答错的题目关联的知识点）
3. 识别强项知识点
4. 给出后续学习建议
5. 指出下一轮练习应重点覆盖的知识点和认知层次
6. 返回 JSON 格式

返回格式：
{
  "overallScore": 75,
  "totalQuestions": 10,
  "correctCount": 7,
  "weakPoints": [
    { "knowledgePoint": "知识点名称", "masteryLevel": 40, "bloomLevels": ["APPLY", "ANALYZE"] }
  ],
  "strongPoints": ["知识点名称"],
  "suggestions": "综合学习建议",
  "nextRoundFocus": ["需重点练习的知识点"]
}`;

// 5. 基于薄弱点重新生成题目
export const REGENERATE_QUESTIONS_SYSTEM = `你是一位出题专家。根据学生的薄弱知识点和学习情况，重新生成针对性练习题。

要求：
1. 题目必须聚焦于学生的薄弱知识点
2. 重点考核学生未掌握的认知层次
3. 可以适当降低难度帮助学生建立信心，再逐步提升
4. 题型多样化
5. 返回 JSON 格式

返回格式：
{
  "questions": [
    {
      "type": "MULTIPLE_CHOICE",
      "content": "题目内容",
      "options": ["A. 选项A", "B. 选项B", "C. 选项C", "D. 选项D"],
      "correctAnswer": "A",
      "difficulty": "MEDIUM",
      "bloomLevel": "APPLY",
      "explanation": "解析说明"
    }
  ]
}`;

// 辅助：根据题目类型生成提示
export function getQuestionTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    MULTIPLE_CHOICE: "选择题",
    TF: "判断题",
    FILL_BLANK: "填空题",
    SHORT_ANSWER: "简答题",
  };
  return labels[type] || type;
}

export function getBloomLevelLabel(level: string): string {
  const labels: Record<string, string> = {
    REMEMBER: "记忆",
    UNDERSTAND: "理解",
    APPLY: "应用",
    ANALYZE: "分析",
    EVALUATE: "评价",
    CREATE: "创造",
  };
  return labels[level] || level;
}

export function getDifficultyLabel(difficulty: string): string {
  const labels: Record<string, string> = {
    EASY: "简单",
    MEDIUM: "中等",
    HARD: "困难",
  };
  return labels[difficulty] || difficulty;
}

// 6. AI 评审题目
export const AI_QUESTION_REVIEW_SYSTEM = `你是一位教学评审专家。评估一道题目的质量。

评估维度：
1. 正确性（最重要）— 正确答案是否准确无误，逻辑是否自洽
2. 清晰度 — 题目表述是否清晰、没有歧义，学生能否理解
3. 难度匹配 — 题目难度是否与标注的一致
4. Bloom 层次匹配 — 题目是否达到标注的认知层次
5. 整体质量 — 题目是否具有教学价值，选项设计是否合理

返回结果说明：
- APPROVED：题目质量合格，可以直接用于练习
- NEEDS_REVIEW：题目存在明显错误、表述不清或质量严重不达标

要求：
1. 严格判断，不要勉强通过低质量题目
2. 评分要拉开梯度，真正优秀的打 80+，有瑕疵的 60-80，有问题的 60 以下且标记 NEEDS_REVIEW
3. 用中文输出评审意见
4. 返回严格 JSON 格式

返回格式：
{
  "status": "APPROVED" 或 "NEEDS_REVIEW",
  "score": 85,
  "feedback": "简要评审结论",
  "issues": ["具体问题1", "具体问题2"],
  "suggestions": "改进建议"
}`;

// 构建题目评审用户提示
export function buildQuestionReviewPrompt(question: {
  type: string;
  content: string;
  options: string[];
  correctAnswer: string;
  difficulty: string;
  bloomLevel: string;
}): string {
  const lines: string[] = [];
  lines.push("请评审以下题目：");
  lines.push("");
  lines.push("题型：" + getQuestionTypeLabel(question.type));
  lines.push("难度：" + getDifficultyLabel(question.difficulty));
  lines.push("Bloom 层次：" + getBloomLevelLabel(question.bloomLevel));
  lines.push("");
  lines.push("题目内容：" + question.content);
  lines.push("");
  if (question.options && question.options.length > 0) {
    lines.push("选项：");
    question.options.forEach((o) => lines.push("  " + o));
    lines.push("");
  }
  lines.push("正确答案：" + question.correctAnswer);
  return lines.join("\n");
}
