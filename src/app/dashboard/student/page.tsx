"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Card, Row, Col, Statistic, Button, Typography, Spin, Table, Tag, Empty,
} from "antd";
import {
  PlayCircleOutlined, BarChartOutlined, HistoryOutlined,
  TrophyOutlined, CheckCircleOutlined, BookOutlined,
} from "@ant-design/icons";
import apiClient from "@/lib/api";
import { useUserStore } from "@/stores/userStore";

export default function StudentDashboard() {
  const router = useRouter();
  const { user } = useUserStore();
  const [sessions, setSessions] = useState<any[]>([]);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      apiClient.get("/practice/sessions"),
      apiClient.get("/subjects"),
    ])
      .then(([sessionRes, subjectRes]) => {
        setSessions(sessionRes.data.sessions || []);
        setSubjects(subjectRes.data.subjects || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading) {
    return <div style={{ textAlign: "center", padding: 60 }}><Spin size="large" /></div>;
  }

  const completed = sessions.filter((s: any) => s.status === "COMPLETED");
  const totalQuestions = completed.reduce((sum: number, s: any) => sum + s.totalQuestions, 0);
  const correctCount = completed.reduce((sum: number, s: any) => sum + s.correctCount, 0);
  const avgScore =
    completed.length > 0
      ? Math.round(completed.reduce((sum: number, s: any) => sum + s.score, 0) / completed.length)
      : 0;
  const correctRate = totalQuestions > 0 ? Math.round((correctCount / totalQuestions) * 100) : 0;

  const recentSessions = [...sessions]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 5);

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <Typography.Title level={4} style={{ marginBottom: 4 }}>
          欢迎回来，{user?.name || "同学"} 👋
        </Typography.Title>
        <Typography.Text type="secondary">
          {subjects.length > 0
            ? `共有 ${subjects.length} 个科目可供练习`
            : "联系老师添加科目"}
        </Typography.Text>
      </div>

      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={12} sm={6}>
          <Card hoverable onClick={() => router.push("/dashboard/student/results")}>
            <Statistic title="已做练习" value={completed.length} suffix="次" prefix={<CheckCircleOutlined />} />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card hoverable onClick={() => router.push("/dashboard/student/progress")}>
            <Statistic
              title="平均分"
              value={avgScore}
              suffix="分"
              prefix={<TrophyOutlined />}
              styles={{ content: { color: avgScore >= 90 ? "#52c41a" : avgScore >= 60 ? "#faad14" : "#888" } }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card hoverable onClick={() => router.push("/dashboard/student/progress")}>
            <Statistic title="总答题数" value={totalQuestions} suffix="题" prefix={<BookOutlined />} />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card hoverable onClick={() => router.push("/dashboard/student/progress")}>
            <Statistic
              title="正确率"
              value={correctRate}
              suffix="%"
              styles={{ content: { color: correctRate >= 90 ? "#52c41a" : correctRate >= 60 ? "#faad14" : "#888" } }}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={8}>
          <Button
            type="primary"
            size="large"
            icon={<PlayCircleOutlined />}
            onClick={() => router.push("/dashboard/student/practice")}
            block
          >
            开始练习
          </Button>
        </Col>
        <Col xs={12} sm={8}>
          <Button
            size="large"
            icon={<BarChartOutlined />}
            onClick={() => router.push("/dashboard/student/progress")}
            block
          >
            学习进度
          </Button>
        </Col>
        <Col xs={12} sm={8}>
          <Button
            size="large"
            icon={<HistoryOutlined />}
            onClick={() => router.push("/dashboard/student/results")}
            block
          >
            练习记录
          </Button>
        </Col>
      </Row>

      {/* 最近练习 */}
      <Card title="最近的练习">
        {recentSessions.length === 0 ? (
          <Empty description="还没有练习记录，去「开始练习」吧！">
            <Button type="primary" onClick={() => router.push("/dashboard/student/practice")}>
              开始练习
            </Button>
          </Empty>
        ) : (
          <Table
            dataSource={recentSessions}
            columns={[
              { title: "科目", key: "subject", render: (_: any, r: any) => r.subject?.name || "-" },
              { title: "题数", dataIndex: "totalQuestions", key: "totalQuestions", width: 60 },
              {
                title: "得分",
                dataIndex: "score",
                key: "score",
                width: 80,
                render: (v: number) => (
                  <span style={{ fontWeight: 600, color: v >= 90 ? "#52c41a" : v >= 60 ? "#faad14" : "#ff4d4f" }}>
                    {v} 分
                  </span>
                ),
              },
              {
                title: "时间",
                dataIndex: "createdAt",
                key: "createdAt",
                render: (v: string) => new Date(v).toLocaleString("zh-CN"),
              },
            ]}
            rowKey="id"
            pagination={false}
            size="small"
          />
        )}
      </Card>
    </div>
  );
}
