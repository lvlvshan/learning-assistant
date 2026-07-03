"use client";

import { useEffect, useState } from "react";
import { Card, Typography, Empty, Spin, Tag, Progress, Row, Col, Statistic } from "antd";
import apiClient from "@/lib/api";

export default function StudentProgress() {
  const [sessions, setSessions] = useState<any[]>([]);
  const [weaknesses, setWeaknesses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      apiClient.get("/practice/sessions"),
      apiClient.get("/users?role=STUDENT"),
    ])
      .then(([sessionRes]) => {
        setSessions(sessionRes.data.sessions || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const completed = sessions.filter((s) => s.status === "COMPLETED");
  const avgScore =
    completed.length > 0
      ? Math.round(completed.reduce((sum, s) => sum + s.score, 0) / completed.length)
      : 0;

  if (loading) {
    return (
      <div style={{ textAlign: "center", padding: 60 }}>
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div>
      <h2 style={{ marginBottom: 24 }}>学习进度</h2>

      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={12} sm={6}>
          <Card>
            <Statistic
              title="已完成练习"
              value={completed.length}
              suffix="次"
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card>
            <Statistic
              title="平均分"
              value={avgScore}
              suffix="分"
              valueStyle={{ color: avgScore >= 90 ? "#52c41a" : "#faad14" }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card>
            <Statistic
              title="总答题数"
              value={completed.reduce((sum, s) => sum + s.totalQuestions, 0)}
              suffix="题"
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card>
            <Statistic
              title="正确率"
              value={
                completed.reduce((sum, s) => sum + s.totalQuestions, 0) > 0
                  ? Math.round(
                      (completed.reduce((sum, s) => sum + s.correctCount, 0) /
                        completed.reduce((sum, s) => sum + s.totalQuestions, 0)) *
                        100
                    )
                  : 0
              }
              suffix="%"
              valueStyle={{
                color:
                  completed.reduce((sum, s) => sum + s.totalQuestions, 0) > 0 &&
                  completed.reduce((sum, s) => sum + s.correctCount, 0) /
                    completed.reduce((sum, s) => sum + s.totalQuestions, 0) >= 0.9
                    ? "#52c41a"
                    : "#faad14",
              }}
            />
          </Card>
        </Col>
      </Row>

      {completed.length === 0 ? (
        <Card>
          <Empty description="暂无已完成的练习">
            <a href="/dashboard/student/practice">去练习</a>
          </Empty>
        </Card>
      ) : (
        <Card title="近期成绩趋势">
          {completed.map((s, i) => (
            <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 0", borderBottom: "1px solid #f0f0f0" }}>
              <span style={{ color: "#888", width: 32 }}>#{i + 1}</span>
              <span style={{ minWidth: 80 }}>{s.subject?.name || "-"}</span>
              <Progress
                percent={s.score}
                style={{ flex: 1 }}
                strokeColor={s.score >= 90 ? "#52c41a" : s.score >= 60 ? "#faad14" : "#ff4d4f"}
                format={(p) => (
                  <span style={{ fontWeight: 600 }}>{p}分</span>
                )}
              />
              <span style={{ color: "#888", fontSize: 12, minWidth: 120 }}>
                {s.completedAt ? new Date(s.completedAt).toLocaleDateString("zh-CN") : "进行中"}
              </span>
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}
