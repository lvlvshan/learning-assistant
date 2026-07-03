"use client";

import { useEffect, useState } from "react";
import { Card, Row, Col, Statistic, Table, Tag } from "antd";
import { TeamOutlined, BookOutlined, UserOutlined, ReadOutlined } from "@ant-design/icons";
import apiClient from "@/lib/api";

export default function AdminDashboard() {
  const [stats, setStats] = useState({ users: 0, students: 0, teachers: 0, classes: 0, subjects: 0 });

  useEffect(() => {
    Promise.all([
      apiClient.get("/users?role=STUDENT"),
      apiClient.get("/users?role=TEACHER"),
      apiClient.get("/classes"),
      apiClient.get("/subjects"),
      apiClient.get("/users"),
    ]).then(([students, teachers, classes, subjects, allUsers]) => {
      setStats({
        users: allUsers.data.users.length,
        students: students.data.users.length,
        teachers: teachers.data.users.length,
        classes: classes.data.classes.length,
        subjects: subjects.data.subjects.length,
      });
    });
  }, []);

  return (
    <div>
      <h2 style={{ marginBottom: 24 }}>管理概览</h2>
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic title="总用户数" value={stats.users} prefix={<UserOutlined />} />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic title="学生数" value={stats.students} prefix={<TeamOutlined />} />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic title="教师数" value={stats.teachers} prefix={<ReadOutlined />} />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic title="科目数" value={stats.subjects} prefix={<BookOutlined />} />
          </Card>
        </Col>
      </Row>
    </div>
  );
}
