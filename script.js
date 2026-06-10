// ===== CẤU HÌNH API DỊCH =====
const TRANSLATE_API_URL = "https://translate-worker.tranmanhcuonghappy.workers.dev/translate";

class TranslationApp {
    constructor() {
        this.recognition = null;
        this.currentMode = null;
        this.isListening = false;
        this.isLongPress = false;
        this.longPressTimeout = null;
        
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
    
    initSpeechRecognition() {
        if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
            const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
            this.recognition = new SpeechRecognition();
            this.recognition.continuous = false;
            this.recognition.interimResults = true;
            this.recognition.maxAlternatives = 1;
            
            this.recognition.onstart = () => {
                this.isListening = true;
                this.updateStatus('🎤 Đang nghe, hãy nói...', 'listening');
            };
            
            this.recognition.onresult = async (event) => {
                // Lấy kết quả cuối cùng (khi người dùng ngừng nói)
                const result = event.results[event.results.length - 1];
                if (result && result.isFinal) {
                    const text = result[0].transcript;
                    console.log('Nhận diện được:', text);
                    this.resultText.innerHTML = `📝 Đã nhận diện: "${text}"\n\n🔄 Đang dịch...`;
                    
                    if (this.currentMode === 'listen') {
                        await this.translateText(text, 'en', 'vi');
                    } else {
                        await this.translateText(text, 'vi', 'en');
                    }
                } else if (event.results[0] && !event.results[0].isFinal) {
                    // Hiển thị kết quả tạm thời
                    const interimText = event.results[0][0].transcript;
                    this.resultText.innerHTML = `🎙️ Đang nghe: "${interimText}"`;
                }
            };
            
            this.recognition.onerror = (event) => {
                console.error('Lỗi recognition:', event.error);
                if (event.error === 'no-speech') {
                    this.updateStatus('Không nghe thấy giọng nói', 'error');
                    this.resultText.innerHTML = '🔇 Không nghe thấy. Hãy thử lại.';
                } else if (event.error === 'not-allowed') {
                    this.updateStatus('Chưa cho phép microphone', 'error');
                    this.resultText.innerHTML = '🎙️ Vui lòng cho phép microphone.';
                }
                this.isListening = false;
                this.updateStatus('Sẵn sàng', 'ready');
            };
            
            this.recognition.onend = () => {
                this.isListening = false;
                if (this.statusText.innerText !== '✅ Hoàn thành') {
                    this.updateStatus('Sẵn sàng', 'ready');
                }
            };
        } else {
            this.updateStatus('Trình duyệt không hỗ trợ', 'error');
        }
    }
    
    initEventListeners() {
        // Xử lý nhấn giữ cho nút Nghe tiếng Anh
        this.listenBtn.addEventListener('mousedown', () => this.startPress('en-US'));
        this.listenBtn.addEventListener('mouseup', () => this.endPress());
        this.listenBtn.addEventListener('mouseleave', () => this.endPress());
        
        // Xử lý nhấn giữ cho nút Nói tiếng Việt
        this.speakBtn.addEventListener('mousedown', () => this.startPress('vi-VN'));
        this.speakBtn.addEventListener('mouseup', () => this.endPress());
        this.speakBtn.addEventListener('mouseleave', () => this.endPress());
        
        // Hỗ trợ cảm ứng di động
        this.listenBtn.addEventListener('touchstart', (e) => {
            e.preventDefault();
            this.startPress('en-US');
        });
        this.listenBtn.addEventListener('touchend', (e) => {
            e.preventDefault();
            this.endPress();
        });
        
        this.speakBtn.addEventListener('touchstart', (e) => {
            e.preventDefault();
            this.startPress('vi-VN');
        });
        this.speakBtn.addEventListener('touchend', (e) => {
            e.preventDefault();
            this.endPress();
        });
    }
    
    startPress(language) {
        if (this.isListening) {
            return;
        }
        
        this.currentMode = language === 'en-US' ? 'listen' : 'speak';
        const modeText = language === 'en-US' ? 'TIẾNG ANH MỸ' : 'TIẾNG VIỆT';
        const speakHint = language === 'en-US' ? 'Nói TIẾNG ANH' : 'Nói TIẾNG VIỆT';
        
        this.resultText.innerHTML = `🎙️ GIỮ NÚT VÀ NÓI\n${speakHint}\n\nBuông nút để dịch ngay!`;
        this.updateStatus(`Đang nghe ${modeText}...`, 'listening');
        
        this.recognition.lang = language;
        this.recognition.start();
    }
    
    endPress() {
        if (this.isListening && this.recognition) {
            this.recognition.stop();
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
                    this.resultText.innerHTML = `🎧 NGƯỜI NÓI (Tiếng Anh):\n"${text}"\n\n\n🇻🇳 TIẾNG VIỆT:\n"${data.translated}"`;
                } else {
                    this.resultText.innerHTML = `🇻🇳 BẠN NÓI (Tiếng Việt):\n"${text}"\n\n\n🔊 TIẾNG ANH:\n"${data.translated}"\n\n🔊 Đang phát...`;
                    this.speakEnglish(data.translated);
                }
                this.updateStatus('✅ Hoàn thành', 'ready');
            } else {
                throw new Error(data.error || 'Dịch thất bại');
            }
        } catch (error) {
            console.error('Lỗi dịch:', error);
            this.updateStatus('Lỗi dịch thuật', 'error');
            this.resultText.innerHTML = `❌ Lỗi: ${error.message}\nVui lòng thử lại.`;
        }
    }
    
    speakEnglish(text) {
        if ('speechSynthesis' in window) {
            window.speechSynthesis.cancel();
            
            const utterance = new SpeechSynthesisUtterance(text);
            utterance.lang = 'en-US';
            utterance.rate = 0.9;
            utterance.pitch = 1.0;
            utterance.volume = 1.0;
            
            utterance.onend = () => {
                console.log('Phát âm hoàn tất');
            };
            
            setTimeout(() => {
                window.speechSynthesis.speak(utterance);
            }, 100);
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
    console.log('🎉 Phiên Dịch Du Lịch - NHẤN GIỮ để nói, BUÔNG RA để dịch!');
});