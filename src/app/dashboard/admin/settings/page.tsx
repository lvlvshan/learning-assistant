"use client";

import { useEffect, useState } from "react";
import { Card, Form, Input, InputNumber, Select, Button, Switch, App, Alert, Typography, Space, Tag } from "antd";
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

export default function AISettings() {
  const { message } = App.useApp();
  const [form] = Form.useForm();
  const [config, setConfig] = useState<AIConfig | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    fetchConfig();
  }, []);

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
          message="AI 提供商由管理员自行配置，系统不绑定任何特定厂商"
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
    </div>
  );
}
