"use client";

import { useEffect, useState } from "react";
import { Card, Row, Col, Typography, Spin, Button, Tag, App, Modal, Tree, Empty, Space } from "antd";
import { BookOutlined, PlayCircleOutlined } from "@ant-design/icons";
import { useRouter } from "next/navigation";
import apiClient from "@/lib/api";
import type { DataNode } from "antd/es/tree";

const iconMap: Record<string, any> = {
  calculator: "📐",
  book: "📖",
  language: "🌐",
  experiment: "🔬",
};

export default function StudentPractice() {
  const { message } = App.useApp();
  const [subjects, setSubjects] = useState<any[]>([]);
  const [starting, setStarting] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  // 知识点选择 Modal 状态
  const [kpModalVisible, setKpModalVisible] = useState(false);
  const [currentSubject, setCurrentSubject] = useState<any>(null);
  const [treeData, setTreeData] = useState<DataNode[]>([]);
  const [loadingKps, setLoadingKps] = useState(false);
  const [checkedKeys, setCheckedKeys] = useState<React.Key[]>([]);

  useEffect(() => {
    apiClient.get("/subjects").then((res) => {
      setSubjects(res.data.subjects);
      setLoading(false);
    });
  }, []);

  // 打开知识点选择 Modal
  const openKpModal = async (subject: any) => {
    setCurrentSubject(subject);
    setCheckedKeys([]);
    setTreeData([]);
    setKpModalVisible(true);
    setLoadingKps(true);
    try {
      const res = await apiClient.get(`/knowledge-points?tree=true&subjectId=${subject.id}`);
      setTreeData(buildTreeData(res.data.knowledgePoints || []));
    } catch {
      message.error("加载知识点失败");
    } finally {
      setLoadingKps(false);
    }
  };

  // 将 API 树形数据转换为 DataNode 格式
  const buildTreeData = (points: any[]): DataNode[] => {
    return points.map((p: any) => ({
      key: p.id,
      title: p.name,
      children: p.children ? buildTreeData(p.children) : undefined,
    }));
  };

  // 选中/取消选中知识点
  const handleCheck = (checked: React.Key[] | { checked: React.Key[]; halfChecked: React.Key[] }) => {
    setCheckedKeys(Array.isArray(checked) ? checked : checked.checked);
  };

  // 全选 / 清空
  const handleSelectAll = () => {
    const allKeys = getAllKeys(treeData);
    setCheckedKeys(allKeys);
  };

  const handleDeselectAll = () => {
    setCheckedKeys([]);
  };

  const getAllKeys = (nodes: DataNode[]): React.Key[] => {
    let keys: React.Key[] = [];
    for (const node of nodes) {
      keys.push(node.key);
      if (node.children) {
        keys = keys.concat(getAllKeys(node.children));
      }
    }
    return keys;
  };

  // 确认开始练习
  const handleStartPractice = async () => {
    if (!currentSubject) return;
    setStarting(currentSubject.id);
    try {
      const res = await apiClient.post("/practice/start", {
        subjectId: currentSubject.id,
        count: 10,
        knowledgePointIds: checkedKeys.length > 0 ? checkedKeys : undefined,
      });
      const { session, selectedKnowledgePoints } = res.data;
      setKpModalVisible(false);
      // 显示知识点范围提示
      const kpHint = selectedKnowledgePoints?.length
        ? `知识点范围：${selectedKnowledgePoints.join("、")}`
        : "练习全部知识点";
      message.success(`开始练习！${kpHint}`);
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
        选择一个科目，可选择知识点范围进行针对性练习。
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
                  onClick={() => openKpModal(subject)}
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

      {/* 知识点选择 Modal */}
      <Modal
        title={`选择练习知识点 — ${currentSubject?.name || ""}`}
        open={kpModalVisible}
        onCancel={() => { setKpModalVisible(false); setStarting(null); }}
        footer={[
          <Button key="cancel" onClick={() => { setKpModalVisible(false); setStarting(null); }}>
            取消
          </Button>,
          <Button
            key="start"
            type="primary"
            icon={<PlayCircleOutlined />}
            loading={starting === currentSubject?.id}
            onClick={handleStartPractice}
          >
            开始练习
          </Button>,
        ]}
        width={520}
      >
        {loadingKps ? (
          <div style={{ textAlign: "center", padding: 40 }}>
            <Spin description="加载知识点..." />
          </div>
        ) : treeData.length === 0 ? (
          <Empty description="该科目暂无知识点，无法开始练习" />
        ) : (
          <>
            <Space style={{ marginBottom: 12 }}>
              <Button size="small" onClick={handleSelectAll}>全选</Button>
              <Button size="small" onClick={handleDeselectAll}>清空</Button>
              <Typography.Text type="secondary">
                {checkedKeys.length > 0
                  ? `已选 ${checkedKeys.length} 个知识点`
                  : "未选（将练习全部知识点）"}
              </Typography.Text>
            </Space>
            <div style={{ maxHeight: 420, overflow: "auto", border: "1px solid #f0f0f0", borderRadius: 6, padding: "8px 0" }}>
              <Tree
                checkable
                defaultExpandAll
                treeData={treeData}
                checkedKeys={checkedKeys}
                onCheck={handleCheck}
              />
            </div>
          </>
        )}
      </Modal>
    </div>
  );
}
