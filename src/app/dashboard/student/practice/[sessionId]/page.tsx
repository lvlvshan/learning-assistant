"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  Card, Button, Radio, Checkbox, Input, Typography, Tag,
  Progress, Space, App, Spin, Steps, Result, Descriptions,
  Alert, Divider, Modal,
} from "antd";
import {
  ArrowLeftOutlined, ArrowRightOutlined, CheckCircleOutlined,
  CloseCircleOutlined, ReloadOutlined, RobotOutlined,
} from "@ant-design/icons";
import apiClient from "@/lib/api";
import { getBloomLevelLabel, getQuestionTypeLabel } from "@/lib/ai/prompts";

interface Question {
  id: string;
  type: string;
  content: string;
  options: string[];
  bloomLevel: string;
  difficulty: string;
  answered: boolean;
}

interface AnswerFeedback {
  isCorrect: boolean;
  score: number;
  analysis: string;
  suggestion: string;
}

export default function PracticeSession() {
  const params = useParams();
  const router = useRouter();
  const { message } = App.useApp();
  const sessionId = params.sessionId as string;

  const [loading, setLoading] = useState(true);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, { answer: string; feedback?: AnswerFeedback }>>({});
  const [currentAnswer, setCurrentAnswer] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [finished, setFinished] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [regenerating, setRegenerating] = useState(false);
  const [sessionInfo, setSessionInfo] = useState<any>(null);

  const currentQuestion = questions[currentIndex];
  const answeredCount = Object.keys(answers).length;
  const progressPercent = Math.round((answeredCount / (questions.length || 1)) * 100);

  const fetchQuestions = useCallback(async () => {
    try {
      const res = await apiClient.get(`/practice/${sessionId}/questions`);
      const data = res.data;
      setSessionInfo(data.session);
      setQuestions(data.questions);
      // 恢复已有答案
      const restored: Record<string, { answer: string; feedback?: AnswerFeedback }> = {};
      for (const a of data.answers) {
        restored[a.questionId] = { answer: a.studentAnswer, feedback: { isCorrect: a.isCorrect, score: a.score, analysis: "", suggestion: "" } };
      }
      setAnswers(restored);
      setLoading(false);
    } catch (error: any) {
      message.error("加载题目失败");
      router.push("/dashboard/student/practice");
    }
  }, [sessionId]);

  useEffect(() => {
    if (sessionId) fetchQuestions();
  }, [sessionId]);

  // 提交答案
  const handleSubmit = async () => {
    if (!currentQuestion || !currentAnswer.trim()) {
      message.warning("请先作答");
      return;
    }

    setSubmitting(true);
    try {
      const res = await apiClient.post(`/practice/${sessionId}/submit`, {
        questionId: currentQuestion.id,
        studentAnswer: currentAnswer,
      });

      const feedback: AnswerFeedback = res.data.answer.feedback;
      setAnswers((prev) => ({
        ...prev,
        [currentQuestion.id]: { answer: currentAnswer, feedback },
      }));

      setCurrentAnswer("");
    } catch (error: any) {
      message.error(error.response?.data?.error || "提交失败");
    } finally {
      setSubmitting(false);
    }
  };

  // 跳到下一题
  const handleNext = () => {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex(currentIndex + 1);
      setCurrentAnswer("");
    }
  };

  // 完成练习
  const handleFinish = async () => {
    setLoading(true);
    Modal.confirm({
      title: "确认完成练习？",
      content: `已作答 ${answeredCount}/${questions.length} 题，未作答的题目将计为错误。`,
      okText: "确认完成",
      cancelText: "继续答题",
      onOk: async () => {
        try {
          const res = await apiClient.post(`/practice/${sessionId}/finish`);
          setResult(res.data);
          setFinished(true);
        } catch (error: any) {
          message.error(error.response?.data?.error || "提交失败");
        } finally {
          setLoading(false);
        }
      },
    });
  };

  // 重新出题
  const handleRegenerate = async () => {
    setRegenerating(true);
    try {
      const res = await apiClient.post(`/practice/${sessionId}/regenerate`);
      const { newSession } = res.data;
      message.success("新题目已生成！");
      router.push(`/dashboard/student/practice/${newSession.id}`);
    } catch (error: any) {
      message.error(error.response?.data?.error || "重新出题失败");
    } finally {
      setRegenerating(false);
    }
  };

  // 渲染题目
  const renderQuestion = (q: Question) => {
    const isAnswered = !!answers[q.id];
    const feedback = answers[q.id]?.feedback;

    switch (q.type) {
      case "MULTIPLE_CHOICE":
        return (
          <Radio.Group
            value={isAnswered ? answers[q.id].answer : currentAnswer}
            onChange={(e) => setCurrentAnswer(e.target.value)}
            disabled={isAnswered}
          >
            <Space direction="vertical" style={{ width: "100%" }}>
              {q.options?.map((opt, i) => (
                <Radio
                  key={i}
                  value={opt.charAt(0)}
                  style={{
                    display: "block",
                    padding: "8px 12px",
                    border: "1px solid #d9d9d9",
                    borderRadius: 6,
                    marginBottom: 8,
                    width: "100%",
                    background: feedback
                      ? opt.charAt(0) === answers[q.id]?.answer?.charAt(0)
                        ? feedback.isCorrect ? "#f6ffed" : "#fff2f0"
                        : "#fff"
                      : "#fff",
                  }}
                >
                  {opt}
                </Radio>
              ))}
            </Space>
          </Radio.Group>
        );

      case "TF":
        return (
          <Radio.Group
            value={isAnswered ? answers[q.id].answer : currentAnswer}
            onChange={(e) => setCurrentAnswer(e.target.value)}
            disabled={isAnswered}
          >
            <Space>
              <Radio value="对" style={{ padding: "8px 24px", border: "1px solid #d9d9d9", borderRadius: 6 }}>对</Radio>
              <Radio value="错" style={{ padding: "8px 24px", border: "1px solid #d9d9d9", borderRadius: 6 }}>错</Radio>
            </Space>
          </Radio.Group>
        );

      case "FILL_BLANK":
        return (
          <Input.TextArea
            rows={3}
            value={isAnswered ? answers[q.id].answer : currentAnswer}
            onChange={(e) => setCurrentAnswer(e.target.value)}
            disabled={isAnswered}
            placeholder="请输入答案..."
          />
        );

      case "SHORT_ANSWER":
        return (
          <Input.TextArea
            rows={5}
            value={isAnswered ? answers[q.id].answer : currentAnswer}
            onChange={(e) => setCurrentAnswer(e.target.value)}
            disabled={isAnswered}
            placeholder="请输入你的回答..."
          />
        );

      default:
        return <Typography.Text>不支持的题型</Typography.Text>;
    }
  };

  if (loading && !finished) {
    return <div style={{ textAlign: "center", padding: 60 }}><Spin size="large" tip="加载题目..." /></div>;
  }

  // 练习结果页
  if (finished && result) {
    return (
      <div style={{ maxWidth: 800, margin: "0 auto" }}>
        <Result
          status={result.session.passed ? "success" : "warning"}
          title={result.session.passed ? "🎉 太棒了！成绩优秀！" : "📚 练习完成"}
          subTitle={
            <span>
              得分：<strong style={{ fontSize: 24, color: result.session.passed ? "#52c41a" : "#faad14" }}>
                {result.session.score}
              </strong> 分
              &nbsp;&nbsp;|&nbsp;&nbsp;
              正确：{result.session.correctCount}/{result.session.totalQuestions}
            </span>
          }
          extra={[
            !result.session.passed && (
              <Button
                key="regenerate"
                type="primary"
                icon={<RobotOutlined />}
                loading={regenerating}
                onClick={handleRegenerate}
                size="large"
              >
                针对薄弱点重新出题
              </Button>
            ),
            <Button key="back" onClick={() => router.push("/dashboard/student/practice")} size="large">
              返回科目列表
            </Button>,
          ]}
        />

        {result.analysis && result.analysis.weakPoints?.length > 0 && (
          <Card title="📊 AI 分析报告" style={{ marginTop: 16 }}>
            <Descriptions column={1} bordered size="small">
              <Descriptions.Item label="总体评价">{result.analysis.suggestions}</Descriptions.Item>
              <Descriptions.Item label="薄弱知识点">
                {result.analysis.weakPoints.map((wp: any, i: number) => (
                  <Tag key={i} color="red" style={{ margin: 2 }}>
                    {wp.knowledgePoint}（掌握度 {wp.masteryLevel}%）
                  </Tag>
                ))}
              </Descriptions.Item>
              <Descriptions.Item label="掌握较好的知识点">
                {result.analysis.strongPoints?.map((sp: string, i: number) => (
                  <Tag key={i} color="green" style={{ margin: 2 }}>{sp}</Tag>
                )) || "无"}
              </Descriptions.Item>
              <Descriptions.Item label="建议重点复习">
                {result.analysis.nextRoundFocus?.map((f: string, i: number) => (
                  <Tag key={i} color="blue" style={{ margin: 2 }}>{f}</Tag>
                )) || "无"}
              </Descriptions.Item>
            </Descriptions>
          </Card>
        )}

        {!result.session.passed && (
          <Alert
            style={{ marginTop: 16 }}
            message="💡 低于 90 分？点击上方「针对薄弱点重新出题」，AI 将为你生成针对性练习题！"
            type="info"
            showIcon
          />
        )}
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 900, margin: "0 auto" }}>
      {/* 顶部进度 */}
      <Card style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
          <Typography.Text strong>
            第 {currentIndex + 1}/{questions.length} 题
          </Typography.Text>
          <Typography.Text type="secondary">
            已答 {answeredCount}/{questions.length} 题
          </Typography.Text>
        </div>
        <Progress percent={progressPercent} showInfo={false} />
      </Card>

      {/* 答题卡 */}
      {questions.length > 0 && (
        <Card>
          {/* 题目标签 */}
          <div style={{ marginBottom: 12 }}>
            <Space>
              <Tag color="blue">{getQuestionTypeLabel(currentQuestion.type)}</Tag>
              <Tag>{getBloomLevelLabel(currentQuestion.bloomLevel)}</Tag>
              {answers[currentQuestion.id] && (
                <Tag color={answers[currentQuestion.id].feedback?.isCorrect ? "green" : "red"}>
                  {answers[currentQuestion.id].feedback?.isCorrect ? "✓ 正确" : "✗ 错误"}
                </Tag>
              )}
            </Space>
          </div>

          {/* 题目内容 */}
          <Typography.Title level={5} style={{ whiteSpace: "pre-wrap", marginBottom: 16 }}>
            {currentQuestion.content}
          </Typography.Title>

          {/* 答题区域 */}
          {renderQuestion(currentQuestion)}

          {/* AI 反馈 */}
          {answers[currentQuestion.id]?.feedback && (
            <div style={{ marginTop: 16, padding: 12, background: "#f5f5f5", borderRadius: 6 }}>
              <Typography.Text strong>📝 AI 评估：</Typography.Text>
              <div style={{ marginTop: 4 }}>
                <Typography.Text>
                  {answers[currentQuestion.id].feedback?.analysis}
                </Typography.Text>
                {answers[currentQuestion.id].feedback?.suggestion && (
                  <div style={{ marginTop: 4 }}>
                    <Typography.Text type="secondary">
                      💡 {answers[currentQuestion.id].feedback?.suggestion}
                    </Typography.Text>
                  </div>
                )}
              </div>
            </div>
          )}

          <Divider />

          {/* 操作按钮 */}
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <Button
              icon={<ArrowLeftOutlined />}
              onClick={() => setCurrentIndex(Math.max(0, currentIndex - 1))}
              disabled={currentIndex === 0}
            >
              上一题
            </Button>

            <Space>
              {!answers[currentQuestion.id] ? (
                <Button
                  type="primary"
                  onClick={handleSubmit}
                  loading={submitting}
                  disabled={!currentAnswer.trim()}
                >
                  提交答案
                </Button>
              ) : currentIndex < questions.length - 1 ? (
                <Button type="primary" onClick={handleNext}>
                  下一题 <ArrowRightOutlined />
                </Button>
              ) : null}
            </Space>
          </div>
        </Card>
      )}

      {/* 答题卡导航 + 交卷 */}
      <Card style={{ marginTop: 16 }}>
        <Typography.Text strong style={{ display: "block", marginBottom: 8 }}>答题卡</Typography.Text>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 16 }}>
          {questions.map((q, i) => (
            <Button
              key={q.id}
              size="small"
              type={currentIndex === i ? "primary" : "default"}
              style={{
                width: 32,
                background: answers[q.id]
                  ? answers[q.id].feedback?.isCorrect ? "#f6ffed" : "#fff2f0"
                  : i === currentIndex ? undefined : undefined,
                borderColor: answers[q.id]
                  ? answers[q.id].feedback?.isCorrect ? "#52c41a" : "#ff4d4f"
                  : undefined,
                color: answers[q.id]
                  ? answers[q.id].feedback?.isCorrect ? "#52c41a" : "#ff4d4f"
                  : undefined,
              }}
              onClick={() => setCurrentIndex(i)}
            >
              {i + 1}
            </Button>
          ))}
        </div>

        <Button
          type="primary"
          danger
          onClick={handleFinish}
          disabled={answeredCount === 0}
          block
          size="large"
        >
          完成练习（{answeredCount}/{questions.length}）
        </Button>
      </Card>
    </div>
  );
}
