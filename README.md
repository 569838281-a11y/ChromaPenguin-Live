# ChromaPenguin-Live UI

梦幻可爱风前端（React + Vite + Tailwind + Lucide），可打包为 Windows 桌面应用。

## 浏览器开发模式

```powershell
cd c:\Users\ADMIN\Desktop\SAM\chroma-penguin-live-ui
npm install
npm run dev
```

另开终端启动后端：

```powershell
conda activate erdes
cd c:\Users\ADMIN\Desktop\大三下\fastsam-penguin
$env:KMP_DUPLICATE_LIB_OK="TRUE"
python web_server.py
```

打开 http://localhost:5174 。

## 桌面应用（Electron）

图标：粉蓝渐变 + 中心可爱企鹅（`build/icon.png`）。

### 开发态桌面窗

```powershell
npm run electron:dev
```

### 打包安装包 / 绿色版

```powershell
npm run dist
```

产物在 `release/`：

- `ChromaPenguin-Live-*-Setup.exe` — 安装版（开始菜单 + 桌面快捷方式）
- `ChromaPenguin-Live-*-portable.exe` — 便携版，双击即用

桌面版会尝试按 `desktop-config.json` 自动拉起 Python 后端（`erdes` 环境）。  
若路径不同，请编辑该文件中的 `pythonPath` / `backendDir`。

## 视图

| View | 说明 |
|------|------|
| `home` | 大标题 + 三个主按钮 |
| `mode1` | 咕咕嘎嘎大作战（后端实时合成） |
| `mode2` | 探索其他变身（单点 + 英文咒语） |
| gallery | 魔法相册 |
