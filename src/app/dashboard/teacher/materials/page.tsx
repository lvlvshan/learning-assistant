"use client";

import { useEffect, useState } from "react";
import {
  Card, Table, Button, Modal, Form, Input, Select, Upload, Space, App,
  Tag, Typography, Tooltip, Tabs, Alert, Tree,
} from "antd";
import {
  PlusOutlined, UploadOutlined, DeleteOutlined, FileTextOutlined,
  PictureOutlined, VideoCameraOutlined, FilePdfOutlined,
  RobotOutlined, EyeOutlined, InboxOutlined,
} from "@ant-design/icons";
import apiClient from "@/lib/api";
import type { UploadFile } from "antd";
import type { DataNode } from "antd/es/tree";

const typeIcons: Record<string, any> = {
  TEXT: FileTextOutlined,
  PDF: FilePdfOutlined,
  PPT: FileTextOutlined,
  IMAGE: PictureOutlined,
  VIDEO: VideoCameraOutlined,
};

const typeLabels: Record<string, string> = {
  TEXT: "文本",
  PDF: "PDF",
  PPT: "PPT",
  IMAGE: "图片",
  VIDEO: "视频",
};

const difficultyColors: Record<string, string> = {
  BASIC: "green",
  INTERMEDIATE: "orange",
  ADVANCED: "red",
};

const difficultyLabels: Record<string, string> = {
  BASIC: "基础",
  INTERMEDIATE: "进阶",
  ADVANCED: "高难",
};

