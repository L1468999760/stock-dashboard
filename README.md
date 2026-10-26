# 基金行情与限购看板

纳斯达克100 / 标普500 / 黄金 / 红利低波的实时行情与历史走势，叠加国内 QDII 基金每日限购额度跟踪。

体验地址：https://road2rich.top

## 功能

### 大盘看板

![image-20261026234310251](https://cloud.lijinning.top/api/raw/?path=/%E5%9B%BE%E7%89%87/%E5%9B%BE%E5%BA%8A/stock0.png)

- 纳斯达克100/标普500/黄金/红利低波今日行情
- 黄金支持国内/国际切换
- 系统5分钟自动同步，支持手动触发同步
- 主题切换

### 历史走势

![image-20261026234427520](https://cloud.lijinning.top/api/raw/?path=/%E5%9B%BE%E7%89%87/%E5%9B%BE%E5%BA%8A/stock1.png)

+ 支持3个月/6个月/1年/3年筛选
+ 支持年线/月线
+ 黄金单独支持美元指数/CPI
+ 红利低波单独支持股息率/股债利差

### QDII每日限购

![image-20261026234457953](https://cloud.lijinning.top/api/raw/?path=/%E5%9B%BE%E7%89%87/%E5%9B%BE%E5%BA%8A/stock2.png)

+ 支持纳斯达克100/标普500场外限购额度展示
+ 基金编号展示

### 纳斯达克主动基金

![image-20261026234519922](https://cloud.lijinning.top/api/raw/?path=/%E5%9B%BE%E7%89%87/%E5%9B%BE%E5%BA%8A/stock3.png)

+ 支持基金编号/规模/海外占比/涨跌幅/限额展示
+ 支持限额/涨跌幅/美股占比/基金规模排序

## 技术栈

Next.js + Tailwind CSS + ECharts + Neon Postgres + Vercel

## 本地开发

```bash
npm install
npm run dev          # 打开 http://localhost:3000
```



## 跟踪范围

基金列表自动发现:按天天基金全量代码表中基金名称匹配 `纳斯达克100` / `标普500`,排除美元份额、等权重指数、场内 ETF(仅保留"ETF联接"场外份额)。调整范围编辑 `src/lib/funds.ts` 的 `INDEX_RULES`。

## 部署到 Vercel

```bash
npm i -g vercel
vercel                # 首次登录并 link 项目
vercel --prod         # 部署
```

`vercel.json` 已配置 cron:每天 UTC 14:00(北京时间 22:00)自动抓取当日限购额度，覆盖当日基金公司最终的限额状态。

## 数据源说明

| 数据 | 来源 | 说明 |
|---|---|---|
| 纳指100 / 标普500 实时+日K | 腾讯财经 `qt.gtimg.cn` / `web.ifzq.gtimg.cn` | 免费公开接口,无需 key |
| 标普红利低波50ETF联接A 净值+历史 | 腾讯财经(sh515450,南方基金) | 场外单位净值,元,4 位小数,日更;场内交易日盘中/收盘后按母基金 ETF(腾讯 sh515450)涨跌估算当日净值与高低,官方净值公布后自动切回 |
| 沪金主力实时+日K | 新浪财经 `hq.sinajs.cn`(nf_AU0)/ 新浪国内期货(AU0) | 元/克,涨跌按昨结算价计算 |
| 伦敦金现实时 | 新浪财经 `hq.sinajs.cn`(hf_XAU) | 需要 Referer 头 |
| 伦敦金日K | 新浪全球期货(XAU) | 2006 年至今 |
| 指数估值(PE) | 蛋卷指数估值 `danjuanfunds.com` | 纳指100 / 标普500 当前 PE + 历史百分位,日更,缓存 1 小时;红利低波当前股息率同源(CSIH30269) |
| 中证红利低波 PE 历史 | 中证指数官网 `csindex.com.cn` | 日频,2013 年至今,缓存 12 小时;用于反推股息率历史 |
| 中国10年期国债收益率 | 东财数据中心 `datacenter.eastmoney.com` | 股债利差的债券端,缓存 12 小时 |
| 限购基金名单 | 天天基金全量代码表 `fund.eastmoney.com/js/fundcode_search.js` | 每日缓存一次,按名称匹配指数 |
| 申购状态 + 每日额度 | 天天基金费率页 `fundf10.eastmoney.com` | 申购状态表格优先于旧限额文本,状态缓存 10 分钟 |
| 基金当日涨跌幅 | 东财 F10 历史净值 `api.fund.eastmoney.com` | 最新单位净值日增长率(QDII 为 T-1),缓存 1 小时 |
| 区域分布(美股/港股/A股/其它) | 东财 F10 持仓 `fundf10.eastmoney.com`(jjcc, month=6) | 中报/年报全持仓按市场前缀归类,缓存 1 天 |

## 注意

- 本机 Node 为 18.16.0,`next dev` 可正常运行;若 `next build` 报版本错误,升级到 Node 20 LTS
- 行情有约 1 分钟缓存(接口层)，属正常延迟
