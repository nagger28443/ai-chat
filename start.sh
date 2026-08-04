#!/bin/bash

echo "============================================"
echo "  AI Chat Demo - 一键启动"
echo "============================================"
echo ""

cd "$(dirname "$0")"

if [ ! -d "frontend/node_modules" ]; then
  echo "[Frontend] 正在安装依赖..."
  (cd frontend && npm install)
  echo ""
fi

if [ ! -d "backend/node_modules" ]; then
  echo "[Backend] 正在安装依赖..."
  (cd backend && npm install)
  echo ""
fi

echo "[Backend] 正在启动 http://localhost:3000"
(cd backend && npm run dev) &
BACKEND_PID=$!

sleep 2

echo "[Frontend] 正在启动 http://localhost:5173"
(cd frontend && npm run dev) &
FRONTEND_PID=$!

echo ""
echo "============================================"
echo "  所有服务已启动！"
echo "  后端: http://localhost:3000"
echo "  前端: http://localhost:5173"
echo "============================================"
echo ""
echo "按 Ctrl+C 停止所有服务"

trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit" INT TERM

wait
