# Live2D 集成来源

- 上游：<https://github.com/LuoTian001/live2d-widget-AIChat>
- 固定版本：`54d1e807111b4e1ebafbef846663a98aa59848ce`
- 使用上游的 `Core/live2dcubismcore.js` 和 `Core/live2d-sdk.js`。
- SDK 的本地增补由 `tools/live2d/prepare-sdk.cjs` 生成：命名表情、命名动作、就绪检查、隐藏标签页/收起挂件时暂停绘制。
- `live2d.js` / `widget.css` 是此博客的适配层：齿轮猫猫头入口、左侧纯图标工具栏、动态/静态切换、页面上下文。`retrieval.mjs` 对现有 `/search.json` 做中英分词与相关片段检索。回复由安全 DOM 节点构建，支持可点击来源链接。
- 上游的 `ariu` 是另一个人物，仅在被排除的 `workplace/upstream` 中用于加载测试，没有安装为苺氷模型。
- 上游 MIT 许可保存在同目录 `LICENSE`；Live2D Core 的专有软件许可声明保留在原文件头。
- `assets/ichigoori-static.png` 是基于用户设定图通过内置 imagegen 生成的单张透明立绘。它不是 PSD 分层、绑定工程或 MOC3。
- `model/ichigoori/` 中为本人物实际导出的 Cubism 5.0 MOC3、纹理、6 个自定义命名表情与 Idle/Blink/Nod/Shake 动作。当前五官 v3 使用 PSD2Live 3.6.7 制作，27 图层、29 变形器、23 参数、2048 单页纹理。遮挡补绘、分层 PSD、`.psd2live`、`.cmo3` 和制作脚本保留在已排除的 `workplace/`。
- PSD2Live 官方项目：<https://github.com/tsunehimatoi/psd2live>。此交付是自动绑定的基础版，头部转向和身体动作幅度有限，衣服/四肢仍合并在身体层。
- 聊天 Worker 在用户自己的 `ergoutree-live2d-chat`，联网搜索调用 DeepSeek 官方 Search API，Key 仅保存在后端 Secret。
- 五官 v2：虹膜、睫毛、眉毛和闭嘴纹理直接从用户提供的 `苺氷人设图.jpg` 取样，统一配准到原有头部。眼白遮挡层按原图眼裂轮廓重做；淡肤色和腮红挂在脸部变形器。工作工程为 `workplace/ichigoori-simple-v2.psd2live`，保留 v1 以便比较。
- 人物所有控件 SVG 改用 Lucide 0.468.0，原 SVG、ISC/MIT 许可和下载来源/哈希在 `icons/`，由 `tools/live2d/update-icons.cjs` 获取，没有手绘控件路径。
- SDK v2 适配减小呼吸与鼠标导致的摆头，保留平滑瞳孔跟随，并按实际变形后的模型下边界对齐窗口底部；显示比例支持 1× / 1.3×，按窗口高度约束尺寸。
- 五官 v3：改为从原人设图 FRONT 正面图统一取样，以两眼中心的间距配准眼白、虹膜、睫毛和嘴线；脸部保留原正面图的自然腮红，情绪腮红另保留为脸部参数层。默认睁眼，闭眼时清除底图旧眼线。工程在 `workplace/ichigoori-simple-v3.psd2live`。
- 当前静态立绘为用户本轮明确指定的 PNG，原样复制到 `assets/ichigoori-static-selected.png`，`live2d.json` 单独引用该文件，模型导出不再覆盖它。
