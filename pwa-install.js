// Service Worker 등록
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/service-worker.js')
      .then((registration) => {
        console.log('Service Worker 등록 성공:', registration.scope);
      })
      .catch((error) => {
        console.log('Service Worker 등록 실패:', error);
      });
  });
}

// PWA 설치 프롬프트
let deferredPrompt;
const installButton = document.getElementById('installButton');

window.addEventListener('beforeinstallprompt', (e) => {
  // 기본 설치 프롬프트 방지
  e.preventDefault();
  
  // 나중에 사용하기 위해 저장
  deferredPrompt = e;
  
  // 설치 버튼 표시
  if (installButton) {
    installButton.style.display = 'block';
  }
});

// 설치 버튼 클릭 핸들러
if (installButton) {
  installButton.addEventListener('click', async () => {
    if (!deferredPrompt) {
      return;
    }
    
    // 설치 프롬프트 표시
    deferredPrompt.prompt();
    
    // 사용자 선택 대기
    const { outcome } = await deferredPrompt.userChoice;
    console.log(`사용자 선택: ${outcome}`);
    
    // 프롬프트 초기화
    deferredPrompt = null;
    
    // 버튼 숨김
    installButton.style.display = 'none';
  });
}

// 앱 설치 완료 이벤트
window.addEventListener('appinstalled', () => {
  console.log('PWA가 설치되었습니다!');
  deferredPrompt = null;
});
