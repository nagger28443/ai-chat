import { useState, useEffect, useCallback } from 'react';

/**
 * URL search param hook - 读写单个 URL 参数
 *
 * 不依赖 react-router，使用原生 URL API + 自定义事件实现跨组件响应式。
 *
 * 跨组件同步机制：
 * - setParam 调用 pushState 后，派发 search-param-change 自定义事件
 * - 所有 useSearchParam 实例监听该事件，各自从 URL 重新读取值并更新 state
 * - popstate（浏览器前进/后退）同样触发同步
 *
 * 用法：
 * ```tsx
 * const [conversationId, setConversationId] = useSearchParam('conversationId');
 * ```
 */

// 跨组件同步用的自定义事件名
const SEARCH_PARAM_CHANGE_EVENT = 'search-param-change';

export function useSearchParam(
  key: string
): [string | null, (value: string | null) => void] {
  // 从 URL 读取当前值
  const getValue = useCallback(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get(key);
  }, [key]);

  const [value, setValue] = useState<string | null>(getValue);

  // 监听 URL 变化：popstate（浏览器前进/后退）+ 自定义事件（其他组件调用 setParam）
  useEffect(() => {
    const syncFromURL = () => {
      setValue(getValue());
    };

    window.addEventListener('popstate', syncFromURL);
    window.addEventListener(SEARCH_PARAM_CHANGE_EVENT, syncFromURL);
    return () => {
      window.removeEventListener('popstate', syncFromURL);
      window.removeEventListener(SEARCH_PARAM_CHANGE_EVENT, syncFromURL);
    };
  }, [getValue]);

  // 设置新值（更新 URL + 通知其他组件）
  const setParam = useCallback(
    (newValue: string | null) => {
      const url = new URL(window.location.href);

      if (newValue === null) {
        url.searchParams.delete(key);
      } else {
        url.searchParams.set(key, newValue);
      }

      // 使用 pushState 更新 URL（不触发刷新）
      window.history.pushState({}, '', url.toString());

      // 更新自己的 state
      setValue(newValue);

      // 通知其他组件 URL 已变化（pushState 不会触发 popstate，需要手动派发）
      window.dispatchEvent(new CustomEvent(SEARCH_PARAM_CHANGE_EVENT));
    },
    [key]
  );

  return [value, setParam];
}
