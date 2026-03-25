# OpenClaw Station：自动下载并安装 OpenClaw 实现方案

本文档基于对仓库内 `openclaw-desktop/src` 与对应 Tauri 原生层（`openclaw-desktop/src-tauri`）的分析，说明 **openclaw-desktop** 如何完成「无本地 CLI 时的自动安装」，并给出在 **OpenClaw Station**（Electron 控制端）中复现或对齐该能力的实现方案。

---

## 1. 背景与目标

| 项目 | 角色 |
|------|------|
| **openclaw-desktop** | Tauri 壳：首次启动通过 `bootstrap_openclaw` 检测/安装 OpenClaw CLI，并执行 `setup`、`onboard`、`gateway start` 等，使本地 `http://127.0.0.1:18789` 可用。 |
| **OpenClaw Station** | Electron 客户端：默认连接 `ws://127.0.0.1:18789`，**假设 Gateway 已存在**；若用户机器上未安装 OpenClaw，当前体验是连接失败，需手动安装。 |

**目标**：在 Station 内提供「一键/自动下载并安装 OpenClaw + 拉起 Gateway」的能力，行为与 desktop 的引导流程尽量一致，降低用户门槛。

---

## 2. openclaw-desktop/src 关键模块（前端）

### 2.1 `bridge/openclawBridge.ts`

- 通过 `@tauri-apps/api/core` 的 `invoke` 调用 Rust 命令，例如：
  - `bootstrap_openclaw`：完整引导（安装 + 初始化 + 校验本地 Web）。
  - `select_windows_portable_bundle_file` / `bootstrap_openclaw_with_selected_bundle`：Windows 下手动选择离线 zip。
- 非 Tauri 环境（浏览器）返回占位数据，避免崩溃。

### 2.2 `features/bootstrap/Bootstrap.tsx`

- 挂载时自动执行 `openclawBridge.bootstrapOpenClaw()`。
- 监听 Tauri 事件 `bootstrap-log` 实时追加日志。
- Windows 额外提供「选择 portable zip」重试路径。

**对 Station 的启示**：需要 **主进程长任务 + 日志流**（IPC 事件如 `openclaw-bootstrap-log`），以及渲染进程上的进度/重试 UI。

### 2.3 `scripts/prepare-openclaw-bundle.mjs`（构建期，非运行时）

- 在打包前生成 `openclaw-bundle`：内含 `openclaw.tgz`、Node 运行时、npm CLI、`npm-cache` 或完整 `prefix` 快照等。
- 该产物由 **Tauri 资源目录** 随安装包分发；Station 若未内置相同资源，则依赖 **在线下载** 或与 desktop 相同的 **portable zip** 兜底路径。

---

## 3. Tauri 原生层核心流程（与 `src` 配套）

逻辑位于 `openclaw-desktop/src-tauri/src/main.rs`，与前端 `invoke` 对应。

### 3.1 安装入口：`bootstrap_openclaw`

高层流程可概括为：

1. **`resolve_openclaw_binary()`**  
   按顺序探测 `OPENCLAW_BIN`、常见 `~/.openclaw/...`、`openclaw --version` 等路径（Windows 含 `.cmd` / `.exe`）。
2. **若未找到 CLI**：调用 **`install_openclaw_from_bundle`**
   - 优先使用 **安装包内嵌** 的 `openclaw-bundle`（`resolve_bundled_openclaw_dir`）。
   - **仅 Windows**：若内嵌缺失或不可用，则 **`try_prepare_windows_downloaded_bundle`**：从固定 URL 下载 `openclaw-desktop-windows-portable.zip`，解压并定位其中的 `openclaw-bundle`，再写入缓存目录。
   - **若离线安装仍失败**：回退 **`run_installer_script`**（Windows：`install.ps1`；非 Windows：`install.sh`）。
3. 找到二进制后：执行 **`setup`**、非交互 **`onboard`**、**`gateway start`**，并检测本地 HTTP 是否就绪等。

