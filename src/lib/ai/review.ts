import { prisma } from "@/lib/prisma";
import { chatWithJSON, isAIAvailable } from "@/lib/ai/provider";
import { AI_QUESTION_REVIEW_SYSTEM, buildQuestionReviewPrompt } from "@/lib/ai/prompts";
import { QuestionReviewResult } from "@/lib/ai/types";

interface QuestionReviewInput {
  id: string;
  type: string;
  content: string;
  options: string[];
  correctAnswer: string;
  difficulty: string;
  bloomLevel: string;
}

interface BatchReviewResult {
  reviews: { questionId: string; review: QuestionReviewResult }[];
  stats: { total: number; approved: number; needsReview: number; skipped: number };
}

// 创建降级结果（AI 不可用时）
function createFallbackResult(): QuestionReviewResult {
  return {
    status: "APPROVED",
    score: 0,
    feedback: "AI 服务未配置，跳过评审",
    issues: [],
    suggestions: "请配置 AI 提供商后重新评审",
  };
}

// 评审单道题目
export async function reviewSingleQuestion(
  input: QuestionReviewInput
): Promise<QuestionReviewResult> {
  const aiAvailable = await isAIAvailable();
  if (!aiAvailable) {
    return createFallbackResult();
  }

  const userPrompt = buildQuestionReviewPrompt({
    type: input.type,
    content: input.content,
    options: input.options,
    correctAnswer: input.correctAnswer,
    difficulty: input.difficulty,
    bloomLevel: input.bloomLevel,
  });

  const result = await chatWithJSON<QuestionReviewResult>(
    AI_QUESTION_REVIEW_SYSTEM,
    userPrompt
  );

  // 验证并规范化返回结果
  return {
    status: result.status === "NEEDS_REVIEW" ? "NEEDS_REVIEW" : "APPROVED",
    score: Math.max(0, Math.min(100, result.score || 0)),
    feedback: result.feedback || "",
    issues: Array.isArray(result.issues) ? result.issues : [],
    suggestions: result.suggestions || "",
  };
}

// 批量评审题目并保存结果到数据库
export async function aiReviewQuestions(
  questionIds: string[]
): Promise<BatchReviewResult> {
  const stats = { total: questionIds.length, approved: 0, needsReview: 0, skipped: 0 };
  const reviews: { questionId: string; review: QuestionReviewResult }[] = [];

  if (questionIds.length === 0) {
    return { reviews, stats };
  }

  // 从数据库获取题目
  const questions = await prisma.question.findMany({
    where: { id: { in: questionIds } },
    select: {
      id: true, type: true, content: true, options: true,
      correctAnswer: true, difficulty: true, bloomLevel: true,
    },
  });

  for (const q of questions) {
    try {
      const input: QuestionReviewInput = {
        id: q.id,
        type: q.type,
        content: q.content,
        options: JSON.parse(q.options || "[]"),
        correctAnswer: q.correctAnswer,
        difficulty: q.difficulty,
        bloomLevel: q.bloomLevel,
      };

      const review = await reviewSingleQuestion(input);
      reviews.push({ questionId: q.id, review });

      // 更新数据库
      await prisma.question.update({
        where: { id: q.id },
        data: {
          aiReviewStatus: review.status,
          aiReviewScore: review.score,
          aiReviewFeedback: review.feedback,
          aiReviewedAt: new Date(),
          // AI 通过时同步设置 reviewedByTeacher（保持练习流程兼容）
          reviewedByTeacher: review.status === "APPROVED",
        },
      });

      if (review.status === "APPROVED") stats.approved++;
      else stats.needsReview++;

      // 间隔 200ms 避免限流
      await new Promise((r) => setTimeout(r, 200));
    } catch (err) {
      console.error(`AI review failed for question ${q.id}:`, err);
      stats.skipped++;
    }
  }

  return { reviews, stats };
}
