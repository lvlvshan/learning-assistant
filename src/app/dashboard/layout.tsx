"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Layout, Menu, Avatar, Dropdown, Typography, Spin } from "antd";
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
        <Spin size="large" tip="加载中..." />
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

  // 计算当前选中的菜单项
  const selectedKey = menuItems.find((item) => pathname.startsWith(item.key))?.key || menuItems[0]?.key;

  const userDropdownItems = {
    items: [
      { key: "profile", label: `${user.name} (${roleLabels[user.role]})`, disabled: true },
      { type: "divider" as const },
      { key: "logout", label: "退出登录", icon: <LogoutOutlined />, danger: true },
    ],
    onClick: ({ key }: { key: string }) => {
      if (key === "logout") handleLogout();
    },
  };

  return (
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
  );
}
