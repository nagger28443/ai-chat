# AI Chat Demo - 启动脚本

echo "============================================"
echo "  AI Chat Demo - 一键启动"
echo "============================================"
echo ""

cd "$(dirname "$0")"

# 端口配置
BACKEND_PORT=3000
FRONTEND_PORT=5173

# 检测操作系统
is_windows() {
  [[ "$OSTYPE" == "msys" || "$OSTYPE" == "cygwin" || "$OSTYPE" == "win32" ]]
}

# 检查端口是否被占用
check_port() {
  local port=$1
  if is_windows; then
    # Windows: 使用 netstat
    netstat -ano 2>/dev/null | grep -q ":${port}.*LISTENING"
  else
    # Unix/Linux/Mac: 使用 lsof 或 netstat
    if command -v lsof >/dev/null 2>&1; then
      lsof -ti:"$port" >/dev/null 2>&1
    else
      netstat -tulpn 2>/dev/null | grep -q ":${port}"
    fi
  fi
}

# 获取占用端口的进程ID
get_port_pid() {
  local port=$1
  if is_windows; then
    # Windows: 从 netstat 输出中提取 PID
    netstat -ano 2>/dev/null | grep ":${port}.*LISTENING" | awk '{print $5}' | head -1
  else
    # Unix/Linux/Mac
    if command -v lsof >/dev/null 2>&1; then
      lsof -ti:"$port" 2>/dev/null | head -1
    else
      netstat -tulpn 2>/dev/null | grep ":${port}" | awk '{print $7}' | cut -d'/' -f1 | head -1
    fi
  fi
}

# 释放端口
kill_port() {
  local port=$1
  local pid=$(get_port_pid "$port")

  if [ -n "$pid" ] && [ "$pid" != "0" ]; then
    echo "  端口 $port 被进程 PID=$pid 占用"
    if is_windows; then
      # Windows: 使用 taskkill
      if taskkill //F //PID "$pid" >/dev/null 2>&1; then
        echo "  ✓ 已释放端口 $port (PID=$pid)"
        sleep 1
        return 0
      else
        echo "  ✗ 释放端口 $port 失败"
        return 1
      fi
    else
      # Unix/Linux/Mac: 使用 kill
      if kill -9 "$pid" >/dev/null 2>&1; then
        echo "  ✓ 已释放端口 $port (PID=$pid)"
        sleep 1
        return 0
      else
        echo "  ✗ 释放端口 $port 失败"
        return 1
      fi
    fi
  else
    echo "  端口 $port 未被占用"
    return 0
  fi
}

# 检查并释放端口
echo "[检查] 检查端口占用情况..."
echo ""

# 检查后端端口
echo "  后端端口 ($BACKEND_PORT):"
if check_port $BACKEND_PORT; then
  kill_port $BACKEND_PORT
else
  echo "  ✓ 端口 $BACKEND_PORT 可用"
fi
echo ""

# 检查前端端口
echo "  前端端口 ($FRONTEND_PORT):"
if check_port $FRONTEND_PORT; then
  kill_port $FRONTEND_PORT
else
  echo "  ✓ 端口 $FRONTEND_PORT 可用"
fi
echo ""

echo "============================================"
echo ""

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
echo "[Backend] 正在启动 http://localhost:$BACKEND_PORT"
(cd backend && npm run dev) &
BACKEND_PID=$!

sleep 2

# 检查后端是否启动成功
if ! kill -0 $BACKEND_PID 2>/dev/null; then
  echo "[Backend] ✗ 启动失败"
  exit 1
fi
echo "[Backend] ✓ 启动成功 (PID=$BACKEND_PID)"
echo ""

# 启动前端服务
echo "[Frontend] 正在启动 http://localhost:$FRONTEND_PORT"
(cd frontend && npm run dev) &
FRONTEND_PID=$!

sleep 2

# 检查前端是否启动成功
if ! kill -0 $FRONTEND_PID 2>/dev/null; then
  echo "[Frontend] ✗ 启动失败"
  kill $BACKEND_PID 2>/dev/null
  exit 1
fi
echo "[Frontend] ✓ 启动成功 (PID=$FRONTEND_PID)"
echo ""

echo "============================================"
echo "  所有服务已启动！"
echo "  后端: http://localhost:$BACKEND_PORT"
echo "  前端: http://localhost:$FRONTEND_PORT"
echo "  健康检查: http://localhost:$BACKEND_PORT/api/health"
echo "============================================"
echo ""
echo "按 Ctrl+C 停止所有服务"

# 捕获中断信号，清理进程
cleanup() {
  echo ""
  echo "正在停止服务..."
  kill $BACKEND_PID $FRONTEND_PID 2>/dev/null
  sleep 1

  # 确保进程已停止
  if kill -0 $BACKEND_PID 2>/dev/null; then
    kill -9 $BACKEND_PID 2>/dev/null
  fi
  if kill -0 $FRONTEND_PID 2>/dev/null; then
    kill -9 $FRONTEND_PID 2>/dev/null
  fi

  echo "✓ 所有服务已停止"
  exit 0
}

trap cleanup INT TERM

wait
