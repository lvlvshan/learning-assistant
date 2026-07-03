"use client";

import { useEffect, useState } from "react";
import { Card, Table, Tag, Typography, Empty, Spin } from "antd";
import { CheckCircleOutlined, CloseCircleOutlined } from "@ant-design/icons";
import apiClient from "@/lib/api";

export default function StudentResults() {
  const [sessions, setSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiClient
      .get("/practice/sessions")
      .then((res) => {
        setSessions(res.data.sessions);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const columns = [
    {
      title: "科目",
      key: "subject",
      render: (_: any, r: any) => r.subject?.name || "-",
    },
    {
      title: "总题数",
      dataIndex: "totalQuestions",
      key: "totalQuestions",
      width: 80,
    },
    {
      title: "正确数",
      dataIndex: "correctCount",
      key: "correctCount",
      width: 80,
      render: (v: number, r: any) => (
        <span style={{ color: v / (r.totalQuestions || 1) >= 0.9 ? "#52c41a" : "#faad14" }}>
          {v}
        </span>
      ),
    },
    {
      title: "得分",
      dataIndex: "score",
      key: "score",
      width: 80,
      render: (v: number) => (
        <span style={{ color: v >= 90 ? "#52c41a" : v >= 60 ? "#faad14" : "#ff4d4f", fontWeight: 600 }}>
          {v}
        </span>
      ),
    },
    {
      title: "状态",
      dataIndex: "status",
      key: "status",
      width: 80,
      render: (v: string) =>
        v === "COMPLETED" ? (
          <Tag color="green">已完成</Tag>
        ) : (
          <Tag color="orange">进行中</Tag>
        ),
    },
    {
      title: "完成时间",
      dataIndex: "completedAt",
      key: "completedAt",
      render: (v: string) =>
        v ? new Date(v).toLocaleString("zh-CN") : "-",
    },
  ];

  return (
    <div>
      <h2 style={{ marginBottom: 24 }}>练习记录</h2>
      <Card>
        {loading ? (
          <div style={{ textAlign: "center", padding: 40 }}>
            <Spin />
          </div>
        ) : (
          <Table
            dataSource={sessions}
            columns={columns}
            rowKey="id"
            locale={{ emptyText: <Empty description="暂无练习记录" /> }}
            pagination={{ pageSize: 10 }}
          />
        )}
      </Card>
    </div>
  );
}