### 3.2 Windows 离线包下载与解压

- 常量 URL（与 release 产物一致）：  
  `https://github.com/daxiondi/openclaw-desktop/releases/latest/download/openclaw-desktop-windows-portable.zip`
- 下载：`download_url_to_file_native`（优先 `curl`，失败则 PowerShell `Invoke-WebRequest`）。
- 解压：`extract_zip_to_dir_native`（优先 `tar -xf`，失败则 `Expand-Archive`）。
- 缓存目录：`resolve_openclaw_agent_dir()/offline-bundle-cache`，最终得到可用的 `openclaw-bundle` 目录。

### 3.3 从 `openclaw-bundle` 安装到用户目录：`install_openclaw_from_bundle_dir`

- 目标前缀：`~/.openclaw`（Windows 为 `%USERPROFILE%\.openclaw`）。
- 若存在 `prefix` 子目录：整目录复制到用户 prefix，并确保 `openclaw` 启动器可用。
- 否则用捆绑的 **Node + npm-cli.js + openclaw.tgz + npm-cache** 执行 **`npm install --prefix ~/.openclaw --offline ...`**。

### 3.4 与 Station 的对应关系

Station 的 `electron/main.ts` 已存在对 `openclaw` 子进程的调用（如 `execSync('openclaw gateway restart')`、`spawnSync('openclaw', ...)`），说明 **一旦 CLI 安装到 PATH 或标准目录**，现有逻辑即可复用；缺口在于 **「无 CLI 时的获取与安装」**。

---

## 4. OpenClaw Station 现状（简要）

- **渲染进程**：`src/services/gateway` 通过 WebSocket 连接 Gateway；`App.tsx` 默认 `ws://127.0.0.1:18789`。
- **主进程**：配置、托盘、部分 IPC；**未实现** 与 desktop 同级的 bootstrap 管道。

---

## 5. 总体实现方案

### 5.1 架构原则

1. **与 desktop 行为对齐**：探测路径、下载 URL、缓存目录、`~/.openclaw` 安装方式、以及 `setup` / `onboard` / `gateway` 参数应尽量与 `main.rs` 保持一致，避免「desktop 装得上、Station 装不上」的分叉。
2. **重逻辑放主进程**：下载、解压、文件复制、`spawn` 子进程均在 **Electron main**，通过 IPC 向渲染进程汇报进度与日志。
3. **可观测性**：长任务必须支持取消（可选）、重试、日志回传（对齐 `bootstrap-log` 体验）。

### 5.2 模块划分（建议）

| 模块 | 职责 |
|------|------|
| `electron/openclaw/bootstrap.ts`（新建） | `resolveOpenclawBinary()`、`downloadPortableBundle()`、`extractZip()`、`installFromBundleDir()`、`runBootstrapPipeline()`（setup/onboard/gateway）。 |
| `electron/main.ts` | 注册 IPC：`openclaw-bootstrap:start`、`openclaw-bootstrap:cancel`、日志 `webContents.send('openclaw-bootstrap-log', line)`。 |
| `electron/preload.ts` | 暴露 `window.aegis.openclawBootstrap` 等类型安全 API。 |
| `src/...` 页面组件 | 设置页或首次连接失败时的引导卡片：按钮触发、进度条、日志区、手动选 zip（Windows）。 |

### 5.3 平台策略

| 平台 | 建议策略 |
|------|----------|
| **Windows** | 与 desktop 一致：优先尝试 **下载 portable zip**（或用户选择本地 zip）→ 解压得到 `openclaw-bundle` → `installFromBundleDir`；失败则调用 **官方 `install.ps1`**（需将脚本 URL 或内嵌脚本与 desktop 常量对齐）。 |
| **macOS / Linux** | 无与 Windows 相同的 portable zip 路径时：直接 **`run_installer_script` 等价**（`bash -lc install.sh`），或文档化要求用户先装 Node 后 `npm i -g openclaw`（体验较差，作备选）。 |

