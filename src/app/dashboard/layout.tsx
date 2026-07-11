"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Layout, Menu, Avatar, Dropdown, Typography, Spin, Modal, Form, Input } from "antd";
import {
  DashboardOutlined,
  UserOutlined,
  BookOutlined,
  TeamOutlined,
  SettingOutlined,
  FileTextOutlined,
  QuestionCircleOutlined,
  BarChartOutlined,
  LogoutOutlined,
  ReadOutlined,
  LockOutlined,
} from "@ant-design/icons";
import { useUserStore } from "@/stores/userStore";
import apiClient from "@/lib/api";

const { Sider, Content, Header } = Layout;

const roleLabels: Record<string, string> = {
  ADMIN: "系统管理员",
  TEACHER: "教师",
  STUDENT: "学生",
};

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, token, setUser, logout } = useUserStore();
  const [loading, setLoading] = useState(true);
  const [collapsed, setCollapsed] = useState(false);
  const [passwordModalOpen, setPasswordModalOpen] = useState(false);
  const [passwordForm] = Form.useForm();

  useEffect(() => {
    // zustand v5 persist 恢复是异步的（Promise-based microtask）
    // 首次渲染时 token 为 null，需要等恢复完成再判断
    const checkAuth = () => {
      const currentToken = useUserStore.getState().token;
      if (!currentToken) {
        router.push("/login");
        return;
      }

      apiClient
        .get("/auth/me")
        .then((res) => {
          setUser(res.data.user);
          setLoading(false);
        })
        .catch(() => {
          logout();
          router.push("/login");
        });
    };

    // 先订阅 store 变化，在恢复完成时立即处理
    let unsub: (() => void) | null = null;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    unsub = useUserStore.subscribe((state, prevState) => {
      if (state.token && !prevState?.token) {
        unsub?.();
        if (timeoutId) clearTimeout(timeoutId);
        checkAuth();
      }
    });

    const currentToken = useUserStore.getState().token;
    if (currentToken) {
      unsub();
      checkAuth();
    } else {
      // 等待 hydration 完成后 store 更新 token
      // 超时保护：非登录用户直接跳转登录页
      timeoutId = setTimeout(() => {
        unsub?.();
        if (!useUserStore.getState().token) {
          router.push("/login");
        }
      }, 500);
    }

    return () => {
      unsub?.();
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, []);

  if (loading || !user) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "100vh" }}>
        <Spin size="large" description="加载中..." />
      </div>
    );
  }

  // 根据角色生成菜单
  const menuItems: any[] = [];

  // 所有角色通用
  if (user.role === "STUDENT") {
    menuItems.push(
      { key: "/dashboard/student", icon: <DashboardOutlined />, label: "我的学习" },
      { key: "/dashboard/student/practice", icon: <ReadOutlined />, label: "开始练习" },
      { key: "/dashboard/student/progress", icon: <BarChartOutlined />, label: "学习进度" },
      { key: "/dashboard/student/results", icon: <FileTextOutlined />, label: "练习记录" }
    );
  }

  if (user.role === "TEACHER") {
    menuItems.push(
      { key: "/dashboard/teacher", icon: <DashboardOutlined />, label: "教学看板" },
      { key: "/dashboard/teacher/materials", icon: <FileTextOutlined />, label: "学习资料" },
      { key: "/dashboard/teacher/knowledge-points", icon: <QuestionCircleOutlined />, label: "知识点管理" },
      { key: "/dashboard/teacher/questions", icon: <BookOutlined />, label: "题库管理" },
      { key: "/dashboard/teacher/students", icon: <TeamOutlined />, label: "学生管理" },
      { key: "/dashboard/teacher/class-analysis", icon: <BarChartOutlined />, label: "班级分析" }
    );
  }

  if (user.role === "ADMIN") {
    menuItems.push(
      { key: "/dashboard/admin", icon: <DashboardOutlined />, label: "管理概览" },
      { key: "/dashboard/admin/users", icon: <UserOutlined />, label: "用户管理" },
      { key: "/dashboard/admin/classes", icon: <TeamOutlined />, label: "班级管理" },
      { key: "/dashboard/admin/subjects", icon: <BookOutlined />, label: "科目管理" },
      { key: "/dashboard/admin/settings", icon: <SettingOutlined />, label: "系统设置" }
    );
  }

  const handleMenuClick = (e: { key: string }) => {
    router.push(e.key);
  };

  const handleLogout = () => {
    logout();
    router.push("/login");
  };

  const handleChangePassword = async () => {
    try {
      const values = await passwordForm.validateFields();
      if (values.newPassword !== values.confirmPassword) {
        Modal.error({ title: "密码不一致", content: "两次输入的新密码不一致" });
        return;
      }
      try {
        await apiClient.post("/auth/change-password", {
          oldPassword: values.oldPassword,
          newPassword: values.newPassword,
        });
        Modal.success({ title: "密码修改成功" });
        setPasswordModalOpen(false);
        passwordForm.resetFields();
      } catch (error: any) {
        Modal.error({ title: "修改失败", content: error.response?.data?.error || "请检查旧密码" });
      }
    } catch {}
  };

  // 计算当前选中的菜单项
  const selectedKey = menuItems.find((item) => pathname.startsWith(item.key))?.key || menuItems[0]?.key;

  const userDropdownItems = {
    items: [
      { key: "profile", label: `${user.name} (${roleLabels[user.role]})`, disabled: true },
      { type: "divider" as const },
      { key: "changePassword", label: "修改密码", icon: <LockOutlined /> },
      { key: "logout", label: "退出登录", icon: <LogoutOutlined />, danger: true },
    ],
    onClick: ({ key }: { key: string }) => {
      if (key === "logout") handleLogout();
      else if (key === "changePassword") setPasswordModalOpen(true);
    },
  };

  return (
    <>
    <Layout style={{ minHeight: "100vh" }}>
      <Sider
        collapsible
        collapsed={collapsed}
        onCollapse={setCollapsed}
        className="sidebar"
        theme="dark"
      >
        <div style={{ height: 64, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Typography.Title
            level={4}
            style={{ color: "#fff", margin: 0, fontSize: collapsed ? 14 : 16 }}
          >
            {collapsed ? "📚" : "📚 辅助学习"}
          </Typography.Title>
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[selectedKey]}
          items={menuItems}
          onClick={handleMenuClick}
        />
      </Sider>
      <Layout>
        <Header
          style={{
            background: "#fff",
            padding: "0 24px",
            display: "flex",
            justifyContent: "flex-end",
            alignItems: "center",
            borderBottom: "1px solid #f0f0f0",
          }}
        >
          <Dropdown menu={userDropdownItems} placement="bottomRight">
            <div style={{ cursor: "pointer", display: "flex", alignItems: "center", gap: 8 }}>
              <Avatar icon={<UserOutlined />} style={{ backgroundColor: "#1677ff" }} />
              <span>{user.name}</span>
            </div>
          </Dropdown>
        </Header>
        <Content className="content-area">{children}</Content>
      </Layout>
    </Layout>

    {/* 修改密码模态框 */}
    <Modal
      title="修改密码"
      open={passwordModalOpen}
      onCancel={() => { setPasswordModalOpen(false); passwordForm.resetFields(); }}
      onOk={handleChangePassword}
      okText="确认"
      cancelText="取消"
    >
      <Form form={passwordForm} layout="vertical">
        <Form.Item name="oldPassword" label="旧密码" rules={[{ required: true, message: "请输入旧密码" }]}>
          <Input.Password />
        </Form.Item>
        <Form.Item name="newPassword" label="新密码" rules={[{ required: true, message: "请输入新密码" }, { min: 6, message: "至少6位" }]}>
          <Input.Password />
        </Form.Item>
        <Form.Item
          name="confirmPassword"
          label="确认新密码"
          rules={[{ required: true, message: "请确认新密码" }]}
        >
          <Input.Password />
        </Form.Item>
      </Form>
    </Modal>
    </>
  );
}