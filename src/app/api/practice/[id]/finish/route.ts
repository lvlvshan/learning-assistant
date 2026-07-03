import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthFromRequest, unauthorizedResponse } from "@/lib/auth";
import { chatWithJSON } from "@/lib/ai/provider";
import { SESSION_ANALYSIS_SYSTEM } from "@/lib/ai/prompts";
import { SessionAnalysisResult } from "@/lib/ai/types";

// POST /api/practice/[id]/finish - 完成练习 + AI 分析
export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = getAuthFromRequest(request);
  if (!auth) return unauthorizedResponse();

  const { id } = await context.params;

  const session = await prisma.exerciseSession.findUnique({
    where: { id },
    include: {
      answers: {
        include: { question: { include: { knowledgePoint: true } } },
      },
      subject: true,
    },
  });

  if (!session) {
    return NextResponse.json({ error: "练习不存在" }, { status: 404 });
  }

  if (auth.role === "STUDENT" && session.studentId !== auth.userId) {
    return NextResponse.json({ error: "无权限" }, { status: 403 });
  }

  if (session.status === "COMPLETED") {
    return NextResponse.json({ error: "练习已结束" }, { status: 400 });
  }

  const score = session.score;
  const passed = score >= 90;

  // AI 分析
  let analysis: SessionAnalysisResult | null = null;
  try {
    const answerDetails = session.answers.map(a => ({
      题目: a.question.content,
      正确答案: a.question.correctAnswer,
      学生答案: a.studentAnswer,
      是否正确: a.isCorrect,
      知识点: a.question.knowledgePoint?.name || "未知",
      Bloom层次: a.question.bloomLevel,
    }));

    analysis = await chatWithJSON<SessionAnalysisResult>(
      SESSION_ANALYSIS_SYSTEM,
      JSON.stringify(answerDetails, null, 2)
    );
  } catch (error) {
    console.error("AI analysis error:", error);
    // AI 分析失败时使用简单统计
    analysis = {
      overallScore: score,
      totalQuestions: session.totalQuestions,
      correctCount: session.correctCount,
      weakPoints: [],
      strongPoints: [],
      suggestions: "AI 分析暂不可用，请联系老师",
      nextRoundFocus: [],
    };
  }

  // 更新会话状态
  await prisma.exerciseSession.update({
    where: { id },
    data: {
      status: "COMPLETED",
      completedAt: new Date(),
      weaknessData: JSON.stringify(analysis),
    },
  });

  // 更新学生薄弱知识点
  if (analysis.weakPoints.length > 0) {
    for (const wp of analysis.weakPoints) {
      const kp = await prisma.knowledgePoint.findFirst({
        where: { name: { contains: wp.knowledgePoint }, subjectId: session.subjectId },
      });
      if (kp) {
        const existing = await prisma.studentWeakness.findFirst({
          where: {
            studentId: session.studentId,
            knowledgePointId: kp.id,
          },
        });

        if (existing) {
          await prisma.studentWeakness.update({
            where: { id: existing.id },
            data: {
              masteryLevel: Math.round(wp.masteryLevel),
              lastPracticedAt: new Date(),
            },
          });
        } else {
          await prisma.studentWeakness.create({
            data: {
              studentId: session.studentId,
              knowledgePointId: kp.id,
              masteryLevel: Math.round(wp.masteryLevel),
              bloomBreakdown: JSON.stringify({}),
            },
          });
        }

        // 记录掌握度变化
        await prisma.masteryRecord.create({
          data: {
            studentId: session.studentId,
            knowledgePointId: kp.id,
            sessionId: id,
            previousLevel: 0,
            newLevel: Math.round(wp.masteryLevel),
            delta: Math.round(wp.masteryLevel),
          },
        });
      }
    }
  }

  return NextResponse.json({
    session: {
      id: session.id,
      totalQuestions: session.totalQuestions,
      correctCount: session.correctCount,
      score,
      passed,
    },
    analysis,
  });
}
