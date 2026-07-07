import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthFromRequest, unauthorizedResponse } from "@/lib/auth";
import { chatWithJSON } from "@/lib/ai/provider";
import { ANSWER_EVALUATION_SYSTEM } from "@/lib/ai/prompts";
import { AnswerEvaluation } from "@/lib/ai/types";

// POST /api/practice/[id]/submit - 提交答案
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = getAuthFromRequest(request);
  if (!auth) return unauthorizedResponse();

  const { id } = await context.params;

  const session = await prisma.exerciseSession.findUnique({ where: { id } });
  if (!session) {
    return NextResponse.json({ error: "练习不存在" }, { status: 404 });
  }

  if (auth.role === "STUDENT" && session.studentId !== auth.userId) {
    return NextResponse.json({ error: "无权限" }, { status: 403 });
  }

  if (session.status === "COMPLETED") {
    return NextResponse.json({ error: "练习已结束" }, { status: 400 });
  }

  try {
    const { questionId, studentAnswer } = await request.json();
    if (!questionId || studentAnswer === undefined || studentAnswer === null) {
      return NextResponse.json({ error: "题目 ID 和答案不能为空" }, { status: 400 });
    }

    // 获取题目
    const question = await prisma.question.findUnique({ where: { id: questionId } });
    if (!question) {
      return NextResponse.json({ error: "题目不存在" }, { status: 404 });
    }

    let isCorrect = false;
    let score = 0;
    let aiFeedback = "";

    // 选择题/判断题 — 自动判卷
    if (question.type === "MULTIPLE_CHOICE" || question.type === "TF") {
      // 判断题：学生发送中文（"对"/"错"），数据库存英文（"TRUE"/"FALSE"），需统一映射
      const normalizeTF = (v: string) => {
        const t = v.trim().toLowerCase();
        if (t === "true" || t === "对") return "TRUE";
        if (t === "false" || t === "错") return "FALSE";
        return t.toUpperCase();
      };
      isCorrect = question.type === "TF"
        ? normalizeTF(studentAnswer) === normalizeTF(question.correctAnswer)
        : studentAnswer.trim().toUpperCase() === question.correctAnswer.trim().toUpperCase();
      score = isCorrect ? 100 : 0;
      aiFeedback = JSON.stringify({
        isCorrect,
        score,
        analysis: isCorrect ? "回答正确！" : `正确答案是：${question.correctAnswer}`,
        suggestion: isCorrect ? "继续保持" : "建议复习相关概念",
      });
    }
    // 填空题 — 先直接比对，如果不同再走 AI
    else if (question.type === "FILL_BLANK") {
      const directMatch =
        studentAnswer.trim().toLowerCase() === question.correctAnswer.trim().toLowerCase();
      if (directMatch) {
        isCorrect = true;
        score = 100;
        aiFeedback = JSON.stringify({ isCorrect: true, score: 100, analysis: "正确！", suggestion: "" });
      } else {
        // AI 评估
        try {
          const evaluation = await chatWithJSON<AnswerEvaluation>(
            ANSWER_EVALUATION_SYSTEM,
            `题目：${question.content}
            正确答案：${question.correctAnswer}
            学生答案：${studentAnswer}
            题型：填空题`
          );
          isCorrect = evaluation.isCorrect;
          score = evaluation.score;
          aiFeedback = JSON.stringify(evaluation);
        } catch {
          // AI 失败时，容错处理
          isCorrect = false;
          score = 0;
          aiFeedback = JSON.stringify({ isCorrect: false, score: 0, analysis: "答案不匹配", suggestion: "" });
        }
      }
    }
    // 简答题 — AI 评估
    else if (question.type === "SHORT_ANSWER") {
      try {
        const evaluation = await chatWithJSON<AnswerEvaluation>(
          ANSWER_EVALUATION_SYSTEM,
          `题目：${question.content}
          正确答案要点：${question.correctAnswer}
          学生答案：${studentAnswer}
          题型：简答题`
        );
        isCorrect = evaluation.isCorrect;
        score = evaluation.score;
        aiFeedback = JSON.stringify(evaluation);
      } catch {
        isCorrect = false;
        score = 50; // 简答题给一半分作为容错
        aiFeedback = JSON.stringify({ isCorrect: false, score: 50, analysis: "AI 评估暂不可用", suggestion: "请联系老师" });
      }
    }

    // 保存答案
    const answer = await prisma.exerciseAnswer.create({
      data: {
        sessionId: id,
        questionId,
        studentAnswer: String(studentAnswer),
        isCorrect,
        score,
        aiFeedback,
      },
    });

    // 更新会话统计
    const allAnswers = await prisma.exerciseAnswer.findMany({ where: { sessionId: id } });
    const correctCount = allAnswers.filter(a => a.isCorrect).length;
    const totalScore = allAnswers.reduce((sum, a) => sum + a.score, 0) / allAnswers.length;

    await prisma.exerciseSession.update({
      where: { id },
      data: {
        correctCount,
        score: Math.round(totalScore),
      },
    });

    return NextResponse.json({
      answer: {
        id: answer.id,
        isCorrect: answer.isCorrect,
        score: answer.score,
        feedback: JSON.parse(answer.aiFeedback),
      },
    });
  } catch (error) {
    console.error("Submit answer error:", error);
    return NextResponse.json({ error: "提交答案失败" }, { status: 500 });
  }
}
