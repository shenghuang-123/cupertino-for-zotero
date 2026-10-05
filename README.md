<img src="icons/cupertino-icon-96.png" alt="Cupertino for Zotero 图标" width="72" align="left">

# Cupertino for Zotero

把 macOS 的原生观感搬进 Zotero：SF Pro 字体观感、系统级配色、圆角卡片面板、细滚动条，外加条目展开时的级联入场动画。设计语言移植自 Obsidian 的 [Cupertino](https://github.com/aaaaalexis/obsidian-cupertino) 主题。

- 当前版本：**v1.7.5**
- 支持 Zotero **7.0 – 10.x**
- 纯样式插件：不改动 Zotero 数据，不做网络请求，卸载即完全还原

## 特性

**视觉**

- 全局字体切换为 SF Pro 观感（`-apple-system` / `SF Pro Text` / `Segoe UI Variable` 回退链），字重与字距按 macOS 规范微调
- 浅色 / 深色双套系统色板，强调色对齐 macOS 系统红
- 三栏面板改为圆角卡片：去掉所有描边，只保留柔和投影；panedivider、标签底线等"多余线条"全部透明化（拖拽区域保留）
- 菜单改为毛玻璃圆角面板 + 红色高亮项
- 工具栏按钮三态动效（常态 / 悬浮 / 按下）
- Safari 风格标签页、搜索框聚焦红色光环、细滚动条
- 集合树行图标换成红色竖线，选中行为浅红底 + 深红字；详情面板的彩色图标统一为灰色，避免视觉噪音

**动画**

- 条目展开时子行级联入场：逐行 65ms 间隔、上限 520ms，位移 + 淡入 380ms
- 因展开 / 收起而平移的兄弟行做 FLIP 位移动画（520ms），与级联尾部对齐
- twisty 箭头旋转改用苹果曲线
- 尊重系统「减弱动态效果」设置，开启时自动关闭全部条目动画

## 安装

1. 下载或自行打包得到 `cupertino-theme@zotero.local.xpi`
2. Zotero → 工具 → 插件 → 右上角齿轮 → **Install Plugin From File…**
3. 选择 xpi，无需重启，样式即时生效

## 从源码打包

源码在 `Cupertino-Zotero/`：`manifest.json`、`bootstrap.js`、`style.css`，以及 `icons/` 下的插件图标。

Windows 下右键 `pack.ps1` → **使用 PowerShell 运行**，会在项目根目录生成 `cupertino-theme@zotero.local.xpi`。

若提示脚本被执行策略拦截，先在 PowerShell 中执行：

```powershell
Set-ExecutionPolicy -Scope Process Bypass
```

也可以手动压缩：把 `Cupertino-Zotero/` 里的三个文件和 `icons/` 文件夹**直接放在 zip 根目录**（不要多套一层文件夹，`icons/` 保留这层子目录），改扩展名为 `.xpi` 即可。

## 目录结构

```
Cupertino-Zotero/
  manifest.json    插件清单（id / 版本 / 兼容范围 / icons）
  bootstrap.js     生命周期与条目动画逻辑
  style.css        Cupertino 设计令牌与全部样式规则
  icons/           插件图标（48 / 96 PNG，供 Zotero 插件管理器显示）
icons/             图标设计稿：SVG 主稿、各尺寸导出、方案对比图
pack.ps1           打包脚本
```

## 实现要点

### 样式注入

采用 Zotero 官方 `make-it-red` 示例的模式：`startup()` 里通过 `nsIStyleSheetService.loadAndRegisterSheet()` 以 `AUTHOR_SHEET` 级别注入 `style.css`，`shutdown()` 里注销。因为是作者级样式表，优先级高于 Zotero 内置样式，改样式不需要动官方 DOM。

### 条目展开动画（v1.7.3）

Zotero 的条目列表是 windowed-list，它的 `invalidate()` → `_renderItem(index, oldDiv)` 会**复用旧行元素、原地置换内容**——展开时通常根本没有新增的 `.row` 节点，靠 `MutationObserver` 的 `addedNodes` 无法识别子行。所以做法是：

1. 在 window **mouseup 捕获阶段**（先于官方 twisty 监听器）快照当前渲染窗口内所有行的（元素、`style.top`、`aria-level`）
2. 预挂载的 `MutationObserver` 在波次结束后消费快照，按 `aria-level` 圈出紧随父行的深层行，即本次插入的子行
3. 子行播放级联入场，其余因插入而位移的行按快照 top 做 FLIP

两个容易踩的坑：

- **DOM 顺序不等于视觉顺序**。windowed-list 滚动重渲染时新行是 `appendChild` 到 DOM 末尾的，向上滚动后 children 顺序与视觉顺序脱钩，任何基于"DOM 顺序 == 行逻辑顺序"的位置算术都会失效。因此快照按 `style.top` 空间排序，FLIP 改为按**元素身份**（`Map<元素, 旧 top>`）匹配新旧位置，每个幸存行只跟自己比，天然免疫 DOM 乱序。
- **级联延迟必须留足**。多附件条目展开时子行多，若延迟封顶过低（如 330ms），第 7 行之后会同帧入场，看起来像"一整块"。现在间隔 65ms、上限 520ms，并与平移动画时长对齐，避免"下方先到位"的割裂感。

### 已知限制

- 键盘开合（无 mouseup）与「展开全部」不播动画——这两条路径没有可挂载快照的触发点，属官方原生行为
- 展开瞬间若用户滚动，快照会被主动废弃（滚动重渲染会使快照元素集合大面积失效，强行套用会错播）

## 许可

MIT。上游设计语言来自 [Obsidian Cupertino](https://github.com/aaaaalexis/obsidian-cupertino)（作者 Alexis C），本项目与其无隶属关系。
