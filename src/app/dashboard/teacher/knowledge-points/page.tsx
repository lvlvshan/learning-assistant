"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Card, Button, Select, Space, App, Tree, Empty, Spin, Modal, Form, Input, Tag, Typography, Tooltip, Dropdown,
} from "antd";
import {
  PlusOutlined, EditOutlined, DeleteOutlined, ApartmentOutlined,
  FileTextOutlined, ReloadOutlined, CaretRightOutlined, CaretDownOutlined,
} from "@ant-design/icons";
import apiClient from "@/lib/api";
import type { DataNode } from "antd/es/tree";

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

interface KnowledgePoint {
  id: string;
  name: string;
  description: string;
  subjectId: string;
  parentId: string | null;
  difficultyLevel: string;
  orderIndex: number;
  children?: KnowledgePoint[];
}

export default function TeacherKnowledgePoints() {
  const { message, modal } = App.useApp();
  const [subjects, setSubjects] = useState<any[]>([]);
  const [selectedSubject, setSelectedSubject] = useState<string>();
  const [treeData, setTreeData] = useState<DataNode[]>([]);
  const [expandedKeys, setExpandedKeys] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingKP, setEditingKP] = useState<KnowledgePoint | null>(null);
  const [parentId, setParentId] = useState<string | null>(null);
  const [form] = Form.useForm();

  const fetchSubjects = async () => {
    try {
      const res = await apiClient.get("/subjects");
      setSubjects(res.data.subjects);
    } catch {}
  };

  const fetchTree = useCallback(async () => {
    if (!selectedSubject) return;
    setLoading(true);
    try {
      const res = await apiClient.get(`/knowledge-points?tree=true&subjectId=${selectedSubject}`);
      const points = res.data.knowledgePoints || [];
      setTreeData(buildTreeData(points));
      // 切换科目时默认展开所有根节点
      setExpandedKeys(points.map((n: any) => n.id));
    } finally {
      setLoading(false);
    }
  }, [selectedSubject]);

  useEffect(() => {
    fetchSubjects();
  }, []);

  useEffect(() => {
    fetchTree();
  }, [fetchTree]);

  // 构建 Ant Design Tree 数据
  const buildTreeData = (points: KnowledgePoint[]): DataNode[] => {
    return points.map((p) => ({
      key: p.id,
      title: (
        <Space size={4}>
          <Tag color={difficultyColors[p.difficultyLevel]} style={{ marginRight: 4 }}>
            {difficultyLabels[p.difficultyLevel]}
          </Tag>
          <span>{p.name}</span>
          {p.description && (
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              — {p.description}
            </Typography.Text>
          )}
        </Space>
      ),
      icon: <FileTextOutlined />,
      children: p.children ? buildTreeData(p.children) : undefined,
    }));
  };

  // 添加子知识点
  const handleAddChild = (nodeKey: string) => {
    setEditingKP(null);
    setParentId(nodeKey);
    form.resetFields();
    form.setFieldsValue({ subjectId: selectedSubject });
    setModalOpen(true);
  };

  // 编辑知识点
  const handleEdit = (nodeKey: string) => {
    openEditModal(nodeKey);
    setParentId(null);
    setEditingKP({ id: nodeKey } as KnowledgePoint);
    form.resetFields();
    setModalOpen(true);
  };

  // 保存
  const handleSave = async () => {
    const values = await form.validateFields();
    try {
      if (editingKP) {
        await apiClient.put("/knowledge-points", { id: editingKP.id, ...values });
        message.success("更新成功");
      } else {
        await apiClient.post("/knowledge-points", { ...values, parentId });
        message.success("创建成功");
      }
      setModalOpen(false);
      form.resetFields();
      setEditingKP(null);
      setParentId(null);
      fetchTree();
    } catch (error: any) {
      message.error(error.response?.data?.error || "操作失败");
    }
  };

  // 删除
  const handleDelete = async (nodeKey: string) => {
    modal.confirm({
      title: "确认删除",
      content: "删除知识点后关联的题目将失去关联",
      okText: "确认",
      cancelText: "取消",
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          await apiClient.delete(`/knowledge-points?id=${nodeKey}`);
          message.success("删除成功");
          fetchTree();
        } catch (error: any) {
          message.error(error.response?.data?.error || "删除失败");
        }
      },
    });
  };

  // 树节点的右键菜单
  const treeNodeMenu = (nodeKey: string): any => ({
    items: [
      { key: "add", label: "添加子知识点", icon: <PlusOutlined /> },
      { key: "edit", label: "编辑", icon: <EditOutlined /> },
      { type: "divider" },
      { key: "delete", label: "删除", icon: <DeleteOutlined />, danger: true },
    ],
    onClick: ({ key }: { key: string }) => {
      if (key === "add") handleAddChild(nodeKey);
      else if (key === "edit") handleEdit(nodeKey);
      else if (key === "delete") handleDelete(nodeKey);
    },
  });

  // 打开编辑模态框
  const openEditModal = async (id: string) => {
    try {
      const allRes = await apiClient.get(`/knowledge-points?tree=true&subjectId=${selectedSubject}`);
      const findNode = (nodes: any[], key: string): any => {
        for (const n of nodes) {
          if (n.id === key) return n;
          if (n.children) {
            const found = findNode(n.children, key);
            if (found) return found;
          }
        }
        return null;
      };
      const node = findNode(allRes.data.knowledgePoints, id);
      if (node) {
        setEditingKP(node);
        setParentId(null);
        form.setFieldsValue({
          name: node.name,
          description: node.description,
          difficultyLevel: node.difficultyLevel,
          subjectId: node.subjectId,
        });
        setModalOpen(true);
      }
    } catch {}
  };

  // 展开/折叠切换
  const toggleExpand = (key: string) => {
    setExpandedKeys((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  };

  return (
    <div>
      <div className="table-actions">
        <h2>知识点管理</h2>
        <Space>
          <Select
            placeholder="选择科目"
            style={{ width: 150 }}
            value={selectedSubject}
            onChange={(v) => setSelectedSubject(v)}
            options={subjects.map((s) => ({ value: s.id, label: s.name }))}
            allowClear
          />
          <Tooltip title="刷新">
            <Button icon={<ReloadOutlined />} onClick={fetchTree} />
          </Tooltip>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            disabled={!selectedSubject}
            onClick={() => {
              setEditingKP(null);
              setParentId(null);
              form.resetFields();
              form.setFieldsValue({ subjectId: selectedSubject });
              setModalOpen(true);
            }}
          >
            添加根知识点
          </Button>
        </Space>
      </div>

      <Card>
        {!selectedSubject ? (
          <Empty description="请先选择一个科目" />
        ) : loading ? (
          <div style={{ textAlign: "center", padding: 40 }}>
            <Spin size="large" />
          </div>
        ) : treeData.length === 0 ? (
          <Empty description="暂无知识点，点击上方按钮添加">
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => {
                setEditingKP(null);
                setParentId(null);
                form.resetFields();
                form.setFieldsValue({ subjectId: selectedSubject });
                setModalOpen(true);
              }}
            >
              添加根知识点
            </Button>
          </Empty>
        ) : (
          <Tree
            showIcon
            expandedKeys={expandedKeys}
            onExpand={(keys) => setExpandedKeys(keys as string[])}
            treeData={treeData}
            titleRender={(node: any) => (
              <Dropdown menu={treeNodeMenu(node.key)} trigger={["contextMenu"]}>
                <span style={{ display: "flex", alignItems: "center" }}>
                  {node.children && node.children.length > 0 && (
                    <span
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleExpand(node.key);
                      }}
                      style={{ cursor: "pointer", marginRight: 4, userSelect: "none" }}
                    >
                      {expandedKeys.includes(node.key) ? (
                        <CaretDownOutlined />
                      ) : (
                        <CaretRightOutlined />
                      )}
                    </span>
                  )}
                  {node.title}
                </span>
              </Dropdown>
            )}
            style={{ fontSize: 14 }}
          />
        )}
      </Card>

      {/* 知识编辑模态框 */}
      <Modal
        title={editingKP ? "编辑知识点" : parentId ? "添加子知识点" : "添加根知识点"}
        open={modalOpen}
        onCancel={() => {
          setModalOpen(false);
          form.resetFields();
          setEditingKP(null);
          setParentId(null);
        }}
        onOk={handleSave}
        okText="保存"
        cancelText="取消"
      >
        <Form form={form} layout="vertical">
          <Form.Item name="subjectId" label="科目" rules={[{ required: true }]}>
            <Select
              disabled={!!selectedSubject}
              options={subjects.map((s) => ({ value: s.id, label: s.name }))}
            />
          </Form.Item>
          <Form.Item name="name" label="知识点名称" rules={[{ required: true, message: "请输入名称" }]}>
            <Input placeholder="如：函数的定义" />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <Input.TextArea rows={3} placeholder="简要描述该知识点的内容（可选）" />
          </Form.Item>
          <Form.Item name="difficultyLevel" label="难度等级" rules={[{ required: true }]}>
            <Select
              options={[
                { value: "BASIC", label: "基础" },
                { value: "INTERMEDIATE", label: "进阶" },
                { value: "ADVANCED", label: "高难" },
              ]}
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
