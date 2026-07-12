"use client";

import { useEffect, useState } from "react";
import {
  Card, Table, Button, Select, Space, App, Tag, Modal,
  Typography, Tooltip, Form, Input, InputNumber, Descriptions, Badge, Empty,
} from "antd";
import {
  RobotOutlined, DeleteOutlined, EditOutlined, CheckCircleOutlined,
  EyeOutlined, ReloadOutlined, PlusOutlined,
} from "@ant-design/icons";
import apiClient from "@/lib/api";
import { getBloomLevelLabel, getQuestionTypeLabel, getDifficultyLabel } from "@/lib/ai/prompts";

const bloomColors: Record<string, string> = {
  REMEMBER: "default",
  UNDERSTAND: "blue",
  APPLY: "green",
  ANALYZE: "orange",
  EVALUATE: "red",
  CREATE: "purple",
};

const difficultyColors: Record<string, string> = {
  EASY: "green",
  MEDIUM: "orange",
  HARD: "red",
};

const typeColors: Record<string, string> = {
  MULTIPLE_CHOICE: "blue",
  TF: "cyan",
  FILL_BLANK: "geekblue",
  SHORT_ANSWER: "purple",
};

export default function TeacherQuestions() {
  const { message, modal } = App.useApp();
  const [questions, setQuestions] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [knowledgePoints, setKnowledgePoints] = useState<any[]>([]);
  const [filterSubject, setFilterSubject] = useState<string>();
  const [filterKP, setFilterKP] = useState<string>();
  const [filterBloom, setFilterBloom] = useState<string>();
  const [filterReviewed, setFilterReviewed] = useState<string>();

  // 生成相关
  const [genModalOpen, setGenModalOpen] = useState(false);
  const [genKPs, setGenKPs] = useState<string[]>([]);
  const [genCount, setGenCount] = useState(20);
  const [generating, setGenerating] = useState(false);

  // 详情/编辑
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [selectedQuestion, setSelectedQuestion] = useState<any>(null);

  // 编辑
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editForm] = Form.useForm();
  const [editingQuestion, setEditingQuestion] = useState<any>(null);
  const [editKPs, setEditKPs] = useState<any[]>([]);

  const fetchSubjects = async () => {
    try {
      const res = await apiClient.get("/subjects");
      setSubjects(res.data.subjects);
    } catch {}
  };

  const fetchQuestions = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterKP) params.set("knowledgePointId", filterKP);
      else if (filterSubject) params.set("subjectId", filterSubject);
      if (filterBloom) params.set("bloomLevel", filterBloom);
      if (filterReviewed) params.set("aiReviewStatus", filterReviewed as string);

      const res = await apiClient.get(`/questions?${params.toString()}`);
      setQuestions(res.data.questions);
    } finally {
      setLoading(false);
    }
  };

  const fetchKPs = async (subjectId: string) => {
    try {
      const res = await apiClient.get(`/knowledge-points?tree=true&subjectId=${subjectId}`);
      // 扁平化
      const flat = flattenTree(res.data.knowledgePoints);
      setKnowledgePoints(flat);
    } catch {}
  };

  const flattenTree = (nodes: any[], parent = "", depth = 0): any[] => {
    let result: any[] = [];
    for (const n of nodes) {
      result.push({ ...n, parentName: parent, depth });
      if (n.children) {
        result = result.concat(flattenTree(n.children, n.name, depth + 1));
      }
    }
    return result;
  };

  const formatKPLabel = (kp: any) => {
    const indent = kp.depth > 0 ? "└─ ".repeat(kp.depth) : "";
    return `${indent}${kp.name}`;
  };

  useEffect(() => {
    fetchSubjects();
  }, []);

  useEffect(() => {
    if (filterSubject) {
      fetchKPs(filterSubject);
      setFilterKP(undefined);
    } else {
      setKnowledgePoints([]);
    }
  }, [filterSubject]);

  useEffect(() => {
    fetchQuestions();
  }, [filterKP, filterBloom, filterReviewed, filterSubject]);

  // AI 生成题目
  const handleGenerate = async () => {
    if (genKPs.length === 0) {
      message.warning("请选择至少一个知识点");
      return;
    }

    setGenerating(true);
    try {
      const res = await apiClient.post("/questions/generate", {
        knowledgePointIds: genKPs,
        count: genCount,
        bloomLevels: ["REMEMBER", "UNDERSTAND", "APPLY", "ANALYZE", "EVALUATE", "CREATE"],
        types: ["MULTIPLE_CHOICE", "TF", "FILL_BLANK", "SHORT_ANSWER"],
      });

      message.success(`成功生成 ${res.data.questions.length} 道题目！请审核后使用。`);
      setGenModalOpen(false);
      setGenKPs([]);
      fetchQuestions();
    } catch (error: any) {
      message.error(error.response?.data?.error || "生成失败");
    } finally {
      setGenerating(false);
    }
  };

  // 手动通过（教师复审）
  const handleManualApprove = async (id: string) => {
    try {
      await apiClient.put(`/questions/${id}`, {
        reviewedByTeacher: true,
        aiReviewStatus: "APPROVED",
      });
      message.success("审核通过");
      fetchQuestions();
    } catch {
      message.error("操作失败");
    }
  };

  // 删除
  const handleDelete = (id: string) => {
    modal.confirm({
      title: "确认删除",
      content: "删除后不可恢复",
      okText: "确认",
      cancelText: "取消",
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          await apiClient.delete(`/questions/${id}`);
          message.success("删除成功");
          fetchQuestions();
        } catch { message.error("删除失败"); }
      },
    });
  };

  // 编辑
  const handleEdit = async (q: any) => {
    setEditingQuestion(q);
    editForm.setFieldsValue({
      content: q.content,
      correctAnswer: q.correctAnswer,
      type: q.type,
      difficulty: q.difficulty,
      bloomLevel: q.bloomLevel,
      knowledgePointId: q.knowledgePointId,
    });
    setEditModalOpen(true);
  };

  const handleSaveEdit = async () => {
    const values = await editForm.validateFields();
    try {
      await apiClient.put(`/questions/${editingQuestion.id}`, {
        ...values,
        reviewedByTeacher: false,
        aiReviewStatus: "PENDING",
      });
      message.success("更新成功");
      setEditModalOpen(false);
      setEditingQuestion(null);
      fetchQuestions();
    } catch (error: any) {
      message.error(error.response?.data?.error || "更新失败");
    }
  };

  // 详情查看
  const handleViewDetail = (q: any) => {
    setSelectedQuestion(q);
    setDetailModalOpen(true);
  };

  const columns = [
    {
      title: "题目内容",
      dataIndex: "content",
      key: "content",
      ellipsis: true,
      width: 300,
      render: (content: string) => (
        <Typography.Paragraph ellipsis={{ rows: 2 }} style={{ margin: 0 }}>
          {content}
        </Typography.Paragraph>
      ),
    },
    {
      title: "题型",
      dataIndex: "type",
      key: "type",
      width: 90,
      render: (type: string) => <Tag color={typeColors[type]}>{getQuestionTypeLabel(type)}</Tag>,
    },
    {
      title: "Bloom 层次",
      dataIndex: "bloomLevel",
      key: "bloomLevel",
      width: 100,
      render: (level: string) => {
        const levels = (level || "").split(",").map((l: string) => l.trim()).filter(Boolean);
        return (
          <span style={{ display: "flex", flexWrap: "wrap", gap: 2 }}>
            {levels.map((l: string, i: number) => (
              <Tag key={i} color={bloomColors[l]} style={{ fontSize: 11 }}>
                {getBloomLevelLabel(l)}
              </Tag>
            ))}
          </span>
        );
      },
    },
    {
      title: "难度",
      dataIndex: "difficulty",
      key: "difficulty",
      width: 70,
      render: (d: string) => <Tag color={difficultyColors[d]}>{getDifficultyLabel(d)}</Tag>,
    },
    {
      title: "知识点",
      key: "kp",
      width: 120,
      ellipsis: true,
      render: (_: any, r: any) => r.knowledgePoint?.name || "-",
    },
    {
      title: "评审状态",
      key: "aiReview",
      width: 90,
      render: (_: any, r: any) => {
        if (r.aiReviewStatus === "APPROVED") return <Tag color="green">已通过</Tag>;
        if (r.aiReviewStatus === "NEEDS_REVIEW") return <Tooltip title={r.aiReviewFeedback || "AI 建议复核"}><Tag color="orange">需复核</Tag></Tooltip>;
        return <Tag color="default">待评审</Tag>;
      },
    },
    {
      title: "来源",
      dataIndex: "aiGenerated",
      key: "source",
      width: 70,
      render: (ai: boolean) => ai ? <Tag>AI</Tag> : <Tag color="blue">人工</Tag>,
    },
    {
      title: "操作",
      key: "actions",
      width: 220,
      render: (_: any, record: any) => (
        <Space>
          <Tooltip title="查看详情">
            <Button type="link" icon={<EyeOutlined />} onClick={() => handleViewDetail(record)} />
          </Tooltip>
          <Tooltip title="编辑">
            <Button type="link" icon={<EditOutlined />} onClick={() => handleEdit(record)} />
          </Tooltip>
          {(record.aiReviewStatus === "PENDING" || record.aiReviewStatus === "NEEDS_REVIEW") && (
            <Tooltip title="审核通过">
              <Button type="link" icon={<CheckCircleOutlined />} style={{ color: "green" }} onClick={() => handleManualApprove(record.id)} />
            </Tooltip>
          )}
          <Tooltip title="删除">
            <Button type="link" danger icon={<DeleteOutlined />} onClick={() => handleDelete(record.id)} />
          </Tooltip>
        </Space>
      ),
    },
  ];

  // AI 生成的知识点选择 - 获取所有知识点
  const [allKPs, setAllKPs] = useState<any[]>([]);
  const genKpOptions = allKPs.map((kp) => ({
    value: kp.id,
    label: `${kp.parentName ? kp.parentName + " > " : ""}${kp.name}`,
  }));

  useEffect(() => {
    if (genModalOpen) {
      // 获取所有知识点
      const fetchAllKPs = async () => {
        try {
          const res = await apiClient.get("/knowledge-points?tree=true");
          setAllKPs(flattenTree(res.data.knowledgePoints));
        } catch {}
      };
      fetchAllKPs();
    }
  }, [genModalOpen]);

  useEffect(() => {
    if (editModalOpen && subjects.length > 0) {
      // 获取知识点用于编辑表单
      const fetchEditKPs = async () => {
        const res = await apiClient.get("/knowledge-points?tree=true");
        setEditKPs(flattenTree(res.data.knowledgePoints));
      };
      fetchEditKPs();
    }
  }, [editModalOpen]);

  return (
    <div>
      <div className="table-actions">
        <h2>题库管理</h2>
        <Space wrap>
          <Select
            allowClear
            placeholder="按科目筛选"
            style={{ width: 130 }}
            value={filterSubject}
            onChange={(v) => setFilterSubject(v)}
            options={subjects.map((s) => ({ value: s.id, label: s.name }))}
          />
          <Select
            allowClear
            placeholder="按知识点"
            style={{ width: 240 }}
            value={filterKP}
            onChange={(v) => setFilterKP(v)}
            options={knowledgePoints.map((kp) => ({
              value: kp.id,
              label: formatKPLabel(kp),
            }))}
            popupMatchSelectWidth={false}
            dropdownStyle={{ minWidth: 280 }}
          />
          <Select
            allowClear
            placeholder="Bloom层次"
            style={{ width: 120 }}
            value={filterBloom}
            onChange={(v) => setFilterBloom(v)}
            options={["REMEMBER", "UNDERSTAND", "APPLY", "ANALYZE", "EVALUATE", "CREATE"].map((l) => ({
              value: l,
              label: getBloomLevelLabel(l),
            }))}
          />
          <Select
            allowClear
            placeholder="评审状态"
            style={{ width: 110 }}
            value={filterReviewed}
            onChange={(v) => setFilterReviewed(v)}
            options={[
              { value: "PENDING", label: "待评审" },
              { value: "APPROVED", label: "已通过" },
              { value: "NEEDS_REVIEW", label: "需复核" },
            ]}
          />
          <Tooltip title="刷新">
            <Button icon={<ReloadOutlined />} onClick={fetchQuestions} />
          </Tooltip>
          <Button type="primary" icon={<RobotOutlined />} onClick={() => setGenModalOpen(true)}>
            AI 生成题目
          </Button>
        </Space>
      </div>

      <Card>
        <Table
          dataSource={questions}
          columns={columns}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 15 }}
          locale={{ emptyText: <Empty description="暂无题目，点击「AI 生成题目」开始创建" /> }}
        />
      </Card>

      {/* AI 生成题目模态框 */}
      <Modal
        title="🤖 AI 生成题目"
        open={genModalOpen}
        onCancel={() => { setGenModalOpen(false); setGenKPs([]); }}
        onOk={handleGenerate}
        confirmLoading={generating}
        okText="开始生成"
        cancelText="取消"
        width={600}
      >
        <div style={{ marginBottom: 16 }}>
          <Typography.Text type="secondary">
            AI 将根据选中的知识点，从多个认知层次（记忆、理解、应用、分析、评价、创造）生成不同题型的练习题。
          </Typography.Text>
        </div>
        <div style={{ marginBottom: 16 }}>
          <Typography.Text strong>选择知识点（可多选）：</Typography.Text>
        </div>
        <Select
          mode="multiple"
          style={{ width: "100%" }}
          placeholder="搜索并选择知识点..."
          value={genKPs}
          onChange={(v) => setGenKPs(v)}
          options={genKpOptions}
          showSearch
          filterOption={(input, option) =>
            (option?.label as string)?.toLowerCase().includes(input.toLowerCase())
          }
          notFoundContent={<Empty description="请先在知识点管理中添加知识点" />}
        />
        <div style={{ marginTop: 16, display: "flex", alignItems: "center", gap: 8 }}>
          <Typography.Text>生成数量：</Typography.Text>
          <Space.Compact>
            <InputNumber
              min={1}
              max={100}
              value={genCount}
              onChange={(v) => setGenCount(v || 20)}
              style={{ width: 80, textAlign: "center" }}
            />
            <div style={{ display: "flex", alignItems: "center", padding: "0 10px", background: "#f5f5f5", border: "1px solid #d9d9d9", borderLeft: "none", borderRadius: "0 6px 6px 0", fontSize: 14, color: "#666" }}>
              题
            </div>
          </Space.Compact>
        </div>
      </Modal>

      {/* 题目详情模态框 */}
      <Modal
        title="题目详情"
        open={detailModalOpen}
        onCancel={() => { setDetailModalOpen(false); setSelectedQuestion(null); }}
        footer={
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
            {selectedQuestion && (selectedQuestion.aiReviewStatus === "PENDING" || selectedQuestion.aiReviewStatus === "NEEDS_REVIEW") && (
              <Button type="primary" icon={<CheckCircleOutlined />} style={{ color: "#fff" }}
                onClick={async () => {
                  await handleManualApprove(selectedQuestion.id);
                  setDetailModalOpen(false);
                  setSelectedQuestion(null);
                }}>
                审核通过
              </Button>
            )}
            <Button onClick={() => { setDetailModalOpen(false); setSelectedQuestion(null); }}>关闭</Button>
          </div>
        }
        width={700}
      >
        {selectedQuestion && (
          <Descriptions column={2} bordered size="small" style={{ tableLayout: "fixed", width: "100%" }} styles={{ content: { whiteSpace: "pre-wrap", wordBreak: "break-word", overflowWrap: "break-word" } }}>
            <Descriptions.Item label="题型" span={1}>
              <Tag color={typeColors[selectedQuestion.type]}>{getQuestionTypeLabel(selectedQuestion.type)}</Tag>
            </Descriptions.Item>
            <Descriptions.Item label="Bloom 层次" span={1}>
              <Tag color={bloomColors[selectedQuestion.bloomLevel]}>{getBloomLevelLabel(selectedQuestion.bloomLevel)}</Tag>
            </Descriptions.Item>
            <Descriptions.Item label="难度" span={1}>
              <Tag color={difficultyColors[selectedQuestion.difficulty]}>{getDifficultyLabel(selectedQuestion.difficulty)}</Tag>
            </Descriptions.Item>
            <Descriptions.Item label="评审状态" span={1}>
              {selectedQuestion.aiReviewStatus === "APPROVED" ? (
                <Tag color="green">已通过</Tag>
              ) : selectedQuestion.aiReviewStatus === "NEEDS_REVIEW" ? (
                <Tag color="orange">需复核</Tag>
              ) : (
                <Tag>待评审</Tag>
              )}
            </Descriptions.Item>
            <Descriptions.Item label="AI 评分" span={1}>
              {selectedQuestion.aiReviewScore != null ? `${selectedQuestion.aiReviewScore}/100` : "-"}
            </Descriptions.Item>
            <Descriptions.Item label="来源" span={1}>
              {selectedQuestion.aiGenerated ? <Tag>AI 生成</Tag> : <Tag color="blue">人工录入</Tag>}
            </Descriptions.Item>
            <Descriptions.Item label="知识点" span={2}>
              <span style={{ wordBreak: "break-word" }}>{selectedQuestion.knowledgePoint?.name || "-"}</span>
            </Descriptions.Item>
            <Descriptions.Item label="题目内容" span={2}>
              <div style={{ background: "#f5f5f5", padding: 12, borderRadius: 6, wordBreak: "break-word", overflowWrap: "break-word", maxWidth: "100%" }}>
                {selectedQuestion.content}
              </div>
            </Descriptions.Item>
            {selectedQuestion.options?.length > 0 && (
              <Descriptions.Item label="选项" span={2}>
                <div>
                  {(selectedQuestion.options as string[]).map((opt: string, i: number) => (
                    <div key={i} style={{ padding: "2px 0" }}>{opt}</div>
                  ))}
                </div>
              </Descriptions.Item>
            )}
            <Descriptions.Item label="正确答案" span={2} contentStyle={{ wordBreak: "break-all", overflowWrap: "break-word" }}>
              <span style={{ display: "block", background: "#f6ffed", border: "1px solid #b7eb8f", color: "#52c41a", padding: "2px 8px", borderRadius: 4, wordBreak: "break-all", overflowWrap: "break-word", lineHeight: 1.8 }}>{selectedQuestion.correctAnswer}</span>
            </Descriptions.Item>
            {selectedQuestion.aiReviewStatus === "NEEDS_REVIEW" && selectedQuestion.aiReviewFeedback && (
              <Descriptions.Item label="AI 评审意见" span={2}>
                <div style={{ background: "#fff7e6", border: "1px solid #ffd591", padding: 12, borderRadius: 6 }}>
                  <Typography.Text strong>评审意见：</Typography.Text>
                  <p style={{ margin: "4px 0" }}>{selectedQuestion.aiReviewFeedback}</p>
                </div>
              </Descriptions.Item>
            )}
          </Descriptions>
        )}
      </Modal>

      {/* 编辑题目模态框 */}
      <Modal
        title="编辑题目"
        open={editModalOpen}
        onCancel={() => { setEditModalOpen(false); setEditingQuestion(null); }}
        onOk={handleSaveEdit}
        okText="保存"
        cancelText="取消"
        width={700}
      >
        <Form form={editForm} layout="vertical">
          <Form.Item name="knowledgePointId" label="知识点" rules={[{ required: true }]}>
            <Select
              showSearch
              placeholder="选择知识点"
              style={{ width: "100%" }}
              options={editKPs.map((kp) => ({
                value: kp.id,
                label: formatKPLabel(kp),
              }))}
              popupMatchSelectWidth={false}
              dropdownStyle={{ minWidth: 280 }}
              filterOption={(input, option) =>
                (option?.label as string)?.toLowerCase().includes(input.toLowerCase())
              }
            />
          </Form.Item>
          <Form.Item name="type" label="题型" rules={[{ required: true }]}>
            <Select
              options={[
                { value: "MULTIPLE_CHOICE", label: "选择题" },
                { value: "TF", label: "判断题" },
                { value: "FILL_BLANK", label: "填空题" },
                { value: "SHORT_ANSWER", label: "简答题" },
              ]}
            />
          </Form.Item>
          <Form.Item name="content" label="题目内容" rules={[{ required: true }]}>
            <Input.TextArea rows={4} />
          </Form.Item>
          <Form.Item name="correctAnswer" label="正确答案" rules={[{ required: true }]}>
            <Input.TextArea rows={2} />
          </Form.Item>
          <Space style={{ width: "100%" }}>
            <Form.Item name="difficulty" label="难度" rules={[{ required: true }]}>
              <Select style={{ width: 150 }}
                options={[
                  { value: "EASY", label: "简单" },
                  { value: "MEDIUM", label: "中等" },
                  { value: "HARD", label: "困难" },
                ]}
              />
            </Form.Item>
            <Form.Item name="bloomLevel" label="Bloom 层次" rules={[{ required: true }]}>
              <Select style={{ width: 150 }}
                options={["REMEMBER", "UNDERSTAND", "APPLY", "ANALYZE", "EVALUATE", "CREATE"].map((l) => ({
                  value: l,
                  label: getBloomLevelLabel(l),
                }))}
              />
            </Form.Item>
          </Space>
        </Form>
      </Modal>
    </div>
  );
}
