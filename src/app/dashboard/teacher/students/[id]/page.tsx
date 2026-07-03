"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  Card, Row, Col, Statistic, Typography, Spin, Tag, Descriptions,
  Progress, Empty, Table, Button, Space,
} from "antd";
import { ArrowLeftOutlined } from "@ant-design/icons";
import apiClient from "@/lib/api";

interface StudentStats {
  student: { id: string; name: string; username: string; class: { id: string; name: string; grade: string } | null };
  summary: { totalSessions: number; avgScore: number };
  scoreTrend: { index: number; score: number; subject: string; date: string }[];
  subjectBreakdown: { name: string; sessionsCount: number; avgScore: number }[];
  weaknesses: {
    id: string;
    masteryLevel: number;
    bloomBreakdown: string;
    knowledgePoint: { name: string; subjectId: string };
  }[];
}

export default function StudentDetail() {
  const params = useParams();
  const router = useRouter();
  const studentId = params.id as string;
  const [data, setData] = useState<StudentStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiClient
      .get(`/students/${studentId}/stats`)
      .then((res) => {
        setData(res.data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [studentId]);

  if (loading) {
    return <div style={{ textAlign: "center", padding: 60 }}><Spin size="large" /></div>;
  }

  if (!data) {
    return <Card><Empty description="暂无数据" /></Card>;
  }

  const weakPoints = data.weaknesses.filter((w) => w.masteryLevel < 75);
  const strongPoints = data.weaknesses.filter((w) => w.masteryLevel >= 75);

  // 掌握度雷达数据（用进度条代替）
  const masteryData = data.weaknesses.slice(0, 10);

  return (
    <div>
      <Button
        type="link"
        icon={<ArrowLeftOutlined />}
        onClick={() => router.push("/dashboard/teacher/students")}
        style={{ marginBottom: 16, padding: 0 }}
      >
        返回学生列表
      </Button>

      <h2 style={{ marginBottom: 24 }}>
        {data.student.name}
        <Typography.Text type="secondary" style={{ fontSize: 14, marginLeft: 12 }}>
          @{data.student.username}
          {data.student.class && ` | ${data.student.class.grade} ${data.student.class.name}`}
        </Typography.Text>
      </h2>

      {/* 统计卡片 */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={12} sm={6}>
          <Card>
            <Statistic title="已做练习" value={data.summary.totalSessions} suffix="次" />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card>
            <Statistic
              title="平均分"
              value={data.summary.avgScore}
              suffix="分"
              valueStyle={{ color: data.summary.avgScore >= 80 ? "#52c41a" : data.summary.avgScore >= 60 ? "#faad14" : "#ff4d4f" }}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        {/* 成绩趋势 */}
        <Col xs={24} lg={12}>
          <Card title="📈 成绩趋势" size="small">
            {data.scoreTrend.length === 0 ? (
              <Typography.Text type="secondary">暂无练习记录</Typography.Text>
            ) : (
              <div style={{ display: "flex", alignItems: "flex-end", gap: 4, height: 150, padding: "8px 0" }}>
                {data.scoreTrend.map((t, i) => (
                  <div
                    key={i}
                    style={{
                      flex: 1,
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      gap: 2,
                    }}
                  >
                    <Typography.Text style={{ fontSize: 10, color: "#888" }}>{t.score}</Typography.Text>
                    <div
                      style={{
                        width: "100%",
                        maxWidth: 28,
                        height: Math.max((t.score / 100) * 130, 4),
                        background: t.score >= 90 ? "#52c41a" : t.score >= 60 ? "#1677ff" : "#ff4d4f",
                        borderRadius: "4px 4px 0 0",
                        transition: "height 0.3s",
                      }}
                    />
                    <Typography.Text style={{ fontSize: 9, color: "#888" }}>{t.date.slice(5)}</Typography.Text>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </Col>

        {/* 科目分布 */}
        <Col xs={24} lg={12}>
          <Card title="📚 各科目表现" size="small">
            {data.subjectBreakdown.filter((s) => s.sessionsCount > 0).length === 0 ? (
              <Typography.Text type="secondary">暂无数据</Typography.Text>
            ) : (
              data.subjectBreakdown
                .filter((s) => s.sessionsCount > 0)
                .map((s) => (
                  <div key={s.name} style={{ marginBottom: 12 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                      <Typography.Text>{s.name}</Typography.Text>
                      <Typography.Text type="secondary">{s.sessionsCount}次</Typography.Text>
                    </div>
                    <Progress
                      percent={s.avgScore}
                      size="small"
                      strokeColor={s.avgScore >= 80 ? "#52c41a" : s.avgScore >= 60 ? "#faad14" : "#ff4d4f"}
                      format={(p) => `${p}分`}
                    />
                  </div>
                ))
            )}
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginTop: 16 }}>
        {/* 薄弱知识点 */}
        <Col xs={24} lg={12}>
          <Card title="🔴 薄弱知识点" size="small">
            {weakPoints.length === 0 ? (
              <Typography.Text type="secondary">暂无薄弱知识点</Typography.Text>
            ) : (
              weakPoints.map((w) => (
                <div key={w.id} style={{ marginBottom: 10 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 2 }}>
                    <Typography.Text>{w.knowledgePoint?.name}</Typography.Text>
                    <Tag color={w.masteryLevel >= 60 ? "orange" : "red"}>{w.masteryLevel}%</Tag>
                  </div>
                  <Progress
                    percent={w.masteryLevel}
                    size="small"
                    strokeColor={w.masteryLevel >= 60 ? "#faad14" : "#ff4d4f"}
                    showInfo={false}
                  />
                </div>
              ))
            )}
          </Card>
        </Col>

        {/* 掌握较好的知识点 */}
        <Col xs={24} lg={12}>
          <Card title="🟢 已掌握知识点" size="small">
            {strongPoints.length === 0 ? (
              <Typography.Text type="secondary">暂无数据</Typography.Text>
            ) : (
              strongPoints.slice(0, 10).map((w) => (
                <div key={w.id} style={{ marginBottom: 10 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 2 }}>
                    <Typography.Text>{w.knowledgePoint?.name}</Typography.Text>
                    <Tag color="green">{w.masteryLevel}%</Tag>
                  </div>
                  <Progress
                    percent={w.masteryLevel}
                    size="small"
                    strokeColor="#52c41a"
                    showInfo={false}
                  />
                </div>
              ))
            )}
          </Card>
        </Col>
      </Row>

      {/* 练习记录 */}
      <Card title="📋 近期练习记录" size="small" style={{ marginTop: 16 }}>
        {data.scoreTrend.length === 0 ? (
          <Typography.Text type="secondary">暂无练习记录</Typography.Text>
        ) : (
          <div>
            {[...data.scoreTrend].reverse().slice(0, 20).map((t, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "8px 0",
                  borderBottom: i < 19 ? "1px solid #f0f0f0" : "none",
                }}
              >
                <Space>
                  <Tag>{t.subject}</Tag>
                  <Typography.Text type="secondary">{t.date}</Typography.Text>
                </Space>
                <Typography.Text
                  strong
                  style={{
                    color:
                      t.score >= 90 ? "#52c41a" : t.score >= 60 ? "#faad14" : "#ff4d4f",
                  }}
                >
                  {t.score}分
                </Typography.Text>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
