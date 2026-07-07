import type { Metadata } from "next";
import AntdProvider from "@/components/AntdProvider";
import "./globals.css";

export const metadata: Metadata = {
  title: "辅助学习系统",
  description: "智能学习辅助平台",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <body>
        <AntdProvider>{children}</AntdProvider>
      </body>
    </html>
  );
}
