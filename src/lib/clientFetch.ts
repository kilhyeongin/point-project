// src/lib/clientFetch.ts
// 클라이언트 사이드 fetch 래퍼 — 401 응답 시 자동 로그아웃

const SESSION_EXPIRED_EVENT = "auth:session-expired";

/** 각 Shell 컴포넌트에서 한 번만 호출 */
export function initAuthInterceptor() {
  if (typeof window === "undefined") return;
  // 이미 설치된 경우 중복 방지
  if ((window as any).__authInterceptorInstalled) return;
  (window as any).__authInterceptorInstalled = true;

  const original = window.fetch.bind(window);
  window.fetch = async (...args) => {
    const response = await original(...args);
    if (response.status === 401) {
      const url = typeof args[0] === "string" ? args[0] : (args[0] as Request).url;
      // 로그인/인증 API 자체의 401은 인터셉트하지 않음
      if (!url.includes("/api/auth/")) {
        window.dispatchEvent(new CustomEvent(SESSION_EXPIRED_EVENT));
      }
    }
    return response;
  };
}

/** Shell 컴포넌트에서 useEffect로 구독 */
export function onSessionExpired(callback: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(SESSION_EXPIRED_EVENT, callback);
  return () => window.removeEventListener(SESSION_EXPIRED_EVENT, callback);
}
