# Agent 须知

完整交接见 **[项目交接.md](./项目交接.md)**。下一轮迭代开工前必读。

硬规则（摘要）：

- 只读 DOM，不碰 Temu/知了接口；知了封闭 Shadow 能读不能写。
- 新功能独立文件，不要改 `parseCard` / `evaluateRules` / `findCardFrom` / `collect`。
- 性能优化不要和筛选逻辑混在一次改动里。
- A/B 筛选变灰 与 C 自动点开、半价数字，三者互不嵌套。
- 对用户用简体中文。未点名不要 commit / push。

产品口径：`temu-知了数据筛选插件-需求与可行性梳理.md`（口径变了才改，不要为改代码顺手重写）。
稳定代码边界：`.cursor/rules/dont-touch-stable.mdc`。
加载与仓库：`加载说明.txt`、`README.md`。
