"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Form, Input, Button, Select, App } from "antd";
import { UserOutlined, LockOutlined, SmileOutlined } from "@ant-design/icons";
import apiClient from "@/lib/api";
import { useUserStore } from "@/stores/userStore";

interface ClassOption {
  id: string;
  name: string;
  grade: string;
}

export default function RegisterPage() {
  const [loading, setLoading] = useState(false);
  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [form] = Form.useForm();
  const router = useRouter();
  const { setUser, setToken } = useUserStore();
  const { message } = App.useApp();

  // 获取班级列表
  useEffect(() => {
    const fetchClasses = async () => {
      try {
        const res = await apiClient.get("/classes");
        setClasses(res.data.classes);
      } catch (error) {
        console.error("获取班级列表失败:", error);
      }
    };
    fetchClasses();
  }, []);

  const onFinish = async (values: {
    username: string;
    password: string;
    name: string;
    classId?: string;
  }) => {
    setLoading(true);
    try {
      const res = await apiClient.post("/auth/register", {
        username: values.username,
        password: values.password,
        name: values.name,
        classId: values.classId || undefined,
      });
      const { token, user } = res.data;
      setToken(token);
      setUser(user);
      message.success("注册成功！");
      // 等待 Zustand persist 完成后再跳转
      setTimeout(() => {
        router.push("/dashboard/student");
      }, 100);
    } catch (error: any) {
      message.error(error.response?.data?.error || "注册失败");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <h1>📚 创建账号</h1>
        <p className="subtitle">注册学生账号，开始学习</p>
        <Form
          form={form}
          name="register"
          onFinish={onFinish}
          layout="vertical"
          size="large"
          style={{ width: "100%" }}
        >
          <Form.Item
            name="username"
            rules={[{ required: true, message: "请输入用户名" }]}
          >
            <Input prefix={<UserOutlined />} placeholder="用户名" style={{ width: "100%" }} />
          </Form.Item>
          <Form.Item
            name="name"
            rules={[{ required: true, message: "请输入姓名" }]}
          >
            <Input prefix={<SmileOutlined />} placeholder="姓名" style={{ width: "100%" }} />
          </Form.Item>
          <Form.Item
            name="password"
            rules={[
              { required: true, message: "请输入密码" },
              { min: 6, message: "密码至少需要6个字符" },
            ]}
          >
            <Input.Password prefix={<LockOutlined />} placeholder="密码" style={{ width: "100%" }} />
          </Form.Item>
          <Form.Item
            name="confirm"
            dependencies={["password"]}
            rules={[
              { required: true, message: "请再次输入密码" },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || getFieldValue("password") === value) {
                    return Promise.resolve();
                  }
                  return Promise.reject(new Error("两次输入的密码不一致"));
                },
              }),
            ]}
          >
            <Input.Password prefix={<LockOutlined />} placeholder="确认密码" style={{ width: "100%" }} />
          </Form.Item>
          <Form.Item name="classId">
            <Select
              placeholder="选择班级（可选）"
              allowClear
              options={classes.map((c) => ({
                value: c.id,
                label: `${c.grade} - ${c.name}`,
              }))}
            />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" block loading={loading}>
              注 册
            </Button>
          </Form.Item>
        </Form>
        <div style={{ textAlign: "center" }}>
          已有账号？
          <Button
            type="link"
            onClick={() => router.push("/login")}
            style={{ padding: 0 }}
          >
            立即登录
          </Button>
        </div>
      </div>
    </div>
  );
}
