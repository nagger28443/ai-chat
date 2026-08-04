#!/usr/bin/env bash
#
# commit.sh
# 读取同目录下 git-message.md 的内容作为 commit message，
# 提交当前仓库中的所有修改（包括新增、修改、删除）。
#
# 用法:
#   ./shell/commit.sh          # 从仓库任意位置运行均可
#   bash shell/commit.sh

set -euo pipefail

# ---------- 路径解析 ----------
# 无论脚本从哪里被调用，都能正确定位 git-message.md
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MESSAGE_FILE="${SCRIPT_DIR}/git-message.md"

# ---------- 前置检查 ----------
# 1) 必须处于 git 仓库中
if ! git rev-parse --is-inside-work-tree > /dev/null 2>&1; then
  echo "错误: 当前目录不在 git 仓库中" >&2
  exit 1
fi

# 2) git-message.md 必须存在
if [[ ! -f "${MESSAGE_FILE}" ]]; then
  echo "错误: 找不到 commit 信息文件: ${MESSAGE_FILE}" >&2
  exit 1
fi

# ---------- 暂存所有修改 ----------
# git add -A 会暂存工作区中所有变更（新增/修改/删除），
# 但会遵循 .gitignore 的规则。
git add -A

# 如果暂存后没有任何变更，提示并退出
if git diff --cached --quiet; then
  echo "没有需要提交的修改。"
  exit 0
fi

# ---------- 提交 ----------
# 如果 git-message.md 为空，使用 "." 作为 commit message；
# 否则使用文件内容。
if [[ -s "${MESSAGE_FILE}" ]]; then
  git commit --file "${MESSAGE_FILE}"
else
  git commit -m "."
fi

# ---------- 清理 ----------
# 提交成功后清空 git-message.md，为下次记录做准备
> "${MESSAGE_FILE}"

echo "提交完成 ✓"
