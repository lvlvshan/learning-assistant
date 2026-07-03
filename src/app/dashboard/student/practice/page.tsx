"use client";

import { useEffect, useState } from "react";
import { Card, Row, Col, Typography, Spin, Button, message, Tag } from "antd";
import { BookOutlined, PlayCircleOutlined } from "@ant-design/icons";
import { useRouter } from "next/navigation";
import apiClient from "@/lib/api";

const iconMap: Record<string, any> = {
  calculator: "📐",
  book: "📖",
  language: "🌐",
  experiment: "🔬",
};

export default function StudentPractice() {
  const [subjects, setSubjects] = useState<any[]>([]);
  const [starting, setStarting] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    apiClient.get("/subjects").then((res) => {
      setSubjects(res.data.subjects);
      setLoading(false);
    });
  }, []);

  const handleStart = async (subjectId: string) => {
    setStarting(subjectId);
    try {
      const res = await apiClient.post("/practice/start", { subjectId, count: 10 });
      const { session } = res.data;
      router.push(`/dashboard/student/practice/${session.id}`);
    } catch (error: any) {
      message.error(error.response?.data?.error || "开始练习失败");
      setStarting(null);
    }
  };

  if (loading) {
    return <div style={{ textAlign: "center", padding: 60 }}><Spin size="large" /></div>;
  }

  return (
    <div>
      <h2 style={{ marginBottom: 8 }}>开始练习</h2>
      <Typography.Text type="secondary" style={{ display: "block", marginBottom: 24 }}>
        选择一个科目，系统将从题库中随机抽取题目进行练习。
      </Typography.Text>

      <Row gutter={[16, 16]}>
        {subjects.map((subject) => (
          <Col xs={24} sm={12} lg={8} xl={6} key={subject.id}>
            <Card
              hoverable
              actions={[
                <Button
                  type="primary"
                  icon={<PlayCircleOutlined />}
                  loading={starting === subject.id}
                  onClick={() => handleStart(subject.id)}
                  key="start"
                >
                  开始练习
                </Button>,
              ]}
            >
              <Card.Meta
                avatar={<span style={{ fontSize: 32 }}>{iconMap[subject.icon] || "📚"}</span>}
                title={subject.name}
                description={
                  <div>
                    <Typography.Text type="secondary">{subject.description}</Typography.Text>
                    <div style={{ marginTop: 8 }}>
                      <Tag>{subject.knowledgePointCount || 0} 个知识点</Tag>
                      <Tag>{subject.materialCount || 0} 份资料</Tag>
                    </div>
                  </div>
                }
              />
            </Card>
          </Col>
        ))}
      </Row>
    </div>
  );
}
