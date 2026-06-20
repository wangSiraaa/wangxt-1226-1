#!/usr/bin/env bash
# ============================================================
#  药企稳定性试验管理系统 - 一键启动脚本
# ============================================================
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"

echo ""
echo "╔═══════════════════════════════════════════════════════════════╗"
echo "║   🧪 药企稳定性试验管理系统 - Startup Script                 ║"
echo "║   Angular 17 + FastAPI + PostgreSQL + Redis + Celery         ║"
echo "╚═══════════════════════════════════════════════════════════════╝"
echo ""

if ! command -v docker &> /dev/null; then
  echo "❌ 未检测到 docker，请先安装 Docker Desktop"
  exit 1
fi
if ! command -v docker compose &> /dev/null && ! docker --version | grep -q "version 2"; then
  echo "❌ 请升级 Docker Compose v2+"
  exit 1
fi

CMD="${1:-up}"

case "$CMD" in
  up|start)
    echo "🚀 启动所有服务（首次会构建镜像，需约 5-15 分钟）..."
    docker compose up -d --build
    echo ""
    echo "⏳ 等待健康检查..."
    for i in $(seq 1 30); do
      sleep 2
      STATUS=$(docker compose ps --format json 2>/dev/null | python3 -c "import sys,json;d=[x for x in sys.stdin.read().strip().split('\n') if x];print('OK' if d and all('running' in json.loads(x).get('State','') for x in d if x) else 'WAIT'  if d else 'WAIT')" 2>/dev/null || echo "WAIT")
      if [ "$STATUS" = "OK" ]; then break; fi
      echo -n "."
    done
    echo ""
    echo ""
    echo "✅ 服务已就绪！"
    echo ""
    echo "  ┌───────────────────────────────────────────────────┐"
    echo "  │  🌐 前端界面  : http://localhost:4200               │"
    echo "  │  🔧 后端文档  : http://localhost:8000/docs           │"
    echo "  │  🐘 数据库    : localhost:5432   db=stability_study  │"
    echo "  │  ⚡ Redis     : localhost:6379                       │"
    echo "  └───────────────────────────────────────────────────┘"
    echo ""
    echo "📋 默认测试账号（登录页点「一键初始化」可自动创建）："
    echo "   • admin / admin123     →  全部权限"
    echo "   • researcher1 / pass1234  →  研究员（方案/结果）"
    echo "   • warehouse1 / pass1234   →  仓库（入箱/取样）"
    echo "   • qa1 / pass1234          →  QA（审批/偏差）"
    echo ""
    echo "💡 查看日志： ./start.sh logs"
    echo "💡 停止服务： ./start.sh stop"
    ;;

  stop|down)
    echo "🛑 停止并移除所有容器..."
    docker compose down
    echo "✅ 已停止"
    ;;

  restart)
    "$0" stop
    sleep 2
    "$0" up
    ;;

  logs)
    echo "📜 服务实时日志（Ctrl+C 退出）..."
    docker compose logs -f --tail=200
    ;;

  reset)
    echo "⚠️  将清除所有数据卷！确认请输入 yes: "
    read -r CONFIRM
    if [ "$CONFIRM" = "yes" ]; then
      docker compose down -v
      echo "✅ 已重置（含数据）"
    else
      echo "取消"
    fi
    ;;

  status)
    docker compose ps
    ;;

  *)
    echo "用法: $0 {up|stop|restart|logs|reset|status}"
    echo "   默认 up（后台启动）"
    exit 1
    ;;
esac
