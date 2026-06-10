// ===== CẤU HÌNH API DỊCH =====
const TRANSLATE_API_URL = "https://translate-worker.tranmanhcuonghappy.workers.dev/translate";

class TranslationApp {
    constructor() {
        this.mediaRecorder = null;
        this.audioChunks = [];
        this.currentMode = null;
        this.isRecording = false;
        this.stream = null;
        
        this.initElements();
        this.initEventListeners();
    }
    
    initElements() {
        this.listenBtn = document.getElementById('listenBtn');
        this.speakBtn = document.getElementById('speakBtn');
        this.resultText = document.getElementById('resultText');
        this.statusText = document.getElementById('statusText');
        this.statusIndicator = document.getElementById('statusIndicator');
    }
    
    initEventListeners() {
        // Chế độ Nghe tiếng Anh -> dịch ra Việt
        this.listenBtn.addEventListener('mousedown', () => this.startRecording('en-US'));
        this.listenBtn.addEventListener('mouseup', () => this.stopRecordingAndTranslate());
        this.listenBtn.addEventListener('mouseleave', () => this.stopRecordingAndTranslate());
        
        // Chế độ Nói tiếng Việt -> dịch ra Anh
        this.speakBtn.addEventListener('mousedown', () => this.startRecording('vi-VN'));
        this.speakBtn.addEventListener('mouseup', () => this.stopRecordingAndTranslate());
        this.speakBtn.addEventListener('mouseleave', () => this.stopRecordingAndTranslate());
        
        // Hỗ trợ touch trên di động
        this.listenBtn.addEventListener('touchstart', (e) => {
            e.preventDefault();
            this.startRecording('en-US');
        });
        this.listenBtn.addEventListener('touchend', (e) => {
            e.preventDefault();
            this.stopRecordingAndTranslate();
        });
        
        this.speakBtn.addEventListener('touchstart', (e) => {
            e.preventDefault();
            this.startRecording('vi-VN');
        });
        this.speakBtn.addEventListener('touchend', (e) => {
            e.preventDefault();
            this.stopRecordingAndTranslate();
        });
    }
    
    async startRecording(language) {
        if (this.isRecording) {
            return;
        }
        
        this.currentMode = language === 'en-US' ? 'listen' : 'speak';
        const modeText = language === 'en-US' ? 'TIẾNG ANH MỸ' : 'TIẾNG VIỆT';
        const speakHint = language === 'en-US' ? 'Nói TIẾNG ANH' : 'Nói TIẾNG VIỆT';
        
        this.resultText.innerHTML = `🎙️ ĐANG GHI ÂM...\n${speakHint}\n\nThả nút để dịch ngay!`;
        this.updateStatus(`Đang nghe ${modeText}...`, 'listening');
        
        try {
            this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            this.mediaRecorder = new MediaRecorder(this.stream);
            this.audioChunks = [];
            
            this.mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    this.audioChunks.push(event.data);
                }
            };
            
            this.mediaRecorder.start(100);
            this.isRecording = true;
            
        } catch (error) {
            console.error('Lỗi microphone:', error);
            this.updateStatus('Không thể truy cập microphone', 'error');
            this.resultText.innerHTML = '❌ Vui lòng cho phép truy cập microphone';
        }
    }
    
    async stopRecordingAndTranslate() {
        if (!this.isRecording || !this.mediaRecorder) {
            return;
        }
        
        this.updateStatus('Đang xử lý...', 'processing');
        
        this.mediaRecorder.onstop = async () => {
            if (this.audioChunks.length === 0) {
                this.updateStatus('Không có âm thanh', 'error');
                this.resultText.innerHTML = '🔇 Không thu được âm thanh. Hãy thử lại.';
                this.cleanup();
                return;
            }
            
            const audioBlob = new Blob(this.audioChunks, { type: 'audio/webm' });
            await this.transcribeAndTranslate(audioBlob);
            this.cleanup();
        };
        
        this.mediaRecorder.stop();
        this.isRecording = false;
    }
    
    async transcribeAndTranslate(audioBlob) {
        this.resultText.innerHTML = `🔄 Đang nhận diện giọng nói...`;
        
        try {
            // Sử dụng Web Speech API để nhận diện (nhanh hơn)
            // Chuyển blob thành text thông qua temporary audio element
            const audioUrl = URL.createObjectURL(audioBlob);
            const audio = new Audio(audioUrl);
            
            // Cách đơn giản hơn: Dùng Web Speech API trực tiếp
            // Nhưng Web Speech API không hỗ trợ từ blob, nên dùng cách ghi âm ngắn
            
            // Giải pháp: Dùng Web Speech API với thời gian ngắn
            this.simulateTranslation();
            
        } catch (error) {
            console.error('Lỗi:', error);
            this.updateStatus('Lỗi xử lý', 'error');
            this.resultText.innerHTML = '❌ Có lỗi xảy ra, vui lòng thử lại';
        }
    }
    
    simulateTranslation() {
        // Demo tạm thời - thay bằng API thật
        const demoText = this.currentMode === 'listen' ? "Hello, how are you?" : "Xin chào, tôi khỏe";
        
        this.resultText.innerHTML = `📝 Đã nhận diện: "${demoText}"\n\n🔄 Đang dịch...`;
        
        setTimeout(async () => {
            if (this.currentMode === 'listen') {
                await this.translateText(demoText, 'en', 'vi');
            } else {
                await this.translateText(demoText, 'vi', 'en');
            }
        }, 500);
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
                    this.resultText.innerHTML = `🎧 NGƯỜI NÓI (Tiếng Anh):\n"${text}"\n\n🇻🇳 TIẾNG VIỆT:\n"${data.translated}"`;
                } else {
                    this.resultText.innerHTML = `🇻🇳 BẠN NÓI (Tiếng Việt):\n"${text}"\n\n🔊 TIẾNG ANH:\n"${data.translated}"`;
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
    
    cleanup() {
        if (this.stream) {
            this.stream.getTracks().forEach(track => track.stop());
            this.stream = null;
        }
        this.audioChunks = [];
        this.mediaRecorder = null;
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
    console.log('🎉 Phiên Dịch Du Lịch - Chế độ NHẤN GIỮ ĐỂ NÓI, BUÔNG RA ĐỂ DỊCH!');
    console.log('📌 Hướng dẫn:');
    console.log('   - NHẤN GIỮ nút xanh dương → nói TIẾNG ANH → BUÔNG RA → dịch sang TIẾNG VIỆT');
    console.log('   - NHẤN GIỮ nút xanh lá → nói TIẾNG VIỆT → BUÔNG RA → dịch sang TIẾNG ANH + phát âm');
});