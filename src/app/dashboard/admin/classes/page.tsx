"use client";

import { useEffect, useState } from "react";
import { Card, Table, Button, Modal, Form, Input, Space, App } from "antd";
import { PlusOutlined, EditOutlined, DeleteOutlined } from "@ant-design/icons";
import apiClient from "@/lib/api";

export default function ClassManagement() {
  const { message, modal } = App.useApp();
  const [classes, setClasses] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingClass, setEditingClass] = useState<any>(null);
  const [form] = Form.useForm();

  const fetchClasses = async () => {
    setLoading(true);
    try {
      const res = await apiClient.get("/classes");
      setClasses(res.data.classes);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchClasses(); }, []);

  const handleSubmit = async () => {
    const values = await form.validateFields();
    try {
      if (editingClass) {
        await apiClient.put(`/classes/${editingClass.id}`, values);
        message.success("更新成功");
      } else {
        await apiClient.post("/classes", values);
        message.success("创建成功");
      }
      setModalOpen(false);
      form.resetFields();
      setEditingClass(null);
      fetchClasses();
    } catch (error: any) {
      message.error(error.response?.data?.error || "操作失败");
    }
  };

  const handleDelete = async (id: string) => {
    modal.confirm({
      title: "确认删除",
      content: "删除班级不会删除关联的学生，但学生将无班级归属",
      okText: "确认",
      cancelText: "取消",
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          await apiClient.delete(`/classes/${id}`);
          message.success("删除成功");
          fetchClasses();
        } catch { message.error("删除失败"); }
      },
    });
  };

  const openEdit = (cls: any) => {
    setEditingClass(cls);
    form.setFieldsValue({ name: cls.name, grade: cls.grade });
    setModalOpen(true);
  };

  const columns = [
    { title: "年级", dataIndex: "grade", key: "grade" },
    { title: "班级名称", dataIndex: "name", key: "name" },
    { title: "学生人数", dataIndex: "studentCount", key: "studentCount" },
    {
      title: "操作", key: "actions",
      render: (_: any, record: any) => (
        <Space>
          <Button type="link" icon={<EditOutlined />} onClick={() => openEdit(record)}>编辑</Button>
          <Button type="link" danger icon={<DeleteOutlined />} onClick={() => handleDelete(record.id)}>删除</Button>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div className="table-actions">
        <h2>班级管理</h2>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => { setEditingClass(null); form.resetFields(); setModalOpen(true); }}>
          新增班级
        </Button>
      </div>
      <Card>
        <Table dataSource={classes} columns={columns} rowKey="id" loading={loading} />
      </Card>
      <Modal title={editingClass ? "编辑班级" : "新增班级"} open={modalOpen} onCancel={() => { setModalOpen(false); setEditingClass(null); }} onOk={handleSubmit} okText="保存" cancelText="取消">
        <Form form={form} layout="vertical">
          <Form.Item name="grade" label="年级" rules={[{ required: true }]}>
            <Input placeholder="如：高三" />
          </Form.Item>
          <Form.Item name="name" label="班级名称" rules={[{ required: true }]}>
            <Input placeholder="如：(1)班" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
