import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";
import { I18nProvider } from "@/components/I18nProvider";

export const metadata: Metadata = {
  title: "行情与限购看板",
  description: "纳斯达克100 / 标普500 / 黄金实时行情与 QDII 基金每日限购额度",
};

/** 首帧前按 localStorage 同步主题(默认暗色;历史 system 值按系统偏好折算成亮/暗),避免闪烁 */
const themeInit = `(function(){try{var t=localStorage.getItem("theme");if(t==="system"){t=window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"}if(t!=="light"&&t!=="dark"){t="dark"}localStorage.setItem("theme",t);var el=document.documentElement;el.classList.toggle("dark",t==="dark");el.dataset.theme=t}catch(e){document.documentElement.classList.add("dark")}})()`;

/** 首帧前解析语言:显式选择 > 时区推断(中国大陆→简体,港台澳→繁体,其它→英文),写入 dataset 供 I18nProvider 同步 */
const localeInit = `(function(){try{var s=localStorage.getItem("locale");var l=s==="zh-CN"||s==="zh-TW"||s==="en"?s:"";if(!l){var tz="";try{tz=Intl.DateTimeFormat().resolvedOptions().timeZone||""}catch(e){}l=tz==="Asia/Shanghai"||tz==="Asia/Chongqing"||tz==="Asia/Urumqi"||tz==="Asia/Harbin"?"zh-CN":tz==="Asia/Taipei"||tz==="Asia/Hong_Kong"||tz==="Asia/Macau"?"zh-TW":"en"}document.documentElement.dataset.locale=l}catch(e){document.documentElement.dataset.locale="en"}})()`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN" className="dark" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInit }} />
        <script dangerouslySetInnerHTML={{ __html: localeInit }} />
      </head>
      <body>
        <I18nProvider>{children}</I18nProvider>
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
