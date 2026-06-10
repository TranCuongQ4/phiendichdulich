// ===== CẤU HÌNH API =====
const CLOUDFLARE_API = "https://translate-worker.tranmanhcuonghappy.workers.dev/translate";
const GEMINI_API = "https://gemini-worker.tranmanhcuonghappy.workers.dev/";

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
                const result = event.results[event.results.length - 1];
                if (result && result.isFinal) {
                    const text = result[0].transcript;
                    console.log('Nhận diện được:', text);
                    this.resultText.innerHTML = `📝 Đã nhận diện: "${text}"\n\n🔄 Đang dịch...`;
                    
                    if (this.currentMode === 'listen') {
                        await this.translateWithFallback(text, 'en', 'vi');
                    } else {
                        await this.translateWithFallback(text, 'vi', 'en');
                    }
                } else if (event.results[0] && !event.results[0].isFinal) {
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
    
    // HÀM DỊCH VỚI FALLBACK: Cloudflare -> Gemini
    async translateWithFallback(text, sourceLang, targetLang) {
        // Thử Cloudflare trước
        try {
            console.log('🟢 Thử Cloudflare...');
            const result = await this.callCloudflare(text, sourceLang, targetLang);
            if (result.success) {
                this.displayTranslation(text, result.translated, '☁️ Cloudflare');
                return;
            }
        } catch (error) {
            console.warn('⚠️ Cloudflare lỗi:', error.message);
        }
        
        // Fallback sang Gemini
        try {
            console.log('🔁 Chuyển sang Gemini...');
            this.updateStatus('🌐 Đang dịch (Gemini)...', 'processing');
            const result = await this.callGemini(text, sourceLang, targetLang);
            if (result.success) {
                this.displayTranslation(text, result.translated, '✨ Gemini');
                return;
            }
        } catch (error) {
            console.error('❌ Gemini cũng lỗi:', error);
        }
        
        // Cả hai đều thất bại
        this.updateStatus('Lỗi dịch thuật', 'error');
        this.resultText.innerHTML = '❌ Không thể dịch. Vui lòng thử lại sau.';
    }
    
    async callCloudflare(text, sourceLang, targetLang) {
        const url = `${CLOUDFLARE_API}?text=${encodeURIComponent(text)}&source=${sourceLang}&target=${targetLang}`;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000);
        
        try {
            const response = await fetch(url, { signal: controller.signal });
            clearTimeout(timeoutId);
            const data = await response.json();
            return { success: data.success === true, translated: data.translated };
        } catch (error) {
            clearTimeout(timeoutId);
            throw error;
        }
    }
    
    async callGemini(text, sourceLang, targetLang) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);
        
        try {
            const response = await fetch(GEMINI_API, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text, sourceLang, targetLang }),
                signal: controller.signal
            });
            clearTimeout(timeoutId);
            const data = await response.json();
            return { success: data.success === true, translated: data.translated };
        } catch (error) {
            clearTimeout(timeoutId);
            throw error;
        }
    }
    
    displayTranslation(originalText, translatedText, service) {
        if (this.currentMode === 'listen') {
            this.resultText.innerHTML = `🎧 NGƯỜI NÓI (Tiếng Anh):\n"${originalText}"\n\n\n🇻🇳 TIẾNG VIỆT:\n"${translatedText}"\n\n📡 ${service}`;
        } else {
            this.resultText.innerHTML = `🇻🇳 BẠN NÓI (Tiếng Việt):\n"${originalText}"\n\n\n🔊 TIẾNG ANH:\n"${translatedText}"\n\n🔊 Đang phát...\n📡 ${service}`;
            this.speakEnglish(translatedText);
        }
        this.updateStatus('✅ Hoàn thành', 'ready');
        console.log(`✅ Dịch thành công bằng ${service}`);
    }
    
    speakEnglish(text) {
        if ('speechSynthesis' in window) {
            window.speechSynthesis.cancel();
            const utterance = new SpeechSynthesisUtterance(text);
            utterance.lang = 'en-US';
            utterance.rate = 0.9;
            utterance.pitch = 1.0;
            utterance.volume = 1.0;
            setTimeout(() => window.speechSynthesis.speak(utterance), 100);
        }
    }
    
    initEventListeners() {
        this.listenBtn.addEventListener('mousedown', () => this.startPress('en-US'));
        this.listenBtn.addEventListener('mouseup', () => this.endPress());
        this.listenBtn.addEventListener('mouseleave', () => this.endPress());
        
        this.speakBtn.addEventListener('mousedown', () => this.startPress('vi-VN'));
        this.speakBtn.addEventListener('mouseup', () => this.endPress());
        this.speakBtn.addEventListener('mouseleave', () => this.endPress());
        
        // Hỗ trợ cảm ứng di động
        this.listenBtn.addEventListener('touchstart', (e) => { e.preventDefault(); this.startPress('en-US'); });
        this.listenBtn.addEventListener('touchend', (e) => { e.preventDefault(); this.endPress(); });
        this.speakBtn.addEventListener('touchstart', (e) => { e.preventDefault(); this.startPress('vi-VN'); });
        this.speakBtn.addEventListener('touchend', (e) => { e.preventDefault(); this.endPress(); });
    }
    
    startPress(language) {
        if (this.isListening) return;
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
    console.log('🎉 Phiên Dịch Du Lịch - FALLBACK: Cloudflare + Gemini');
    console.log('   ☁️ Cloudflare: 500 câu/ngày (ưu tiên)');
    console.log('   ✨ Gemini: 1.500 câu/ngày (dự phòng)');
});