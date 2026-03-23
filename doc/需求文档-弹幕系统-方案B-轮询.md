# 弹幕系统需求说明（方案 B：服务端广播 + Unity/手机轮询）

> 版本：v0.2  
> 前提：手机端、Unity 投屏端、竞猜 Node 服务部署在**同一局域网**内；弹幕业务仅服务于本场活动，不面向公网开放。

---

## 一、方案结论

| 对比项 | 说明 |
|--------|------|
| **为何选 B** | Node 用 Socket.IO **向手机实时推送**（推荐）；Unity 通过 **HTTP 短轮询**拉取增量弹幕，**无需** Socket.IO 客户端，与现有 `ContestSyncManager`（`UnityWebRequest`）一致，**Unity 改动面最小**。 |
| **「只广播给局域网」** | 客户端连接本机部署的 Contest 地址即可；不单独做网段过滤，依赖部署与防火墙。 |

---

## 二、总体数据流

```
[手机] 点击底部栏发送入口 → 输入文案 → POST /api/danmaku/send
         ↓
[Node] 校验（含屏蔽字）→ 写入环形队列（序号 seq）
         ↓
[手机] Socket：danmaku:message → 上半屏飘字层展示（含用户名）
[Unity] GET /api/danmaku/poll?since= → 大屏飘字展示（含用户名）
```

- **写入单点**：所有弹幕经 Node，便于限流、屏蔽字、序号统一。
- **Unity**：仅轮询，不建立长连接。

---

## 三、服务端（LumiSportContest `server/index.js`）

### 3.1 内存模型

- **单调递增序号** `seq`；每条：`{ seq, ts, username, text }`（`username` 必填，供各端展示）。
- **环形缓冲区**（如最近 **500** 条），供 `poll` 增量查询。
- **场次 `sessionId`（可选保留）**：用于 Unity 与轮询的**游标对齐**、缓冲区滚动后的 `truncated` 处理；**不要求**手机端做「整屏清弹幕」交互（见第四节）。

### 3.2 API：发送弹幕 `POST /api/danmaku/send`

- **请求体示例**：

```json
{
  "username": "观众A",
  "text": "红方加油"
}
```

- **校验（必选）**：
  - `username`、`text` 必填；`text` 去首尾空格后长度 **1～40**（上限可配置）；
  - `username` 与已登录用户一致（服务端校验为已存在用户）；
  - **屏蔽字**：维护**屏蔽词列表**（可先配置文件或代码内数组，后续可改远程配置）。若 `text` 经检测**包含任一词**，**拒绝发送**，返回 `400` + 明确文案（如「内容包含不当词语」）；**必须以服务端为准**（防抓包绕过前端）。
  - **频控**：同一 `username` 每 **5 秒最多 1 条**（可配置）；可选全站每秒条数上限。
- **响应**：`{ ok, seq, ts }`。
- **副作用**：写入队列；`io.emit('danmaku:message', { seq, ts, username, text })`。

### 3.3 API：轮询 `GET /api/danmaku/poll`

- **Query**：`since`（必填，数字）、`sessionId`（**建议必填**，与上次响应中的 `sessionId` 一致，URL 编码）。
- **正常**：返回当前场次内 `seq > since` 的 `items`，以及 `sessionId`、`latestSeq`、`truncated`（环形缓冲丢弃旧序号时 `truncated: true`）。
- **场次切换 / 序号重置后重同步**（任选其一即可触发服务端全量返回当前缓冲）：
  1. **`sessionId` 与当前场次不一致**：返回 **当前缓冲内全部** `items`，`truncated: true`（客户端应更新本地 `sessionId` 与 `since`）。
  2. **`since` 大于服务端 `latestSeq`**（例如新局序号从 0 再起，Unity 仍带上一局的 `since=50`）：视为游标过期，同样返回 **全部** `items`，`truncated: true`。

### 3.4 关于「清屏」与场次

- **手机端**：**不做**「一键清屏」或新局强制清空飘字层；采用**飘字播完即消失**，视觉上自然结束。
- **Unity 大屏**：以**飘字播放完毕**为主；若队列堆积，可实现侧策略（如最多同时 N 条），**不强制**与手机一致的「整屏清空」产品动作；`sessionId` 变化时 Unity 可重置本地 `since` 与待播队列（技术项，见实现文档）。

