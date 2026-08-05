/**
 * 对未闭合的 Markdown 语法进行智能补全，使流式渲染时能正确显示格式。
 * 仅应用于最后一个正在流式输入的段落。
 */
export function completeMarkdown(text: string): string {
  // 1. 检查未闭合的代码围栏
  let inCodeFence = false;
  const lines = text.split('\n');
  for (const line of lines) {
    if (/^```/.test(line.trim())) {
      inCodeFence = !inCodeFence;
    }
  }
  if (inCodeFence) {
    return text + '\n```';
  }

  // 2. 移除已闭合的代码块，分析行内格式
  const cleaned = text.replace(/^```[\s\S]*?^```/gm, '');

  // 3. 检查未闭合的行内代码
  let inInlineCode = false;
  let nonCodeText = '';
  for (let i = 0; i < cleaned.length; i++) {
    if (cleaned[i] === '`') {
      inInlineCode = !inInlineCode;
    } else if (!inInlineCode) {
      nonCodeText += cleaned[i];
    }
  }
  if (inInlineCode) {
    return text + '`';
  }

  // 4. 检查未闭合的行内格式（删除线、加粗、斜体）
  const strikethroughCount = (nonCodeText.match(/~~/g) || []).length;
  const withoutStrikethrough = nonCodeText.replace(/~~/g, '');

  const boldCount = (withoutStrikethrough.match(/\*\*/g) || []).length;
  const withoutBold = withoutStrikethrough.replace(/\*\*/g, '');

  const italicCount = (withoutBold.match(/\*/g) || []).length;

  // 按从外到内的顺序闭合（LIFO）
  let completion = '';
  if (strikethroughCount % 2 === 1) completion = '~~' + completion;
  if (boldCount % 2 === 1) completion = '**' + completion;
  if (italicCount % 2 === 1) completion = '*' + completion;

  return text + completion;
}
