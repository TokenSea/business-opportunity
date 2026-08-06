import "@ant-design/v5-patch-for-react-19";
import type { Metadata } from "next";
import { AntdRegistry } from "@ant-design/nextjs-registry";
import { App as AntApp, ConfigProvider } from "antd";
import zhCN from "antd/locale/zh_CN";
import { QueryProvider } from "@/components/QueryProvider";
import "./globals.css";

export const metadata: Metadata = {
  title: "商机云台",
  description: "商机、合同、付款及供应商管理系统",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>
        <AntdRegistry>
          <ConfigProvider
            locale={zhCN}
            theme={{
              token: {
                colorPrimary: "#2563eb",
                borderRadius: 10,
                fontFamily: 'Inter, "PingFang SC", "Microsoft YaHei", sans-serif',
              },
            }}
          >
            <AntApp><QueryProvider>{children}</QueryProvider></AntApp>
          </ConfigProvider>
        </AntdRegistry>
      </body>
    </html>
  );
}