### 3.5 安全与局域网

- 局域网 HTTP 可接受；屏蔽字 + 频控 + 长度限制为基线；可选后续加强鉴权。

---

## 四、手机端（LumiSportContest）— 交互与布局（定稿）

### 4.1 发送入口

- **位置**：底部导航栏 **【我要竞猜】与【我要参赛】两个按钮的中间**，放置**圆形「发弹幕」图标按钮**。
- **布局**：底部栏采用 **三栏结构**（左：竞猜 Tab | **中：圆形发送** | 右：参赛 Tab），保证中间图标**独立占位**，不被两侧 Tab 遮挡、不与其他模块重叠。
- **交互**：点击圆形图标 → 打开**输入方式**（半屏抽屉或居中弹层，实现时二选一）：单行/多行输入 + 发送 + 字数提示；发送走 `POST /api/danmaku/send`。

### 4.2 弹幕呈现

- **区域**：占据手机**上半部分屏幕**（具体比例实现时可约 **50% 高度** 或「顶栏以下至屏高中线附近」，以不挡底部 Tab 与中间核心操作为准）。
- **形式**：**横向飘字**；每条弹幕需 **展示用户名称**（如 `用户名：内容` 或「用户名」+ 内容样式，样式实现时定）。
- **样式**：**半透明底**（条带或文字背景），提高可读性。
- **点击穿透**：弹幕展示层 **`pointer-events: none`**，**不响应点击**，触摸/点击**穿透到下层**（下注、滚动等**不受影响**）。

### 4.3 数据通道

- **实现**：手机端使用 **`SocketProvider`（`SocketContext.jsx`）** 全局只建 **一个** `io()` 连接；`QuizPage`、`JoinPage`、`DanmakuFlyLayer` 均通过 `useMobileSocket()` 复用，与需求「共用连接」一致。
- **弹幕**：监听 `danmaku:message`，低延迟上屏。
- **可选兜底**：仅 `poll`（一般不必）。

### 4.4 失败提示

- 网络错误、频控、屏蔽字拦截：使用 **toast / 文案** 提示；屏蔽字拦截文案与后端一致。

---

## 五、Unity 端（LumiSports Server）

- 轮询 `poll`、解析 `items`，大屏 **飘字展示**，每条 **带用户名**（字段 `username` + `text`）。
- 轮询间隔、游标 `since`、`sessionId` 处理与 v0.1 一致；**不要求**与手机完全一致的「清屏」产品行为，以播完与本地队列策略为主。

---

## 六、后续拓展（不纳入首版实现）

| 项 | 说明 |
|----|------|
| **系统弹幕** | 由服务端或主持端下发「官方」文案（如活动提示），与普通用户弹幕区分展示样式（如固定色、前缀「官方」）；需额外字段如 `type: 'system' \| 'user'` 与下发接口。 |
| **屏蔽词运营化** | 词库改远程配置、热更新等。 |
| **持久化 / 复盘** | 弹幕落库或文件。 |

---

## 七、非功能需求

| 项 | 说明 |
|----|------|
| 延迟 | 手机 Socket 近实时；Unity 轮询 300–500ms 可接受 |
| 负载 | 局域网场景；仍保留频控与条数上限 |
| 日志 | 服务端可记录发送拒绝原因（屏蔽字、频控）便于排查 |

---

## 八、验收要点

1. 底部栏 **三栏布局**：中间圆形发弹幕入口稳定可见，不误触两侧 Tab。  
2. 上半屏飘字、半透明、**点击穿透**，下层按钮与滚动可用。  
3. 每条弹幕 **可见用户名**。  
4. 含屏蔽字内容 **无法发送**，前后端提示一致；服务端不可被简单绕过。  
5. 同局域网内手机与 Unity 均能收到同一条（顺序与序号一致）。  
6. **不要求**手机端「清屏」交互；飘字结束即自然消失。

---

*文档版本：v0.2 | 已对齐手机端布局与屏蔽字、用户名展示*

---

## 九、实现状态（2026-03-20）

