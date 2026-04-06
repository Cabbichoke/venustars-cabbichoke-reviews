// ============================================================
// VENUSTARS 리뷰 사이트 — Service Worker v3
// 전략:
//   · Shell (HTML) — Cache First (설치 시 사전 캐시)
//   · reviews_best.json — Cache First + 백그라운드 갱신 (Stale-While-Revalidate)
//   · reviews_all.json — Network First (크기가 커서 온디맨드만)
//   · 기타 정적 자산 — Cache First
// ============================================================

// ─── 버전 관리 ───────────────────────────────────────────────
// 파일을 수정할 때마다 아래 버전 숫자를 올려주세요.
// 그러면 이전 캐시가 자동으로 삭제되고 새 파일이 캐시됩니다.
const CACHE_VERSION = 3;
const SHELL_CACHE   = `venustars-shell-v${CACHE_VERSION}`;
const DATA_CACHE    = `venustars-data-v${CACHE_VERSION}`;

// ─── 사전 캐시 목록 (Shell) ──────────────────────────────────
// 주의: 여기에 없는 파일은 캐시되지 않습니다.
// styles.css, icon 파일 등이 실제로 존재하면 아래에 추가하세요.
const SHELL_URLS = [
  '/venustars-cabbichoke-reviews/',
  '/venustars-cabbichoke-reviews/index.html',
  '/venustars-cabbichoke-reviews/reviews.html',
  '/venustars-cabbichoke-reviews/manifest.json',
];

// ─── 베스트 리뷰 JSON (Stale-While-Revalidate) ───────────────
const BEST_JSON_URL = '/venustars-cabbichoke-reviews/reviews_best.json';

// ─── 설치 ────────────────────────────────────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(SHELL_CACHE)
      .then(cache => cache.addAll(SHELL_URLS))
      .then(() => self.skipWaiting()) // 즉시 활성화
  );
});

// ─── 활성화 (구버전 캐시 정리) ───────────────────────────────
self.addEventListener('activate', event => {
  const allowedCaches = [SHELL_CACHE, DATA_CACHE];
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.map(key => {
          if (!allowedCaches.includes(key)) {
            console.log('[SW] 구버전 캐시 삭제:', key);
            return caches.delete(key);
          }
        })
      ))
      .then(() => self.clients.claim()) // 새 SW를 즉시 모든 탭에 적용
  );
});

// ─── Fetch 요청 라우팅 ───────────────────────────────────────
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // ① 다른 도메인 요청은 그냥 네트워크로
  if (url.origin !== location.origin) return;

  // ② reviews_all.json — Network First (크기 큼, 온디맨드)
  if (request.url.includes('reviews_all.json')) {
    event.respondWith(networkFirst(request, DATA_CACHE));
    return;
  }

  // ③ reviews_best.json — Stale-While-Revalidate
  if (request.url.includes('reviews_best.json')) {
    event.respondWith(staleWhileRevalidate(request, DATA_CACHE));
    return;
  }

  // ④ Shell (HTML, manifest 등) — Cache First
  event.respondWith(cacheFirst(request, SHELL_CACHE));
});

// ─── 전략 함수들 ─────────────────────────────────────────────

// Cache First: 캐시에 있으면 즉시 반환, 없으면 네트워크 후 캐시 저장
async function cacheFirst(request, cacheName) {
  const cached = await caches.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    // 완전 오프라인 + 캐시도 없으면 오프라인 안내 페이지
    return offlineFallback();
  }
}

// Network First: 네트워크 시도 후 실패 시 캐시 반환
async function networkFirst(request, cacheName) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    return cached || offlineFallback();
  }
}

// Stale-While-Revalidate: 캐시를 즉시 반환하면서 백그라운드에서 갱신
async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);

  // 백그라운드 갱신 (결과를 기다리지 않음)
  const networkFetch = fetch(request).then(response => {
    if (response.ok) cache.put(request, response.clone());
    return response;
  }).catch(() => null);

  // 캐시 있으면 즉시, 없으면 네트워크 완료 대기
  return cached || networkFetch;
}

// 오프라인 폴백 — 간단한 안내 HTML 반환
function offlineFallback() {
  return new Response(
    `<!DOCTYPE html>
    <html lang="ko">
    <head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
    <title>오프라인 - VENUSTARS</title>
    <style>
      body { font-family: sans-serif; display: flex; align-items: center; justify-content: center;
             min-height: 100vh; margin: 0; background: #f8f9fa; color: #333; text-align: center; padding: 20px; }
      .box { max-width: 320px; }
      h2 { color: #1a5c3a; font-size: 22px; margin-bottom: 12px; }
      p { font-size: 14px; color: #666; line-height: 1.6; }
      button { margin-top: 20px; padding: 12px 24px; background: #1a5c3a; color: white;
               border: none; border-radius: 8px; font-size: 15px; cursor: pointer; }
    </style></head>
    <body>
      <div class="box">
        <h2>📡 인터넷 연결 없음</h2>
        <p>현재 오프라인 상태입니다.<br>인터넷에 연결한 후 다시 시도해 주세요.</p>
        <button onclick="location.reload()">🔄 다시 시도</button>
      </div>
    </body></html>`,
    { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
  );
}

// ─── Firebase 푸시 알림 (설정 후 주석 해제) ──────────────────
//
// 사용 방법:
// 1. Firebase 콘솔(console.firebase.google.com)에서 프로젝트 생성
// 2. 프로젝트 설정 > 클라우드 메시징 > VAPID 키 복사
// 3. index.html의 Firebase 설정값을 채워넣기
// 4. 아래 주석을 해제하면 푸시 알림 수신 시작
//
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey:            "AIzaSyBpqZEXkf6vq5cwpdeLADGTz8A0M3NKLjU",
  authDomain:        "venustars.firebaseapp.com",
  projectId:         "venustars",
  storageBucket:     "venustars.firebasestorage.app",
  messagingSenderId: "171419456473",
  appId:             "1:171419456473:web:d9b77b0608b5ef3201bfc8"
});

const messaging = firebase.messaging();

// 백그라운드 푸시 알림 수신 (앱이 닫혀있거나 백그라운드일 때)
messaging.onBackgroundMessage(payload => {
  const { title, body, icon } = payload.notification;
  self.registration.showNotification(title, {
    body,
    icon: icon || '/venustars-cabbichoke-reviews/icon-192.png',
    badge: '/venustars-cabbichoke-reviews/icon-192.png',
    data: payload.data,
    vibrate: [100, 50, 100],
    actions: [
      { action: 'open', title: '리뷰 보기' },
      { action: 'dismiss', title: '닫기' }
    ]
  });
});

// 알림 클릭 시 사이트 열기
self.addEventListener('notificationclick', event => {
  event.notification.close();
  const target = event.notification.data?.url || '/venustars-cabbichoke-reviews/';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
      for (const client of clientList) {
        if (client.url === target && 'focus' in client) return client.focus();
      }
      if (clients.openWindow) return clients.openWindow(target);
    })
  );
});
