# @cmx/ontology-graph

本体图（Object/Link ER 图）可视化编辑组件 —— 独立 **Web Component** / TypeScript / 零框架 / 零运行时依赖。
**与 `@cmx/decision-graph` 平级**（clean-room，借鉴其骨架不共享代码）。本体平台（cmx-ontology）前端
四区设计工作台引用它编辑/预览本体图。

## 为什么与决策图平级而非改造它

| 维度 | `@cmx/decision-graph` | `@cmx/ontology-graph`（本组件） |
|------|------------------------|-------------------------------|
| 拓扑 | DAG（input→output，强制无环） | 一般 ER 图（关系可双向/自环层级；仅接口继承需防环） |
| 节点 | 简单类型节点 | **富卡片**（属性列表 + 主键 ◇ / 标题 ⌾ / 索引 ⚡ / 必填 * + 色条 + 状态描边） |
| 边 | 无向连接 | **有向 + 基数符号**（1:1/1:N/N:M 鸦爪）+ 角色标签；接口虚线挂接 |
| 布局 | 分层 BFS | 确定性网格 + 拖拽提示 |

把 ER 语义塞进 DAG 核会重演「领域逻辑不进通用图核」的教训，故新建平级组件，共享设计语言不共享代码。

## 能力

- **自定义元素** `<cmx-ontology-graph>`：shadow DOM、vanilla、自注册（import 即注册）。
- **富卡片对象类型**：色条 + displayName + apiName(mono) + 卡内关键属性（超 maxRows 折叠 +N）。
- **基数关系边**：有向连线 + 鸦爪/单线端点标记 + 关系名/角色标签。
- **接口虚线挂接**：对象类型 `implements` 接口 → 紫色虚线边（由 implements 派生，自动同步）。
- **手动拖拽节点**：pointer 拖拽微调（会话态坐标提示 `_layout`，非后端契约）。
- **拉线建关系**：从卡片右缘连接点拖橡皮筋线到目标 → 派发 `link-add`，宿主弹速建气泡补 apiName/基数/角色。
- **只读预览** `readonly`；**节点/关系编辑交宿主**：选中派发 `type-select`/`edge-select`，宿主在 property 区渲染强类型 Inspector。

## 元素契约

```html
<cmx-ontology-graph data-spec='{...}' readonly></cmx-ontology-graph>
```

| 类别 | 成员 |
|------|------|
| 数据入 | 属性 `data-spec`（JSON）/ 方法 `setSpec(def)` / `getSpec()` |
| 配置 | 属性 `readonly` |
| 结构操作 | `addObjectType(api,disp?)` / `addInterface(api,disp?)` / `addLink(api,src,tgt,card,roleA?,roleB?)` / `delNode(id)` / `delLink(api)` / `autoLayout()` / `selectNode(id)` |
| 逃生舱 | `getModel()` 返 `OntologyModel`（节点/边/属性/implements 操作 API），对标 `getWorkbook()`/`getModel()` |
| 事件出 | `spec-change` / `type-select` / `edge-select` / `link-add`（拉线落点，宿主补元数据）/ `link-added` / `node-add` / `node-del` / `connect-rejected`（bubbles+composed） |

图 JSON 契约（对齐 cmx-onto-model，camelCase）：
`{name?,nodes:[{id,kind:"object"|"interface",displayName?,color?,status?,properties?:[{apiName,baseType?,isPrimaryKey?,isTitle?,required?,isIndexed?,semanticType?}],implements?:[apiName]}],edges:[{apiName,source,target,cardinality?,roleA?,roleB?,isInterfaceLink?}]}`
`_layout`（拖拽坐标）为组件私有扩展，后端忽略。

## 构建 / 交付 / 测试

```bash
./build.sh            # tsc 类型 + esbuild 打单文件 ESM → dist/cmx-ontology-graph.esm.js
./sync-component.sh   # 拷产物 → ../../backend/cmx-container/assets/onto/web/ui-native/vendor/cmx-ontology-graph.js
npx --no-install vitest run   # 单测（纯逻辑：OntologyModel / layout / renderSvg）
```

工具链复用仓内隔离副本（离线）：`.tsc-tool` 符号链接到 sibling `cmx-mega-sheet` 的隔离 tsc；esbuild 原
取自 `cmx-home-site`（该仓已移出工作区，需自备）；`node_modules` 符号链接自 sibling `cmx-decision-graph`
（devDeps 相同）。**改组件源必须重跑 `build.sh` + `sync-component.sh`，否则本体平台用旧组件**
（对标 @cmx/megasheet vendor 纪律）。
