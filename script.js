// ===== CẤU HÌNH API DỊCH =====
const TRANSLATE_API_URL = "https://translate-worker.tranmanhcuonghappy.workers.dev/translate";

class TranslationApp {
    constructor() {
        this.recognition = null;
        this.currentMode = null;
        this.isListening = false;
        
        this.initElements();
        this.initEventListeners();
        this.initSpeechRecognition();
    }
    
    initElements() {
        this.listenBtn = document.getElementById('listenBtn');
        this.speakBtn = document.getElementById('speakBtn');
        this.resultText = document.getElementById('resultText');
        this.statusText = document.getElementById('statusText');
        this.statusIndicator = document.getElementById('statusIndicator');
    }
    
    initEventListeners() {
        this.listenBtn.addEventListener('click', () => this.startListening('en-US'));
        this.speakBtn.addEventListener('click', () => this.startListening('vi-VN'));
    }
    
    initSpeechRecognition() {
        if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
            const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
            this.recognition = new SpeechRecognition();
            this.recognition.continuous = false;
            this.recognition.interimResults = false;
            this.recognition.lang = 'en-US';
            
            this.recognition.onstart = () => {
                this.isListening = true;
                this.updateStatus('🎤 Đang nghe, hãy nói...', 'listening');
            };
            
            this.recognition.onresult = async (event) => {
                if (event.results && event.results[0] && event.results[0][0]) {
                    const text = event.results[0][0].transcript;
                    console.log('Nhận diện được:', text);
                    this.resultText.innerHTML = `📝 Đã nhận diện: "${text}"\n\n🔄 Đang dịch...`;
                    
                    if (this.currentMode === 'listen') {
                        await this.translateText(text, 'en', 'vi');
                    } else {
                        await this.translateText(text, 'vi', 'en');
                    }
                }
            };
            
            this.recognition.onerror = (event) => {
                console.error('Lỗi recognition:', event.error);
                if (event.error === 'no-speech') {
                    this.updateStatus('❌ Không nghe thấy giọng nói. Hãy thử lại và nói to hơn.', 'error');
                    this.resultText.innerHTML = '🔇 Không nghe thấy giọng nói. Vui lòng:\n- Nói to và rõ hơn\n- Kiểm tra microphone\n- Thử lại';
                } else if (event.error === 'not-allowed') {
                    this.updateStatus('❌ Bạn chưa cho phép microphone', 'error');
                    this.resultText.innerHTML = '🎙️ Vui lòng cho phép truy cập microphone để sử dụng tính năng này.';
                } else {
                    this.updateStatus('Lỗi: ' + event.error, 'error');
                }
                this.isListening = false;
            };
            
            this.recognition.onend = () => {
                this.isListening = false;
                if (this.statusText.innerText !== '✅ Hoàn thành') {
                    this.updateStatus('Sẵn sàng', 'ready');
                }
            };
        } else {
            this.updateStatus('Trình duyệt không hỗ trợ nhận diện giọng nói', 'error');
            this.resultText.innerHTML = '⚠️ Trình duyệt của bạn không hỗ trợ tính năng nhận diện giọng nói. Hãy dùng Chrome, Edge hoặc Safari mới nhất.';
        }
    }
    
    startListening(language) {
        // Ngăn chặn click nhiều lần
        if (this.isListening) {
            console.log('Đang nghe, không thể bắt đầu lại');
            this.updateStatus('Đang nghe... Vui lòng đợi', 'listening');
            return;
        }
        
        if (!this.recognition) {
            this.updateStatus('Không hỗ trợ nhận diện giọng nói', 'error');
            return;
        }
        
        this.currentMode = language === 'en-US' ? 'listen' : 'speak';
        const modeText = language === 'en-US' ? 'TIẾNG ANH MỸ' : 'TIẾNG VIỆT';
        const speakHint = language === 'en-US' ? 'Hãy nói bằng TIẾNG ANH' : 'Hãy nói bằng TIẾNG VIỆT';
        
        this.resultText.innerHTML = `🎙️ Đang lắng nghe ${modeText}...\n${speakHint}\n\n⏰ Bạn có 10 giây để nói.`;
        this.recognition.lang = language;
        
        try {
            this.recognition.start();
        } catch (error) {
            console.error('Lỗi start recognition:', error);
            if (error.name === 'InvalidStateError') {
                // Khởi tạo lại recognition
                this.initSpeechRecognition();
                setTimeout(() => {
                    try {
                        this.recognition.start();
                    } catch(e) {
                        this.updateStatus('Lỗi, vui lòng tải lại trang', 'error');
                    }
                }, 100);
            }
        }
    }
    
    async translateText(text, sourceLang, targetLang) {
        this.updateStatus('🌐 Đang dịch...', 'processing');
        
        try {
            const url = `${TRANSLATE_API_URL}?text=${encodeURIComponent(text)}&source=${sourceLang}&target=${targetLang}`;
            console.log('Gọi API dịch:', url);
            
            const response = await fetch(url);
            const data = await response.json();
            
            console.log('Kết quả dịch:', data);
            
            if (data.success && data.translated) {
                if (this.currentMode === 'listen') {
                    this.resultText.innerHTML = `🎧 NGƯỜI NÓI (Tiếng Anh):\n"${text}"\n\n\n🇻🇳 DỊCH SANG TIẾNG VIỆT:\n"${data.translated}"`;
                } else {
                    this.resultText.innerHTML = `🇻🇳 BẠN NÓI (Tiếng Việt):\n"${text}"\n\n\n🔊 DỊCH SANG TIẾNG ANH:\n"${data.translated}"\n\n🔊 Đang phát âm...`;
                    this.speakEnglish(data.translated);
                }
                this.updateStatus('✅ Hoàn thành', 'ready');
            } else {
                throw new Error(data.error || 'Dịch thất bại');
            }
        } catch (error) {
            console.error('Lỗi dịch:', error);
            this.updateStatus('Lỗi dịch thuật', 'error');
            this.resultText.innerHTML = `❌ Lỗi dịch: ${error.message}\n\nVui lòng kiểm tra kết nối mạng và thử lại.`;
        }
    }
    
    speakEnglish(text) {
        if ('speechSynthesis' in window) {
            // Hủy phát hiện tại
            window.speechSynthesis.cancel();
            
            const utterance = new SpeechSynthesisUtterance(text);
            utterance.lang = 'en-US';
            utterance.rate = 0.9;
            utterance.pitch = 1.0;
            utterance.volume = 1.0;
            
            utterance.onend = () => {
                console.log('Phát âm hoàn tất');
            };
            
            utterance.onerror = (event) => {
                console.error('Lỗi phát âm:', event);
            };
            
            // Đợi một chút để speechSynthesis sẵn sàng
            setTimeout(() => {
                window.speechSynthesis.speak(utterance);
            }, 100);
        } else {
            console.warn('Trình duyệt không hỗ trợ phát giọng');
        }
    }
    
    updateStatus(message, type) {
        this.statusText.innerText = message;
        this.statusIndicator.classList.remove('listening', 'processing');
        
        if (type === 'listening') {
            this.statusIndicator.classList.add('listening');
            this.statusIndicator.style.background = '#ff9800';
        } else if (type === 'processing') {
            this.statusIndicator.classList.add('processing');
            this.statusIndicator.style.background = '#2196f3';
        } else if (type === 'error') {
            this.statusIndicator.style.background = '#f44336';
        } else {
            this.statusIndicator.style.background = '#4caf50';
        }
    }
}

// Khởi tạo ứng dụng
document.addEventListener('DOMContentLoaded', () => {
    const app = new TranslationApp();
    console.log('🎉 Phiên Dịch Du Lịch đã sẵn sàng!');
    console.log('📌 Cách dùng:');
    console.log('   - Nút XANH DƯƠNG: Nghe người nước ngoài nói TIẾNG ANH → dịch ra TIẾNG VIỆT');
    console.log('   - Nút XANH LÁ: Bạn nói TIẾNG VIỆT → dịch ra TIẾNG ANH và phát âm');
});