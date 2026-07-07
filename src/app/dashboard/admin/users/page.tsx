"use client";

import { useEffect, useState } from "react";
import { Card, Table, Button, Modal, Form, Input, Select, Space, App, Tag } from "antd";
import { PlusOutlined, EditOutlined, DeleteOutlined, LockOutlined } from "@ant-design/icons";
import apiClient from "@/lib/api";

interface User {
  id: string;
  username: string;
  name: string;
  role: string;
  classId: string | null;
  class?: { id: string; name: string; grade: string } | null;
  createdAt: string;
}

const roleOptions = [
  { value: "STUDENT", label: "学生" },
  { value: "TEACHER", label: "教师" },
  { value: "ADMIN", label: "管理员" },
];

const roleColors: Record<string, string> = {
  STUDENT: "blue",
  TEACHER: "green",
  ADMIN: "red",
};

const roleLabels: Record<string, string> = {
  STUDENT: "学生",
  TEACHER: "教师",
  ADMIN: "管理员",
};

export default function UserManagement() {
  const { message, modal } = App.useApp();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [form] = Form.useForm();
  const [classes, setClasses] = useState<any[]>([]);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res = await apiClient.get("/users");
      setUsers(res.data.users);
    } finally {
      setLoading(false);
    }
  };

  const fetchClasses = async () => {
    try {
      const res = await apiClient.get("/classes");
      setClasses(res.data.classes);
    } catch {}
  };

  useEffect(() => {
    fetchUsers();
    fetchClasses();
  }, []);

  const handleSubmit = async () => {
    const values = await form.validateFields();
    try {
      if (editingUser) {
        await apiClient.put(`/users/${editingUser.id}`, values);
        message.success("更新成功");
      } else {
        await apiClient.post("/users", values);
        message.success("创建成功");
      }
      setModalOpen(false);
      form.resetFields();
      setEditingUser(null);
      fetchUsers();
    } catch (error: any) {
      message.error(error.response?.data?.error || "操作失败");
    }
  };

  const handleDelete = async (id: string) => {
    modal.confirm({
      title: "确认删除",
      content: "删除后不可恢复，确定删除该用户？",
      okText: "确认",
      cancelText: "取消",
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          await apiClient.delete(`/users/${id}`);
          message.success("删除成功");
          fetchUsers();
        } catch {
          message.error("删除失败");
        }
      },
    });
  };

  const openEdit = (user: User) => {
    setEditingUser(user);
    form.setFieldsValue({
      username: user.username,
      name: user.name,
      role: user.role,
      classId: user.classId,
      password: "",
    });
    setModalOpen(true);
  };

  const openCreate = () => {
    setEditingUser(null);
    form.resetFields();
    setModalOpen(true);
  };

  const columns = [
    { title: "用户名", dataIndex: "username", key: "username" },
    { title: "姓名", dataIndex: "name", key: "name" },
    {
      title: "角色",
      dataIndex: "role",
      key: "role",
      render: (role: string) => (
        <Tag color={roleColors[role]}>{roleLabels[role] || role}</Tag>
      ),
    },
    {
      title: "班级",
      key: "class",
      render: (_: any, record: User) =>
        record.class ? `${record.class.grade} ${record.class.name}` : "-",
    },
    { title: "创建时间", dataIndex: "createdAt", key: "createdAt", render: (v: string) => new Date(v).toLocaleDateString("zh-CN") },
    {
      title: "操作",
      key: "actions",
      render: (_: any, record: User) => (
        <Space>
          <Button type="link" icon={<EditOutlined />} onClick={() => openEdit(record)}>
            编辑
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
        <h2>用户管理</h2>
        <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
          新增用户
        </Button>
      </div>

      <Card>
        <Table
          dataSource={users}
          columns={columns}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 20 }}
        />
      </Card>

      <Modal
        title={editingUser ? "编辑用户" : "新增用户"}
        open={modalOpen}
        onCancel={() => { setModalOpen(false); form.resetFields(); setEditingUser(null); }}
        onOk={handleSubmit}
        okText="保存"
        cancelText="取消"
      >
        <Form form={form} layout="vertical">
          <Form.Item name="username" label="用户名" rules={[{ required: true, message: "请输入用户名" }]}>
            <Input disabled={!!editingUser} />
          </Form.Item>
          <Form.Item name="name" label="姓名" rules={[{ required: true, message: "请输入姓名" }]}>
            <Input />
          </Form.Item>
          <Form.Item name="password" label={editingUser ? "密码（留空不修改）" : "密码"} rules={editingUser ? [] : [{ required: true, message: "请输入密码" }]}>
            <Input.Password prefix={<LockOutlined />} placeholder={editingUser ? "留空不修改" : "至少6位"} />
          </Form.Item>
          <Form.Item name="role" label="角色" rules={[{ required: true }]}>
            <Select options={roleOptions} />
          </Form.Item>
          <Form.Item name="classId" label="班级">
            <Select allowClear placeholder="选择班级（学生必填）" options={classes.map((c) => ({ value: c.id, label: `${c.grade} ${c.name}` }))} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
