# AI Chat Demo - 启动脚本

echo "============================================"
echo "  AI Chat Demo - 一键启动"
echo "============================================"
echo ""

cd "$(dirname "$0")"

# 检查并安装前端依赖
if [ ! -d "frontend/node_modules" ]; then
  echo "[Frontend] 正在安装依赖..."
  (cd frontend && npm install)
  echo ""
fi

# 检查并安装后端依赖
if [ ! -d "backend/node_modules" ]; then
  echo "[Backend] 正在安装依赖..."
  (cd backend && npm install)
  echo ""
fi

# 启动后端服务
echo "[Backend] 正在启动 http://localhost:3000"
(cd backend && npm run dev) &
BACKEND_PID=$!

sleep 2

# 启动前端服务
echo "[Frontend] 正在启动 http://localhost:5173"
(cd frontend && npm run dev) &
FRONTEND_PID=$!

echo ""
echo "============================================"
echo "  所有服务已启动！"
echo "  后端: http://localhost:3000"
echo "  前端: http://localhost:5173"
echo "  健康检查: http://localhost:3000/api/health"
echo "============================================"
echo ""
echo "按 Ctrl+C 停止所有服务"

# 捕获中断信号，清理进程
trap "echo ''; echo '正在停止服务...'; kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit" INT TERM

wait
