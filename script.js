// ===== CẤU HÌNH API =====
const CLOUDFLARE_API = "https://translate-worker.tranmanhcuonghappy.workers.dev/translate";
const GEMINI_API = "https://gemini-worker.tranmanhcuonghappy.workers.dev/";

// ===== LỊCH SỬ =====
let history = [];
const MAX_HISTORY_DAYS = 10; // Giữ lịch sử 10 ngày

class TranslationApp {
    constructor() {
        this.recognition = null;
        this.currentMode = null;
        this.isListening = false;
        this.currentAudio = null; // Lưu audio hiện tại để phát lại
        
        this.initElements();
        this.initEventListeners();
        this.initSpeechRecognition();
        this.loadHistory();
        this.addSecurityFeatures();
    }
    
    initElements() {
        this.listenBtn = document.getElementById('listenBtn');
        this.speakBtn = document.getElementById('speakBtn');
        this.resultText = document.getElementById('resultText');
        this.statusText = document.getElementById('statusText');
        this.statusIndicator = document.getElementById('statusIndicator');
        
        // Tạo container lịch sử nếu chưa có
        if (!document.getElementById('historyPanel')) {
            this.createHistoryUI();
        }
    }
    
    createHistoryUI() {
        // Thêm CSS cho lịch sử
        const style = document.createElement('style');
        style.textContent = `
            .history-section {
                margin-top: 20px;
                background: rgba(255,255,255,0.15);
                border-radius: 15px;
                padding: 12px;
            }
            .history-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 10px;
                color: white;
            }
            .history-title {
                font-size: 14px;
                font-weight: bold;
            }
            .history-buttons {
                display: flex;
                gap: 8px;
            }
            .history-btn {
                background: rgba(255,255,255,0.3);
                border: none;
                border-radius: 8px;
                padding: 4px 10px;
                font-size: 11px;
                cursor: pointer;
                color: white;
            }
            .history-list {
                max-height: 200px;
                overflow-y: auto;
                border-radius: 10px;
            }
            .history-item {
                background: rgba(255,255,255,0.9);
                border-radius: 10px;
                padding: 8px 10px;
                margin-bottom: 6px;
                font-size: 12px;
                display: flex;
                justify-content: space-between;
                align-items: center;
                gap: 8px;
            }
            .history-content {
                flex: 1;
                cursor: pointer;
            }
            .history-viet {
                color: #2c3e50;
                font-weight: 500;
            }
            .history-eng {
                color: #7f8c8d;
                font-size: 11px;
                margin-top: 3px;
            }
            .play-again-btn {
                background: #4caf50;
                border: none;
                border-radius: 20px;
                padding: 4px 12px;
                font-size: 11px;
                cursor: pointer;
                color: white;
            }
            .empty-history {
                text-align: center;
                color: rgba(255,255,255,0.7);
                font-size: 12px;
                padding: 15px;
            }
            .history-list::-webkit-scrollbar {
                width: 3px;
            }
        `;
        document.head.appendChild(style);
        
        // Tạo HTML lịch sử
        const historyHTML = `
            <div class="history-section" id="historyPanel">
                <div class="history-header">
                    <span class="history-title">📜 LỊCH SỬ DỊCH (${MAX_HISTORY_DAYS} ngày)</span>
                    <div class="history-buttons">
                        <button class="history-btn" id="clearHistoryBtn">🗑️ Xóa hết</button>
                    </div>
                </div>
                <div class="history-list" id="historyList">
                    <div class="empty-history">Chưa có lịch sử nào</div>
                </div>
            </div>
        `;
        
        // Chèn sau button-group
        const buttonGroup = document.querySelector('.button-group');
        if (buttonGroup) {
            buttonGroup.insertAdjacentHTML('afterend', historyHTML);
        }
        
        // Gắn sự kiện cho nút xóa
        document.getElementById('clearHistoryBtn')?.addEventListener('click', () => this.clearHistoryWithConfirm());
    }
    
