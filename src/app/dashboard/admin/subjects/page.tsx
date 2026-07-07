"use client";

import { useEffect, useState } from "react";
import { Card, Table, Button, Modal, Form, Input, Space, App, Tag } from "antd";
import { PlusOutlined, EditOutlined, DeleteOutlined } from "@ant-design/icons";
import apiClient from "@/lib/api";

export default function SubjectManagement() {
  const { message, modal } = App.useApp();
  const [subjects, setSubjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingSubject, setEditingSubject] = useState<any>(null);
  const [form] = Form.useForm();

  const fetchSubjects = async () => {
    setLoading(true);
    try {
      const res = await apiClient.get("/subjects");
      setSubjects(res.data.subjects);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchSubjects(); }, []);

  const handleSubmit = async () => {
    const values = await form.validateFields();
    try {
      if (editingSubject) {
        await apiClient.put("/subjects", { id: editingSubject.id, ...values });
        message.success("更新成功");
      } else {
        await apiClient.post("/subjects", values);
        message.success("创建成功");
      }
      setModalOpen(false);
      form.resetFields();
      setEditingSubject(null);
      fetchSubjects();
    } catch (error: any) {
      message.error(error.response?.data?.error || "操作失败");
    }
  };

  const handleDelete = async (id: string) => {
    modal.confirm({
      title: "确认删除",
      okText: "确认",
      cancelText: "取消",
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          await apiClient.delete(`/subjects?id=${id}`);
          message.success("删除成功");
          fetchSubjects();
        } catch { message.error("删除失败"); }
      },
    });
  };

  const columns = [
    { title: "科目名称", dataIndex: "name", key: "name" },
    { title: "描述", dataIndex: "description", key: "description", ellipsis: true },
    { title: "资料数", dataIndex: "materialCount", key: "materialCount" },
    { title: "知识点数", dataIndex: "knowledgePointCount", key: "knowledgePointCount" },
    {
      title: "操作", key: "actions",
      render: (_: any, record: any) => (
        <Space>
          <Button type="link" icon={<EditOutlined />} onClick={() => { setEditingSubject(record); form.setFieldsValue(record); setModalOpen(true); }}>编辑</Button>
          <Button type="link" danger icon={<DeleteOutlined />} onClick={() => handleDelete(record.id)}>删除</Button>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div className="table-actions">
        <h2>科目管理</h2>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => { setEditingSubject(null); form.resetFields(); setModalOpen(true); }}>
          新增科目
        </Button>
      </div>
      <Card>
        <Table dataSource={subjects} columns={columns} rowKey="id" loading={loading} />
      </Card>
      <Modal title={editingSubject ? "编辑科目" : "新增科目"} open={modalOpen} onCancel={() => { setModalOpen(false); setEditingSubject(null); }} onOk={handleSubmit} okText="保存" cancelText="取消">
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="科目名称" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <Input.TextArea rows={3} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
