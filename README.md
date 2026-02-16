# xiaobu

微信小程序示例：加载 Blender 导出的 `GLB` 模型。

## 项目结构

- `/Users/ronny/workspace/57-code/xiaobu/pages/model/model.js`: Three.js 场景与 GLB 加载逻辑
- `/Users/ronny/workspace/57-code/xiaobu/pages/model/model.wxml`: WebGL Canvas
- `/Users/ronny/workspace/57-code/xiaobu/assets/models/model.glb`: 模型文件位置（你需要自行放入）

## 使用步骤

1. 安装依赖：

```bash
npm install
```

2. 打开微信开发者工具，导入目录：

`/Users/ronny/workspace/57-code/xiaobu`

3. 在微信开发者工具中执行：

`工具 -> 构建 npm`

4. 把 Blender 导出的模型文件放到：

`/Users/ronny/workspace/57-code/xiaobu/assets/models/model.glb`

5. 预览运行，小程序会自动加载并显示该模型。

## 常见问题

- `GLTFLoader 未加载`：
  通常是 npm 依赖未安装或未构建，请重新执行 `npm install` 和微信开发者工具里的 `构建 npm`。
- 模型加载失败：
  确认文件名是 `model.glb`，路径是 `/assets/models/model.glb`。