| 项 | 状态 |
|----|------|
| `POST /api/danmaku/send`、`GET /api/danmaku/poll` | ✅ `server/index.js` |
| 屏蔽词 / 频控 / 场次切换重置队列 | ✅ |
| Socket `danmaku:message` | ✅ |
| 手机底栏三栏 + 圆形入口 + 发弹幕弹层 | ✅ `MobileApp.jsx` |
| 上半屏飘字 + 半透明条 + `pointer-events: none` | ✅ `Danmaku.jsx` + `MobileApp.css` |
| Unity 轮询 | ⏳ 需在 LumiSports 工程内接入 `poll` |

屏蔽词列表见服务端常量 `DANMAKU_BLOCKED_WORDS`，可按现场要求增删。

---

## 十、Unity 端接入指南（LumiSports / 大屏开发必读）

本节面向 **Unity 工程**同学，说明如何在不引入 Socket.IO 客户端的前提下，用 **HTTP 短轮询** 接入弹幕，与现有竞猜联动方式（`ContestApiUrl` + `UnityWebRequest`）保持一致。

### 10.1 职责划分

| 端 | 职责 |
|----|------|
| **手机 H5** | 用户登录后发送弹幕：`POST /api/danmaku/send`；并通过 Socket 收 `danmaku:message` 自播飘字。 |
| **Unity 大屏** | **仅拉取展示**：定时请求 `GET /api/danmaku/poll`，解析 `items` 后在大屏做横向飘字；**不需要**在 Unity 里实现「发弹幕」（除非产品单独要求）。 |
| **Node（LumiSportContest）** | 统一入队、序号、屏蔽字、频控；场次切换时重置队列；与竞猜 **共用同一进程与端口**（默认 `3001`）。 |

### 10.2 配置从哪里来

与竞猜、开赛场次相同，使用 Unity 侧已有的 **`ServerConfig.txt`（或等价配置）**：

- **`ContestApiUrl`**：竞猜 Node 服务根地址，例如 `http://<局域网IP>:3001`。  
- 弹幕接口即：`{ContestApiUrl}/api/danmaku/...`（**无**单独「弹幕服务器」）。

详见《后续操作指南》中 **ContestApiUrl / ContestPageUrl / ContestAdminToken** 说明；**弹幕轮询只依赖 `ContestApiUrl` 可达**，与 `ContestAdminToken` 无直接关系（`poll` / `send` 均为公开 HTTP，安全边界为局域网 + 服务端屏蔽字/频控）。

### 10.3 接口：`GET /api/danmaku/poll`（Unity 唯一必接）

**用途**：按序号 **增量**拉取本场次内、手机端已发送的弹幕，用于大屏播放。

**请求**

- **方法**：`GET`
- **完整路径**：`{ContestApiUrl}/api/danmaku/poll`
- **Query 参数**：

| 参数 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `since` | 整数 | **是** | 客户端已消费的 **最大 `seq`**；从未拉过则传 **`0`**。下一轮请求传 **上一轮处理完后**应使用的游标（见 10.5）。 |
| `sessionId` | 字符串 | 建议 | **上一次响应 JSON 里的 `sessionId` 原样回传**（注意 URL 编码）。**首次请求**可传空字符串，或不传该参数。 |

**服务端行为摘要**

- 场次标识 `sessionId` 由服务端根据当前 **`matchName` + `round`** 生成（形如 `某赛事名|3`）。**新一局、或赛事名变化**会导致 `sessionId` 变化，弹幕队列与序号会重置。
- 若客户端持有的 `sessionId` 与当前不一致 → 返回 **当前缓冲区内全部** `items`，且 **`truncated: true`**（需按全量同步处理游标）。
- 若客户端 **`since` 大于** 服务端当前 `latestSeq`**（例如换局后序号从 0 再起，仍带着上一局的 `since=50`）→ 同样返回全量 `items`，**`truncated: true`**。

**响应 JSON 示例**

```json
{
  "sessionId": "第2局|2",
  "latestSeq": 3,
  "truncated": false,
  "items": [
    {
      "seq": 1,
      "ts": "2026-03-20T08:30:00.000Z",
      "username": "观众A",
      "text": "红方加油"
    }
  ]
}
```

