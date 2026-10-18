# Temu × 知了筛选

Chrome MV3 本地插件。和「知了数据」同时开，**只读页面**，按门槛把不合格商品卡变灰；半价数字是独立展示。

## 加载

见 `加载说明.txt`。选中本仓库根目录（含 `manifest.json`）。

## 文档

| 文件 | 给谁 |
|---|---|
| [项目交接.md](./项目交接.md) | 下一轮 Agent 必读：现状、硬约束、坑 |
| [AGENTS.md](./AGENTS.md) | Cursor 入口 |
| [temu-知了数据筛选插件-需求与可行性梳理.md](./temu-知了数据筛选插件-需求与可行性梳理.md) | 产品口径（筛什么、不筛什么） |
| `.cursor/rules/dont-touch-stable.mdc` | 新功能不得牵连已稳定筛选 |

## 模块

- **A** 规则筛选：两套数字门槛（套内并且、两套或）+ 共用品类；日/周/月销、上架（超过近 N 用 `>`）、评分、评论、Temu 已售、不看/不做名单
- **B** AI 分类：默认可关，BYOK Gemini
- **C** 自动点开：默认关，只点未变灰普通卡
- **D** 半价数字：现价÷2，只标数字，不参与变灰

空字段或「-」跳过该条门槛。知了蓝框封闭 Shadow 能读不能写。

## 测试

```
node tools/test-parse.js
node tools/test-half-price.js
node tools/test-rules.js
```
