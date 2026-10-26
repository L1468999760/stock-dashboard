import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";

export const metadata: Metadata = {
  title: "行情与限购看板",
  description: "纳斯达克100 / 标普500 / 黄金实时行情与 QDII 基金每日限购额度",
};

/** 首帧前按 localStorage 同步主题(默认暗色,system 跟随系统),避免闪烁 */
const themeInit = `(function(){try{var t=localStorage.getItem("theme")||"dark";var d=t==="dark"||(t==="system"&&window.matchMedia("(prefers-color-scheme: dark)").matches);var el=document.documentElement;el.classList.toggle("dark",d);el.dataset.theme=t}catch(e){document.documentElement.classList.add("dark")}})()`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN" className="dark" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInit }} />
      </head>
      <body>
        {children}
        {/* Umami 统计分析(afterInteractive ≈ defer,不影响首屏) */}
        <Script
          defer
          src="https://traffic.lijinning.top/script.js"
          data-website-id="30f4202c-b3de-49c2-9fd9-60ab933667f7"
          strategy="afterInteractive"
        />
      </body>
    </html>
  );
}
