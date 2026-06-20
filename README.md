# 🧪 药企稳定性试验管理系统 (Stability Study Management System)

> GxP 合规的药企药物稳定性试验全流程管理平台：**样品入箱 → 定时取样 → 检测分析 → 偏差调查(CAPA)**

---

## ✨ 核心特性

### 🔬 业务全流程闭环

| 阶段 | 责任人 | 关键控制 |
|------|--------|----------|
| **1. 试验方案** | 研究员 | 创建方案（含储存条件+取样时间点）→ 提交审批 → QA批准 |
| **2. 样品入箱** | 仓库 | 批量生成样品 → 入箱分配温箱 → 记录温湿度 |
| **3. 定时取样** | 仓库 | **🚩 取样窗口强制控制**（未到窗口禁止出箱，超窗自动转偏差） |
| **4. 检测分析** | 研究员 | 录入结果 → OOS/OOT自动判定 → 提交审核 |
| **5. QA 审批** | QA | 电子签名 → **🚩 批准后任何角色不可改写** → 通知发布 |
| **6. 偏差调查** | QA | 环境/OOS/超窗偏差 → **🚩 自动锁定受影响样品** → CAPA → 关闭解锁 |

### 🛡️ GxP 合规要点

- ✅ **取样窗口严格控制**：Sampling Window ±天数，前后端双重校验，提前取样被强制拒绝
- ✅ **温湿度偏差自动锁样**：环境超限 → 生成警报 → 转偏差 → 自动标记 `is_locked`
- ✅ **检测结果防篡改**：`APPROVED` 状态后任何账号均不可修改
- ✅ **OOS/OOT 智能判定**：正则解析医药常见 4 种规格写法（`95.0~105.0` / `≥98.0` / `≤0.5` / `符合规定`）
- ✅ **完整 CAPA 调查流程**：报告 → 指派 → 调查 → 根本原因 → 纠正/预防 → 验证 → 关闭
- ✅ **电子签名 + 审计轨迹**：每次状态变更均记录审批人、时间、评语
- ✅ **到期提醒**：Celery 定时扫描取样窗口，提前 24h 推送通知

---

## 🏗️ 技术架构

```
┌─────────────────────────────────────────────────────────────────────────┐
│                              浏览器 / 客户端                              │
│                      Angular 17 + PrimeNG (Standalone)                   │
└────────────────────────────────────┬────────────────────────────────────┘
                                     │ HTTPS :4200
               ┌─────────────────────┴─────────────────────┐
               │           Nginx / ng serve Dev            │
               └─────────────────────┬─────────────────────┘
                                     │ /api/*  :8000
┌────────────────────────────────────┴────────────────────────────────────┐
│                         FastAPI (Python 3.11)                           │
│  ┌─────────────┬──────────────┬──────────────┬────────────────────────┐  │
│  │ 🔐 JWT Auth │  📋 Protocols │  🧪 Samples │  🌡️ Environment        │  │
│  │ 👥 RBAC 4角 │  🔬 TestRes.  │  ⚠️ Deviation│  🔔 Notification       │  │
│  └─────────────┴──────────────┴──────────────┴────────────────────────┘  │
│                         SQLAlchemy 2.0 / Pydantic v2                      │
└────────────┬──────────────────────────┬────────────────────────────────┘
             │ PostgreSQL               │ Redis (Broker + Cache)
      ┌──────┴──────┐              ┌────┴────┐
      │  13 张业务表 │              │ Celery  │
      │  审计 + 索引 │              │ Beat +  │
      └─────────────┘              │ Worker  │
                                   └─────────┘
                                   每小时: 取样提醒
                                   每30分: 环境巡检
```

### 📦 技术栈

| 层 | 技术 | 说明 |
|----|------|------|
| 前端 | **Angular 17** + **PrimeNG 17** | Standalone 无 NgModule，路由守卫 + 拦截器 + 懒加载 |
| 后端 | **FastAPI 0.110** + **Pydantic v2** | 7 模块 REST 路由，依赖注入 RBAC |
| ORM | **SQLAlchemy 2.0** | 13 个模型，同步引擎 + 连接池 |
| 数据库 | **PostgreSQL 15** | 业务表 + 审计字段 (created_by/at, ts) |
| 任务 | **Celery 5.3** + **Redis 7** | reminder + default 双队列，Beat 定时 |
| 部署 | **Docker Compose 3.8** | 6 个服务一键启动，healthcheck 顺序启动 |

