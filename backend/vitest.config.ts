import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Windows 上多 worker 并发写入 data/ 目录会触发 EPERM（文件锁），
    // 使用单 worker 串行执行避免冲突。
    fileParallelism: false,
  },
});
