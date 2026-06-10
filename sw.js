// ===== SERVICE WORKER - LƯU WEB ĐỂ CHẠY OFFLINE =====
const CACHE_NAME = 'phien-dich-du-lich-v1';
const urlsToCache = [
  '/',
  '/index.html',
  '/style.css',
  '/script.js',
  'https://translate-worker.tranmanhcuonghappy.workers.dev/translate',
  'https://gemini-worker.tranmanhcuonghappy.workers.dev/'
];

// Cài đặt Service Worker - Lưu file vào cache
self.addEventListener('install', event => {
  console.log('🔄 Đang cài đặt Service Worker...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('✅ Đã lưu file vào cache');
        return cache.addAll(urlsToCache);
      })
      .catch(err => console.error('❌ Lỗi cache:', err))
  );
  self.skipWaiting(); // Kích hoạt ngay lập tức
});

// Kích hoạt - Xóa cache cũ
self.addEventListener('activate', event => {
  console.log('🚀 Kích hoạt Service Worker...');
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cache => {
          if (cache !== CACHE_NAME) {
            console.log('🗑️ Xóa cache cũ:', cache);
            return caches.delete(cache);
          }
        })
      );
    })
  );
  self.clients.claim(); // Chiếm quyền điều khiển trang ngay
});

// Xử lý fetch - Lấy từ cache khi offline
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  
  // API calls - KHÔNG cache, thử mạng trước
  if (url.hostname.includes('workers.dev')) {
    event.respondWith(
      fetch(event.request)
        .catch(() => {
          return new Response(JSON.stringify({ 
            error: 'Không có mạng! Vui lòng kết nối internet để dịch câu mới.',
            offline: true 
          }), {
            headers: { 'Content-Type': 'application/json' }
          });
        })
    );
    return;
  }
  
  // File tĩnh (HTML, CSS, JS) - Cache first
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        if (response) {
          console.log('📦 Từ cache:', event.request.url);
          return response;
        }
        return fetch(event.request)
          .then(response => {
            // Không cache response không hợp lệ
            if (!response || response.status !== 200) {
              return response;
            }
            // Clone response để cache
            const responseToCache = response.clone();
            caches.open(CACHE_NAME)
              .then(cache => {
                cache.put(event.request, responseToCache);
              });
            return response;
          });
      })
  );
});