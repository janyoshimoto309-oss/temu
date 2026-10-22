# Agent 须知

完整交接见 **[项目交接.md](./项目交接.md)**。已踩的坑见 **[沉淀经验.md](./沉淀经验.md)**。下一轮迭代开工前两篇都读。

硬规则（摘要）：

- 只读 DOM，不碰 Temu/知了接口；知了封闭 Shadow 能读不能写。
- 新功能独立文件，不要改 `parseCard` / `evaluateRules` / `findCardFrom` / `collect` 来夹带半价或点开。两套数字门槛已在 `evaluateRules` 里，不要再二次 mark。
- 性能优化不要和筛选逻辑混在一次改动里。
- A/B 筛选变灰 与 C 自动点开、半价数字，三者互不嵌套。
- 对用户用简体中文。未点名不要 commit / push。

产品口径：`temu-知了数据筛选插件-需求与可行性梳理.md`（口径变了才改，不要为改代码顺手重写）。
漏网、半价、详情闪缩、加载错目录：先查 `沉淀经验.md`，不要换一套做法重踩。
稳定代码边界：`.cursor/rules/dont-touch-stable.mdc`。
加载与仓库：`加载说明.txt`、`README.md`。
