"use client";

import { useEffect, useState } from "react";
import {
  Card, Select, Row, Col, Typography, Spin, Empty, Table,
  Tag, Progress, Space, Statistic,
} from "antd";
import {
  TrophyOutlined, WarningOutlined, TeamOutlined, RiseOutlined,
} from "@ant-design/icons";
import { useRouter } from "next/navigation";
import apiClient from "@/lib/api";

export default function ClassAnalysis() {
  const [students, setStudents] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [selectedClass, setSelectedClass] = useState<string>();
  const [sessions, setSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    Promise.all([
      apiClient.get("/classes"),
      apiClient.get("/practice/sessions?status=COMPLETED"),
    ]).then(([classRes]) => {
      setClasses(classRes.data.classes);
      if (classRes.data.classes.length > 0) {
        setSelectedClass(classRes.data.classes[0].id);
      }
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    if (!selectedClass) return;
    Promise.all([
      apiClient.get(`/users?role=STUDENT`),
      apiClient.get("/practice/sessions"),
    ]).then(([userRes, sessionRes]) => {
      const cls = classes.find((c) => c.id === selectedClass);
      const classStudentIds = (userRes.data.users as any[])
        .filter((u: any) => u.classId === selectedClass)
        .map((u: any) => u.id);
      setStudents(
        (userRes.data.users as any[]).filter((u: any) => u.classId === selectedClass)
      );
      setSessions(
        (sessionRes.data.sessions as any[]).filter((s: any) =>
          classStudentIds.includes(s.studentId)
        )
      );
    });
  }, [selectedClass]);

  if (loading) {
    return <div style={{ textAlign: "center", padding: 60 }}><Spin size="large" /></div>;
  }

  const completed = sessions.filter((s) => s.status === "COMPLETED");
  const totalSessions = completed.length;
  const avgScore =
    totalSessions > 0
      ? Math.round(completed.reduce((sum, s) => sum + s.score, 0) / totalSessions)
      : 0;

  // 成绩分布
  const distribution = [
    { range: "优秀 (≥90)", count: completed.filter((s) => s.score >= 90).length, color: "#52c41a" },
    { range: "良好 (75-89)", count: completed.filter((s) => s.score >= 75 && s.score < 90).length, color: "#1677ff" },
    { range: "及格 (60-74)", count: completed.filter((s) => s.score >= 60 && s.score < 75).length, color: "#faad14" },
    { range: "不及格 (<60)", count: completed.filter((s) => s.score < 60).length, color: "#ff4d4f" },
  ];

  // 学生平均分排名
  const studentRanking = students.map((s) => {
    const stuSessions = completed.filter((c) => c.studentId === s.id);
    return {
      id: s.id,
      name: s.name,
      totalSessions: stuSessions.length,
      avgScore:
        stuSessions.length > 0
          ? Math.round(stuSessions.reduce((sum, c) => sum + c.score, 0) / stuSessions.length)
          : 0,
    };
  }).sort((a, b) => b.avgScore - a.avgScore);

  const totalStudentCount = students.length;
  const activeStudentCount = studentRanking.filter((s) => s.totalSessions > 0).length;

  const maxScore = Math.max(...distribution.map((d) => d.count), 1);

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
        <h2 style={{ margin: 0 }}>班级分析</h2>
        <Select
          style={{ width: 200 }}
          value={selectedClass}
          onChange={(v) => setSelectedClass(v)}
          options={classes.map((c) => ({ value: c.id, label: `${c.grade} ${c.name}` }))}
        />
      </div>

      {!selectedClass ? (
        <Card><Empty description="请选择一个班级" /></Card>
      ) : (
        <>
          <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
            <Col xs={8} sm={6}>
              <Card size="small">
                <Statistic title="学生人数" value={totalStudentCount} prefix={<TeamOutlined />} />
              </Card>
            </Col>
            <Col xs={8} sm={6}>
              <Card size="small">
                <Statistic title="参与练习" value={activeStudentCount} suffix={`/${totalStudentCount}`} prefix={<RiseOutlined />} />
              </Card>
            </Col>
            <Col xs={8} sm={6}>
              <Card size="small">
                <Statistic title="总练习次数" value={totalSessions} prefix={<TrophyOutlined />} />
              </Card>
            </Col>
            <Col xs={8} sm={6}>
              <Card size="small">
                <Statistic title="班级平均分" value={avgScore} suffix="分" styles={{ content: { color: avgScore >= 80 ? "#52c41a" : avgScore >= 60 ? "#faad14" : "#ff4d4f" } }} />
              </Card>
            </Col>
          </Row>

          <Row gutter={[16, 16]}>
            {/* 成绩分布 */}
            <Col xs={24} lg={10}>
              <Card title="📊 成绩分布" size="small">
                <div style={{ display: "flex", alignItems: "flex-end", gap: 16, height: 160, padding: "8px 0", justifyContent: "center" }}>
                  {distribution.map((d, i) => (
                    <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                      <Typography.Text style={{ fontSize: 12, fontWeight: 600 }}>{d.count}</Typography.Text>
                      <div
                        style={{
                          width: 48,
                          height: Math.max((d.count / maxScore) * 130, 4),
                          background: d.color,
                          borderRadius: "6px 6px 0 0",
                          transition: "height 0.3s",
                        }}
                      />
                      <Typography.Text style={{ fontSize: 11 }}>{d.range}</Typography.Text>
                    </div>
                  ))}
                </div>
              </Card>
            </Col>

            {/* 各分数段比例 */}
            <Col xs={24} lg={14}>
              <Card title="📈 各分数段占比" size="small">
                {totalSessions === 0 ? (
                  <Typography.Text type="secondary">暂无数据</Typography.Text>
                ) : (
                  distribution.map((d, i) => (
                    <div key={i} style={{ marginBottom: 10 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                        <span><Tag color={d.count > 0 ? d.color : "default"}>{d.range}</Tag></span>
                        <Typography.Text strong>{Math.round((d.count / totalSessions) * 100)}%</Typography.Text>
                      </div>
                      <Progress
                        percent={Math.round((d.count / totalSessions) * 100)}
                        size="small"
                        strokeColor={d.color}
                        showInfo={false}
                      />
                    </div>
                  ))
                )}
              </Card>
            </Col>
          </Row>

          {/* 学生排名 */}
          <Card title="🏆 学生成绩排名" size="small" style={{ marginTop: 16 }}>
            <Table
              dataSource={studentRanking}
              columns={[
                {
                  title: "排名",
                  key: "rank",
                  width: 50,
                  render: (_: any, _r: any, i: number) => {
                    const rank = i + 1;
                    const colors = ["#ffd700", "#c0c0c0", "#cd7f32"];
                    return (
                      <span style={{ fontWeight: 600, color: rank <= 3 ? colors[rank - 1] : undefined }}>
                        #{rank}
                      </span>
                    );
                  },
                },
                {
                  title: "姓名",
                  dataIndex: "name",
                  key: "name",
                  render: (name: string, record: any) => (
                    <Typography.Link onClick={() => router.push(`/dashboard/teacher/students/${record.id}`)}>
                      {name}
                    </Typography.Link>
                  ),
                },
                { title: "练习次数", dataIndex: "totalSessions", key: "totalSessions", width: 80 },
                {
                  title: "平均分",
                  dataIndex: "avgScore",
                  key: "avgScore",
                  width: 80,
                  sorter: (a: any, b: any) => b.avgScore - a.avgScore,
                  render: (v: number) => (
                    <span
                      style={{
                        fontWeight: 600,
                        color: v >= 80 ? "#52c41a" : v >= 60 ? "#faad14" : "#ff4d4f",
                      }}
                    >
                      {v}
                    </span>
                  ),
                },
                {
                  title: "掌握度",
                  key: "status",
                  width: 100,
                  render: (_: any, record: any) =>
                    record.totalSessions === 0 ? (
                      <Tag>未开始</Tag>
                    ) : record.avgScore >= 90 ? (
                      <Tag color="green">优秀</Tag>
                    ) : record.avgScore >= 75 ? (
                      <Tag color="blue">良好</Tag>
                    ) : record.avgScore >= 60 ? (
                      <Tag color="orange">及格</Tag>
                    ) : (
                      <Tag color="red">需努力</Tag>
                    ),
                },
              ]}
              rowKey="id"
              pagination={{ pageSize: 20 }}
              size="small"
            />
          </Card>
        </>
      )}
    </div>
  );
}