---

## 🚀 快速启动（5 分钟）

### 方式一：一键启动脚本（推荐 ✨）

```bash
cd /path/to/project
chmod +x start.sh
./start.sh up
```

访问：
- 🌐 前端界面: **http://localhost:4200**
- 🔧 API 文档: **http://localhost:8000/docs**

### 方式二：手动 Docker Compose

```bash
# 1. 构建镜像 & 后台启动
docker compose up -d --build

# 2. 查看日志
docker compose logs -f backend celery_worker

# 3. 停止
docker compose down
```

### 其他命令

| 命令 | 说明 |
|------|------|
| `./start.sh stop` | 停止所有服务 |
| `./start.sh restart` | 重启 |
| `./start.sh logs` | 实时查看日志 |
| `./start.sh reset` | 清除所有数据（⚠️ 含数据库卷）|
| `./start.sh status` | 查看容器状态 |

---

## 👤 默认账号

> 💡 **首次使用**：访问登录页 → 点击右下角「一键初始化」按钮，自动创建以下账号
> （也可手动调用 `POST /api/auth/init-default-users`）

| 账号 | 密码 | 角色 | 典型业务场景 |
|------|------|------|--------------|
| `admin` | `admin123` | **Admin** 超级管理员 | 所有操作 + 用户管理 |
| `researcher1` | `pass1234` | **Researcher 研究员** | 创建试验方案、录入检测结果、提交审核 |
| `warehouse1` | `pass1234` | **Warehouse 仓库** | 样品入箱/出箱、按窗口取样 |
| `qa1` | `pass1234` | **QA 质量保证** | 审批方案/结果、处理偏差、CAPA、样品解锁 |

---

## 🎯 业务演示场景脚本

### 场景 A：完整稳定性试验（研究员 → 仓库 → QA）

```
步骤1  researcher1 登录
  └─ 方案管理 → 新建 → 输入「阿司匹林肠溶片 长期稳定性」
     ├─ 储存条件: 25℃±2℃ / 60%±5%RH  (长期)
     ├─ 取样点: 0, 3, 6, 9, 12, 24, 36 月
     └─ 提交 → 状态: 待审批

步骤2  qa1 登录
  └─ 方案列表 → 审批通过 → 状态: 进行中

步骤3  researcher1 回到方案详情
  └─ 点击「批量生成样品」→ 每个时间点 × 2 份 = 14 个样品生成

步骤4  warehouse1 登录
  ├─ 样品管理 → 多选 → 批量入箱（分配 STB-001 温箱）
  └─ 「取样操作」页面：
     • 未到窗口（如 24 月点）：显示 🟡「距窗口开启还有 23 天」按钮禁用
     • 0 月点（t=0）：✅ 窗口内 → 取样确认 → 生成取样记录
     • 故意超窗模拟 1 个点：🟠 超窗提示 → 自动通知 QA

步骤5  researcher1 录入结果
  └─ 新建检测结果 → 选择样品 → 含量 98.5% (规格95.0~105.0)
     • OOS/OOT 判定: ✅ 合格
     • 故意把含量改为 92.0%：🔴 自动判定 OOS，按钮提示启动调查

步骤6  qa1 审批结果
  └─ 结果详情 → 批准 → 电子签名 → 状态: APPROVED
     • 尝试再次编辑：按钮隐藏，显示绿色「🔒 已锁定」水印
```

### 场景 B：温湿度偏差 + 自动锁样

```
步骤1  访问「环境监控」→ 点击「模拟传感器数据」
     • 每 8 秒生成 3 个温箱记录，12% 概率超限

步骤2  「环境警报」→ 看到 🚨 Critical 警报
     └─ 一键「转偏差调查」→ 自动：
       • 创建 Deviation
       • 自动锁定该温箱全部样品（is_locked=True）
       • 写入样品流转轨迹 LOCK

步骤3  仓库尝试取样被锁样品：
     └─ ❌ 拒绝原因:「样品已锁定，请联系 QA」

步骤4  qa1 处理偏差：
     ├─ 指派 → 启动调查 → 定位原因（如：空调故障）
     ├─ 录入纠正措施（维修空调）+ 预防措施（预防性维护）
     ├─ 添加 CAPA 验证结论
     └─ 关闭偏差 → ✅ 自动解锁所有受影响样品
```