> 若产品要求三端完全一致，需确认上游是否提供 **非 Windows 的离线 bundle** 或统一安装脚本；否则 Station 只能与 desktop 的 **非 Windows 分支** 对齐（`install.sh`）。

### 5.4 安装完成后的初始化步骤（与 desktop 对齐）

在 `openclaw` 二进制可用后，建议顺序执行（与 `bootstrap_openclaw` 后半段一致，参数需随 OpenClaw 版本演进做对照测试）：

1. `openclaw setup`（失败可记 WARN 继续尝试）。
2. `openclaw onboard --non-interactive ...`（含 `--skip-ui` 等 flags）。
3. 若 onboard 失败：`openclaw gateway install --force` + `gateway start`。
4. `openclaw gateway start`（或 Station 已有 `gateway restart` 逻辑）。
5. 轮询 `http://127.0.0.1:18789` 可用后再让 UI 重连 WebSocket。

### 5.5 UI/产品入口

- **设置页**：新增「安装/修复本地 OpenClaw」区块，显示 CLI 是否已检测到、Gateway 是否可达。
- **连接失败时**：若 `ws://127.0.0.1:18789` 不可达且本机无 `openclaw`，展示引导卡片（与 `Bootstrap.tsx` 类似）。

### 5.6 安全与合规

- 下载使用 **HTTPS**，可选：校验 release 的 **checksum**（若上游在 release 提供 checksum 文件）。
- 提供 **镜像 URL 配置**（desktop 的 `tauri.conf.json` 中 updater 使用了 ghfast 镜像；bootstrap 下载 URL 可做成可配置项）。
- 明确告知用户将执行安装脚本与写入 `~/.openclaw`。

---

## 6. 实现阶段（建议排期）

| 阶段 | 内容 |
|------|------|
| **M1** | 主进程实现 `resolveOpenclawBinary()`（与 Rust 候选路径一致）+ IPC 自检 API；设置页展示状态。 |
| **M2** | Windows：下载 zip → 解压 → 安装 bundle → 执行 `setup/onboard/gateway`；日志 IPC。 |
| **M3** | Windows：手动选择 zip（对齐 `select_windows_portable_bundle_file` / `bootstrap_openclaw_with_selected_bundle`）。 |
| **M4** | macOS/Linux：`install.sh` 回退路径 + 错误处理与文档。 |
| **M5** | 与 desktop 版本联调：同一 OpenClaw 大版本下端到端测试；失败重试与卸载/升级策略（可选）。 |

---

## 7. 代码复用与维护

- **避免重复**：长期可将「下载 + 解压 + 安装 bundle + 命令序列」抽成 **独立 Node 包**（或 WASM/CLI），供 Tauri 与 Electron 共同调用；短期可在 Station 中 **移植 TypeScript 版** 并对照 `main.rs` 做行为测试。
- **单测**：参考 `openclaw-desktop/scripts/test-windows-portable-install.mjs`，对 portable zip 的解压与目录结构做自动化校验。

---

## 8. 参考文件索引（本仓库）

| 路径 | 说明 |
|------|------|
| `openclaw-desktop/src/bridge/openclawBridge.ts` | 前端 invoke 封装 |
| `openclaw-desktop/src/features/bootstrap/Bootstrap.tsx` | 引导 UI 与事件 |
| `openclaw-desktop/scripts/prepare-openclaw-bundle.mjs` | 构建期 bundle 生成 |
| `openclaw-desktop/src-tauri/src/main.rs` | `bootstrap_openclaw`、`try_prepare_windows_downloaded_bundle`、`install_openclaw_from_bundle_dir`、`run_installer_script` |
| `openclaw-desktop/src-tauri/src/main.rs`（`resolve_openclaw_binary`） | CLI 探测路径 |
| `electron/main.ts` | Station 主进程与现有 `openclaw` 调用 |

