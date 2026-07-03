import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const hashedPassword = await bcrypt.hash("123456", 10);

  // 清空数据（按外键依赖顺序）
  await prisma.aIGenerationLog.deleteMany();
  await prisma.systemConfig.deleteMany();
  await prisma.masteryRecord.deleteMany();
  await prisma.studentWeakness.deleteMany();
  await prisma.exerciseAnswer.deleteMany();
  await prisma.exerciseSession.deleteMany();
  await prisma.question.deleteMany();
  await prisma.knowledgePoint.deleteMany();
  await prisma.materialChunk.deleteMany();
  await prisma.learningMaterial.deleteMany();
  await prisma.user.deleteMany();
  await prisma.subject.deleteMany();
  await prisma.class.deleteMany();

  // 创建班级
  const class1 = await prisma.class.create({ data: { name: "(1)班", grade: "高三" } });
  const class2 = await prisma.class.create({ data: { name: "(2)班", grade: "高三" } });
  const class3 = await prisma.class.create({ data: { name: "(1)班", grade: "高二" } });

  // 创建管理员
  await prisma.user.create({
    data: {
      username: "admin",
      password: hashedPassword,
      name: "系统管理员",
      role: "ADMIN",
    },
  });

  // 创建老师
  const teacher1 = await prisma.user.create({
    data: {
      username: "teacher1",
      password: hashedPassword,
      name: "张老师",
      role: "TEACHER",
      taughtClasses: { connect: [{ id: class1.id }, { id: class2.id }] },
    },
  });

  const teacher2 = await prisma.user.create({
    data: {
      username: "teacher2",
      password: hashedPassword,
      name: "李老师",
      role: "TEACHER",
      taughtClasses: { connect: [{ id: class3.id }] },
    },
  });

  // 创建学生
  const students = [
    { username: "student1", name: "李小明", classId: class1.id },
    { username: "student2", name: "王小红", classId: class1.id },
    { username: "student3", name: "赵小刚", classId: class1.id },
    { username: "student4", name: "陈小丽", classId: class2.id },
    { username: "student5", name: "周小华", classId: class2.id },
    { username: "student6", name: "吴晓明", classId: class3.id },
  ];

  for (const s of students) {
    await prisma.user.create({
      data: {
        username: s.username,
        password: hashedPassword,
        name: s.name,
        role: "STUDENT",
        classId: s.classId,
      },
    });
  }

  // 创建科目
  const math = await prisma.subject.create({
    data: { name: "数学", description: "数学科目，包含代数、几何、概率等", icon: "calculator" },
  });
  await prisma.subject.create({
    data: { name: "语文", description: "语文学科，包含文言文、现代文、作文等", icon: "book" },
  });
  await prisma.subject.create({
    data: { name: "英语", description: "英语学科，包含语法、阅读、写作等", icon: "language" },
  });
  await prisma.subject.create({
    data: { name: "物理", description: "物理学科，包含力学、电磁学、热学等", icon: "experiment" },
  });

  // 为数学创建示例知识点树
  const rootKP = await prisma.knowledgePoint.create({
    data: { name: "函数", description: "函数的概念与性质", subjectId: math.id, difficultyLevel: "BASIC", orderIndex: 1 },
  });
  await prisma.knowledgePoint.create({
    data: { name: "函数的定义", description: "映射关系与函数定义", subjectId: math.id, parentId: rootKP.id, difficultyLevel: "BASIC", orderIndex: 1 },
  });
  await prisma.knowledgePoint.create({
    data: { name: "函数的性质", description: "单调性、奇偶性、周期性", subjectId: math.id, parentId: rootKP.id, difficultyLevel: "BASIC", orderIndex: 2 },
  });
  await prisma.knowledgePoint.create({
    data: { name: "指数函数与对数函数", description: "指数运算与对数运算", subjectId: math.id, parentId: rootKP.id, difficultyLevel: "INTERMEDIATE", orderIndex: 3 },
  });
  await prisma.knowledgePoint.create({
    data: { name: "三角函数", description: "三角恒等变换与图像性质", subjectId: math.id, difficultyLevel: "INTERMEDIATE", orderIndex: 2 },
  });

  // 创建默认系统配置
  await prisma.systemConfig.create({
    data: {
      key: "ai-config",
      value: JSON.stringify({
        provider: "openai-compatible",
        endpoint: "",
        apiKey: "",
        model: "gpt-4o",
        maxTokens: 2048,
        temperature: 0.7,
        enabled: false,
      }),
      description: "AI 提供商配置",
    },
  });

  console.log("\n✓ Seed data created successfully!");
  console.log("\nDefault accounts (password: 123456):");
  console.log("  Admin:   admin");
  console.log("  Teacher: teacher1, teacher2");
  console.log("  Student: student1 ~ student6");
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
