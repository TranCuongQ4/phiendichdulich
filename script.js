// ===== CẤU HÌNH API =====
const CLOUDFLARE_API = "https://translate-worker.tranmanhcuonghappy.workers.dev/translate";
const GEMINI_API = "https://gemini-worker.tranmanhcuonghappy.workers.dev/";

// ===== LỊCH SỬ =====
let history = [];
const MAX_HISTORY_DAYS = 10;

class TranslationApp {
    constructor() {
        this.recognition = null;
        this.currentMode = null; // 'listenEn', 'speakEn', 'listenCn', 'speakCn'
        this.isListening = false;
        this.currentAudio = null;
        
        this.initElements();
        this.initEventListeners();
        this.initSpeechRecognition();
        this.loadHistory();
        this.addSecurityFeatures();
    }
    
    initElements() {
        this.listenBtn = document.getElementById('listenBtn');
        this.speakBtn = document.getElementById('speakBtn');
        this.listenCnBtn = document.getElementById('listenCnBtn');
        this.speakCnBtn = document.getElementById('speakCnBtn');
        this.resultText = document.getElementById('resultText');
        this.statusText = document.getElementById('statusText');
        this.statusIndicator = document.getElementById('statusIndicator');
        
        if (!document.getElementById('historyPanel')) {
            this.createHistoryUI();
        }
    }
    