---

## 9. 小结

openclaw-desktop 的「自动安装 OpenClaw」并非单一前端功能，而是 **Tauri 资源 + Windows 可选下载 portable zip + 离线 npm 安装 + 在线脚本回退 + 非交互 onboard/gateway** 的组合链。在 OpenClaw Station 中实现同等能力时，应 **以 `main.rs` 为事实来源**，在 Electron 主进程用 Node 实现等价步骤，并通过 IPC 与 UI 提供与 `Bootstrap.tsx` 类似的可观测、可重试体验。

---

## 10. 沙箱隔离策略（安全增强）

你希望“下载并运行的 openclaw”尽量不破坏宿主机环境。需要先明确边界：**沙箱隔离可以显著降低破坏范围，但不能保证对恶意代码的完全免疫**（如果 openclaw 具备足够权限，仍可能通过网络/进程/用户可写目录造成影响）。因此建议把沙箱目标拆成两类：

1. **数据与安装目录隔离**：把写入集中到沙箱目录（尤其是 `~/.openclaw`、缓存、临时文件）。
2. **减少对宿主系统的“全局修改”**：例如默认浏览器设置、浏览器扩展安装等，尽可能跳过或降级。

下面给出多种实现方案，并对比安全性与落地成本。

### 10.1 关键观测：desktop 已经把安装写入集中到 `~/.openclaw`

从 `openclaw-desktop/src-tauri/src/main.rs` 的离线安装逻辑可以看出：

- 离线安装前缀是通过 `HOME`/`USERPROFILE` 推导的：`prefix = <home>/.openclaw`。
- 安装完成后会在该 `prefix` 内生成启动器：`ensure_prefix_openclaw_launcher()` 会写 `<prefix>/bin/openclaw.cmd`（Windows）或 `<prefix>/bin/openclaw`（非 Windows），脚本会指向沙箱内的 `openclaw.mjs` 和（可选的）沙箱内 node runtime。

这意味着：**在 Station 的“下载-安装-启动”过程中，只要把进程环境变量 `HOME`（以及必要时 `USERPROFILE`、`TEMP/TMP`）重定向到沙箱根目录，就能把绝大多数写入约束到沙箱**，而不需要大规模重写 openclaw 自身逻辑。

### 10.2 方案 A：进程级沙箱（环境变量重定向 + 单独 prefix）

实现思路：在 Electron main 中创建一个沙箱目录（示例：`<app.userData>/openclaw-sandbox/<sessionId>`），并在“执行 openclaw 安装/启动命令”的子进程上设置：

- `HOME=<sandboxRoot>`
- `USERPROFILE=<sandboxRoot>`（Windows 上通常需要兜底）
- `TEMP=<sandboxRoot>/tmp`、`TMP=<sandboxRoot>/tmp`（可选）
- （可选）`OPENCLAW_BIN` 或 `PATH`：确保 `openclaw` 命令解析到沙箱内生成的 launcher。

落地要点：

1. **下载 portable zip**（或用内嵌 bundle），解压出 `openclaw-bundle`。
2. 将安装/启动的“工作目录/环境”都限定在沙箱环境变量下，使离线安装写入 `<sandboxRoot>/.openclaw`。
3. 启动 gateway 时优先使用“沙箱内 launcher 的绝对路径”（或保证 `openclaw` 命令解析到沙箱 prefix），避免误用宿主机已安装的 openclaw。
4. 启动后 Station 继续连接 `http://127.0.0.1:18789`（端口保持不变），UI 逻辑不需要大改。

安全效果：中到高（主要隔离“写入范围”，减少宿主污染）。
实现成本：低到中（主要是 Electron main 中对子进程 env 的封装）。
残余风险：如果 openclaw 在启动后仍会执行“全局修改”（例如默认浏览器、扩展安装、注册系统项等），仍可能影响宿主，需要在 sandbox mode 下做“跳过策略”。

