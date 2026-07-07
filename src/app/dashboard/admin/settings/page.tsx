"use client";

import { useEffect, useState } from "react";
import { Card, Form, Input, InputNumber, Select, Button, Switch, App, Alert, Typography, Space, Tag, Divider } from "antd";
import apiClient from "@/lib/api";

interface AIConfig {
  provider: string;
  endpoint: string;
  apiKey: string;
  model: string;
  maxTokens: number;
  temperature: number;
  enabled: boolean;
}

interface MinerUConfig {
  token: string;
  enabled: boolean;
}

export default function AISettings() {
  const { message } = App.useApp();
  const [form] = Form.useForm();
  const [config, setConfig] = useState<AIConfig | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  // MinerU 配置状态
  const [mineruForm] = Form.useForm();
  const [mineruConfig, setMineruConfig] = useState<MinerUConfig | null>(null);
  const [mineruLoading, setMineruLoading] = useState(false);
  const [mineruSaving, setMineruSaving] = useState(false);

  useEffect(() => {
    fetchConfig();
    fetchMineruConfig();
  }, []);

  const fetchMineruConfig = async () => {
    setMineruLoading(true);
    try {
      const res = await apiClient.get("/admin/settings?key=mineru-config");
      if (res.data.config) {
        setMineruConfig(res.data.config.value);
        mineruForm.setFieldsValue(res.data.config.value);
      } else {
        const defaultConfig: MinerUConfig = { token: "", enabled: false };
        setMineruConfig(defaultConfig);
        mineruForm.setFieldsValue(defaultConfig);
      }
    } finally {
      setMineruLoading(false);
    }
  };

  const handleMineruSave = async () => {
    const values = await mineruForm.validateFields();
    setMineruSaving(true);
    try {
      await apiClient.put("/admin/settings", {
        key: "mineru-config",
        value: values,
        description: "MinerU 文档解析配置",
      });
      setMineruConfig(values);
      message.success("MinerU 配置保存成功");
    } catch (error: any) {
      message.error(error.response?.data?.error || "保存失败");
    } finally {
      setMineruSaving(false);
    }
  };

  const fetchConfig = async () => {
    setLoading(true);
    try {
      const res = await apiClient.get("/admin/settings?key=ai-config");
      if (res.data.config) {
        setConfig(res.data.config.value);
        form.setFieldsValue(res.data.config.value);
      } else {
        // 设置默认值
        const defaultConfig: AIConfig = {
          provider: "openai-compatible",
          endpoint: "",
          apiKey: "",
          model: "gpt-4o",
          maxTokens: 2048,
          temperature: 0.7,
          enabled: false,
        };
        setConfig(defaultConfig);
        form.setFieldsValue(defaultConfig);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    const values = await form.validateFields();
    setSaving(true);
    try {
      await apiClient.put("/admin/settings", {
        key: "ai-config",
        value: values,
        description: "AI 提供商配置",
      });
      setConfig(values);
      message.success("配置保存成功");
    } catch (error: any) {
      message.error(error.response?.data?.error || "保存失败");
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    const values = await form.validateFields();
    if (!values.endpoint) {
      message.warning("请先填写 API 地址");
      return;
    }

    setTesting(true);
    try {
      // 通过服务端 API 代理测试，绕过浏览器 CORS 限制
      const res = await apiClient.post("/admin/settings/test", {
        endpoint: values.endpoint,
        apiKey: values.apiKey,
        model: values.model,
      });

      if (res.data.success) {
        message.success(res.data.message);
      } else {
        message.error(res.data.error);
      }
    } catch (error: any) {
      const errData = error.response?.data;
      if (errData?.error) {
        message.error(errData.error);
      } else {
        message.error(`无法连接到 AI 服务: ${error.message}`);
      }
    } finally {
      setTesting(false);
    }
  };

  return (
    <div>
      <h2 style={{ marginBottom: 24 }}>系统设置 — AI 提供商配置</h2>

      <Card title="AI 服务配置" loading={loading}>
        <Alert
          title="AI 提供商由管理员自行配置，系统不绑定任何特定厂商"
          description="推荐使用支持 OpenAI 兼容接口的模型。学校局域网可部署 Ollama + DeepSeek / Qwen2.5 等本地模型。"
          type="info"
          showIcon
          style={{ marginBottom: 24 }}
        />

        <Form
          form={form}
          layout="vertical"
          style={{ maxWidth: 600 }}
          onFinish={handleSave}
        >
          <Form.Item label="启用 AI 服务" name="enabled" valuePropName="checked">
            <Switch />
          </Form.Item>

          <Form.Item label="提供商类型" name="provider" rules={[{ required: true }]}>
            <Select
              options={[
                { value: "openai-compatible", label: "OpenAI 兼容接口" },
                { value: "ollama", label: "Ollama（本地部署）" },
                { value: "custom", label: "自定义" },
              ]}
            />
          </Form.Item>

          <Form.Item
            label="API 地址"
            name="endpoint"
            rules={[{ required: true, message: "请输入 API 地址" }]}
            extra="例如：https://api.openai.com/v1 或 http://192.168.1.100:11434/v1"
          >
            <Input placeholder="https://api.openai.com/v1" />
          </Form.Item>

          <Form.Item
            label="API Key"
            name="apiKey"
            extra="本地部署的模型可能不需要 API Key"
          >
            <Input.Password placeholder="sk-..." />
          </Form.Item>

          <Form.Item label="模型名称" name="model" rules={[{ required: true }]}>
            <Input placeholder="gpt-4o / qwen2.5:7b / deepseek-chat" />
          </Form.Item>

          <Form.Item label="最大 Token" name="maxTokens">
            <InputNumber min={256} max={32768} style={{ width: 200 }} />
          </Form.Item>

          <Form.Item label="温度 (Temperature)" name="temperature" extra="越低越确定，越高越有创造性">
            <InputNumber min={0} max={2} step={0.1} style={{ width: 200 }} />
          </Form.Item>

          <Space>
            <Button type="primary" htmlType="submit" loading={saving}>
              保存配置
            </Button>
            <Button onClick={handleTest} loading={testing}>
              测试连接
            </Button>
          </Space>
        </Form>

        {config && (
          <div style={{ marginTop: 24, padding: 16, background: "#f5f5f5", borderRadius: 8 }}>
            <Typography.Text type="secondary">
              当前状态：
              {config.enabled ? (
                <Tag color="green" style={{ marginLeft: 8 }}>已启用</Tag>
              ) : (
                <Tag style={{ marginLeft: 8 }}>未启用</Tag>
              )}
              <br />
              提供商：{config.provider} | 模型：{config.model} | 端点：{config.endpoint || "未配置"}
            </Typography.Text>
          </div>
        )}
      </Card>

      <Divider />

      <Card title="MinerU 文档解析配置" loading={mineruLoading} style={{ marginTop: 24 }}>
        <Alert
          title="MinerU 提供高精度文档解析能力（PDF/图片/PPT/Word/Excel → Markdown）"
          description="在上海人工智能实验室 mineru.net 注册并创建 Token 后填入此处。启用后，AI 分析资料时将优先使用 MinerU 提取文本，支持 PDF、图片等格式。"
          type="info"
          showIcon
          style={{ marginBottom: 24 }}
        />

        <Form
          form={mineruForm}
          layout="vertical"
          style={{ maxWidth: 600 }}
          onFinish={handleMineruSave}
        >
          <Form.Item label="启用 MinerU 文档解析" name="enabled" valuePropName="checked">
            <Switch />
          </Form.Item>

          <Form.Item
            label="API Token"
            name="token"
            rules={[{ required: false }]}
            extra="从 mineru.net 的「API 管理」页面创建。启用但留空时，系统将继续使用内置解析方案。"
          >
            <Input.Password placeholder="mineru_xxxxxxxxxxxxxxxx" />
          </Form.Item>

          <Space>
            <Button type="primary" htmlType="submit" loading={mineruSaving}>
              保存配置
            </Button>
          </Space>
        </Form>

        {mineruConfig && (
          <div style={{ marginTop: 24, padding: 16, background: "#f5f5f5", borderRadius: 8 }}>
            <Typography.Text type="secondary">
              MinerU 状态：
              {mineruConfig.enabled && mineruConfig.token ? (
                <Tag color="green" style={{ marginLeft: 8 }}>已启用</Tag>
              ) : mineruConfig.enabled && !mineruConfig.token ? (
                <Tag color="orange" style={{ marginLeft: 8 }}>已启用但未配置 Token</Tag>
              ) : (
                <Tag style={{ marginLeft: 8 }}>未启用</Tag>
              )}
              <br />
              {mineruConfig.token ? "Token 已配置" : "Token 未配置"}
              {mineruConfig.enabled ? " | 启用状态下 AI 分析将优先使用 MinerU" : " | 禁用状态下使用内置解析方案"}
            </Typography.Text>
          </div>
        )}
      </Card>
    </div>
  );
}
