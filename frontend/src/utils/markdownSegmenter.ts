const FENCE = '```';

/**
 * 增量 Markdown 分段器。
 *
 * 将流式到达的文本按 Markdown 块边界（空行、代码围栏）拆分为
 * 已完成的不可变段 + 一个正在进行的尾部缓冲区。
 * 已完成的段可直接交给 React.memo 缓存，避免整段重新解析。
 */
export class MarkdownSegmenter {
  private buffer = '';
  private insideCodeFence = false;
  private segments: string[] = [];

  /** 追加一段文本，自动扫描并拆分已完成的段。 */
  push(chunk: string): void {
    this.buffer += chunk;
    this.scan();
  }

  /** 返回当前所有段（已完成 + 进行中的 buffer）。 */
  getSegments(): string[] {
    return this.buffer ? [...this.segments, this.buffer] : [...this.segments];
  }

  /** 将剩余 buffer 推入最后一段，返回最终快照并重置。 */
  finalize(): string[] {
    if (this.buffer) {
      this.segments.push(this.buffer);
      this.buffer = '';
    }
    const result = [...this.segments];
    this.reset();
    return result;
  }

  /** 清空所有状态。 */
  reset(): void {
    this.buffer = '';
    this.insideCodeFence = false;
    this.segments = [];
  }

  // ==================== 内部扫描 ====================

  private scan(): void {
    while (this.buffer.length > 0) {
      const extracted = this.insideCodeFence
        ? this.extractCodeBlock()
        : this.extractNextBlock();
      if (!extracted) break; // 等待更多数据
    }
  }

  /**
   * 非代码围栏状态：寻找最近的边界（空行或开始围栏），
   * 将边界之前的内容推入 segments。
   */
  private extractNextBlock(): boolean {
    const blankIdx = this.buffer.indexOf('\n\n');
    const fenceIdx = this.findFenceOpen();

    // 情况1：无空行且无围栏 → 等待更多数据
    if (blankIdx === -1 && fenceIdx === -1) return false;

    // 情况2：围栏先到（或没有空行）
    if (fenceIdx !== -1 && (blankIdx === -1 || fenceIdx <= blankIdx)) {
      // 围栏前的内容作为独立段
      if (fenceIdx > 0) {
        this.segments.push(this.buffer.slice(0, fenceIdx));
        this.buffer = this.buffer.slice(fenceIdx);
      }
      // 现在 buffer 以 ``` 开头，进入代码围栏状态
      this.insideCodeFence = true;
      // 跳过围栏行（到下一个 \n）
      const nlIdx = this.buffer.indexOf('\n');
      if (nlIdx === -1) {
        // 围栏行尚未完整到达，等待
        return true;
      }
      // 围栏行完整，buffer 仍以此行开头，由 extractCodeBlock 继续处理
      return true;
    }

    // 情况3：空行先到
    // 将 \n\n 及之前的内容推为一段
    this.segments.push(this.buffer.slice(0, blankIdx + 2));
    this.buffer = this.buffer.slice(blankIdx + 2);
    return true;
  }

  /**
   * 代码围栏状态：buffer 以围栏标记开头，寻找闭合围栏。
   * 找到后将整个代码块（含围栏）推入 segments。
   */
  private extractCodeBlock(): boolean {
    // 找围栏行结束位置
    const firstNl = this.buffer.indexOf('\n');
    if (firstNl === -1) return false; // 围栏行未完整

    // 从围栏行后搜索闭合围栏 "\n```"
    const closeMarker = '\n' + FENCE;
    const closeIdx = this.buffer.indexOf(closeMarker, firstNl);

    if (closeIdx === -1) return false; // 闭合围栏尚未到达

    // 找到闭合围栏，找该行结尾
    const afterClose = closeIdx + closeMarker.length;

    // 闭合围栏后可能还有同一行的内容（如语言标记等）
    const nlAfter = this.buffer.indexOf('\n', afterClose);

    if (nlAfter === -1) {
      // 闭合围栏行无结尾 \n：
      // 若闭合围栏正好在 buffer 末尾，可提取
      if (afterClose === this.buffer.length) {
        this.segments.push(this.buffer);
        this.buffer = '';
        this.insideCodeFence = false;
        return true;
      }
      // 否则闭合行还在继续，等待 \n
      return false;
    }

    // 提取整个代码块（含闭合围栏行的 \n）
    this.segments.push(this.buffer.slice(0, nlAfter + 1));
    this.buffer = this.buffer.slice(nlAfter + 1);
    this.insideCodeFence = false;
    return true;
  }

  /**
   * 在 buffer 中查找位于行首的 ``` 标记。
   * 行首定义：位置 0 或紧跟 \n 之后。返回索引，未找到返回 -1。
   */
  private findFenceOpen(): number {
    if (this.buffer.startsWith(FENCE)) return 0;
    let pos = 0;
    while (true) {
      const nl = this.buffer.indexOf('\n', pos);
      if (nl === -1) return -1;
      const next = nl + 1;
      if (this.buffer.startsWith(FENCE, next)) return next;
      pos = next;
    }
  }
}
