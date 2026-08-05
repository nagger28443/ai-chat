import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import 'highlight.js/styles/github-dark.css';
import { renderStreamingMarkdown } from '../../utils/renderStreamingMarkdown';
import styles from './MarkdownRenderer.module.css';

interface MarkdownRendererProps {
  content: string;
  /** 是否为流式渲染中（会自动补全未闭合语法） */
  isStreaming?: boolean;
}

export function MarkdownRenderer({ content, isStreaming }: MarkdownRendererProps) {
  // 流式渲染时对内容进行预处理，补全未闭合的 Markdown 语法
  const processedContent = isStreaming ? renderStreamingMarkdown(content) : content;

  return (
    <div className={styles.markdown}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeHighlight]}
      >
        {processedContent}
      </ReactMarkdown>
    </div>
  );
}