---

## 🗄️ 数据库表清单

| 表名 | 说明 | 核心字段 |
|------|------|----------|
| `users` / `roles` / `user_roles` | 用户与RBAC | bcrypt + JWT |
| `protocols` | 试验方案 | 6 态 status, 审批人 |
| `sampling_timepoints` | 取样时间点 | month, window_days |
| `protocol_storage_conditions` | 储存条件 | temp±tol, humidity±tol |
| `samples` | 样品 | 8 态 + `is_locked`, `lock_reason` |
| `sample_movements` | 流转轨迹 | 5类 IN/OUT/SAMPLE/LOCK/UNLOCK |
| `sampling_records` | 取样记录 | `is_within_window`, 取样人/时间 |
| `environment_records` | 环境记录 | temp, humidity, deviation 自动算 |
| `environment_alerts` | 环境警报 | 3级 info/warning/critical |
| `test_results` | 检测结果 | 6态 + `is_oos`, `is_oot` |
| `test_result_items` | 检测项明细 | value, spec, oos/oot判定 |
| `test_result_approvals` | 审批电子签名 | 评语, 签名, 时间戳 |
| `deviations` | 偏差报告 | 7态, 3类, 3严重度 |
| `deviation_affected_samples` | 偏差×样品多对多 | 受影响样品关联 |
| `deviation_conclusions` | CAPA 结论 | RCA, 纠正, 预防, 验证 |
| `notifications` | 通知中心 | 10种类型, 优先级, 已读状态 |

---

## 📡 REST API 概览

> 完整交互文档：**http://localhost:8000/docs** (Swagger UI)

### 🔐 Auth

| Method | Path | 说明 |
|--------|------|------|
| POST | `/api/auth/login` | 登录，返回 access_token |
| POST | `/api/auth/init-default-users` | 初始化 4 个默认账号 |
| GET | `/api/auth/me` | 当前用户信息 + 角色 |

### 📋 Protocols

- `GET /api/protocols` · `POST /api/protocols` · `GET /api/protocols/{id}`
- `POST /api/protocols/{id}/submit` · `POST /api/protocols/{id}/approve` · `POST /api/protocols/{id}/reject`
- `POST /api/protocols/{id}/generate-samples` · `GET /api/protocols/{id}/window-info`

### 🧪 Samples

- `GET /api/samples` · `POST /api/samples` · `GET /api/samples/{id}`
- `POST /api/samples/{id}/move` (in/out) · `POST /api/samplings` (取样，含窗口校验)
- `POST /api/samples/lock` · `POST /api/samples/unlock`

### 🌡️ Environment

- `GET /api/environment/records` · `POST /api/environment/records`
- `GET /api/alerts` · `POST /api/alerts/{id}/confirm` · `POST /api/alerts/{id}/create-deviation`

### 🔬 Test Results

- `GET /api/test-results` · `POST /api/test-results` · `GET /api/test-results/{id}`
- `POST /api/test-results/{id}/submit` · `POST /api/test-results/{id}/review` · `POST /api/test-results/{id}/approve`
- `POST /api/test-results/{id}/reject`

### ⚠️ Deviations

- `GET /api/deviations` · `POST /api/deviations` · `GET /api/deviations/{id}`
- `POST /api/deviations/{id}/status` · `POST /api/deviations/{id}/assign`
- `POST /api/deviations/{id}/conclusions` · `POST /api/deviations/{id}/close` (关闭并解锁样品)
- `POST /api/deviations/{id}/unlock-samples`

### 🔔 Notifications

- `GET /api/notifications` · `POST /api/notifications/{id}/read` · `POST /api/notifications/read-all`

---

## 📂 项目结构

