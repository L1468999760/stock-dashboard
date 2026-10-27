"use client";

import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useState } from "react";
import type { Locale, T } from "@/lib/i18n";
import { makeT } from "@/lib/i18n";

const DEFAULT_LOCALE: Locale = "zh-CN";

const I18nContext = createContext<{ locale: Locale; t: T; setLocale: (l: Locale) => void }>({
  locale: DEFAULT_LOCALE,
  t: makeT(DEFAULT_LOCALE),
  setLocale: () => {},
});

/** SSR 阶段没有 window,退回 useEffect 避免 useLayoutEffect 服务端告警 */
const useIsoLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

/** 初始语言由 layout 内联脚本(显式选择 > 时区推断)写在 <html> dataset 上,首帧前同步避免闪中文 */
export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(DEFAULT_LOCALE);

  useIsoLayoutEffect(() => {
    const l = document.documentElement.dataset.locale;
    if (l === "zh-CN" || l === "zh-TW" || l === "en") setLocaleState(l);
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  // 只持久化用户显式选择;未选择时每次访问仍按时区解析
  const setLocale = useCallback((l: Locale) => {
    setLocaleState(l);
    try {
      localStorage.setItem("locale", l);
    } catch {
      /* 隐私模式等场景忽略 */
    }
  }, []);

  const value = useMemo(() => ({ locale, t: makeT(locale), setLocale }), [locale, setLocale]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  return useContext(I18nContext);
}
