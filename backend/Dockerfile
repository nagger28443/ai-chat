# ============================================
# Backend Dockerfile - 多阶段构建
# ============================================

# 阶段 1：构建
FROM node:20-alpine AS builder
WORKDIR /app

# 复制依赖清单
COPY backend/package.json backend/package-lock.json ./
RUN npm ci

# 复制源代码
COPY backend/ ./
COPY shared/ ../shared/

# TypeScript 编译
RUN npm run build

# 阶段 2：运行
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

# 创建非 root 用户
RUN addgroup -g 1001 -S nodejs && \
    adduser -S appuser -u 1001

# 复制构建产物
COPY --from=builder --chown=appuser:nodejs /app/dist ./dist
COPY --from=builder --chown=appuser:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=appuser:nodejs /app/package.json ./
COPY --from=builder --chown=appuser:nodejs /app/../shared ../shared/

# 创建数据目录
RUN mkdir -p /app/data && chown appuser:nodejs /app/data

USER appuser

EXPOSE 3000

# 健康检查
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api/health || exit 1

CMD ["node", "dist/server.js"]