```
.
├── backend/                          # FastAPI 后端
│   ├── app/
│   │   ├── api/
│   │   │   └── routers/              # 7 个 REST 路由模块
│   │   │       ├── auth.py           # 认证 & JWT
│   │   │       ├── protocol.py       # 试验方案
│   │   │       ├── sample.py         # 样品 + 取样
│   │   │       ├── environment.py    # 环境监控
│   │   │       ├── test_result.py    # 检测结果审批
│   │   │       ├── deviation.py      # 偏差调查
│   │   │       └── notification.py   # 通知中心
│   │   ├── core/                     # 配置/数据库/安全/Celery
│   │   ├── crud/                     # 业务 CRUD（核心校验逻辑）
│   │   ├── models/                   # SQLAlchemy ORM 模型 (13 表)
│   │   ├── schemas/                  # Pydantic 入参/出参
│   │   ├── tasks/                    # Celery 定时任务
│   │   │   ├── sampling.py           # 取样窗口扫描
│   │   │   └── monitoring.py         # 环境巡检
│   │   └── main.py                   # FastAPI 入口
│   ├── Dockerfile
│   └── requirements.txt
│
├── frontend/                         # Angular 17 前端
│   ├── src/
│   │   ├── app/
│   │   │   ├── layout/               # 主布局（导航+通知中心）
│   │   │   ├── pages/                # 16+ 业务页面
│   │   │   │   ├── dashboard/        # 仪表盘 KPI
│   │   │   │   ├── protocol/         # 方案 列表/新建/详情
│   │   │   │   ├── sample/           # 样品 列表/详情/取样(核心)
│   │   │   │   ├── environment/      # 环境监控 + 警报
│   │   │   │   ├── test-result/      # 检测结果列表/新建/审批
│   │   │   │   └── deviation/        # 偏差列表/新建/详情 CAPA
│   │   │   ├── shared/
│   │   │   │   ├── models/index.ts   # TypeScript 完整接口
│   │   │   │   └── services/         # 7 个 Http 服务 + 2 个守卫
│   │   │   ├── app.routes.ts         # 懒加载路由
│   │   │   └── app.config.ts         # Standalone 根配置
│   │   ├── main.ts
│   │   └── styles.scss
│   ├── Dockerfile
│   └── package.json
│
├── docker-compose.yml                # 6 服务编排
├── start.sh                          # 🚀 一键脚本
└── README.md
```

---

## 🧪 核心校验逻辑速查

### 取样窗口校验（前后端双重）

```python
# backend/app/crud/crud_sample.py
def check_sample_can_be_sampled(sample, timepoint_id):
    # 1. 锁定检查
    if sample.is_locked:
        return False, f"样品已锁定: {sample.lock_reason}"
    # 2. 窗口时间范围
    win = calc_window(timepoint)
    if today < win.start:
        return False, f"取样窗口未开启，还有 {(win.start-today).days} 天"
    if today > win.end:
        return False, "取样窗口已关闭，请启动偏差调查"
    # 3. 重复取样检查
    if already_sampled(sample, timepoint):
        return False, "该时间点已取样"
    return True, "OK"
```

### 检测结果防篡改

```python
# can_user_edit_result(result, user_roles):
#   result.status == 'APPROVED'  → 任何角色 False
#   result.status in ['DRAFT','REJECTED'] → 创建者或 QA
#   其他状态 → QA/Admin
```

### 规格解析（OOS 自动判定）

```python
# 支持以下医药常见写法：
"95.0~105.0"   → 区间判定
">=98.0"       → 下限
"≤0.5"         → 上限
"符合规定"     → 直接通过
```

---

## 🐛 常见问题排查

| 问题 | 解决 |
|------|------|
| 启动后前端 404 | 等 Angular 首次编译完成（需 2-4min），`./start.sh logs frontend` |
| 后端启动报 DB 连不上 | PostgreSQL 健康检查未通过，等 15 秒重试 |
| 忘记账号密码 | 重新调用 `POST /api/auth/init-default-users`（不会覆盖已存在用户）|
| 样品无法取样 | 检查：①样品已锁定 ②窗口未开启 ③该时间点已取样 |
| 定时任务没反应 | `./start.sh logs celery_worker celery_beat` |

---

## 📜 License

Internal Pharmaceutical GxP System · 仅供学习与合规评估使用
