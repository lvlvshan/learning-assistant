"use client";

import { useEffect, useState } from "react";
import {
  Card, Row, Col, Statistic, Table, Tag, Typography, Spin, Empty,
  Progress,
} from "antd";
import {
  TeamOutlined, TrophyOutlined, RiseOutlined, WarningOutlined,
  BookOutlined, CheckCircleOutlined, CloseCircleOutlined,
} from "@ant-design/icons";
import apiClient from "@/lib/api";

interface DashboardData {
  summary: {
    totalStudents: number;
    totalSessions: number;
    avgScore: number;
    excellentCount: number;
    passCount: number;
    failCount: number;
    excellentRate: number;
  };
  subjectStats: { id: string; name: string; totalSessions: number; avgScore: number }[];
  classStats: { id: string; name: string; studentCount: number; totalSessions: number; avgScore: number; sessionsPerStudent: number }[];
  trend: { date: string; count: number; avgScore: number }[];
  topImprovers: { id: string; name: string; className: string; sessionsCount: number; avgScore: number; improvement: number }[];
  needsAttention: { id: string; name: string; className: string; sessionsCount: number; avgScore: number; improvement: number }[];
}

export default function TeacherDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiClient
      .get("/dashboard/teacher")
      .then((res) => {
        setData(res.data);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading) {
    return <div style={{ textAlign: "center", padding: 60 }}><Spin size="large" /></div>;
  }

  if (!data) {
    return <Card><Empty description="暂无数据" /></Card>;
  }

  return (
    <div>
      <h2 style={{ marginBottom: 24 }}>教学看板</h2>

      {/* 统计卡片 */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={12} sm={8} lg={4}>
          <Card size="small">
            <Statistic title="学生总数" value={data.summary.totalStudents} prefix={<TeamOutlined />} />
          </Card>
        </Col>
        <Col xs={12} sm={8} lg={4}>
          <Card size="small">
            <Statistic title="总练习次数" value={data.summary.totalSessions} prefix={<BookOutlined />} />
          </Card>
        </Col>
        <Col xs={12} sm={8} lg={4}>
          <Card size="small">
            <Statistic
              title="平均分"
              value={data.summary.avgScore}
              suffix="分"
              prefix={<TrophyOutlined />}
              styles={{ content: { color: data.summary.avgScore >= 80 ? "#52c41a" : "#faad14" } }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={8} lg={4}>
          <Card size="small">
            <Statistic title="优秀(≥90分)" value={data.summary.excellentCount} prefix={<CheckCircleOutlined />} styles={{ content: { color: "#52c41a" } }} />
          </Card>
        </Col>
        <Col xs={12} sm={8} lg={4}>
          <Card size="small">
            <Statistic title="及格(60-89)" value={data.summary.passCount} prefix={<RiseOutlined />} styles={{ content: { color: "#1677ff" } }} />
          </Card>
        </Col>
        <Col xs={12} sm={8} lg={4}>
          <Card size="small">
            <Statistic title="不及格(<60)" value={data.summary.failCount} prefix={<CloseCircleOutlined />} styles={{ content: { color: "#ff4d4f" } }} />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        {/* 7 日趋势 */}
        <Col xs={24} lg={12}>
          <Card title="📈 近7天练习趋势" size="small">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", height: 120, padding: "0 8px" }}>
              {data.trend.map((t, i) => {
                const maxCount = Math.max(...data.trend.map((d) => d.count), 1);
                const height = Math.max((t.count / maxCount) * 100, 4);
                return (
                  <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                    <Typography.Text style={{ fontSize: 11, color: "#888" }}>{t.count}</Typography.Text>
                    <div
                      style={{
                        width: 24,
                        height,
                        background: t.avgScore >= 80 ? "#52c41a" : "#1677ff",
                        borderRadius: "4px 4px 0 0",
                        transition: "height 0.3s",
                      }}
                    />
                    <Typography.Text style={{ fontSize: 10, color: "#888" }}>
                      {t.date.slice(5)}
                    </Typography.Text>
                  </div>
                );
              })}
            </div>
            <div style={{ marginTop: 8, display: "flex", justifyContent: "space-around" }}>
              {data.trend.map((t, i) => (
                <Typography.Text key={i} style={{ fontSize: 10, color: t.avgScore >= 80 ? "#52c41a" : "#888" }}>
                  {t.avgScore}分
                </Typography.Text>
              ))}
            </div>
          </Card>
        </Col>

        {/* 班级统计 */}
        <Col xs={24} lg={12}>
          <Card title="🏫 班级统计" size="small">
            <Table
              dataSource={data.classStats}
              columns={[
                { title: "班级", dataIndex: "name", key: "name" },
                { title: "人数", dataIndex: "studentCount", key: "studentCount", width: 50 },
                { title: "练习", dataIndex: "totalSessions", key: "totalSessions", width: 50 },
                { title: "人均", dataIndex: "sessionsPerStudent", key: "sessionsPerStudent", width: 50 },
                {
                  title: "平均分",
                  dataIndex: "avgScore",
                  key: "avgScore",
                  width: 60,
                  render: (v: number) => (
                    <span style={{ color: v >= 80 ? "#52c41a" : v >= 60 ? "#faad14" : "#ff4d4f", fontWeight: 600 }}>
                      {v}
                    </span>
                  ),
                },
              ]}
              rowKey="id"
              pagination={false}
              size="small"
            />
          </Card>
        </Col>

        {/* 各科目情况 */}
        <Col xs={24} lg={8}>
          <Card title="📚 各科目情况" size="small">
            {data.subjectStats.map((s) => (
              <div key={s.id} style={{ marginBottom: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                  <Typography.Text>{s.name}</Typography.Text>
                  <Typography.Text type="secondary">{s.totalSessions}次</Typography.Text>
                </div>
                <Progress
                  percent={s.avgScore}
                  size="small"
                  strokeColor={s.avgScore >= 80 ? "#52c41a" : s.avgScore >= 60 ? "#faad14" : "#ff4d4f"}
                  format={(p) => `${p}分`}
                />
              </div>
            ))}
          </Card>
        </Col>

        {/* 进步最快学生 */}
        <Col xs={24} lg={8}>
          <Card title="📈 进步最快学生" size="small">
            {data.topImprovers.length === 0 ? (
              <Typography.Text type="secondary">暂无数据（需要至少2次练习记录）</Typography.Text>
            ) : (
              <Table
                dataSource={data.topImprovers}
                columns={[
                  { title: "姓名", dataIndex: "name", key: "name", width: 60 },
                  { title: "进步", dataIndex: "improvement", key: "improvement", width: 60, render: (v: number) => <span style={{ color: "#52c41a", fontWeight: 600 }}>+{v}分</span> },
                ]}
                rowKey="id"
                pagination={false}
                size="small"
                showHeader={false}
              />
            )}
          </Card>
        </Col>

        {/* 需关注学生 */}
        <Col xs={24} lg={8}>
          <Card title="⚠️ 需关注学生" size="small">
            {data.needsAttention.length === 0 ? (
              <Typography.Text type="secondary">暂无需关注的学生</Typography.Text>
            ) : (
              <Table
                dataSource={data.needsAttention}
                columns={[
                  { title: "姓名", dataIndex: "name", key: "name", width: 60 },
                  { title: "班级", dataIndex: "className", key: "className", width: 80 },
                  { title: "平均分", dataIndex: "avgScore", key: "avgScore", width: 60, render: (v: number) => <span style={{ color: "#ff4d4f", fontWeight: 600 }}>{v}</span> },
                ]}
                rowKey="id"
                pagination={false}
                size="small"
                showHeader={false}
              />
            )}
          </Card>
        </Col>
      </Row>
    </div>
  );
}
