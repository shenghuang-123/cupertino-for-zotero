# 图标设计稿

Cupertino for Zotero 的图标概念：**把 Zotero 的 Z 做成一颗 macOS 应用图标**。
红底圆角方块（squircle）+ 白色几何 Z，强调色对齐主题的 macOS 系统红 `#FF3B30`。

自 v1.7.5 起已接入插件：`Cupertino-Zotero/icons/icon-48.png`、`icon-96.png`，由 `manifest.json` 的 `icons` 字段注册，Zotero 插件管理器列表即显示此图标。

## 文件

| 文件 | 说明 |
| --- | --- |
| `cupertino-icon.svg` | 采用方案（锐角几何 Z）的矢量主稿，1024×1024 |
| `cupertino-icon-v1.svg` | 备选方案（圆头笔画）矢量主稿 |
| `cupertino-icon-1024/512/192/96/48.png` | 采用方案的透明底位图导出 |
| `icon-compare.png` | 两方案在浅色底与深色底下的对比图 |
| `_sheet.html` | 对比图排版源文件 |
| `_master-v1.png` | 备选方案的 1024 渲染，供 `_sheet.html` 使用 |
| `_resize.ps1` | 由 `cupertino-icon-1024.png` 批量导出各尺寸 |

## 设计规格

- 画布 1024×1024，图标本体 824×824 居中（四周留 100px，符合 macOS 图标的内缩比例）
- 圆角 `rx=182`（≈ 边长的 22%，接近 Apple 连续曲率）
- 竖向渐变 `#FF4B3C → #FF382E → #DD261E`，顶部再叠一层 14% 白色高光
- 1px 内描边 `#FFFFFF / 12%`，用于在深色底上把轮廓从背景里"提"出来
- 投影 `dy=14 / blur=20 / #5C0A06 30%`，不用纯灰，保持暖色一致
- Z 字形：单条路径 `M352 336 H672 L352 688 H672`，描边宽 78、端点平头、转角尖角 —— 即真正的几何 Z，而不是圆头笔画

## 改稿后重新导出

```bash
"<Edge 路径>" --headless=new --disable-gpu --hide-scrollbars \
  --default-background-color=00000000 --window-size=1024,1024 \
  --screenshot="$PWD/cupertino-icon-1024.png" "file:///$PWD/cupertino-icon.svg"
powershell -NoProfile -ExecutionPolicy Bypass -File ./_resize.ps1
cp cupertino-icon-48.png ../Cupertino-Zotero/icons/icon-48.png
cp cupertino-icon-96.png ../Cupertino-Zotero/icons/icon-96.png
```

Edge 截图写完文件后不会自动退出，放后台跑即可。
