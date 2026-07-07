"use client";

import { useEffect, useState } from "react";
import {
  Card, Table, Input, Typography, Tag, Spin, Empty, Space,
  Button, Modal, Form, App,
} from "antd";
import { EyeOutlined, SearchOutlined, DeleteOutlined, KeyOutlined } from "@ant-design/icons";
import { useRouter } from "next/navigation";
import apiClient from "@/lib/api";

interface Student {
  id: string;
  name: string;
  username: string;
  role: string;
  classId: string | null;
  class?: { id: string; name: string; grade: string } | null;
}

export default function TeacherStudents() {
  const { message, modal } = App.useApp();
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const router = useRouter();
  const [passwordModalOpen, setPasswordModalOpen] = useState(false);
  const [resetStudent, setResetStudent] = useState<Student | null>(null);
  const [passwordForm] = Form.useForm();

  const fetchStudents = () => {
    setLoading(true);
    apiClient
      .get("/users?role=STUDENT")
      .then((res) => {
        setStudents(res.data.users);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  useEffect(() => {
    fetchStudents();
  }, []);

  // 重置密码
  const handleResetPassword = async () => {
    const values = await passwordForm.validateFields();
    try {
      await apiClient.put(`/users/${resetStudent!.id}`, {
        password: values.newPassword,
      });
      message.success("密码重置成功");
      setPasswordModalOpen(false);
      setResetStudent(null);
      passwordForm.resetFields();
    } catch (error: any) {
      message.error(error.response?.data?.error || "重置失败");
    }
  };

  // 删除学生
  const handleDelete = (student: Student) => {
    modal.confirm({
      title: `确认删除学生「${student.name}」`,
      content: `删除后该学生的所有数据（练习记录、答题记录等）将被永久删除，不可恢复。`,
      okText: "确认删除",
      cancelText: "取消",
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          await apiClient.delete(`/users/${student.id}`);
          message.success("删除成功");
          fetchStudents();
        } catch (error: any) {
          message.error(error.response?.data?.error || "删除失败");
        }
      },
    });
  };

  const filtered = students.filter(
    (s) =>
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.username.toLowerCase().includes(search.toLowerCase())
  );

  const columns = [
    { title: "姓名", dataIndex: "name", key: "name" },
    { title: "用户名", dataIndex: "username", key: "username" },
    {
      title: "班级",
      key: "class",
      render: (_: any, r: Student) =>
        r.class ? `${r.class.grade} ${r.class.name}` : "未分配",
    },
    {
      title: "操作",
      key: "actions",
      render: (_: any, r: Student) => (
        <Space>
          <Button
            type="link"
            icon={<EyeOutlined />}
            onClick={() => router.push(`/dashboard/teacher/students/${r.id}`)}
          >
            查看详情
          </Button>
          <Button
            type="link"
            icon={<KeyOutlined />}
            onClick={() => {
              setResetStudent(r);
              passwordForm.resetFields();
              setPasswordModalOpen(true);
            }}
          >
            重置密码
          </Button>
          <Button
            type="link"
            danger
            icon={<DeleteOutlined />}
            onClick={() => handleDelete(r)}
          >
            删除
          </Button>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div className="table-actions">
        <h2>学生管理</h2>
        <Input
          prefix={<SearchOutlined />}
          placeholder="搜索学生姓名或用户名..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ width: 250 }}
          allowClear
        />
      </div>
      <Card>
        <Table
          dataSource={filtered}
          columns={columns}
          rowKey="id"
          loading={loading}
          locale={{ emptyText: <Empty description="暂无学生" /> }}
          pagination={{ pageSize: 20 }}
        />
      </Card>

      {/* 重置密码模态框 */}
      <Modal
        title={`重置密码 — ${resetStudent?.name || ""}`}
        open={passwordModalOpen}
        onCancel={() => { setPasswordModalOpen(false); setResetStudent(null); passwordForm.resetFields(); }}
        onOk={handleResetPassword}
        okText="确认重置"
        cancelText="取消"
      >
        <Form form={passwordForm} layout="vertical">
          <Form.Item
            name="newPassword"
            label="新密码"
            rules={[
              { required: true, message: "请输入新密码" },
              { min: 6, message: "密码至少 6 位" },
            ]}
          >
            <Input.Password placeholder="输入新的登录密码（至少6位）" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