    createHistoryUI() {
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
            .history-title { font-size: 14px; font-weight: bold; }
            .history-buttons { display: flex; gap: 8px; }
            .history-btn {
                background: rgba(255,255,255,0.3);
                border: none;
                border-radius: 8px;
                padding: 4px 10px;
                font-size: 11px;
                cursor: pointer;
                color: white;
            }
            .history-list { max-height: 200px; overflow-y: auto; border-radius: 10px; }
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
            .history-content { flex: 1; cursor: pointer; }
            .history-viet { color: #2c3e50; font-weight: 500; }
            .history-trans { color: #7f8c8d; font-size: 11px; margin-top: 3px; }
            .play-again-btn {
                background: #4caf50;
                border: none;
                border-radius: 20px;
                padding: 4px 12px;
                font-size: 11px;
                cursor: pointer;
                color: white;
            }
            .empty-history { text-align: center; color: rgba(255,255,255,0.7); font-size: 12px; padding: 15px; }
            .history-list::-webkit-scrollbar { width: 3px; }
        `;
        document.head.appendChild(style);
        
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
        
        const buttonGroup = document.querySelector('.button-group');
        if (buttonGroup) {
            buttonGroup.insertAdjacentHTML('afterend', historyHTML);
        }
        
        document.getElementById('clearHistoryBtn')?.addEventListener('click', () => this.clearHistoryWithConfirm());
    }
    
    addSecurityFeatures() {
        document.addEventListener('contextmenu', (e) => { e.preventDefault(); return false; });
        document.addEventListener('copy', (e) => { e.preventDefault(); return false; });
        document.addEventListener('cut', (e) => { e.preventDefault(); return false; });
        document.addEventListener('dragstart', (e) => { e.preventDefault(); return false; });
        
        const style = document.createElement('style');
        style.textContent = `body { user-select: none; -webkit-user-select: none; } input, textarea { user-select: text; -webkit-user-select: text; }`;
        document.head.appendChild(style);
        
        console.log('🛡️ Chế độ bảo vệ đã bật - Chuột phải và copy bị chặn');
    }
    
    loadHistory() {
        const saved = localStorage.getItem('translation_history');
        if (saved) {
            try {
                history = JSON.parse(saved);
                const now = Date.now();
                const maxAge = MAX_HISTORY_DAYS * 24 * 60 * 60 * 1000;
                history = history.filter(item => (now - item.timestamp) < maxAge);
                this.renderHistory();
                this.saveHistory();
            } catch(e) {}
        }
    }
    
    saveHistory() { localStorage.setItem('translation_history', JSON.stringify(history)); }
    
    addToHistory(originalText, translatedText, targetLang) {
        history.unshift({
            original: originalText,
            translated: translatedText,
            targetLang: targetLang,
            timestamp: Date.now()
        });
        if (history.length > 200) history = history.slice(0, 200);
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
        
        historyList.innerHTML = history.map((item, index) => {
            const flag = item.targetLang === 'en' ? '🇺🇸' : '🇨🇳';
            const langName = item.targetLang === 'en' ? 'Anh' : 'Trung';
            return `
            <div class="history-item">
                <div class="history-content" onclick="app.replayHistory(${index})">
                    <div class="history-viet">🇻🇳 ${this.truncateText(item.original, 45)}</div>
                    <div class="history-trans">${flag} ${langName}: ${this.truncateText(item.translated, 45)}</div>
                </div>
                <button class="play-again-btn" onclick="app.playHistoryAudio(${index})">🔊 Phát lại</button>
            </div>
        `}).join('');
    }
    
    truncateText(text, maxLen) { return text.length <= maxLen ? text : text.substring(0, maxLen) + '...'; }
    
    replayHistory(index) {
        const item = history[index];
        if (item && item.translated) {
            this.resultText.innerHTML = `🔊 PHÁT LẠI TỪ LỊCH SỬ:\n🇻🇳 "${item.original}"\n\n${item.targetLang === 'en' ? '🇺🇸 TIẾNG ANH' : '🇨🇳 TIẾNG TRUNG'}:\n"${item.translated}"`;
            this.speakText(item.translated, item.targetLang);
        }
    }
    
    playHistoryAudio(index) {
        const item = history[index];
        if (item && item.translated) this.speakText(item.translated, item.targetLang);
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
                    
                    if (this.currentMode === 'listenEn') {
                        await this.translateWithFallback(text, 'en', 'vi');
                    } else if (this.currentMode === 'speakEn') {
                        await this.translateWithFallback(text, 'vi', 'en');
                    } else if (this.currentMode === 'listenCn') {
                        await this.translateWithFallback(text, 'zh', 'vi');
                    } else if (this.currentMode === 'speakCn') {
                        await this.translateWithFallback(text, 'vi', 'zh');
                    }
                } else if (event.results[0] && !event.results[0].isFinal) {
                    this.resultText.innerHTML = `🎙️ Đang nghe: "${event.results[0][0].transcript}"`;
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
            console.log(`🟢 Thử Cloudflare: ${sourceLang} → ${targetLang}`);
            const result = await this.callCloudflare(text, sourceLang, targetLang);
            if (result.success) {
                this.displayTranslation(text, result.translated, '☁️ Cloudflare', targetLang);
                return;
            }
        } catch (error) {
            console.warn('⚠️ Cloudflare lỗi:', error.message);
        }
        
        try {
            console.log(`🔁 Chuyển sang Gemini: ${sourceLang} → ${targetLang}`);
            this.updateStatus('🌐 Đang dịch (Gemini)...', 'processing');
            const result = await this.callGemini(text, sourceLang, targetLang);
            if (result.success) {
                this.displayTranslation(text, result.translated, '✨ Gemini', targetLang);
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
    
    displayTranslation(originalText, translatedText, service, targetLang) {
        const isVietnameseTarget = (targetLang === 'vi');
        
        if (isVietnameseTarget) {
            // Nghe: Anh/Trung → Việt
            const sourceFlag = this.currentMode === 'listenEn' ? '🇺🇸 TIẾNG ANH' : '🇨🇳 TIẾNG TRUNG';
            this.resultText.innerHTML = `🎧 NGƯỜI NÓI (${sourceFlag}):\n"${originalText}"\n\n\n🇻🇳 TIẾNG VIỆT:\n"${translatedText}"\n\n📡 ${service}`;
        } else {
            // Nói: Việt → Anh/Trung
            const targetFlag = targetLang === 'en' ? '🇺🇸 TIẾNG ANH' : '🇨🇳 TIẾNG TRUNG';
            this.addToHistory(originalText, translatedText, targetLang);
            this.resultText.innerHTML = `🇻🇳 BẠN NÓI (Tiếng Việt):\n"${originalText}"\n\n\n🔊 ${targetFlag}:\n"${translatedText}"\n\n🔊 Đang phát...\n📡 ${service}`;
            this.speakText(translatedText, targetLang);
        }
        this.updateStatus('✅ Hoàn thành', 'ready');
        console.log(`✅ Dịch thành công bằng ${service} → ${targetLang}`);
    }
    
    speakText(text, lang) {
        if ('speechSynthesis' in window) {
            window.speechSynthesis.cancel();
            const utterance = new SpeechSynthesisUtterance(text);
            utterance.lang = lang === 'en' ? 'en-US' : 'zh-CN';
            utterance.rate = 0.9;
            utterance.pitch = 1.0;
            utterance.volume = 1.0;
            this.currentAudio = text;
            setTimeout(() => window.speechSynthesis.speak(utterance), 100);
        }
    }
    
    initEventListeners() {
        // Tiếng Anh
        this.listenBtn.addEventListener('mousedown', () => this.startPress('en-US', 'listenEn'));
        this.listenBtn.addEventListener('mouseup', () => this.endPress());
        this.listenBtn.addEventListener('mouseleave', () => this.endPress());
        
        this.speakBtn.addEventListener('mousedown', () => this.startPress('vi-VN', 'speakEn'));
        this.speakBtn.addEventListener('mouseup', () => this.endPress());
        this.speakBtn.addEventListener('mouseleave', () => this.endPress());
        
        // Tiếng Trung
        this.listenCnBtn.addEventListener('mousedown', () => this.startPress('zh-CN', 'listenCn'));
        this.listenCnBtn.addEventListener('mouseup', () => this.endPress());
        this.listenCnBtn.addEventListener('mouseleave', () => this.endPress());
        
        this.speakCnBtn.addEventListener('mousedown', () => this.startPress('vi-VN', 'speakCn'));
        this.speakCnBtn.addEventListener('mouseup', () => this.endPress());
        this.speakCnBtn.addEventListener('mouseleave', () => this.endPress());
        
        // Touch events
        this.listenBtn.addEventListener('touchstart', (e) => { e.preventDefault(); this.startPress('en-US', 'listenEn'); });
        this.listenBtn.addEventListener('touchend', (e) => { e.preventDefault(); this.endPress(); });
        this.speakBtn.addEventListener('touchstart', (e) => { e.preventDefault(); this.startPress('vi-VN', 'speakEn'); });
        this.speakBtn.addEventListener('touchend', (e) => { e.preventDefault(); this.endPress(); });
        this.listenCnBtn.addEventListener('touchstart', (e) => { e.preventDefault(); this.startPress('zh-CN', 'listenCn'); });
        this.listenCnBtn.addEventListener('touchend', (e) => { e.preventDefault(); this.endPress(); });
        this.speakCnBtn.addEventListener('touchstart', (e) => { e.preventDefault(); this.startPress('vi-VN', 'speakCn'); });
        this.speakCnBtn.addEventListener('touchend', (e) => { e.preventDefault(); this.endPress(); });
    }
    
    startPress(language, mode) {
        if (this.isListening) return;
        this.currentMode = mode;
        
        let modeText = '';
        let speakHint = '';
        
        if (mode === 'listenEn') { modeText = 'TIẾNG ANH MỸ'; speakHint = 'Nói TIẾNG ANH'; }
        else if (mode === 'speakEn') { modeText = 'TIẾNG VIỆT → ANH'; speakHint = 'Nói TIẾNG VIỆT'; }
        else if (mode === 'listenCn') { modeText = 'TIẾNG TRUNG'; speakHint = 'Nói TIẾNG TRUNG'; }
        else if (mode === 'speakCn') { modeText = 'TIẾNG VIỆT → TRUNG'; speakHint = 'Nói TIẾNG VIỆT'; }
        
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

let app;
document.addEventListener('DOMContentLoaded', () => {
    app = new TranslationApp();
    console.log('🎉 Phiên Dịch Du Lịch - HỖ TRỢ TIẾNG ANH & TIẾNG TRUNG!');
    console.log('   🇺🇸 Anh → Việt | Việt → Anh');
    console.log('   🇨🇳 Trung → Việt | Việt → Trung');
    console.log('   ☁️ Cloudflare (ưu tiên) + ✨ Gemini (dự phòng)');
    console.log('   📜 Lịch sử lưu 10 ngày | 🛡️ Chặn copy');
});