export default function TeacherMaterials() {
  const { message: msg, modal } = App.useApp();
  const [materials, setMaterials] = useState<any[]>([]);
  const [subjects, setSubjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [analyzing, setAnalyzing] = useState<string[]>([]);
  const [analyzeResult, setAnalyzeResult] = useState<any>(null);
  const [analyzeModalOpen, setAnalyzeModalOpen] = useState(false);
  const [form] = Form.useForm();
  const [fileForm] = Form.useForm();
  const [subjectFilter, setSubjectFilter] = useState<string | undefined>();
  const [uploading, setUploading] = useState(false);
  const [fileList, setFileList] = useState<UploadFile[]>([]);

  // AI 分析节点选择器状态
  const [treeNodes, setTreeNodes] = useState<DataNode[]>([]);
  const [treeSelectOpen, setTreeSelectOpen] = useState(false);
  const [selectedNodeId, setSelectedNodeId] = useState<string>();
  const [analyzingTargetId, setAnalyzingTargetId] = useState<string>();

  const fetchMaterials = async () => {
    setLoading(true);
    try {
      const params = subjectFilter ? `?subjectId=${subjectFilter}` : "";
      const res = await apiClient.get(`/materials${params}`);
      setMaterials(res.data.materials);
    } finally {
      setLoading(false);
    }
  };

  const fetchSubjects = async () => {
    try {
      const res = await apiClient.get("/subjects");
      setSubjects(res.data.subjects);
    } catch {}
  };

  useEffect(() => {
    fetchMaterials();
    fetchSubjects();
  }, []);

  useEffect(() => {
    fetchMaterials();
  }, [subjectFilter]);

  // 加载指定科目的完整知识点树（用于选择器）
  const fetchTreeNodeList = async (subjectId: string) => {
    try {
      const res = await apiClient.get(`/knowledge-points?tree=true&subjectId=${subjectId}`);
      const points = res.data.knowledgePoints || [];
      // 确保每个节点都有 key 属性（Ant Design Tree 要求）
      const transformTree = (nodes: any[]): DataNode[] =>
        nodes.map((n) => ({
          key: n.id,
          name: n.name,
          description: n.description,
          difficultyLevel: n.difficultyLevel,
          children: n.children ? transformTree(n.children) : [],
        }));
      setTreeNodes(transformTree(points));
    } catch {}
  };

  // 创建文本资料
  const handleCreateText = async (values: any) => {
    try {
      await apiClient.post("/materials", values);
      msg.success("资料创建成功");
      setModalOpen(false);
      form.resetFields();
      fetchMaterials();
    } catch (error: any) {
      msg.error(error.response?.data?.error || "创建失败");
    }
  };

  // 上传文件
  const handleUpload = async () => {
    if (fileList.length === 0) {
      msg.warning("请选择文件");
      return;
    }
    const values = await fileForm.validateFields();
    setUploading(true);
    try {
      const formData = new FormData();
      const fileObj = fileList[0].originFileObj || fileList[0];
      formData.append("file", fileObj as Blob);
      formData.append("title", values.title);
      formData.append("subjectId", values.subjectId);

      const uploadRes = await apiClient.post("/materials/upload", formData);

      const { file } = uploadRes.data;

      // 创建资料记录（文件类型暂不提取文本内容）
      await apiClient.post("/materials", {
        title: values.title,
        content: `[文件] ${file.name} (${file.type})\n${file.url}`,
        type: file.type,
        subjectId: values.subjectId,
      });

      msg.success("上传成功");
      setModalOpen(false);
      fileForm.resetFields();
      setFileList([]);
      fetchMaterials();
    } catch (error: any) {
      msg.error(error.response?.data?.error || "上传失败");
    } finally {
      setUploading(false);
    }
  };

  // 点击 AI 分析 → 弹出节点选择器（无已有节点时直接分析）
  const handleAnalyze = async (id: string, record: any) => {
    setAnalyzingTargetId(id);
    try {
      const res = await apiClient.get(`/knowledge-points?tree=true&subjectId=${record.subjectId}`);
      const points = res.data.knowledgePoints || [];
      if (points.length === 0) {
        // 没有已有节点，直接分析（走默认逻辑：按科目创建根节点）
        startAnalyze(id, undefined);
      } else {
        // 有节点则弹出选择器
        const transformTree = (nodes: any[]): DataNode[] =>
          nodes.map((n) => ({
            key: n.id,
            name: n.name,
            description: n.description,
            difficultyLevel: n.difficultyLevel,
            children: n.children ? transformTree(n.children) : [],
          }));
        setTreeNodes(transformTree(points));
        setSelectedNodeId(undefined);
        setTreeSelectOpen(true);
      }
    } catch {}
  };

  // 执行分析（通用逻辑）
  const startAnalyze = async (id: string, nodeId?: string) => {
    setAnalyzing((prev) => [...prev, id]);
    try {
      const res = await apiClient.post(`/materials/${id}/analyze`, {
        rootId: nodeId,
      });
      setAnalyzeResult(res.data);
      setAnalyzeModalOpen(true);
      msg.success("知识点提取完成，请审核");
    } catch (error: any) {
      msg.error(error.response?.data?.error || "分析失败");
    } finally {
      setAnalyzing((prev) => prev.filter((x) => x !== id));
    }
  };

  // 确认分析（用户选择了节点后调用）
  const confirmAnalyze = async () => {
    setTreeSelectOpen(false);
    if (!analyzingTargetId) return;
    startAnalyze(analyzingTargetId, selectedNodeId);
  };

  // 删除资料
  const handleDelete = (id: string) => {
    modal.confirm({
      title: "确认删除",
      content: "删除后不可恢复，确定删除该资料？",
      okText: "确认",
      cancelText: "取消",
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          await apiClient.delete(`/materials/${id}`);
          msg.success("删除成功");
          fetchMaterials();
        } catch { msg.error("删除失败"); }
      },
    });
  };

  // 查看资料详情
  const handleView = (material: any) => {
    modal.info({
      title: material.title,
      width: 640,
      content: (
        <div style={{ maxHeight: 400, overflow: "auto" }}>
          <p><strong>类型：</strong>{typeLabels[material.type] || material.type}</p>
          <p><strong>科目：</strong>{material.subject?.name}</p>
          <p><strong>作者：</strong>{material.author?.name}</p>
          <p><strong>创建时间：</strong>{new Date(material.createdAt).toLocaleString("zh-CN")}</p>
          <hr style={{ margin: "12px 0" }} />
          <pre style={{ whiteSpace: "pre-wrap", fontSize: 13 }}>{material.content}</pre>
        </div>
      ),
      okText: "关闭",
    });
  };

  const columns = [
    {
      title: "标题",
      dataIndex: "title",
      key: "title",
      render: (title: string, record: any) => {
        const Icon = typeIcons[record.type] || FileTextOutlined;
        return (
          <Space>
            <Icon />
            <Typography.Link onClick={() => handleView(record)}>{title}</Typography.Link>
          </Space>
        );
      },
    },
    {
      title: "类型",
      dataIndex: "type",
      key: "type",
      width: 80,
      render: (type: string) => <Tag>{typeLabels[type] || type}</Tag>,
    },
    {
      title: "科目",
      key: "subject",
      width: 120,
      render: (_: any, record: any) => record.subject?.name || "-",
    },
    {
      title: "创建时间",
      dataIndex: "createdAt",
      key: "createdAt",
      width: 160,
      render: (v: string) => new Date(v).toLocaleString("zh-CN"),
    },
    {
      title: "操作",
      key: "actions",
      width: 240,
      render: (_: any, record: any) => (
        <Space>
          {["TEXT", "PPT", "PDF", "IMAGE", "DOC", "XLSX"].includes(record.type) && (
            <Tooltip title="AI 提取知识点">
              <Button
                type="link"
                icon={<RobotOutlined />}
                loading={analyzing.includes(record.id)}
                onClick={() => handleAnalyze(record.id, record)}
              >
                AI 分析
              </Button>
            </Tooltip>
          )}
          <Button type="link" icon={<EyeOutlined />} onClick={() => handleView(record)}>
            查看
          </Button>
          <Button type="link" danger icon={<DeleteOutlined />} onClick={() => handleDelete(record.id)}>
            删除
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div className="table-actions">
        <h2>学习资料</h2>
        <Space>
          <Select
            allowClear
            placeholder="按科目筛选"
            style={{ width: 150 }}
            value={subjectFilter}
            onChange={(v) => setSubjectFilter(v)}
            options={subjects.map((s) => ({ value: s.id, label: s.name }))}
          />
          <Button type="primary" icon={<PlusOutlined />} onClick={() => {
            form.resetFields();
            setFileList([]);
            setModalOpen(true);
          }}>
            新增资料
          </Button>
        </Space>
      </div>

      <Card>
        <Table
          dataSource={materials}
          columns={columns}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 15 }}
        />
      </Card>

      {/* 新增/编辑资料模态框 */}
      <Modal
        title="新增资料"
        open={modalOpen}
        onCancel={() => { setModalOpen(false); form.resetFields(); fileForm.resetFields(); setFileList([]); }}
        footer={null}
        width={640}
      >
        <Tabs
          items={[
            {
              key: "text",
              label: "📝 文本内容",
              children: (
                <Form form={form} layout="vertical" onFinish={handleCreateText}>
                  <Form.Item name="title" label="标题" rules={[{ required: true }]}>
                    <Input placeholder="输入资料标题" />
                  </Form.Item>
                  <Form.Item name="subjectId" label="科目" rules={[{ required: true }]}>
                    <Select
                      placeholder="选择科目"
                      options={subjects.map((s) => ({ value: s.id, label: s.name }))}
                    />
                  </Form.Item>
                  <Form.Item
                    name="content"
                    label="内容"
                    rules={[{ required: true, message: "请输入资料内容" }]}
                    extra="支持直接粘贴课本内容、讲义、笔记等文本"
                  >
                    <Input.TextArea rows={10} placeholder="粘贴或输入学习资料内容..." />
                  </Form.Item>
                  <Form.Item>
                    <Button type="primary" htmlType="submit">
                      创建资料
                    </Button>
                  </Form.Item>
                </Form>
              ),
            },
            {
              key: "file",
              label: "📁 上传文件",
              children: (
                <Form form={fileForm} layout="vertical" onFinish={handleUpload}>
                  <Form.Item name="title" label="标题" rules={[{ required: true }]}>
                    <Input placeholder="输入资料标题" />
                  </Form.Item>
                  <Form.Item name="subjectId" label="科目" rules={[{ required: true }]}>
                    <Select
                      placeholder="选择科目"
                      options={subjects.map((s) => ({ value: s.id, label: s.name }))}
                    />
                  </Form.Item>
                  <Form.Item label="文件" required>
                    <Upload.Dragger
                      multiple={false}
                      fileList={fileList}
                      beforeUpload={(file) => {
                        setFileList([file as UploadFile]);
                        // 自动用文件名（去掉扩展名）填充标题
                        const fileName = file.name.replace(/\.[^.]+$/, "");
                        fileForm.setFieldValue("title", fileName);
                        return false;
                      }}
                      onRemove={() => setFileList([])}
                      accept=".pdf,.ppt,.pptx,.jpg,.jpeg,.png,.gif,.mp4,.txt,.doc,.docx,.xls,.xlsx"
                    >
                      <p className="ant-upload-drag-icon"><InboxOutlined /></p>
                      <p className="ant-upload-text">点击或拖拽文件到此区域上传</p>
                      <p className="ant-upload-hint">支持 PDF、图片、视频、TXT 等格式</p>
                    </Upload.Dragger>
                  </Form.Item>
                  <Form.Item>
                    <Button type="primary" htmlType="submit" loading={uploading}>
                      上传
                    </Button>
                  </Form.Item>
                </Form>
              ),
            },
          ]}
        />
      </Modal>

      {/* AI 分析结果展示 */}
      <Modal
        title="🤖 AI 知识点提取结果"
        open={analyzeModalOpen}
        onCancel={() => { setAnalyzeModalOpen(false); setAnalyzeResult(null); }}
        footer={[
          <Button key="close" onClick={() => { setAnalyzeModalOpen(false); setAnalyzeResult(null); }}>
            关闭
          </Button>,
        ]}
        width={700}
      >
        {analyzeResult && (
          <div>
            <Alert
              title="AI 提取的知识点已自动保存到知识点库，请前往「知识点管理」查看和编辑。"
              type="success"
              showIcon
              style={{ marginBottom: 16 }}
            />
            <Typography.Title level={5}>提取结果预览</Typography.Title>
            {renderKnowledgePoints(analyzeResult.knowledgePoints || [])}
          </div>
        )}
      </Modal>

      {/* 节点选择器 */}
      <Modal
        title="选择目标节点"
        open={treeSelectOpen}
        onOk={confirmAnalyze}
        onCancel={() => setTreeSelectOpen(false)}
        footer={[
          <Button key="cancel" onClick={() => setTreeSelectOpen(false)}>取消</Button>,
          <Button
            key="submit"
            type="primary"
            disabled={!selectedNodeId}
            onClick={confirmAnalyze}
          >
            确认分析
          </Button>,
        ]}
        width={480}
      >
        <Tree
          showIcon
          defaultExpandAll
          treeData={treeNodes}
          onSelect={(selectedKeys) => setSelectedNodeId(selectedKeys?.[0] as string)}
          titleRender={(node: any) => (
            <Space size={4}>
              <Tag color={difficultyColors[node.difficultyLevel]} style={{ marginRight: 4 }}>
                {difficultyLabels[node.difficultyLevel]}
              </Tag>
              <span>{node.name}</span>
              {node.description && (
                <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                  — {node.description}
                </Typography.Text>
              )}
            </Space>
          )}
        />
        <Typography.Text type="secondary" style={{ display: "block", marginTop: 8 }}>
          选择后将把 AI 提取的知识点合并到该节点下（同名去重，不同名追加）
        </Typography.Text>
      </Modal>
    </div>
  );
}

// 递归渲染知识点树
function renderKnowledgePoints(points: any[], level = 0): React.ReactNode {
  if (!points || points.length === 0) return <Typography.Text type="secondary">无</Typography.Text>;

  return (
    <ul style={{ paddingLeft: level > 0 ? 20 : 0, listStyle: "none" }}>
      {points.map((p: any, i: number) => (
        <li key={i} style={{ margin: "4px 0" }}>
          <Space>
            <Tag color={p.difficulty === "BASIC" ? "green" : p.difficulty === "INTERMEDIATE" ? "orange" : "red"}>
              {p.difficulty === "BASIC" ? "基础" : p.difficulty === "INTERMEDIATE" ? "进阶" : "高难"}
            </Tag>
            <strong>{p.name}</strong>
            <Typography.Text type="secondary">{p.description}</Typography.Text>
          </Space>
          {p.children && p.children.length > 0 && renderKnowledgePoints(p.children, level + 1)}
        </li>
      ))}
    </ul>
  );
}
