"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Form, Input, Button, message } from "antd";
import { UserOutlined, LockOutlined } from "@ant-design/icons";
import apiClient from "@/lib/api";
import { useUserStore } from "@/stores/userStore";

export default function LoginPage() {
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { setUser, setToken } = useUserStore();

  const onFinish = async (values: { username: string; password: string }) => {
    setLoading(true);
    try {
      const res = await apiClient.post("/auth/login", values);
      const { token, user } = res.data;
      setToken(token);
      setUser(user);

      // 根据角色跳转到对应的首页
      if (user.role === "ADMIN") {
        router.push("/dashboard/admin");
      } else if (user.role === "TEACHER") {
        router.push("/dashboard/teacher");
      } else {
        router.push("/dashboard/student");
      }
    } catch (error: any) {
      message.error(error.response?.data?.error || "登录失败");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <h1>📚 辅助学习系统</h1>
        <p className="subtitle">智能学习，因材施教</p>
        <Form
          name="login"
          onFinish={onFinish}
          layout="vertical"
          size="large"
        >
          <Form.Item
            name="username"
            rules={[{ required: true, message: "请输入用户名" }]}
          >
            <Input prefix={<UserOutlined />} placeholder="用户名" />
          </Form.Item>
          <Form.Item
            name="password"
            rules={[{ required: true, message: "请输入密码" }]}
          >
            <Input.Password prefix={<LockOutlined />} placeholder="密码" />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" block loading={loading}>
              登 录
            </Button>
          </Form.Item>
        </Form>
      </div>
    </div>
  );
}