    addSecurityFeatures() {
        // Chặn chuột phải
        document.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            return false;
        });
        
        // Chặn copy (Ctrl+C, Ctrl+X)
        document.addEventListener('copy', (e) => {
            e.preventDefault();
            return false;
        });
        
        document.addEventListener('cut', (e) => {
            e.preventDefault();
            return false;
        });
        
        // Chặn kéo thả copy
        document.addEventListener('dragstart', (e) => {
            e.preventDefault();
            return false;
        });
        
        // Thêm style chống chọn text
        const style = document.createElement('style');
        style.textContent = `
            body {
                user-select: none;
                -webkit-user-select: none;
            }
            input, textarea {
                user-select: text;
                -webkit-user-select: text;
            }
        `;
        document.head.appendChild(style);
        
        // F12 không bị chặn (vẫn mở dev tools)
        console.log('🛡️ Chế độ bảo vệ đã bật - Chuột phải và copy bị chặn');
    }
    
    loadHistory() {
        const saved = localStorage.getItem('translation_history');
        if (saved) {
            try {
                history = JSON.parse(saved);
                // Kiểm tra và xóa dữ liệu cũ hơn MAX_HISTORY_DAYS
                const now = Date.now();
                const maxAge = MAX_HISTORY_DAYS * 24 * 60 * 60 * 1000;
                history = history.filter(item => (now - item.timestamp) < maxAge);
                this.renderHistory();
                this.saveHistory();
            } catch(e) {}
        }
    }
    
    saveHistory() {
        localStorage.setItem('translation_history', JSON.stringify(history));
    }
    
    addToHistory(vietText, engText) {
        history.unshift({
            viet: vietText,
            eng: engText,
            timestamp: Date.now()
        });
        
        // Giới hạn số lượng để tránh đầy bộ nhớ (tối đa 200 item)
        if (history.length > 200) {
            history = history.slice(0, 200);
        }
        
        this.saveHistory();
        this.renderHistory();
    }
    
    renderHistory() {
        const historyList = document.getElementById('historyList');
        if (!historyList) return;
        
        if (history.length === 0) {
            historyList.innerHTML = '<div class="empty-history">📭 Chưa có lịch sử nào</div>';
            return;
        }
        
        historyList.innerHTML = history.map((item, index) => `
            <div class="history-item">
                <div class="history-content" onclick="app.replayHistory(${index})">
                    <div class="history-viet">🇻🇳 ${this.truncateText(item.viet, 50)}</div>
                    <div class="history-eng">🔊 ${this.truncateText(item.eng, 50)}</div>
                </div>
                <button class="play-again-btn" onclick="app.playHistoryAudio(${index})">🔊 Phát lại</button>
            </div>
        `).join('');
    }
    
    truncateText(text, maxLen) {
        if (text.length <= maxLen) return text;
        return text.substring(0, maxLen) + '...';
    }
    
    replayHistory(index) {
        const item = history[index];
        if (item && item.eng) {
            this.resultText.innerHTML = `🔊 PHÁT LẠI TỪ LỊCH SỬ:\n🇻🇳 "${item.viet}"\n\n🔊 TIẾNG ANH:\n"${item.eng}"`;
            this.speakEnglish(item.eng);
        }
    }
    
    playHistoryAudio(index) {
        const item = history[index];
        if (item && item.eng) {
            this.speakEnglish(item.eng);
        }
    }
    
    clearHistoryWithConfirm() {
        if (confirm('🗑️ Bạn có chắc muốn XÓA TOÀN BỘ lịch sử?\n\nHành động này không thể khôi phục!')) {
            history = [];
            this.saveHistory();
            this.renderHistory();
            this.updateStatus('Đã xóa lịch sử', 'ready');
        }
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
    
    async translateWithFallback(text, sourceLang, targetLang) {
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
            // Lưu vào lịch sử (tiếng Việt gốc, tiếng Anh dịch)
            this.addToHistory(originalText, translatedText);
            
            this.resultText.innerHTML = `🇻🇳 BẠN NÓI (Tiếng Việt):\n"${originalText}"\n\n\n🔊 TIẾNG ANH:\n"${translatedText}"\n\n🔊 Đang phát...\n📡 ${service}\n\n🔄 Nhấn nút bên cạnh để phát lại!`;
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
            this.currentAudio = text;
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
let app;
document.addEventListener('DOMContentLoaded', () => {
    app = new TranslationApp();
    console.log('🎉 Phiên Dịch Du Lịch - ĐÃ THÊM LỊCH SỬ + PHÁT LẠI + CHẶN COPY!');
    console.log('   ☁️ Cloudflare: 500 câu/ngày (ưu tiên)');
    console.log('   ✨ Gemini: 1.500 câu/ngày (dự phòng)');
    console.log('   📜 Lịch sử tự động lưu 10 ngày');
    console.log('   🛡️ Đã chặn chuột phải và copy');
});