### 10.3 方案 B：一次性沙箱（环境变量重定向 + 启动后清理）

在方案 A 基础上引入“清理策略”：

- 每次安装/启动（或每次用户会话）使用新的 `<sessionId>` 目录。
- 成功后如果用户不需要保留 auth/model 状态，可以在关闭 Station 或用户点击“清理”时删除沙箱目录。

安全效果：高（减少长期驻留数据）。
实现成本：中（需要清理、并处理失败重试与部分清理）。
残余风险：仍受限于进程权限与潜在全局修改行为；另外清理后可能需要重新 onboarding。

### 10.4 方案 C：容器化运行（Docker/Podman/WSL）（隔离更强但更依赖环境）

将 openclaw 安装与运行放在容器/子系统中：

- 将 gateway 端口 `18789` 映射到宿主（例如 `-p 18789:18789`）。
- 共享最小必要目录：例如 `sharedFolder`（媒体/共享文件）可以用挂载方式提供。
- 可通过容器网络策略限制外连（进一步降低恶意连接面）。

安全效果：高（OS 级隔离优于仅进程隔离）。
实现成本：中到高（需要适配容器环境、文件挂载、网络与身份/回调登录等）。
残余风险：如果 openclaw 依赖宿主级 GUI/浏览器/扩展能力，容器内可能不可用或需要额外工程。

### 10.5 方案 D：完整虚拟化（Windows Sandbox / 独立 VM）

把安装与运行完全放入虚拟环境：

- 宿主仅通过端口通信（Station 仍连 `127.0.0.1:18789` 或通过 VM 的网络映射）。
- VM 内完成下载、安装、onboard、gateway start，宿主机不直接承载 openclaw 的文件写入。

安全效果：最高（隔离粒度最大）。
实现成本：高（需要自动化交互/传参/取回必要状态，且受用户系统能力影响）。
残余风险：基本由虚拟化隔离承担；主要挑战是产品体验与自动化程度。

### 10.6 对比表

| 方案 | 安全性（对“写入污染宿主”） | 实现成本 | 对现有逻辑改动 | 主要残余风险 |
|------|-------------------------------|----------|------------------|----------------|
| 方案 A：进程级沙箱（HOME 重定向） | 中到高 | 低到中 | 小（子进程 env/路径） | 仍可能产生全局修改（需跳过策略） |
| 方案 B：一次性沙箱（清理） | 高 | 中 | 小到中 | 全局修改与一次性数据带来的 onboarding 成本 |
| 方案 C：容器化 | 高 | 中到高 | 中（网络/挂载/权限适配） | 登录/GUI/扩展相关依赖可能不兼容 |
| 方案 D：虚拟化 | 最高 | 高 | 大 | 自动化体验、状态回传/持久化复杂 |

### 10.7 推荐落地顺序（面向 Station）

1. **默认（推荐先做）：方案 A**。这是“隔离写入范围”的最低成本路径，且与 desktop 已使用的 `HOME -> ~/.openclaw` 前缀模型天然一致。
2. 如果用户对隐私/持久性有更高要求：提供选项切换到 **方案 B**（临时沙箱，关闭即清理）。
3. 作为“高安全模式”可选：再逐步评估 **方案 C/D**（取决于你们目标用户环境是否普遍具备 Docker/Windows Sandbox）。

### 10.8 额外安全建议（无论选哪种沙箱都建议）

- **校验下载产物完整性**：对 portable zip/安装脚本做 sha256 校验（或至少对比 release 提供的 checksum）。
- **沙箱模式下跳过宿主全局修改**：例如 desktop 里会尝试浏览器默认与扩展安装等行为；在 Station 的 sandbox mode 下应尽量“不要对宿主做全局写入”。
- **网络与权限收口**：在容器/虚拟化方案中优先启用网络 egress 控制；在方案 A/B 中至少做到“最小必要访问”。
