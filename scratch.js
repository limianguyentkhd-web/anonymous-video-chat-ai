const fs = require('fs');
let content = fs.readFileSync('js/app.js', 'utf8');

// 1. startAISearchingLogs
content = content.replace(/function startAISearchingLogs\(\) \{[\s\S]*?runLogs\(\);\n\}/, 
`function startAISearchingLogs() {
    const aiLogs = document.getElementById("ai-match-logs");
    aiLogs.innerHTML = "";

    const addLog = (text, delay) => {
        return new Promise(resolve => {
            AppState.matchTimeout = setTimeout(() => {
                const matchSearching = document.getElementById("match-searching-view");
                if (!matchSearching || !matchSearching.classList.contains("active")) {
                    resolve(false);
                    return;
                }
                const div = document.createElement("div");
                div.innerHTML = \`[Hệ thống] \${text}\`;
                aiLogs.appendChild(div);
                aiLogs.scrollTop = aiLogs.scrollHeight;
                resolve(true);
            }, delay);
        });
    };

    const runLogs = async () => {
        if (!(await addLog("Khởi tạo kết nối WebRTC...", 100))) return;
        if (!(await addLog("Đang kết nối tới máy chủ ghép cặp...", 400))) return;
        if (!(await addLog("Đang tìm kiếm người dùng đang trực tuyến...", 600))) return;
        if (!(await addLog("Đang chờ phản hồi từ máy chủ...", 800))) return;
    };

    runLogs();
}`);

// 2. btnApproveMatch branch inside initMatchingFlow
content = content.replace(/if \(btnApproveMatch\) \{[\s\S]*?        \}\);\n    \}/, 
`if (btnApproveMatch) {
        btnApproveMatch.addEventListener("click", () => {
            btnApproveMatch.disabled = true;
            btnApproveMatch.style.opacity = "0.6";
            btnApproveMatch.innerHTML = \`<i class="fa-solid fa-spinner fa-spin"></i> Đã đồng ý, chờ đối phương...\`;

            if (AppState.socket && AppState.currentCall.roomId && AppState.currentCall.partnerPeerId) {
                AppState.socket.emit('approve-match', AppState.currentCall.roomId);
            }
        });
    }`);

// 3. renderLoungeProfiles
content = content.replace(/function renderLoungeProfiles\(\) \{[\s\S]*?    \}\);\n\}/, 
`function renderLoungeProfiles() {
    const grid = document.getElementById("lounge-profiles-grid");
    if (!grid) return;

    grid.innerHTML = \`
        <div class="glass-card" style="grid-column: 1 / -1; padding: 40px; text-align: center; color: var(--text-muted); border: 1px dashed var(--border-color);">
            <i class="fa-solid fa-folder-open" style="font-size: 40px; margin-bottom: 15px; color: var(--primary);"></i>
            <p>Chưa có dữ liệu người dùng thực đang trực tuyến để hiển thị tại Lounge.</p>
        </div>
    \`;
}`);

fs.writeFileSync('js/app.js', content);
console.log("Replaced startAISearchingLogs, btnApproveMatch, and renderLoungeProfiles");