| 字段 | 说明 |
|------|------|
| `sessionId` | 当前场次 ID；下次请求 **原样带回**（URL 编码）。 |
| `latestSeq` | 当前服务端已分配的最大序号。 |
| `truncated` | `true` 表示发生了 **全量重同步**（场次切换或游标过期），`items` 可能含缓冲内多条或全部。 |
| `items` | 本响应应处理的弹幕列表；每条必须展示 **`username` + `text`**（与手机端一致）。 |

**实现常量（与代码一致，便于联调对齐）**

- 环形缓冲最多约 **500** 条；单条文案长度 **1～40** 字（手机端限制，Unity 仅展示）。
- 手机端 **5 秒 1 条** 频控；大屏轮询间隔建议 **300ms～500ms** 即可，避免过高 QPS。

### 10.4 推荐状态变量（Unity 侧）

建议在负责弹幕的 MonoBehaviour / 管理器中 **持久维护**（游戏运行期间即可，无需写 PlayerPrefs，除非要做断线恢复）：

- `long since`：初始 **`0`**；每次 **成功处理完** `items` 后，置为响应中的 **`latestSeq`**（或与已展示的最大 `seq` 对齐，二者在顺序消费前提下应一致）。
- `string sessionId`：初始 **`""`**；每次收到响应后更新为 **`json.sessionId`**。
- 下一次请求的 Query：`since={since}&sessionId={Uri.EscapeDataString(sessionId)}`

若 **`truncated == true`**：仍按顺序播放 `items` 中每条，最后将 **`since = latestSeq`**，**`sessionId` 用响应中的新值**，避免漏条与重复。

### 10.5 轮询流程（逻辑伪代码）

```
since = 0
sessionId = ""

每隔约 0.35 秒：
  GET {ContestApiUrl}/api/danmaku/poll?since={since}&sessionId={UrlEncode(sessionId)}
  若 HTTP 非 2xx：记录日志，下次再试（可适当退避）
  解析 JSON
  sessionId = json.sessionId
  对 json.items 中每条按 seq 顺序加入「待播队列」（大屏飘字）
  若 json.items 非空 或 需要对齐游标：
      since = json.latestSeq
```

**注意**：不要仅凭「`items` 为空」就推进 `since`，应以响应体中的 **`latestSeq`** 为准更新游标，避免与服务端序号脱节（具体以你方队列实现为准；若采用「只增量追加」模型，处理完本批 `items` 后将 `since` 设为 `latestSeq` 即可）。

### 10.6 与竞猜「局」的关系（无需额外接口）

- **换局**（PC/Unity 管理端进入下一局、或 Admin `configure` 等导致 **`round` 或 `matchName` 变化**）后，服务端会切换弹幕 `sessionId` 并清空队列。
- Unity **无需**为弹幕单独调用 Admin 接口；只要持续轮询 `poll` 并正确处理 `sessionId` / `truncated` / `since` 即可。

### 10.7 联调步骤建议

1. 启动 LumiSportContest（`start.bat` 或前后端分别启动），确认 **`ContestApiUrl`** 与运行机 **同网段** 可访问。  
2. 浏览器或 Postman 访问：  
   `GET http://<IP>:3001/api/danmaku/poll?since=0`  
   应返回 JSON，`items` 可为 `[]`。  
3. 手机进入 `/mobile` 登录后发一条弹幕。  
4. 再次请求 `poll`，`items` 中应出现对应 `username`、`text`。  
5. Unity 集成后，观察 **新局开始** 后 `sessionId` 变化、`truncated` 是否为 `true`、大屏是否不卡死、不重复播旧局弹幕。

### 10.8 与 Socket 的关系（Unity 不需要接）

- 手机端使用 **`danmaku:message`** 仅为 **低延迟自播**；Unity **不必**接入 Socket.IO。  
- 大屏以 **`poll` 为唯一数据源** 即可与手机内容 ** eventual 一致**（间隔 300～500ms 内可见）。

### 10.9 可选：如需在 Unity 侧排查原始流量

可用 curl 模拟（Windows / Mac 均可）：

```bash
curl "http://127.0.0.1:3001/api/danmaku/poll?since=0"
```

将 `127.0.0.1` 换为实际 `ContestApiUrl` 主机。

---

*Unity 同学若对 `sessionId` / `since` 对齐有疑问，可对照 LumiSportContest 仓库 `server/index.js` 中 `ensureDanmakuSession`、`GET /api/danmaku/poll` 实现。*
