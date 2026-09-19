/**
 * SafeConnect - Main Application Logic
 * Implements real-time WebRTC logic, AI Speech & Vision simulation,
 * NLP classification, Risk Analysis, and Admin Analytics.
 */

// --- GLOBAL APP STATE ---
const AppState = {
    currentUser: {
        nickname: "Người dùng ẩn danh",
        age: 22,
        gender: "Nam",
        location: "Hà Nội",
        interests: ["Âm nhạc", "Ngoại ngữ"],
        purpose: "Kết bạn mới",
        verified: false,
        avatar: "https://api.dicebear.com/7.x/bottts/svg?seed=SafeUser",
        targetLanguage: "vi",
        coinBalance: 100,
        transactionHistory: [],
        consecutiveRejections: 0
    },
    currentCall: {
        active: false,
        status: "idle",
        timer: null,
        duration: 0,
        stranger: null,
        safetyScore: 100,
        riskScore: 0,
        localStream: null,
        micActive: true,
        camActive: true,
        speechRecognition: null,
        isSpeechRecognizing: false,
        audioClassifier: null
    },
    incidents: [
        {
            id: "INC-9821",
            timestamp: new Date(Date.now() - 3600000 * 3).toLocaleString('vi-VN'),
            user: "BadSpammer",
            type: "scam",
            desc: "Yêu cầu chuyển tiền mặt và mượn tài khoản ngân hàng ngay phút đầu",
            confidence: "95%",
            status: "flagged"
        },
        {
            id: "INC-9820",
            timestamp: new Date(Date.now() - 3600000 * 5).toLocaleString('vi-VN'),
            user: "ToxicPlayer",
            type: "speech",
            desc: "Phát hiện ngôn ngữ thù hận, chửi tục tục tĩu liên tiếp",
            confidence: "88%",
            status: "resolved"
        },
        {
            id: "INC-9819",
            timestamp: new Date(Date.now() - 3600000 * 12).toLocaleString('vi-VN'),
            user: "NudityUser",
            type: "image",
            desc: "Camera chứa hình ảnh nhạy cảm 18+ (NSFW)",
            confidence: "92%",
            status: "flagged"
        }
    ],
    bannedUsersCount: 142,
    safetyTrendChart: null,
    incidentPieChart: null,
    userGrowthChart: null,
    callHistory: [],
    interactionHistory: [],
    selectedFeedback: null,
    blockedUsers: [],
    reportCounts: {},
    selectedRating: 0,
    selectedRatingTags: [],
    callType: '1-1',
    behaviorFlags: { personalInfo: 0, moneyRequest: 0, romanceScam: 0, messageCount: 0 },
    socket: null,
    peer: null,
    peerId: null,
    dataConn: null,
    mediaCall: null,
    roomId: null,
    role: null,
    partnerPeerId: null,
    enableTranslation: true,
    enableNsfwDetection: true,
    nsfwModel: null,
    cocoModel: null,
    nsfwInterval: null,
    currentFilter: { beauty: 'none', sticker: 'none' },
    faceMesh: null,
    cameraUtils: null,
    isFaceMeshRunning: false,
    arImages: {},
    reports: []
};

// --- DATA: POTENTIAL STRANGERS ---
// --- TOXIC & SCAM DICTIONARIES (Vietnamese NLP Simulation) ---
const TOXIC_KEYWORDS = ["ngu", "chửi", "đánh", "chết", "mẹ mày", "địt", "lồn", "cặc", "chó", "vãi", "cút", "khùng", "điên"];
const SCAM_PHRASES = [
    "chuyển tiền", "tk ngân hàng", "gửi tiền", "mật khẩu", "otp",
    "nạp thẻ", "cho vay", "vay tiền", "số thẻ", "phí dịch vụ", "số điện thoại cá nhân"
];
const ROMANCE_SCAM_PHRASES = [
    "anh yêu em", "em yêu anh", "chúng ta có duyên", "gặp nhau ngoài đời",
    "cho anh số zalo", "cho em facebook", "nhớ em quá", "tin anh đi",
    "anh ở nước ngoài", "gửi quà cho em", "chuyển tiền giúp anh"
];
const PERSONAL_INFO_PHRASES = [
    "số điện thoại", "địa chỉ nhà", "số cmnd", "cccd", "nơi làm việc",
    "tên thật", "facebook cá nhân", "zalo", "instagram"
];

// --- WEAPON & VIOLENCE OBJECT DICTIONARY (COCO-SSD) ---
const DANGEROUS_OBJECT_CLASSES = {
    'knife': 'Dao / Hung khí sắc nhọn',
    'scissors': 'Kéo sắc nhọn',
    'baseball bat': 'Gậy bóng chày / Hung khí',
    'bottle': 'Chai lọ nguy hiểm',
    'gun': 'Súng / Vũ khí nóng',
    'sword': 'Kiếm / Hung khí nguy hiểm'
};

// --- CLIENT-SIDE MULTI-MODEL VISION GUARD (NSFWJS + COCO-SSD) ---
async function loadVisionModels() {
    console.log("Starting to load Vision AI models (NSFWJS & COCO-SSD)...");
    
    // 1. Load NSFWJS
    try {
        if (typeof nsfwjs !== 'undefined') {
            AppState.nsfwModel = await nsfwjs.load('mobilenet_v2', { size: 224 });
            console.log("NSFWJS model loaded successfully!");
        }
    } catch (err) {
        console.error("Failed to load NSFWJS model:", err);
    }

    // 2. Load COCO-SSD for Weapon & Violence Detection
    try {
        if (typeof cocoSsd !== 'undefined') {
            AppState.cocoModel = await cocoSsd.load({ base: 'mobilenet_v2' });
            console.log("COCO-SSD Weapon Detection model loaded successfully!");
            showToast("AI Vision Guard", "Đã nạp thành công mô hình Quét ảnh 18+ (NSFWJS) và Nhận diện Vũ khí (COCO-SSD).", "success");
        }
    } catch (err) {
        console.error("Failed to load COCO-SSD model:", err);
    }
}

// Backward-compatible alias
async function loadNsfwModel() {
    return loadVisionModels();
}

function startNsfwDetection() {
    if (!AppState.enableNsfwDetection) return;
    if (!AppState.nsfwModel && !AppState.cocoModel) {
        console.warn("Vision AI models are not loaded yet. Skipping real-time scanning.");
        return;
    }
    if (AppState.nsfwInterval) clearInterval(AppState.nsfwInterval);

    const indicator = document.getElementById("ai-nsfw-scanning-indicator");
    if (indicator) {
        indicator.style.display = "inline-block";
        indicator.title = "AI đang quét camera chống NSFW & Vũ khí/Hung khí";
    }

    console.log("Vision Guard (NSFW & Weapon Detection) scanning loop started.");

    AppState.nsfwInterval = setInterval(async () => {
        if (!AppState.currentCall.active) {
            stopNsfwDetection();
            return;
        }

        const strangerVideo = document.getElementById("stranger-video");
        const canvas = document.getElementById("stranger-canvas");

        if (!strangerVideo || !canvas) return;

        if (strangerVideo.readyState === strangerVideo.HAVE_ENOUGH_DATA) {
            const ctx = canvas.getContext("2d");
            canvas.width = 224;
            canvas.height = 224;

            ctx.drawImage(strangerVideo, 0, 0, canvas.width, canvas.height);

            // 1. Quét Ảnh nhạy cảm 18+ (NSFWJS)
            if (AppState.nsfwModel) {
                try {
                    const predictions = await AppState.nsfwModel.classify(canvas);
                    let nsfwScore = 0;
                    let dangerousClass = "";

                    predictions.forEach(p => {
                        if (["Porn", "Hentai", "Sexy"].includes(p.className)) {
                            if (p.probability > nsfwScore) {
                                nsfwScore = p.probability;
                                dangerousClass = p.className;
                            }
                        }
                    });

                    if (nsfwScore >= 0.7) {
                        console.warn(`NSFW detected! Score: ${nsfwScore} (${dangerousClass})`);
                        AppState.currentCall.safetyScore = 15;
                        AppState.currentCall.riskScore = 85;
                        updateSafetyGauges();

                        blurVideoFeed(`AI Shield phát hiện hình ảnh nhạy cảm (${dangerousClass}: ${(nsfwScore * 100).toFixed(0)}%) từ camera đối diện.`);

                        const strangerName = AppState.currentCall.stranger ? AppState.currentCall.stranger.name : "Stranger";
                        logIncident(
                            strangerName,
                            "image",
                            `AI Real-time Vision: Phát hiện hình ảnh nhạy cảm (${dangerousClass} score: ${(nsfwScore * 100).toFixed(0)}%)`,
                            `${(nsfwScore * 100).toFixed(0)}%`,
                            "Auto-Blur video feed"
                        );

                        showToast("AI COMPUTER VISION ALERT", "Phát hiện hình ảnh nhạy cảm từ camera đối phương. Đã tự động che mờ.", "danger");
                    }
                } catch (classifyErr) {
                    console.error("Error classifying NSFW video frame:", classifyErr);
                }
            }

            // 2. Quét Vũ khí & Hung khí (COCO-SSD Object Detection)
            if (AppState.cocoModel) {
                try {
                    const detectedObjects = await AppState.cocoModel.detect(canvas);
                    const dangerousItems = detectedObjects.filter(item => 
                        Object.keys(DANGEROUS_OBJECT_CLASSES).includes(item.class.toLowerCase()) && item.score >= 0.50
                    );

                    if (dangerousItems.length > 0) {
                        const topThreat = dangerousItems[0];
                        const threatNameVi = DANGEROUS_OBJECT_CLASSES[topThreat.class.toLowerCase()] || topThreat.class;
                        const confidenceScore = Math.round(topThreat.score * 100);

                        console.warn(`⚠️ WEAPON DETECTED: ${topThreat.class} (${confidenceScore}%)`);

                        AppState.currentCall.safetyScore = 10;
                        AppState.currentCall.riskScore = 95;
                        updateSafetyGauges();

                        blurVideoFeed(`AI SafeGuard phát hiện hung khí (${threatNameVi}: ${confidenceScore}%) trước camera!`);

                        const strangerName = AppState.currentCall.stranger ? AppState.currentCall.stranger.name : "Đối phương";
                        logIncident(
                            strangerName,
                            "weapon",
                            `[Weapon AI] Phát hiện ${threatNameVi} (${topThreat.class}: ${confidenceScore}%)`,
                            `${confidenceScore}%`,
                            "Auto-Blur & Khóa camera"
                        );

                        showToast("CẢNH BÁO VŨ KHÍ / HUNG KHÍ", `AI phát hiện ${threatNameVi} trước camera. Đã tự động làm mờ bảo vệ!`, "danger");
                        appendWarningMessage(`[AI SafeGuard] ⚠️ Phát hiện hung khí (${threatNameVi} - ${confidenceScore}%). Hãy cẩn thận hoặc ngắt kết nối an toàn.`);
                    }
                } catch (cocoErr) {
                    console.error("Error running COCO-SSD object detection:", cocoErr);
                }
            }
        }
    }, 2500);
}

function stopNsfwDetection() {
    if (AppState.nsfwInterval) {
        clearInterval(AppState.nsfwInterval);
        AppState.nsfwInterval = null;
        console.log("Vision Guard scanning loop stopped.");
    }
    const indicator = document.getElementById("ai-nsfw-scanning-indicator");
    if (indicator) indicator.style.display = "none";
}

// --- SAFECOIN DEMO SYSTEM & ADVANCED FILTERS ---
function updateCoinUI() {
    const balance = AppState.currentUser.coinBalance;
    const headerBal = document.getElementById("header-coin-balance");
    const modalBal = document.getElementById("modal-coin-balance");

    if (headerBal) headerBal.textContent = balance.toLocaleString();
    if (modalBal) modalBal.textContent = balance.toLocaleString();
}

function renderTransactionHistory() {
    const list = document.getElementById("coin-transactions-list");
    if (!list) return;

    const history = AppState.currentUser.transactionHistory;
    if (history.length === 0) {
        list.innerHTML = `
            <div class="empty-transactions" style="text-align: center; padding: 24px; color: var(--text-muted); font-size: 12px;">
                <i class="fa-solid fa-list-check" style="font-size: 18px; margin-bottom: 6px; opacity: 0.5;"></i>
                <p>Chưa có giao dịch nào được ghi nhận.</p>
            </div>
        `;
        return;
    }

    list.innerHTML = "";
    history.forEach(tx => {
        const div = document.createElement("div");
        div.className = "transaction-item";
        div.style.display = "flex";
        div.style.justify = "space-between";
        div.style.alignItems = "center";
        div.style.padding = "8px";
        div.style.borderBottom = "1px solid rgba(255,255,255,0.05)";
        div.style.fontSize = "12px";

        const isDeposit = tx.type === 'deposit';
        const color = isDeposit ? '#10b981' : '#f43f5e';
        const sign = isDeposit ? '+' : '-';
        const icon = isDeposit ? 'fa-circle-plus' : 'fa-circle-minus';

        div.innerHTML = `
            <div style="display: flex; align-items: center; gap: 8px;">
                <i class="fa-solid ${icon}" style="color: ${color};"></i>
                <div>
                    <div style="font-weight: 600; color: var(--text-normal);">${tx.description}</div>
                    <div style="font-size: 10px; color: var(--text-muted);">${tx.timestamp}</div>
                </div>
            </div>
            <div style="font-weight: 700; color: ${color};">${sign}${tx.amount} 🪙</div>
        `;
        list.appendChild(div);
    });
}

async function depositCoins(amount, description) {
    if (!AppState.currentUser) {
        showToast("Yêu cầu đăng nhập", "Bạn cần đăng nhập để thực hiện nạp SafeCoin.", "warning");
        return;
    }
    try {
        const res = await fetch('/api/wallet/update-balance', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ amount: amount, description: description })
        });
        const data = await res.json();
        if (res.ok) {
            AppState.currentUser.coinBalance = data.coinBalance;
            AppState.currentUser.transactionHistory = data.transactionHistory;
            updateCoinUI();
            renderTransactionHistory();
            showToast("Nạp SafeCoin", `Đã nạp thành công +${amount} SafeCoin.`, "success");
        } else {
            showToast("Lỗi nạp SafeCoin", data.error || "Không thể nạp xu.", "danger");
        }
    } catch (e) {
        console.error(e);
        showToast("Lỗi kết nối", "Không thể liên lạc với máy chủ.", "danger");
    }
}

async function chargeCoins(amount, description) {
    if (!AppState.currentUser) {
        showToast("Yêu cầu đăng nhập", "Bạn cần đăng nhập để sử dụng SafeCoin.", "warning");
        return false;
    }
    if (AppState.currentUser.coinBalance < amount) {
        showToast("Thiếu SafeCoin", `Bạn cần tối thiểu ${amount} SafeCoin để thực hiện.`, "danger");
        return false;
    }
    try {
        const res = await fetch('/api/wallet/update-balance', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ amount: -amount, description: description })
        });
        const data = await res.json();
        if (res.ok) {
            AppState.currentUser.coinBalance = data.coinBalance;
            AppState.currentUser.transactionHistory = data.transactionHistory;
            updateCoinUI();
            renderTransactionHistory();
            showToast("Tiêu dùng SafeCoin", `Đã trừ -${amount} SafeCoin cho bộ lọc nâng cao.`, "warning");
            return true;
        } else {
            showToast("Lỗi ví SafeCoin", data.error || "Không thể thực hiện giao dịch.", "danger");
            return false;
        }
    } catch (e) {
        console.error(e);
        showToast("Lỗi kết nối", "Không thể liên lạc với máy chủ.", "danger");
        return false;
    }
}

function initSafeCoinSystem() {
    updateCoinUI();
    renderTransactionHistory();

    const walletWidget = document.getElementById("wallet-widget");
    if (walletWidget) {
        walletWidget.addEventListener("click", () => {
            // Reset to pack select view when opening modal
            const packView = document.getElementById("wallet-pack-select-view");
            const qrView = document.getElementById("wallet-payment-qr-view");
            if (packView) packView.style.display = "block";
            if (qrView) qrView.style.display = "none";
            openModal("safecoin-modal");
        });
    }

    // Handle VietQR Payment Initiation
    document.querySelectorAll(".btn-init-payment").forEach(btn => {
        btn.addEventListener("click", async function () {
            if (!AppState.currentUser || !AppState.currentUser.id) {
                showToast("Yêu cầu đăng nhập", "Vui lòng đăng nhập để nạp SafeCoin qua chuyển khoản ngân hàng.", "warning");
                return;
            }

            const coins = parseInt(this.getAttribute("data-coins"), 10) || 100;
            const price = parseInt(this.getAttribute("data-price"), 10) || 10000;

            try {
                const res = await fetch('/api/wallet/create-qr-invoice', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ coinAmount: coins })
                });

                if (!res.ok) {
                    throw new Error("Không thể khởi tạo hóa đơn QR");
                }

                const invoice = await res.json();
                AppState.activeInvoice = invoice;

                // Populate Payment View
                const qrImg = document.getElementById("payment-qr-image");
                const payAmt = document.getElementById("pay-detail-amount");
                const payContent = document.getElementById("pay-detail-content");
                const btnCopyAmt = document.getElementById("btn-copy-amount");
                const btnCopyContent = document.getElementById("btn-copy-content");

                if (qrImg) qrImg.src = invoice.qrUrl;
                if (payAmt) payAmt.textContent = `${invoice.amountVnd.toLocaleString('vi-VN')} VNĐ`;
                if (payContent) payContent.textContent = invoice.transferContent;
                if (btnCopyAmt) btnCopyAmt.setAttribute("data-copy", invoice.amountVnd);
                if (btnCopyContent) btnCopyContent.setAttribute("data-copy", invoice.transferContent);

                // Switch Views
                const packView = document.getElementById("wallet-pack-select-view");
                const qrView = document.getElementById("wallet-payment-qr-view");
                if (packView) packView.style.display = "none";
                if (qrView) qrView.style.display = "block";

                // Start 15-minute countdown
                let timeLeft = 15 * 60;
                const timerEl = document.getElementById("payment-timer");
                if (AppState.paymentInterval) clearInterval(AppState.paymentInterval);
                AppState.paymentInterval = setInterval(() => {
                    timeLeft--;
                    if (timeLeft <= 0) {
                        clearInterval(AppState.paymentInterval);
                        if (timerEl) timerEl.textContent = "Hết hạn";
                    } else {
                        const m = Math.floor(timeLeft / 60).toString().padStart(2, '0');
                        const s = (timeLeft % 60).toString().padStart(2, '0');
                        if (timerEl) timerEl.textContent = `${m}:${s}`;
                    }
                }, 1000);

                showToast("VietQR MBBank", "Đã tạo mã QR thanh toán thành công. Vui lòng quét mã trên app ngân hàng.", "info");
            } catch (err) {
                console.error(err);
                showToast("Lỗi thanh toán", "Không thể kết nối đến cổng VietQR.", "danger");
            }
        });
    });

    // Back to packs view button
    const btnBackToPacks = document.getElementById("btn-back-to-packs");
    if (btnBackToPacks) {
        btnBackToPacks.addEventListener("click", () => {
            const packView = document.getElementById("wallet-pack-select-view");
            const qrView = document.getElementById("wallet-payment-qr-view");
            if (packView) packView.style.display = "block";
            if (qrView) qrView.style.display = "none";
            if (AppState.paymentInterval) clearInterval(AppState.paymentInterval);
        });
    }

    // Confirm bank transfer button
    const btnConfirmTransfer = document.getElementById("btn-confirm-transfer");
    if (btnConfirmTransfer) {
        btnConfirmTransfer.addEventListener("click", async () => {
            if (!AppState.activeInvoice) return;

            btnConfirmTransfer.disabled = true;
            btnConfirmTransfer.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Đang xác thực giao dịch...`;

            try {
                const res = await fetch('/api/wallet/confirm-bank-transfer', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(AppState.activeInvoice)
                });

                const data = await res.json();
                if (res.ok) {
                    AppState.currentUser.coinBalance = data.coinBalance;
                    AppState.currentUser.transactionHistory = data.transactionHistory;
                    updateCoinUI();
                    renderTransactionHistory();

                    showToast("NẠP XU THÀNH CÔNG", `Hệ thống đã xác nhận chuyển khoản! +${AppState.activeInvoice.coinAmount} SafeCoin đã được cộng vào ví.`, "success");

                    // Reset views
                    const packView = document.getElementById("wallet-pack-select-view");
                    const qrView = document.getElementById("wallet-payment-qr-view");
                    if (packView) packView.style.display = "block";
                    if (qrView) qrView.style.display = "none";
                    if (AppState.paymentInterval) clearInterval(AppState.paymentInterval);
                } else {
                    showToast("Lỗi xác nhận", data.error || "Không thể xác nhận giao dịch.", "danger");
                }
            } catch (e) {
                console.error(e);
                showToast("Lỗi kết nối", "Không thể liên lạc với máy chủ.", "danger");
            } finally {
                btnConfirmTransfer.disabled = false;
                btnConfirmTransfer.innerHTML = `<i class="fa-solid fa-circle-check"></i> Tôi Đã Chuyển Khoản Thành Công`;
            }
        });
    }

    // One-Click Copy Buttons
    document.querySelectorAll(".btn-copy-text").forEach(btn => {
        btn.addEventListener("click", function () {
            const textToCopy = this.getAttribute("data-copy");
            if (textToCopy) {
                navigator.clipboard.writeText(textToCopy).then(() => {
                    showToast("Đã sao chép", `Đã lưu "${textToCopy}" vào bộ nhớ tạm.`, "success");
                }).catch(() => {
                    showToast("Sao chép", textToCopy, "info");
                });
            }
        });
    });

    document.querySelectorAll(".btn-buy-coin").forEach(btn => {
        btn.addEventListener("click", function () {
            const amount = parseInt(this.getAttribute("data-amount"));
            let packName = "Gói Đồng";
            if (amount === 500) packName = "Gói Bạc";
            if (amount === 1000) packName = "Gói Vàng";

            depositCoins(amount, `Nạp ${packName}`);
        });
    });

    const chkGender = document.getElementById("chk-filter-gender");
    const genderWrapper = document.getElementById("filter-gender-select-wrapper");
    const chkLocation = document.getElementById("chk-filter-location");
    const locationWrapper = document.getElementById("filter-location-select-wrapper");
    const chkAge = document.getElementById("chk-filter-age");
    const ageWrapper = document.getElementById("filter-age-select-wrapper");
    const chkVerified = document.getElementById("chk-filter-verified");
    const chkCombo = document.getElementById("chk-filter-combo");

    function calculateFiltersCost() {
        if (chkCombo && chkCombo.checked) {
            return 40;
        }
        let cost = 0;
        if (chkGender && chkGender.checked) cost += 10;
        if (chkLocation && chkLocation.checked) cost += 15;
        if (chkAge && chkAge.checked) cost += 20;
        if (chkVerified && chkVerified.checked) cost += 10;
        return cost;
    }

    function validateAndApplyFilter(checkbox, wrapper = null) {
        if (checkbox.checked) {
            const cost = calculateFiltersCost();
            if (AppState.currentUser.coinBalance < cost) {
                checkbox.checked = false;
                if (wrapper) wrapper.style.display = "none";
                showToast("Không đủ SafeCoin", `Bạn không đủ SafeCoin để kích hoạt bộ lọc này (Tổng chi phí: ${cost} 🪙).`, "danger");
                openModal("safecoin-modal");
                return false;
            }
            if (wrapper) wrapper.style.display = "block";
        } else {
            if (wrapper) wrapper.style.display = "none";
            if (chkCombo && chkCombo.checked) {
                chkCombo.checked = false;
            }
        }
        return true;
    }

    if (chkGender && genderWrapper) {
        chkGender.addEventListener("change", function () {
            validateAndApplyFilter(this, genderWrapper);
        });
    }

    if (chkLocation && locationWrapper) {
        chkLocation.addEventListener("change", function () {
            validateAndApplyFilter(this, locationWrapper);
        });
    }

    if (chkAge && ageWrapper) {
        chkAge.addEventListener("change", function () {
            validateAndApplyFilter(this, ageWrapper);
        });
    }

    if (chkVerified) {
        chkVerified.addEventListener("change", function () {
            validateAndApplyFilter(this, null);
        });
    }

    if (chkCombo) {
        chkCombo.addEventListener("change", function () {
            if (this.checked) {
                if (AppState.currentUser.coinBalance < 40) {
                    this.checked = false;
                    showToast("Không đủ SafeCoin", "Bạn cần tối thiểu 40 SafeCoin để kích hoạt gói Combo All Filters.", "danger");
                    openModal("safecoin-modal");
                    return;
                }
                if (chkGender) { chkGender.checked = true; genderWrapper.style.display = "block"; }
                if (chkLocation) { chkLocation.checked = true; locationWrapper.style.display = "block"; }
                if (chkAge) { chkAge.checked = true; ageWrapper.style.display = "block"; }
                if (chkVerified) { chkVerified.checked = true; }
                showToast("Kích hoạt Combo", "Đã kích hoạt toàn bộ bộ lọc với giá ưu đãi 40 SafeCoin.", "success");
            } else {
                if (chkGender) { chkGender.checked = false; genderWrapper.style.display = "none"; }
                if (chkLocation) { chkLocation.checked = false; locationWrapper.style.display = "none"; }
                if (chkAge) { chkAge.checked = false; ageWrapper.style.display = "none"; }
                if (chkVerified) { chkVerified.checked = false; }
            }
        });
    }
}

// --- BEAUTY FILTERS & AR STICKERS ENGINE (MediaPipe FaceMesh) ---
function initFaceMesh() {
    if (AppState.faceMesh) return;
    if (typeof FaceMesh === 'undefined') {
        console.warn("MediaPipe FaceMesh library not loaded yet.");
        return;
    }

    AppState.faceMesh = new FaceMesh({
        locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`
    });

    AppState.faceMesh.setOptions({
        maxNumFaces: 1,
        refineLandmarks: false,
        minDetectionConfidence: 0.5,
        minTrackingConfidence: 0.5
    });

    AppState.faceMesh.onResults(onFaceMeshResults);
    console.log("MediaPipe FaceMesh initialized successfully!");
}

let arFrameRequest = null;
function startARLoop() {
    if (AppState.isFaceMeshRunning) return;
    AppState.isFaceMeshRunning = true;

    initFaceMesh();

    const video = document.getElementById("local-video");
    async function sendFrame() {
        if (!AppState.isFaceMeshRunning || !AppState.currentCall.active) {
            stopARLoop();
            return;
        }

        if (video && video.readyState === video.HAVE_ENOUGH_DATA && AppState.currentFilter.sticker !== 'none') {
            try {
                if (AppState.faceMesh) {
                    await AppState.faceMesh.send({ image: video });
                }
            } catch (err) {
                console.error("Error sending frame to FaceMesh:", err);
            }
        } else if (AppState.currentFilter.sticker === 'none') {
            // Clear canvas if sticker turned off
            const canvas = document.getElementById("local-filter-canvas");
            if (canvas) {
                const ctx = canvas.getContext("2d");
                ctx.clearRect(0, 0, canvas.width, canvas.height);
            }
        }

        // Cap AR processing to ~25fps to conserve resources
        setTimeout(() => {
            if (AppState.isFaceMeshRunning) {
                arFrameRequest = requestAnimationFrame(sendFrame);
            }
        }, 40);
    }
    sendFrame();
}

function stopARLoop() {
    AppState.isFaceMeshRunning = false;
    if (arFrameRequest) {
        cancelAnimationFrame(arFrameRequest);
        arFrameRequest = null;
    }
    const canvas = document.getElementById("local-filter-canvas");
    if (canvas) {
        const ctx = canvas.getContext("2d");
        ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
}

function onFaceMeshResults(results) {
    const canvas = document.getElementById("local-filter-canvas");
    if (!canvas) return;

    const ctx = canvas.getContext("2d");

    // Set match dimensions
    const video = document.getElementById("local-video");
    if (video) {
        if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
            canvas.width = video.videoWidth || 640;
            canvas.height = video.videoHeight || 480;
        }
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (!results.multiFaceLandmarks || results.multiFaceLandmarks.length === 0) {
        return;
    }

    const landmarks = results.multiFaceLandmarks[0];
    const sticker = AppState.currentFilter.sticker;

    if (sticker === 'glasses') {
        drawARGlasses(ctx, landmarks, canvas.width, canvas.height);
    } else if (sticker === 'cat_ears') {
        drawARCatEars(ctx, landmarks, canvas.width, canvas.height);
    } else if (sticker === 'crown') {
        drawARCrown(ctx, landmarks, canvas.width, canvas.height);
    } else if (sticker === 'clown_nose') {
        drawARClownNose(ctx, landmarks, canvas.width, canvas.height);
    } else if (sticker === 'sparkles') {
        drawARSparkles(ctx, landmarks, canvas.width, canvas.height);
    } else if (sticker === 'neon_border') {
        drawARNeonBorder(ctx, landmarks, canvas.width, canvas.height);
    }
}

// Draw a beautiful golden crown with gems
function drawARCrown(ctx, landmarks, width, height) {
    const foreheadCenter = landmarks[10];
    const foreheadLeft = landmarks[109];
    const foreheadRight = landmarks[338];

    if (!foreheadCenter || !foreheadLeft || !foreheadRight) return;

    const fcX = foreheadCenter.x * width;
    const fcY = foreheadCenter.y * height;
    const flX = foreheadLeft.x * width;
    const flY = foreheadLeft.y * height;
    const frX = foreheadRight.x * width;
    const frY = foreheadRight.y * height;

    const headWidth = Math.hypot(frX - flX, frY - flY);
    const crownWidth = headWidth * 1.2;
    const crownHeight = crownWidth * 0.6;
    const angle = Math.atan2(frY - flY, frX - flX);

    ctx.save();
    ctx.translate(fcX, fcY - crownHeight * 0.4);
    ctx.rotate(angle);

    // Create a real canvas gradient
    const grad = ctx.createLinearGradient(0, -crownHeight, 0, 0);
    grad.addColorStop(0, "#fde047");
    grad.addColorStop(1, "#ca8a04");
    ctx.fillStyle = grad;

    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = crownWidth * 0.02;
    ctx.lineJoin = "round";

    ctx.beginPath();
    ctx.moveTo(-crownWidth * 0.45, 0);
    ctx.lineTo(-crownWidth * 0.45, -crownHeight * 0.5);
    ctx.lineTo(-crownWidth * 0.22, -crownHeight * 0.25);
    ctx.lineTo(0, -crownHeight * 0.95);
    ctx.lineTo(crownWidth * 0.22, -crownHeight * 0.25);
    ctx.lineTo(crownWidth * 0.45, -crownHeight * 0.5);
    ctx.lineTo(crownWidth * 0.45, 0);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Draw gems on peaks
    const drawGem = (x, y, r, color) => {
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "#fff";
        ctx.lineWidth = 1.5;
        ctx.stroke();
    };

    const gemRadius = crownWidth * 0.04;
    drawGem(-crownWidth * 0.45, -crownHeight * 0.5, gemRadius, "#ef4444"); // Red
    drawGem(0, -crownHeight * 0.95, gemRadius * 1.2, "#3b82f6"); // Blue
    drawGem(crownWidth * 0.45, -crownHeight * 0.5, gemRadius, "#ef4444"); // Red

    // Diamonds in the center base
    const drawDiamond = (x, y, size, color) => {
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.moveTo(x, y - size);
        ctx.lineTo(x + size, y);
        ctx.lineTo(x, y + size);
        ctx.lineTo(x - size, y);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = "#fff";
        ctx.lineWidth = 1;
        ctx.stroke();
    };

    drawDiamond(0, -crownHeight * 0.3, gemRadius * 1.5, "#ec4899"); // Pink Center Gem
    drawDiamond(-crownWidth * 0.2, -crownHeight * 0.15, gemRadius, "#10b981"); // Green Left
    drawDiamond(crownWidth * 0.2, -crownHeight * 0.15, gemRadius, "#10b981"); // Green Right

    ctx.restore();
}

// Draw red clown nose with radial gradient for 3D sphere look
function drawARClownNose(ctx, landmarks, width, height) {
    const noseTip = landmarks[4];
    const eyeLeft = landmarks[33];
    const eyeRight = landmarks[263];

    if (!noseTip || !eyeLeft || !eyeRight) return;

    const ntX = noseTip.x * width;
    const ntY = noseTip.y * height;
    const elX = eyeLeft.x * width;
    const elY = eyeLeft.y * height;
    const erX = eyeRight.x * width;
    const erY = eyeRight.y * height;

    const eyeDistance = Math.hypot(erX - elX, erY - elY);
    const noseRadius = eyeDistance * 0.25;

    ctx.save();
    const grad = ctx.createRadialGradient(
        ntX - noseRadius * 0.3, ntY - noseRadius * 0.3, noseRadius * 0.1,
        ntX, ntY, noseRadius
    );
    grad.addColorStop(0, "#ff8787"); // Highlight spot
    grad.addColorStop(0.4, "#ef4444"); // Mid red
    grad.addColorStop(1, "#991b1b"); // Shadow red

    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(ntX, ntY, noseRadius, 0, Math.PI * 2);
    ctx.fill();

    // Draw little white shine arc
    ctx.strokeStyle = "rgba(255, 255, 255, 0.6)";
    ctx.lineWidth = noseRadius * 0.12;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.arc(ntX - noseRadius * 0.3, ntY - noseRadius * 0.3, noseRadius * 0.4, Math.PI, 1.5 * Math.PI);
    ctx.stroke();

    ctx.restore();
}

// Draw beautiful glistening sparkles/glitters on cheeks & forehead
function drawARSparkles(ctx, landmarks, width, height) {
    const indices = [10, 234, 454, 152, 168, 33, 263];
    const time = Date.now() * 0.005;

    ctx.save();
    indices.forEach((idx, i) => {
        const pt = landmarks[idx];
        if (!pt) return;

        const x = pt.x * width;
        const y = pt.y * height;

        const scale = 0.5 + 0.5 * Math.sin(time + i * 1.5);
        if (scale < 0.1) return;

        const size = (width * 0.04) * scale;

        const glow = ctx.createRadialGradient(x, y, 0, x, y, size * 1.5);
        glow.addColorStop(0, "rgba(255, 255, 255, 1)");
        glow.addColorStop(0.3, "rgba(234, 179, 8, 0.8)"); // Gold spark
        glow.addColorStop(1, "rgba(234, 179, 8, 0)");
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(x, y, size * 1.5, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = "#ffffff";
        ctx.beginPath();
        ctx.moveTo(x, y - size);
        ctx.quadraticCurveTo(x, y, x + size, y);
        ctx.quadraticCurveTo(x, y, x, y + size);
        ctx.quadraticCurveTo(x, y, x - size, y);
        ctx.quadraticCurveTo(x, y, x, y - size);
        ctx.closePath();
        ctx.fill();
    });
    ctx.restore();
}

// Draw face silhouette glowing neon outline
function drawARNeonBorder(ctx, landmarks, width, height) {
    const silhouetteIndexes = [
        10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379, 378,
        400, 377, 152, 148, 176, 149, 150, 136, 172, 58, 132, 93, 234, 127, 162, 21,
        54, 103, 67, 109
    ];

    if (silhouetteIndexes.some(idx => !landmarks[idx])) return;

    ctx.save();
    ctx.strokeStyle = "#a855f7"; // Neon Purple
    ctx.lineWidth = width * 0.012;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.shadowColor = "#a855f7";
    ctx.shadowBlur = 15;

    ctx.beginPath();
    const startPt = landmarks[silhouetteIndexes[0]];
    ctx.moveTo(startPt.x * width, startPt.y * height);

    for (let i = 1; i < silhouetteIndexes.length; i++) {
        const pt = landmarks[silhouetteIndexes[i]];
        ctx.lineTo(pt.x * width, pt.y * height);
    }
    ctx.closePath();
    ctx.stroke();

    ctx.shadowBlur = 0;
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = width * 0.004;
    ctx.stroke();

    ctx.restore();
}

// Draw cool retro sunglasses using Canvas 2D paths (fallback safe, 0% broken links)
function drawARGlasses(ctx, landmarks, width, height) {
    // MediaPipe face landmark mapping:
    // Left eye center: 33, Right eye center: 263
    // Nose bridge: 168
    const eyeLeft = landmarks[33];
    const eyeRight = landmarks[263];
    const noseBridge = landmarks[168];

    if (!eyeLeft || !eyeRight || !noseBridge) return;

    const elX = eyeLeft.x * width;
    const elY = eyeLeft.y * height;
    const erX = eyeRight.x * width;
    const erY = eyeRight.y * height;
    const nbX = noseBridge.x * width;
    const nbY = noseBridge.y * height;

    // Calculate dimensions
    const eyeDistance = Math.hypot(erX - elX, erY - elY);
    const glassesWidth = eyeDistance * 1.8;
    const glassesHeight = glassesWidth * 0.35;

    // Calculate rotation angle
    const angle = Math.atan2(erY - elY, erX - elX);

    ctx.save();
    ctx.translate(nbX, nbY);
    ctx.rotate(angle);

    // Draw frame (Black cool sunglasses)
    ctx.fillStyle = "rgba(15, 23, 42, 0.95)";
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = glassesWidth * 0.03;

    // Left lens
    ctx.beginPath();
    ctx.roundRect(-glassesWidth * 0.45, -glassesHeight * 0.5, glassesWidth * 0.38, glassesHeight, glassesHeight * 0.3);
    ctx.fill();
    ctx.stroke();

    // Right lens
    ctx.beginPath();
    ctx.roundRect(glassesWidth * 0.07, -glassesHeight * 0.5, glassesWidth * 0.38, glassesHeight, glassesHeight * 0.3);
    ctx.fill();
    ctx.stroke();

    // Bridge bar connecting lenses
    ctx.beginPath();
    ctx.moveTo(-glassesWidth * 0.08, -glassesHeight * 0.2);
    ctx.lineTo(glassesWidth * 0.08, -glassesHeight * 0.2);
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = glassesWidth * 0.05;
    ctx.stroke();

    // Highlights on glasses (lens reflection glow)
    ctx.fillStyle = "rgba(255, 255, 255, 0.3)";
    ctx.beginPath();
    ctx.ellipse(-glassesWidth * 0.35, -glassesHeight * 0.2, glassesWidth * 0.08, glassesHeight * 0.2, Math.PI / 4, 0, Math.PI * 2);
    ctx.ellipse(glassesWidth * 0.17, -glassesHeight * 0.2, glassesWidth * 0.08, glassesHeight * 0.2, Math.PI / 4, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
}

// Draw cute pink/purple cat ears using Canvas 2D paths
function drawARCatEars(ctx, landmarks, width, height) {
    // Upper forehead landmarks: 109 (left forehead top), 338 (right forehead top), 10 (head center)
    const foreheadLeft = landmarks[109];
    const foreheadRight = landmarks[338];
    const foreheadCenter = landmarks[10];

    if (!foreheadLeft || !foreheadRight || !foreheadCenter) return;

    const flX = foreheadLeft.x * width;
    const flY = foreheadLeft.y * height;
    const frX = foreheadRight.x * width;
    const frY = foreheadRight.y * height;
    const fcX = foreheadCenter.x * width;
    const fcY = foreheadCenter.y * height;

    const headWidth = Math.hypot(frX - flX, frY - flY);
    const earSize = headWidth * 0.55;
    const angle = Math.atan2(frY - flY, frX - flX);

    ctx.save();
    ctx.translate(fcX, fcY);
    ctx.rotate(angle);

    // Left Ear
    ctx.save();
    ctx.translate(-headWidth * 0.45, -headWidth * 0.25);
    ctx.rotate(-Math.PI / 12);

    // Outer Ear (Pink/Purple)
    ctx.fillStyle = "#ec4899";
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(-earSize * 0.2, -earSize * 0.8, -earSize * 0.4, -earSize);
    ctx.quadraticCurveTo(earSize * 0.4, -earSize * 0.9, earSize * 0.6, 0);
    ctx.closePath();
    ctx.fill();

    // Inner Ear (Light Pink)
    ctx.fillStyle = "#fbcfe8";
    ctx.beginPath();
    ctx.moveTo(earSize * 0.05, -earSize * 0.05);
    ctx.quadraticCurveTo(-earSize * 0.05, -earSize * 0.65, -earSize * 0.2, -earSize * 0.8);
    ctx.quadraticCurveTo(earSize * 0.2, -earSize * 0.75, earSize * 0.35, -earSize * 0.05);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    // Right Ear
    ctx.save();
    ctx.translate(headWidth * 0.45, -headWidth * 0.25);
    ctx.rotate(Math.PI / 12);

    // Outer Ear
    ctx.fillStyle = "#ec4899";
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.quadraticCurveTo(-earSize * 0.4, -earSize * 0.9, -earSize * 0.6, -earSize);
    ctx.quadraticCurveTo(earSize * 0.2, -earSize * 0.8, earSize * 0.4, 0);
    ctx.closePath();
    ctx.fill();

    // Inner Ear
    ctx.fillStyle = "#fbcfe8";
    ctx.beginPath();
    ctx.moveTo(-earSize * 0.05, -earSize * 0.05);
    ctx.quadraticCurveTo(-earSize * 0.2, -earSize * 0.75, -earSize * 0.35, -earSize * 0.8);
    ctx.quadraticCurveTo(earSize * 0.05, -earSize * 0.65, earSize * 0.2, -earSize * 0.05);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    ctx.restore();
}

function applyBeautyFilter(filterType) {
    const video = document.getElementById("local-video");
    if (!video) return;

    AppState.currentFilter.beauty = filterType;

    let cssFilter = "scaleX(-1)"; // Keep mirror flipped
    switch (filterType) {
        case 'smooth':
            cssFilter += " brightness(1.08) contrast(1.03) saturate(1.05) blur(0.5px)";
            break;
        case 'bright':
            cssFilter += " brightness(1.22) contrast(1.05)";
            break;
        case 'pink':
            cssFilter += " brightness(1.06) saturate(1.15) hue-rotate(-6deg)";
            break;
    }
    video.style.transform = cssFilter;
    showToast("Bộ lọc làm đẹp", `Đã áp dụng bộ lọc: ${filterType === 'none' ? 'Mộc' : filterType}`, "success");
}

function initVideoFiltersSystem() {
    const btnToggleFilters = document.getElementById("btn-toggle-filters");
    const filterPanel = document.getElementById("filter-selection-panel");

    if (btnToggleFilters && filterPanel) {
        btnToggleFilters.addEventListener("click", (e) => {
            e.stopPropagation();
            const isOpen = filterPanel.style.display === "block";
            filterPanel.style.display = isOpen ? "none" : "block";
            btnToggleFilters.classList.toggle("active", !isOpen);
        });

        // Hide filter panel when clicking outside
        document.addEventListener("click", () => {
            filterPanel.style.display = "none";
            btnToggleFilters.classList.remove("active");
        });
        filterPanel.addEventListener("click", (e) => e.stopPropagation());
    }

    // Beauty Filters selection
    document.querySelectorAll(".filter-opt").forEach(opt => {
        opt.addEventListener("click", function () {
            document.querySelectorAll(".filter-opt").forEach(o => o.classList.remove("active"));
            this.classList.add("active");
            applyBeautyFilter(this.getAttribute("data-beauty"));
        });
    });

    // AR Stickers selection
    document.querySelectorAll(".sticker-opt").forEach(opt => {
        opt.addEventListener("click", function () {
            document.querySelectorAll(".sticker-opt").forEach(o => o.classList.remove("active"));
            this.classList.add("active");

            const stickerType = this.getAttribute("data-sticker");
            AppState.currentFilter.sticker = stickerType;

            // Synchronize with carousel buttons
            document.querySelectorAll(".ar-filter-item").forEach(o => {
                o.classList.toggle("active", o.getAttribute("data-ar-filter") === stickerType);
            });

            showToast("AR Stickers", `Đã chọn sticker: ${stickerType === 'none' ? 'Tắt' : stickerType}`, "success");

            if (stickerType !== 'none') {
                startARLoop();
            } else {
                stopARLoop();
            }
        });
    });

    // Horizontal AR Filters Carousel selection
    document.querySelectorAll(".ar-filter-item").forEach(opt => {
        opt.addEventListener("click", function () {
            document.querySelectorAll(".ar-filter-item").forEach(o => o.classList.remove("active"));
            this.classList.add("active");

            const filterType = this.getAttribute("data-ar-filter");
            AppState.currentFilter.sticker = filterType;

            // Synchronize with older overlay panel selection if exists
            document.querySelectorAll(".sticker-opt").forEach(o => {
                o.classList.toggle("active", o.getAttribute("data-sticker") === filterType);
            });

            // Display Toast
            const filterNameMap = {
                'none': 'Tắt',
                'glasses': 'Kính râm',
                'cat_ears': 'Tai mèo',
                'crown': 'Vương miện',
                'clown_nose': 'Mũi hề',
                'sparkles': 'Sương mai',
                'neon_border': 'Neon Face'
            };
            showToast("AR Filters", `Đã bật filter: ${filterNameMap[filterType] || filterType}`, "success");

            if (filterType !== 'none') {
                startARLoop();
            } else {
                stopARLoop();
            }
        });
    });
}


// --- INITIALIZATION ---
document.addEventListener("DOMContentLoaded", () => {
    loadNsfwModel();
    initNavigation();
    initProfileSettings();
    initMatchingFlow();
    initCallControls();
    initSpeechRecognition();
    initSimulationTriggers();
    initModals();
    initAuthSystem();
    initAdminPanel();
    initRatingModal();
    initSettingsModal();
    initCallTypeToggle();
    initBlockUser();
    initCallHistory();
    initOnlineCounter();
    initScreenshotPrevention();
    initSafeCoinSystem();
    initVideoFiltersSystem();
    initRealtimeWebRTC();
    initLoungeSystem();
    initProfilePage();
    renderSentReports();

    // Toast welcome
    showToast("SafeConnect AI Shield", "Hệ thống bảo vệ AI thời gian thực đã sẵn sàng.", "success");
});

// --- REAL-TIME WEBRTC (SOCKET.IO + PEERJS) ---
function initRealtimeWebRTC() {
    if (AppState.socket) return;

    const host = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
        ? 'http://localhost:3000'
        : window.location.origin;

    console.log("Connecting to matchmaking signaling server:", host);
    AppState.socket = io(host);

    AppState.socket.on('connect', () => {
        console.log("Connected to server. Socket ID:", AppState.socket.id);

        if (!AppState.peer) {
            const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
            const peerPort = isLocal ? 3000 : (window.location.port || (window.location.protocol === 'https:' ? 443 : 80));

            AppState.peer = new Peer({
                host: window.location.hostname,
                port: peerPort,
                path: '/peer/peerjs',
                secure: window.location.protocol === 'https:',
                debug: 1
            });

            AppState.peer.on('open', (id) => {
                AppState.peerId = id;
                console.log("My Peer ID:", id);
            });

            AppState.peer.on('error', (err) => {
                console.error("PeerJS Connection Error:", err);
                showToast("Lỗi kết nối", "Không thể thiết lập WebRTC qua PeerJS.", "danger");
            });

            AppState.peer.on('call', (call) => {
                console.log("Receiving incoming media call from:", call.peer);
                AppState.mediaCall = call;

                if (AppState.currentCall.localStream) {
                    call.answer(AppState.currentCall.localStream);
                    handleIncomingMediaCall(call);
                } else {
                    getLocalStream().then(stream => {
                        if (stream) {
                            AppState.currentCall.localStream = stream;
                            const localVideo = document.getElementById("local-video");
                            localVideo.srcObject = stream;
                            if (stream.getVideoTracks().length === 0) {
                                localVideo.poster = AppState.currentUser.avatar;
                            }
                            call.answer(stream);
                        } else {
                            call.answer();
                        }
                        handleIncomingMediaCall(call);
                    });
                }
            });

            AppState.peer.on('connection', (conn) => {
                console.log("Receiving incoming data connection from:", conn.peer);
                AppState.dataConn = conn;
                handleIncomingDataConnection(conn);
            });
        }
    });

    AppState.socket.on('match-found', (data) => {
        console.log("Match Found (Preview phase):", data);
        AppState.currentCall.roomId = data.roomId;
        AppState.currentCall.stranger = data.partnerProfile;
        AppState.currentCall.status = "pending_approval";

        // Reset UI buttons
        const btnApprove = document.getElementById("btn-approve-match");
        const btnReject = document.getElementById("btn-reject-match");
        const statusText = document.getElementById("approval-status-text");

        if (btnApprove) {
            btnApprove.disabled = false;
            btnApprove.style.opacity = "1";
            btnApprove.innerHTML = `<i class="fa-solid fa-circle-check"></i> Đồng ý kết nối`;
        }
        if (btnReject) {
            btnReject.disabled = false;
            btnReject.style.opacity = "1";
        }
        if (statusText) {
            statusText.innerHTML = "Cả hai bên cần đồng ý để bắt đầu cuộc gọi video.";
        }

        showMatchFound();

        // Start 15-second countdown
        let approvalTimeLeft = 15;
        const countdownEl = document.getElementById("match-approval-countdown");
        if (countdownEl) countdownEl.textContent = approvalTimeLeft;

        clearInterval(AppState.approvalTimer);
        AppState.approvalTimer = setInterval(() => {
            approvalTimeLeft--;
            if (countdownEl) countdownEl.textContent = approvalTimeLeft;

            if (approvalTimeLeft <= 0) {
                clearInterval(AppState.approvalTimer);
                if (AppState.currentCall.status === "pending_approval") {
                    AppState.currentCall.status = "timeout";
                    console.log("Approval timeout reached at client.");
                    if (AppState.socket) {
                        AppState.socket.emit('reject-match', AppState.currentCall.roomId);
                    }
                }
            }
        }, 1000);
    });

    AppState.socket.on('partner-approved-match', () => {
        const statusText = document.getElementById("approval-status-text");
        if (statusText) {
            statusText.innerHTML = `<span style="color: #10b981; font-weight: 700;"><i class="fa-solid fa-circle-check"></i> Đối phương đã đồng ý! Chờ bạn...</span>`;
        }
    });

    AppState.socket.on('match-approved', (data) => {
        console.log("Match approved by both parties. Setting up WebRTC...", data);
        clearInterval(AppState.approvalTimer);

        AppState.currentCall.roomId = data.roomId;
        AppState.currentCall.role = data.role;
        AppState.currentCall.partnerPeerId = data.partnerPeerId;
        AppState.currentCall.stranger = data.partnerProfile;
        AppState.currentCall.status = "connected";

        // Transition to active call screen
        document.getElementById("match-found-view").classList.remove("active");
        document.getElementById("portal-section").classList.remove("active");
        document.getElementById("chat-section").classList.add("active");

        const navItems = document.querySelectorAll(".nav-item");
        navItems.forEach(n => n.classList.remove("active"));
        const chatLink = document.getElementById("nav-chat-link");
        if (chatLink) chatLink.classList.add("active");

        startCall();
    });

    AppState.socket.on('match-failed', (data) => {
        console.log("Match failed event received:", data);
        clearInterval(AppState.approvalTimer);

        const wasPending = AppState.currentCall.status === "pending_approval";
        AppState.currentCall.status = data.reason === 'timeout' ? 'timeout' : 'rejected';

        if (data.byUser === 'partner') {
            AppState.currentUser.consecutiveRejections++;
            showToast("Ghép cặp thất bại", "Đối phương từ chối kết nối hoặc hết giờ xác nhận.", "warning");

            if (AppState.currentUser.consecutiveRejections >= 3) {
                triggerConsecutiveRejectionsViolation();
            }
        } else {
            AppState.currentUser.consecutiveRejections = 0;
            showToast("Ghép cặp thất bại", "Hủy ghép cặp.", "info");
        }

        if (wasPending) {
            document.getElementById("match-found-view").classList.remove("active");
            document.getElementById("match-searching-view").classList.add("active");

            if (AppState.socket) {
                AppState.socket.emit('leave-queue');

                const chkGender = document.getElementById("chk-filter-gender");
                const chkLocation = document.getElementById("chk-filter-location");

                AppState.socket.emit('join-queue', {
                    peerId: AppState.peerId,
                    profile: {
                        name: AppState.currentUser.nickname,
                        age: AppState.currentUser.age,
                        gender: AppState.currentUser.gender,
                        location: AppState.currentUser.location,
                        interests: AppState.currentUser.interests,
                        purpose: AppState.currentUser.purpose,
                        verified: AppState.currentUser.verified,
                        avatar: AppState.currentUser.avatar
                    },
                    type: AppState.callType,
                    filters: {
                        gender: (chkGender && chkGender.checked) ? document.getElementById("filter-gender-val").value : null,
                        location: (chkLocation && chkLocation.checked) ? document.getElementById("filter-location-val").value : null
                    }
                });
                startAISearchingLogs();
            }
        }
    });

    AppState.socket.on('match-found-group', (data) => {
        console.log("Group Match Found:", data);
        AppState.currentCall.roomId = data.roomId;
        AppState.currentCall.role = 'group';

        if (data.peers && data.peers.length > 0) {
            AppState.currentCall.partnerPeerId = data.peers[0].peerId;
            AppState.currentCall.stranger = data.peers[0].profile;
            showMatchFound();
        }
    });

    AppState.socket.on('partner-disconnected', () => {
        showToast("Mất kết nối", "Đối phương đã thoát khỏi cuộc trò chuyện.", "warning");
        endCall();
    });
}

function handleIncomingMediaCall(call) {
    AppState.mediaCall = call;
    call.on('stream', (remoteStream) => {
        console.log("Remote stream received");
        const strangerVideo = document.getElementById("stranger-video");
        strangerVideo.srcObject = remoteStream;
        strangerVideo.play().catch(e => console.log("Play remote stream prevented", e));

        // Start Hybrid Audio AI Classifier on stranger audio to protect user
        startAudioSafetyAI(remoteStream, strangerVideo);
    });
    call.on('close', () => {
        console.log("Call closed by remote peer");
        endCall();
    });
}

function handleIncomingDataConnection(conn) {
    AppState.dataConn = conn;
    conn.on('data', (data) => {
        console.log("Data packet received:", data);
        if (data.type === 'chat') {
            appendMessage(data.sender, data.text, true);
        } else if (data.type === 'speech-transcript') {
            document.getElementById("live-speech-subtitle").textContent = `"${data.sender}: ${data.text}"`;

            // Handle real-time translation for speech subtitles
            const transSubtitle = document.getElementById("live-translation-subtitle");
            if (transSubtitle) {
                if (AppState.enableTranslation) {
                    transSubtitle.style.display = "block";
                    transSubtitle.textContent = "[Đang dịch...]";

                    translateText(data.text, AppState.currentUser.targetLanguage).then(translated => {
                        if (translated) {
                            transSubtitle.textContent = `[Dịch] "${translated}"`;
                        } else {
                            transSubtitle.textContent = `[Dịch] "[Lỗi dịch: không phản hồi]"`;
                        }
                    });
                } else {
                    transSubtitle.style.display = "none";
                }
            }

            analyzeSpeechNLP(data.text, data.sender);

            // Show microphone indicator
            const speechIndicator = document.getElementById("user-speech-indicator");
            if (speechIndicator) {
                speechIndicator.style.display = "inline-block";
                clearTimeout(AppState.speechTimer);
                AppState.speechTimer = setTimeout(() => {
                    speechIndicator.style.display = "none";
                }, 1500);
            }
        }
    });
    conn.on('close', () => {
        console.log("Data connection closed by remote peer");
    });
}

// --- NAVIGATION & VIEWS SWITCHER ---
function initNavigation() {
    const navItems = document.querySelectorAll(".nav-item");
    const sections = document.querySelectorAll(".app-section");

    navItems.forEach(item => {
        item.addEventListener("click", (e) => {
            e.preventDefault();
            const targetId = item.getAttribute("data-target");

            // Prevent leaving active call without warning
            if (AppState.currentCall.active && targetId !== "chat-section") {
                if (!confirm("Bạn đang trong cuộc gọi. Rời đi sẽ kết thúc cuộc trò chuyện. Bạn chắc chắn?")) {
                    return;
                }
                endCall();
            }

            // Check admin permission BEFORE changing visual state
            if (targetId === "admin-section") {
                if (!AppState.currentUser || AppState.currentUser.role !== 'admin') {
                    showToast("Quyền truy cập bị từ chối", "Chỉ tài khoản Quản trị viên mới được phép truy cập Bảng quản trị.", "danger");
                    return;
                }
            }

            // Check login for profile section
            if (targetId === "profile-section") {
                if (!AppState.currentUser || !AppState.currentUser.id) {
                    showToast("Yêu cầu đăng nhập", "Vui lòng đăng nhập để xem và chỉnh sửa hồ sơ cá nhân.", "warning");
                    return;
                }
            }

            // Switch Active Nav Link
            navItems.forEach(nav => nav.classList.remove("active"));
            item.classList.add("active");

            // Switch Active Section
            sections.forEach(sec => sec.classList.remove("active"));
            const targetSec = document.getElementById(targetId);
            targetSec.classList.add("active");

            // Load Admin Chart & Tables if active
            if (targetId === "admin-section") {
                renderAdminCharts();
                populateAdminTable();
                populateAdminForumTable();
                populateAdminBlacklist();
                loadAdminUsers();
            }

            // Load profile data when visiting profile page
            if (targetId === "profile-section") {
                loadProfileData();
            }
        });
    });
}

// --- PROFILE SETTINGS ---
function initProfileSettings() {
    const nicknameInput = document.getElementById("nickname");
    const headerUsername = document.getElementById("header-username");
    const headerAvatar = document.getElementById("header-avatar");
    const searchUserAvatar = document.getElementById("search-user-avatar");
    const foundUserLeft = document.getElementById("found-user-left");

    nicknameInput.addEventListener("input", (e) => {
        const val = e.target.value.trim() || "Người dùng ẩn danh";
        AppState.currentUser.nickname = val;
        headerUsername.textContent = val;

        // Dynamic avatar change based on nickname seed
        const newAvatar = `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(val)}`;
        AppState.currentUser.avatar = newAvatar;
        headerAvatar.src = newAvatar;
        searchUserAvatar.src = newAvatar;
        foundUserLeft.src = newAvatar;
    });

    // Interest tags selection
    const tags = document.querySelectorAll("#interests-container .tag");
    tags.forEach(tag => {
        tag.addEventListener("click", () => {
            tag.classList.toggle("active");
            const val = tag.getAttribute("data-value");

            if (tag.classList.contains("active")) {
                if (!AppState.currentUser.interests.includes(val)) {
                    AppState.currentUser.interests.push(val);
                }
            } else {
                AppState.currentUser.interests = AppState.currentUser.interests.filter(i => i !== val);
            }
        });
    });
}

// --- AI SMART RECOMMENDATION MATCHING ---
// --- MATCHING FLOW ---
function initMatchingFlow() {
    const btnStartMatch = document.getElementById("btn-start-match");
    const btnCancelMatch = document.getElementById("btn-cancel-match");
    const btnApproveMatch = document.getElementById("btn-approve-match");
    const btnRejectMatch = document.getElementById("btn-reject-match");

    const matchDefault = document.getElementById("match-default-view");
    const matchSearching = document.getElementById("match-searching-view");
    const matchFound = document.getElementById("match-found-view");

    btnStartMatch.addEventListener("click", async () => {
        if (!AppState.currentUser) {
            showToast("Yêu cầu đăng nhập", "Bạn cần đăng nhập để bắt đầu ghép cặp trò chuyện.", "warning");
            openModal("auth-modal");
            return;
        }

        // SafeCoin Balance check for Advanced Filters
        const chkGender = document.getElementById("chk-filter-gender");
        const chkLocation = document.getElementById("chk-filter-location");
        const chkAge = document.getElementById("chk-filter-age");
        const chkVerified = document.getElementById("chk-filter-verified");
        const chkCombo = document.getElementById("chk-filter-combo");

        let coinCost = 0;
        let filterDescParts = [];

        if (chkCombo && chkCombo.checked) {
            coinCost = 40;
            filterDescParts.push("Combo All Filters");
        } else {
            if (chkGender && chkGender.checked) {
                coinCost += 10;
                filterDescParts.push("Lọc Giới tính (" + document.getElementById("filter-gender-val").value + ")");
            }
            if (chkLocation && chkLocation.checked) {
                coinCost += 15;
                filterDescParts.push("Lọc Vùng miền (" + document.getElementById("filter-location-val").value + ")");
            }
            if (chkAge && chkAge.checked) {
                coinCost += 20;
                filterDescParts.push("Lọc Độ tuổi (" + document.getElementById("filter-age-min").value + "-" + document.getElementById("filter-age-max").value + ")");
            }
            if (chkVerified && chkVerified.checked) {
                coinCost += 10;
                filterDescParts.push("Lọc Đã xác thực (Verified)");
            }
        }

        if (coinCost > 0) {
            if (AppState.currentUser.coinBalance < coinCost) {
                showToast("Không đủ SafeCoin", `Bạn cần ${coinCost} SafeCoin để sử dụng các bộ lọc này. Vui lòng nạp thêm!`, "danger");
                openModal("safecoin-modal");
                return;
            }
            // Trừ tiền
            const success = await chargeCoins(coinCost, "Bộ lọc nâng cao: " + filterDescParts.join(" & "));
            if (!success) return;
        }

        matchDefault.classList.remove("active");
        matchSearching.classList.add("active");

        // Save current profile details
        AppState.currentUser.age = parseInt(document.getElementById("age").value) || 22;
        AppState.currentUser.gender = document.getElementById("gender").value;
        AppState.currentUser.location = document.getElementById("location").value;
        AppState.currentUser.purpose = document.getElementById("match-purpose").value;

        // Khởi động Realtime WebRTC và gửi tín hiệu vào Queue
        initRealtimeWebRTC();

        // Đợi 500ms cho PeerID sẵn sàng rồi mới join queue
        const checkPeerReady = setInterval(() => {
            if (AppState.peerId && AppState.socket && AppState.socket.connected) {
                clearInterval(checkPeerReady);

                // Gửi thông tin tìm kiếm kèm bộ lọc nâng cao
                AppState.socket.emit('join-queue', {
                    peerId: AppState.peerId,
                    profile: {
                        name: AppState.currentUser.nickname,
                        age: AppState.currentUser.age,
                        gender: AppState.currentUser.gender,
                        location: AppState.currentUser.location,
                        interests: AppState.currentUser.interests,
                        purpose: AppState.currentUser.purpose,
                        verified: AppState.currentUser.verified,
                        avatar: AppState.currentUser.avatar
                    },
                    type: AppState.callType,
                    filters: {
                        gender: (chkGender && chkGender.checked) ? document.getElementById("filter-gender-val").value : null,
                        location: (chkLocation && chkLocation.checked) ? document.getElementById("filter-location-val").value : null,
                        age: (chkAge && chkAge.checked) ? {
                            min: parseInt(document.getElementById("filter-age-min").value) || 18,
                            max: parseInt(document.getElementById("filter-age-max").value) || 100
                        } : null,
                        verified: (chkVerified && chkVerified.checked) ? true : null
                    }
                });
            }
        }, 100);

        startAISearchingLogs();
    });

    btnCancelMatch.addEventListener("click", () => {
        matchSearching.classList.remove("active");
        matchDefault.classList.add("active");
        if (AppState.socket) {
            AppState.socket.emit('leave-queue');
        }
        clearTimeout(AppState.matchTimeout);
        clearTimeout(AppState.mockMatchTimer);
    });

    if (btnApproveMatch) {
        btnApproveMatch.addEventListener("click", () => {
            btnApproveMatch.disabled = true;
            btnApproveMatch.style.opacity = "0.6";
            btnApproveMatch.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Đã đồng ý, chờ đối phương...`;

            if (AppState.socket && AppState.currentCall.roomId) {
                AppState.socket.emit('approve-match', AppState.currentCall.roomId);
            }
        });
    }

    if (btnRejectMatch) {
        btnRejectMatch.addEventListener("click", () => {
            clearInterval(AppState.approvalTimer);
            AppState.currentCall.status = "rejected";
            AppState.currentUser.consecutiveRejections = 0;

            if (AppState.socket && AppState.currentCall.roomId && AppState.currentCall.partnerPeerId) {
                AppState.socket.emit('reject-match', AppState.currentCall.roomId);
            }

            matchFound.classList.remove("active");
            matchSearching.classList.add("active");
            startAISearchingLogs();
        });
    }
}

// Simulate Logs of the AI Match Engine
function startAISearchingLogs() {
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
                div.innerHTML = `[Hệ thống] ${text}`;
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
}

function showMatchFound() {
    const stranger = AppState.currentCall.stranger;
    if (!stranger) return;

    // Display Stranger info
    const imgEl = document.getElementById("found-user-right");
    if (imgEl) imgEl.src = stranger.avatar || "https://api.dicebear.com/7.x/bottts/svg?seed=stranger";

    const nameEl = document.getElementById("found-stranger-name");
    if (nameEl) nameEl.textContent = `${stranger.name}, ${stranger.age || 22}`;

    const locEl = document.getElementById("found-stranger-location");
    if (locEl) locEl.innerHTML = `<i class="fa-solid fa-location-dot"></i> ${stranger.location || "Việt Nam"}`;

    const verifiedBadge = document.getElementById("found-stranger-verified-badge");
    if (verifiedBadge) {
        verifiedBadge.style.display = stranger.verified ? "flex" : "none";
    }

    // Shared interests tags
    const tagsContainer = document.getElementById("match-shared-interests-tags");
    if (tagsContainer) {
        tagsContainer.innerHTML = '';
        if (stranger.interests && stranger.interests.length > 0) {
            stranger.interests.forEach(interest => {
                const isShared = AppState.currentUser.interests.includes(interest);
                const tag = document.createElement("span");
                tag.className = "interest-tag";
                if (isShared) {
                    tag.style.background = "rgba(139, 92, 246, 0.15)";
                    tag.style.borderColor = "rgba(139, 92, 246, 0.3)";
                    tag.style.color = "#a78bfa";
                    tag.innerHTML = `<i class="fa-solid fa-heart" style="font-size: 9px; margin-right: 3px;"></i> ${interest}`;
                } else {
                    tag.textContent = interest;
                }
                tagsContainer.appendChild(tag);
            });
        } else {
            tagsContainer.innerHTML = `<span class="interest-tag">Không có sở thích cụ thể</span>`;
        }
    }

    // Purpose
    const purposeEl = document.getElementById("match-shared-purpose");
    if (purposeEl) purposeEl.textContent = stranger.purpose || "Trò chuyện vui vẻ";

    // Calculate deterministic Cosine Compatibility Score
    let simScore = 88;
    if (typeof calculateUserCompatibility === 'function') {
        const userInterestVec = (typeof ForumState !== 'undefined' && ForumState.interestVector) 
            ? ForumState.interestVector 
            : (AppState.currentUser.interestVector || {});
        simScore = calculateUserCompatibility(AppState.currentUser, stranger, userInterestVec);
    } else {
        const myInterests = new Set(AppState.currentUser.interests || []);
        const theirInterests = new Set(stranger.interests || stranger.topics || []);
        const intersection = [...myInterests].filter(x => theirInterests.has(x)).length;
        const union = new Set([...myInterests, ...theirInterests]).size;
        const jaccard = union > 0 ? intersection / union : 0.5;
        simScore = Math.round((jaccard * 0.30 + 0.68) * 100);
    }

    const scoreEl = document.getElementById("match-similarity-score");
    if (scoreEl) scoreEl.textContent = `${simScore}% Tương thích`;

    // Swap Views
    document.getElementById("match-searching-view").classList.remove("active");
    document.getElementById("match-found-view").classList.add("active");
}

// Helper function to capture media streams robustly with device fallbacks
async function getLocalStream() {
    // Try both video and audio
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        showToast("Quyền thiết bị", "Đã kết nối webcam & micro của bạn.", "success");
        return stream;
    } catch (err) {
        console.warn("Failed to get video and audio stream. Trying audio-only...", err);
    }
    
    // Try audio-only
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: false, audio: true });
        showToast("Quyền thiết bị", "Không mở được camera. Đã kết nối microphone của bạn.", "warning");
        return stream;
    } catch (err) {
        console.warn("Failed to get audio stream. Trying video-only...", err);
    }

    // Try video-only
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        showToast("Quyền thiết bị", "Không mở được micro. Đã kết nối webcam của bạn.", "warning");
        return stream;
    } catch (err) {
        console.error("Failed to get any media stream.", err);
        showToast("Quyền thiết bị", "Không tìm thấy webcam và micro. Bạn chỉ có thể nhắn tin.", "danger");
        return null;
    }
}

// --- CALL OPERATIONS (WEBRTC + FALLBACK) ---
async function startCall() {
    AppState.currentCall.active = true;
    AppState.currentCall.duration = 0;
    AppState.currentCall.safetyScore = 100;
    AppState.currentCall.riskScore = 0;
    updateSafetyGauges();

    // Start Timer
    const callTimer = document.getElementById("call-timer");
    AppState.currentCall.timer = setInterval(() => {
        AppState.currentCall.duration++;
        const mins = String(Math.floor(AppState.currentCall.duration / 60)).padStart(2, '0');
        const secs = String(AppState.currentCall.duration % 60).padStart(2, '0');
        callTimer.textContent = `${mins}:${secs}`;
    }, 1000);

    // Render Stranger info in video chat
    const stranger = AppState.currentCall.stranger;
    document.getElementById("stranger-display-name").textContent = `${stranger.name} (${stranger.age || 22}, ${stranger.location || 'Hà Nội'})`;

    if (stranger.verified) {
        document.getElementById("stranger-verified-badge").style.display = "inline-block";
    } else {
        document.getElementById("stranger-verified-badge").style.display = "none";
    }

    // Init user local camera stream
    const localVideo = document.getElementById("local-video");
    const stream = await getLocalStream();
    if (stream) {
        AppState.currentCall.localStream = stream;
        localVideo.srcObject = stream;
        if (stream.getVideoTracks().length > 0) {
            localVideo.play().catch(e => console.warn("Failed to play local video:", e));
        } else {
            localVideo.poster = AppState.currentUser.avatar;
        }
    } else {
        localVideo.poster = AppState.currentUser.avatar;
    }

    // Nếu mình là Caller, tiến hành kết nối PeerJS tới đối phương
    if (AppState.currentCall.role === 'caller' && AppState.currentCall.partnerPeerId) {
        console.log("Initiating call to partner PeerID:", AppState.currentCall.partnerPeerId);

        // Gọi video
        if (AppState.currentCall.localStream) {
            const call = AppState.peer.call(AppState.currentCall.partnerPeerId, AppState.currentCall.localStream);
            handleIncomingMediaCall(call);
        }

        // Kết nối data connection
        const conn = AppState.peer.connect(AppState.currentCall.partnerPeerId);
        handleIncomingDataConnection(conn);
    }

    // Nếu là mock call (ví dụ từ Lounge hoặc không có partnerPeerId)
    if (!AppState.currentCall.partnerPeerId) {
        const strangerVideo = document.getElementById("stranger-video");
        if (strangerVideo) {
            strangerVideo.srcObject = null;
            if (stranger.videoUrl) {
                strangerVideo.src = stranger.videoUrl;
                strangerVideo.loop = true;
                strangerVideo.play().catch(e => console.warn("Failed to autoplay stranger video:", e));
            } else {
                strangerVideo.poster = stranger.avatar || "https://api.dicebear.com/7.x/bottts/svg?seed=stranger";
            }
        }
    }

    // Clear chat room messages
    const chatMsg = document.getElementById("chat-messages");
    chatMsg.innerHTML = `
        <div class="message-bubble system">
            <p>[AI SafeGuard] Trò chuyện WebRTC an toàn đã được kết nối. AI đang bảo vệ cuộc gọi thời gian thực.</p>
        </div>
    `;

    // Clear call incident logs
    document.getElementById("incident-logs-list").innerHTML = `
        <div class="empty-incidents" id="empty-incidents-msg">
            <i class="fa-solid fa-shield-heart text-success"></i>
            <p>Chưa phát hiện hành vi vi phạm nào trong cuộc gọi này.</p>
        </div>
    `;
    document.getElementById("incident-count").textContent = "0";

    // Start real-time client-side NSFW image scanning
    startNsfwDetection();

    // Start Audio Safety AI if stream is ready
    if (AppState.currentCall.localStream) {
        startAudioSafetyAI(AppState.currentCall.localStream, document.getElementById("stranger-video"));
    }

    // Start AR loop if sticker is selected
    if (AppState.currentFilter.sticker !== 'none') {
        startARLoop();
    }
}

function endCall() {
    stopARLoop();
    stopNsfwDetection();
    stopAudioSafetyAI();
    clearInterval(AppState.currentCall.timer);

    // Save to call history
    if (AppState.currentCall.stranger) {
        const entry = {
            id: 'CALL-' + Date.now(),
            stranger: { ...AppState.currentCall.stranger },
            duration: AppState.currentCall.duration,
            safetyScore: AppState.currentCall.safetyScore,
            riskScore: AppState.currentCall.riskScore,
            timestamp: new Date().toLocaleString('vi-VN'),
            rating: 0,
            tags: []
        };
        AppState.callHistory.unshift(entry);
        renderCallHistory();
    }

    // Close PeerJS connections
    if (AppState.mediaCall) {
        AppState.mediaCall.close();
        AppState.mediaCall = null;
    }
    if (AppState.dataConn) {
        AppState.dataConn.close();
        AppState.dataConn = null;
    }

    // Inform Signaling Server
    if (AppState.socket && AppState.currentCall.roomId) {
        AppState.socket.emit('leave-room', AppState.currentCall.roomId);
    }

    // Stop local video stream tracks
    if (AppState.currentCall.localStream) {
        AppState.currentCall.localStream.getTracks().forEach(track => track.stop());
        AppState.currentCall.localStream = null;
    }

    // Reset videos
    document.getElementById("local-video").srcObject = null;
    const strangerVideo = document.getElementById("stranger-video");
    strangerVideo.srcObject = null;
    strangerVideo.src = "";

    AppState.currentCall.active = false;
    resetBehaviorFlags();
    resetSafetyState();

    // Show rating modal instead of report, unless bypassed
    if (AppState.bypassRatingModal) {
        AppState.bypassRatingModal = false;
        // Auto-redirect to home view
        document.getElementById("chat-section").classList.remove("active");
        document.getElementById("portal-section").classList.add("active");

        const navItems = document.querySelectorAll(".nav-item");
        navItems.forEach(n => n.classList.remove("active"));
        const portalNav = document.querySelector("[data-target='portal-section']");
        if (portalNav) portalNav.classList.add("active");
    } else {
        if (AppState.currentCall.stranger) {
            const s = AppState.currentCall.stranger;
            document.getElementById('rating-avatar').src = s.avatar || "https://api.dicebear.com/7.x/bottts/svg?seed=stranger";
            document.getElementById('rating-partner-name').textContent = s.name;
        }
        openModal('rating-modal');
    }
}

function resetSafetyState() {
    AppState.currentCall.safetyScore = 100;
    AppState.currentCall.riskScore = 0;
    updateSafetyGauges();

    // Reset video overlay blurs
    document.getElementById("stranger-blur-overlay").style.display = "none";
    document.getElementById("stranger-video").style.filter = "none";
}

function updateSafetyGauges() {
    const safetyScoreFill = document.getElementById("safety-score-fill");
    const safetyScoreVal = document.getElementById("safety-score-val");
    const riskScoreFill = document.getElementById("risk-score-fill");
    const riskScoreVal = document.getElementById("risk-score-val");

    safetyScoreFill.style.width = `${AppState.currentCall.safetyScore}%`;
    safetyScoreVal.textContent = `${AppState.currentCall.safetyScore}% (${AppState.currentCall.safetyScore > 70 ? 'An toàn' : AppState.currentCall.safetyScore > 40 ? 'Cảnh báo' : 'Nguy hiểm'})`;

    riskScoreFill.style.width = `${AppState.currentCall.riskScore}%`;
    riskScoreVal.textContent = `${AppState.currentCall.riskScore}% (${AppState.currentCall.riskScore > 60 ? 'Cao' : AppState.currentCall.riskScore > 30 ? 'Trung bình' : 'Thấp'})`;
}

// --- CALL CONTROLS (MIC, CAM, DISCONNECT) ---
function initCallControls() {
    const btnToggleMic = document.getElementById("btn-toggle-mic");
    const btnToggleCam = document.getElementById("btn-toggle-cam");
    const btnEndCall = document.getElementById("btn-end-call");

    btnToggleMic.addEventListener("click", () => {
        AppState.currentCall.micActive = !AppState.currentCall.micActive;
        btnToggleMic.classList.toggle("active", AppState.currentCall.micActive);

        if (AppState.currentCall.localStream) {
            AppState.currentCall.localStream.getAudioTracks().forEach(track => {
                track.enabled = AppState.currentCall.micActive;
            });
        }
        showToast("Microphone", AppState.currentCall.micActive ? "Đã bật micro." : "Đã tắt micro.", "success");
    });

    btnToggleCam.addEventListener("click", () => {
        AppState.currentCall.camActive = !AppState.currentCall.camActive;
        btnToggleCam.classList.toggle("active", AppState.currentCall.camActive);

        if (AppState.currentCall.localStream) {
            AppState.currentCall.localStream.getVideoTracks().forEach(track => {
                track.enabled = AppState.currentCall.camActive;
            });
        }
        showToast("Webcam", AppState.currentCall.camActive ? "Đã bật camera." : "Đã tắt camera.", "success");
    });

    btnEndCall.addEventListener("click", () => {
        endCall();
    });
}

// --- REAL-TIME SPEECH RECOGNITION (HTML5 Web Speech API) ---
function initSpeechRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
        console.warn("Browser does not support Web Speech API. Speech classifier simulation will run.");
        return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    const settingLangEl = document.getElementById("setting-language");
    recognition.lang = settingLangEl ? settingLangEl.value : 'vi-VN';

    recognition.onstart = () => {
        AppState.currentCall.isSpeechRecognizing = true;
        document.getElementById("tag-speech-status").textContent = "AI Đang lắng nghe...";
    };

    recognition.onresult = (event) => {
        let interimTranscript = '';
        let finalTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
            if (event.results[i].isFinal) {
                finalTranscript += event.results[i][0].transcript;
            } else {
                interimTranscript += event.results[i][0].transcript;
            }
        }

        const activeText = finalTranscript || interimTranscript;
        if (activeText.trim()) {
            document.getElementById("live-speech-subtitle").textContent = `"${activeText}"`;

            // Show microphone indicator
            const speechIndicator = document.getElementById("user-speech-indicator");
            speechIndicator.style.display = "inline-block";
            clearTimeout(AppState.speechTimer);
            AppState.speechTimer = setTimeout(() => {
                speechIndicator.style.display = "none";
            }, 1500);

            // NLP scan
            analyzeSpeechNLP(activeText, "Bạn");

            if (AppState.dataConn && AppState.dataConn.open) {
                AppState.dataConn.send({
                    type: 'speech-transcript',
                    sender: AppState.currentUser.nickname,
                    text: activeText
                });
            }
        }
    };

    recognition.onerror = (e) => {
        console.error("Speech Recognition Error", e);
    };

    recognition.onend = () => {
        AppState.currentCall.isSpeechRecognizing = false;
        // Auto-restart if call is active
        if (AppState.currentCall.active) {
            recognition.start();
        } else {
            document.getElementById("tag-speech-status").textContent = "Tạm dừng";
        }
    };

    // Auto start recognition when call starts
    AppState.currentCall.speechRecognition = recognition;
}

// --- AUDIO AI THREAT & ACOUSTIC CLASSIFIER CONTROLLER ---
function startAudioSafetyAI(stream, targetVideoEl) {
    if (!window.AudioSafetyClassifier) return;

    if (AppState.currentCall.audioClassifier) {
        AppState.currentCall.audioClassifier.stop();
    }

    const dbValEl = document.getElementById("audio-db-val");
    const dbFillEl = document.getElementById("audio-db-fill");
    const threatValEl = document.getElementById("audio-threat-val");
    const threatFillEl = document.getElementById("audio-threat-fill");
    const statusBadge = document.getElementById("audio-ai-status-badge");
    const duckBadge = document.getElementById("audio-autoduck-badge");

    const classifier = new window.AudioSafetyClassifier({
        screamDbThreshold: 78,
        screamHfrThreshold: 0.40,
        screamDurationMs: 300,
        autoDuckFactor: 0.25,
        autoDuckDuration: 4000,
        onAudioLevel: (levelData) => {
            if (dbValEl) dbValEl.textContent = `${levelData.db} dB`;
            if (dbFillEl) {
                dbFillEl.style.width = `${Math.min(100, levelData.db)}%`;
                dbFillEl.style.background = levelData.db > 80 ? '#ef4444' : (levelData.db > 65 ? '#f59e0b' : '#38bdf8');
            }

            const threatPercent = Math.round(levelData.hfr * 100);
            if (threatValEl) threatValEl.textContent = `${threatPercent}%`;
            if (threatFillEl) {
                threatFillEl.style.width = `${Math.min(100, threatPercent)}%`;
                threatFillEl.style.background = threatPercent > 40 ? '#ef4444' : (threatPercent > 25 ? '#f59e0b' : '#10b981');
            }

            if (statusBadge) {
                if (levelData.isScreaming || levelData.db > 85) {
                    statusBadge.style.background = 'rgba(239, 68, 68, 0.25)';
                    statusBadge.style.color = '#ef4444';
                    statusBadge.innerHTML = '<i class="fa-solid fa-triangle-exclamation"></i> Kích động / La hét';
                } else if (levelData.isHighVolume) {
                    statusBadge.style.background = 'rgba(245, 158, 11, 0.25)';
                    statusBadge.style.color = '#f59e0b';
                    statusBadge.innerHTML = '<i class="fa-solid fa-volume-high"></i> Âm lượng cao';
                } else {
                    statusBadge.style.background = 'rgba(16, 185, 129, 0.2)';
                    statusBadge.style.color = '#34d399';
                    statusBadge.innerHTML = '<i class="fa-solid fa-shield-check"></i> An toàn';
                }
            }
        },
        onThreatDetected: (threat) => {
            const strangerName = (AppState.currentCall.stranger && AppState.currentCall.stranger.name) ? AppState.currentCall.stranger.name : "Đối phương";
            showToast("AI BẢO VỆ ÂM THANH", `Phát hiện ${threat.label} (${threat.db} dB) từ ${strangerName}`, "danger");
            
            // Adjust risk & safety scores
            AppState.currentCall.riskScore = Math.min(100, AppState.currentCall.riskScore + 30);
            AppState.currentCall.safetyScore = Math.max(0, AppState.currentCall.safetyScore - 25);
            updateSafetyGauges();

            appendWarningMessage(`[Audio AI Shield] Cảnh báo âm thanh đe dọa/la hét: ${threat.label} (${threat.db} dB, Độ tin cậy: ${threat.confidence}%). Hệ thống đã tự động kích hoạt Auto-Ducking hạ âm lượng đối phương.`);

            logIncident(strangerName, "speech", `[Audio AI] ${threat.label} (${threat.db} dB, HFR: ${threat.hfr})`, `${threat.confidence}%`, "Auto-Ducking & Cảnh báo");
        },
        onAutoDuck: (isDucked, volumeFactor) => {
            if (duckBadge) {
                if (isDucked) {
                    duckBadge.style.color = '#ef4444';
                    duckBadge.innerHTML = `<i class="fa-solid fa-volume-xmark"></i> ĐANG BẢO VỆ (${Math.round(volumeFactor * 100)}% Vol)`;
                } else {
                    duckBadge.style.color = '#94a3b8';
                    duckBadge.textContent = 'Sẵn sàng';
                }
            }
        }
    });

    classifier.start(stream, targetVideoEl);
    AppState.currentCall.audioClassifier = classifier;
}

function stopAudioSafetyAI() {
    if (AppState.currentCall.audioClassifier) {
        AppState.currentCall.audioClassifier.stop();
        AppState.currentCall.audioClassifier = null;
    }
    const dbValEl = document.getElementById("audio-db-val");
    const dbFillEl = document.getElementById("audio-db-fill");
    const threatValEl = document.getElementById("audio-threat-val");
    const threatFillEl = document.getElementById("audio-threat-fill");
    const statusBadge = document.getElementById("audio-ai-status-badge");
    const duckBadge = document.getElementById("audio-autoduck-badge");

    if (dbValEl) dbValEl.textContent = "0 dB";
    if (dbFillEl) dbFillEl.style.width = "0%";
    if (threatValEl) threatValEl.textContent = "0%";
    if (threatFillEl) threatFillEl.style.width = "0%";
    if (statusBadge) {
        statusBadge.style.background = 'rgba(16, 185, 129, 0.2)';
        statusBadge.style.color = '#34d399';
        statusBadge.innerHTML = '<i class="fa-solid fa-shield-check"></i> An toàn';
    }
    if (duckBadge) {
        duckBadge.style.color = '#94a3b8';
        duckBadge.textContent = 'Sẵn sàng';
    }
}

// Vietnamese Text Normalization & Obfuscation Stripping
function normalizeVietnameseText(str) {
    if (!str) return '';
    return str
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/đ/g, 'd')
        .replace(/[^a-z0-9\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function matchKeywordList(text, keywordList) {
    const rawLower = text.toLowerCase();
    const normalized = normalizeVietnameseText(text);
    const compactRaw = rawLower.replace(/[^a-z0-9à-ỹ]/gi, '');
    const compactNorm = normalized.replace(/[^a-z0-9]/gi, '');

    const matches = [];
    for (const kw of keywordList) {
        const kwLower = kw.toLowerCase();
        const kwNorm = normalizeVietnameseText(kw);
        const kwCompact = kwNorm.replace(/[^a-z0-9]/gi, '');

        if (rawLower.includes(kwLower) || normalized.includes(kwNorm) || (kwCompact.length >= 3 && (compactRaw.includes(kwCompact) || compactNorm.includes(kwCompact)))) {
            matches.push(kw);
        }
    }
    return matches;
}

// NLP Classification
function analyzeSpeechNLP(text, sender) {
    if (!text || typeof text !== 'string') return;
    AppState.behaviorFlags.messageCount++;

    // Check toxic words
    let toxicFound = matchKeywordList(text, TOXIC_KEYWORDS);
    if (toxicFound.length > 0) {
        triggerSpeechSafetyViolation(sender, `Ngôn từ độc hại: "${toxicFound.join(', ')}"`);
    }

    // Check scam phrases
    let scamFound = matchKeywordList(text, SCAM_PHRASES);
    if (scamFound.length > 0) {
        AppState.behaviorFlags.moneyRequest++;
        updateBehaviorUI('beh-money-request', 'PHÁT HIỆN!', 'danger');
        triggerScamSafetyViolation(sender, `Nghi ngờ lừa đảo tài chính: "${scamFound.join(', ')}"`);
    }

    // Check romance scam phrases
    let romanceFound = matchKeywordList(text, ROMANCE_SCAM_PHRASES);
    if (romanceFound.length > 0) {
        AppState.behaviorFlags.romanceScam++;
        updateBehaviorUI('beh-romance-scam', `Cảnh báo (${AppState.behaviorFlags.romanceScam}x)`, AppState.behaviorFlags.romanceScam >= 2 ? 'danger' : 'warning');
        AppState.currentCall.riskScore = Math.min(100, AppState.currentCall.riskScore + 20);
        updateSafetyGauges();
        if (AppState.behaviorFlags.romanceScam >= 2) {
            showToast('ROMANCE SCAM PATTERN', `AI phát hiện mẫu ngôn ngữ lừa đảo tình cảm từ ${sender}`, 'danger');
            logIncident(sender, 'scam', 'Romance scam pattern: ' + romanceFound.join(', '), '87%', 'Risk Flagged');
        }
    }

    // Check personal info requests
    let personalFound = matchKeywordList(text, PERSONAL_INFO_PHRASES);
    if (personalFound.length > 0) {
        AppState.behaviorFlags.personalInfo++;
        const earlyRequest = AppState.currentCall.duration < 60;
        updateBehaviorUI('beh-personal-info', earlyRequest ? 'Quá sớm!' : `${AppState.behaviorFlags.personalInfo}x`, earlyRequest ? 'danger' : 'warning');
        if (earlyRequest) {
            updateBehaviorUI('beh-speed-info', 'Bất thường!', 'danger');
            AppState.currentCall.riskScore = Math.min(100, AppState.currentCall.riskScore + 25);
            updateSafetyGauges();
            showToast('CẢNH BÁO HÀNH VI', `${sender} hỏi thông tin cá nhân quá sớm (dưới 1 phút)`, 'warning');
        }
    }

    // Auto-ban check
    checkAutoBan(sender);
}

// Safety Action when speech violation detected
function triggerSpeechSafetyViolation(sender, detail) {
    // Decrement safety score
    AppState.currentCall.safetyScore = Math.max(0, AppState.currentCall.safetyScore - 30);
    updateSafetyGauges();

    // Alert User
    showToast("AI PHÁT HIỆN TỪ ĐỘC HẠI", `${sender} đã sử dụng ngôn từ bậy bạ hoặc quấy rối.`, "danger");
    document.getElementById("tag-speech-alert").style.display = "inline-block";

    setTimeout(() => {
        document.getElementById("tag-speech-alert").style.display = "none";
    }, 4000);

    // Mute/blur or warn
    if (AppState.currentCall.safetyScore < 40) {
        blurVideoFeed("Ngôn ngữ độc hại lặp lại nhiều lần. AI tự động khóa kết nối.");
    }

    // Add message warning to chat
    appendWarningMessage(`[AI Cảnh Báo] Phát hiện ngôn từ không chuẩn mực từ ${sender}. Chi tiết: ${detail}`);

    // Log incident
    logIncident(sender, "speech", detail, "90%", "Auto-Mute & Warning");
}

function triggerScamSafetyViolation(sender, detail) {
    // Increment Risk Score
    AppState.currentCall.riskScore = Math.min(100, AppState.currentCall.riskScore + 35);
    updateSafetyGauges();

    // Alert
    showToast("CẢNH BÁO RỦI RO LỪA ĐẢO", `Phát hiện dấu hiệu đe dọa hoặc xin chuyển khoản từ ${sender}. Cẩn thận thông tin cá nhân.`, "warning");

    appendWarningMessage(`[AI Bảo Vệ] Phát hiện nội dung rủi ro cao: ${detail}. Tuyệt đối không giao dịch chuyển khoản hoặc chia sẻ mật khẩu.`);

    // Log incident
    logIncident(sender, "scam", detail, "95%", "Risk Flagged & Banner Warning");
}

function triggerConsecutiveRejectionsViolation() {
    const detail = `Bị từ chối liên tiếp ${AppState.currentUser.consecutiveRejections} lần. Có dấu hiệu spam hoặc hành vi quấy rối.`;
    showToast("AI BẢO VỆ CẢNH BÁO", "Bạn liên tục bị đối phương từ chối kết nối. Hệ thống AI đang theo dõi tài khoản của bạn.", "danger");
    logIncident(AppState.currentUser.nickname, "behavior_warning", detail, "85%", "Cảnh báo & Đưa vào danh sách giám sát");
}

// --- TRANSLATION MODULE ---
async function translateText(text, targetLang) {
    if (!text || !text.trim()) return "";

    const host = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
        ? 'http://localhost:3000'
        : window.location.origin;

    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), 5000); // 5s timeout

    try {
        const response = await fetch(`${host}/api/translate`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ text, targetLang }),
            signal: controller.signal
        });
        clearTimeout(id);

        if (!response.ok) {
            throw new Error(`Server returned status ${response.status}`);
        }

        const data = await response.json();
        return data.translatedText || "";
    } catch (err) {
        clearTimeout(id);
        console.error("Translation API error:", err);
        return null;
    }
}

// --- TEXT CHAT FUNCTIONS ---
function appendMessage(sender, text, isStranger = false) {
    const chatContainer = document.getElementById("chat-messages");
    const bubble = document.createElement("div");
    bubble.className = `message-bubble ${isStranger ? 'stranger' : 'user'}`;
    bubble.innerHTML = `
        <span class="message-author">${sender}</span>
        <p class="chat-original-text">${text}</p>
    `;

    if (isStranger && AppState.enableTranslation) {
        const transDiv = document.createElement("div");
        transDiv.className = "translated-subtext";
        transDiv.style.fontSize = "11px";
        transDiv.style.opacity = "0.8";
        transDiv.style.marginTop = "4px";
        transDiv.style.borderTop = "1px dashed rgba(255,255,255,0.15)";
        transDiv.style.paddingTop = "4px";
        transDiv.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Dịch: [Đang dịch...]`;
        bubble.appendChild(transDiv);

        translateText(text, AppState.currentUser.targetLanguage).then(translated => {
            if (translated) {
                transDiv.innerHTML = `<i class="fa-solid fa-language"></i> Dịch: ${translated}`;
            } else {
                transDiv.innerHTML = `<i class="fa-solid fa-triangle-exclamation text-warning"></i> Dịch: [Không dịch được]`;
            }
            chatContainer.scrollTop = chatContainer.scrollHeight;
        });
    }

    chatContainer.appendChild(bubble);
    chatContainer.scrollTop = chatContainer.scrollHeight;

    // Run NLP scanning for chat message
    analyzeSpeechNLP(text, sender);
}

function appendWarningMessage(text) {
    const chatContainer = document.getElementById("chat-messages");
    const bubble = document.createElement("div");
    bubble.className = "message-bubble warning";
    bubble.innerHTML = `<p><i class="fa-solid fa-triangle-exclamation"></i> ${text}</p>`;
    chatContainer.appendChild(bubble);
    chatContainer.scrollTop = chatContainer.scrollHeight;
}

function receiveStrangerMessage(text) {
    const stranger = AppState.currentCall.stranger;
    appendMessage(stranger.name, text, true);
}

// Send user message
document.getElementById("btn-send-message").addEventListener("click", sendUserMessage);
document.getElementById("chat-input").addEventListener("keypress", (e) => {
    if (e.key === "Enter") sendUserMessage();
});

function sendUserMessage() {
    const input = document.getElementById("chat-input");
    const text = input.value.trim();
    if (!text) return;

    appendMessage(AppState.currentUser.nickname, text, false);

    if (AppState.dataConn && AppState.dataConn.open) {
        AppState.dataConn.send({
            type: 'chat',
            sender: AppState.currentUser.nickname,
            text: text
        });
    }

    input.value = "";
}

// --- SIMULATION TRIGGERS (TO SHOWCASE AI DETECTIONS) ---
function initSimulationTriggers() {
    const simToxic = document.getElementById("sim-toxic-speech");
    const simScam = document.getElementById("sim-scam-chat");
    const simNsfw = document.getElementById("sim-nsfw-image");
    const simReset = document.getElementById("sim-reset-safety");

    simToxic.addEventListener("click", () => {
        if (!AppState.currentCall.active) {
            showToast("Demo Trò chuyện", "Vui lòng ghép cặp và vào phòng để thử nghiệm mô phỏng.", "warning");
            return;
        }
        const strangerName = AppState.currentCall.stranger.name;
        // Mock remote speaker voice
        document.getElementById("live-speech-subtitle").textContent = `"${strangerName}: Đồ ngu này, cút đi con chó chết!"`;
        triggerSpeechSafetyViolation(strangerName, "Xúc phạm chửi rủa: ngu, chó, chết");
    });

    simScam.addEventListener("click", () => {
        if (!AppState.currentCall.active) {
            showToast("Demo Trò chuyện", "Vui lòng ghép cặp và vào phòng để thử nghiệm mô phỏng.", "warning");
            return;
        }
        const strangerName = AppState.currentCall.stranger.name;
        receiveStrangerMessage("Chào bạn, mình đang kẹt tiền đóng học quá, chuyển khoản gấp giúp mình 200k vào số tài khoản ngân hàng này với nha.");
    });

    simNsfw.addEventListener("click", () => {
        if (!AppState.currentCall.active) {
            showToast("Demo Trò chuyện", "Vui lòng ghép cặp và vào phòng để thử nghiệm mô phỏng.", "warning");
            return;
        }

        // Decrement safety
        AppState.currentCall.safetyScore = 10;
        AppState.currentCall.riskScore = 80;
        updateSafetyGauges();

        // Blur webcam
        blurVideoFeed("Mô hình Computer Vision (NSFW-JS) phát hiện hình ảnh khỏa thân / vũ khí nguy hại.");

        // Log incident
        const strangerName = AppState.currentCall.stranger.name;
        logIncident(strangerName, "image", "Computer Vision: Phát hiện hành vi chứa vũ khí / bạo lực hoặc khỏa thân", "98%", "Auto-Blur video feed");
        showToast("AI COMPUTER VISION ALERT", "Phát hiện hình ảnh nhạy cảm ở camera đối diện. Đã che màn hình.", "danger");
    });

    simReset.addEventListener("click", () => {
        if (!AppState.currentCall.active) return;
        resetSafetyState();
        resetBehaviorFlags();
        showToast("Khôi phục an toàn", "Đã xóa các cảnh báo, gỡ bỏ bộ lọc làm mờ màn hình camera.", "success");
    });

    // Romance scam simulation
    const simRomance = document.getElementById('sim-romance-scam');
    if (simRomance) {
        simRomance.addEventListener('click', () => {
            if (!AppState.currentCall.active) {
                showToast('Demo', 'Vui lòng ghép cặp và vào phòng trước.', 'warning');
                return;
            }
            const name = AppState.currentCall.stranger.name;
            receiveStrangerMessage('Em ơi, anh yêu em từ lần đầu nhìn thấy. Cho anh số zalo được không? Anh ở nước ngoài, muốn gửi quà cho em.');
        });
    }
}

function blurVideoFeed(reason) {
    const blurOverlay = document.getElementById("stranger-blur-overlay");
    const strangerVideo = document.getElementById("stranger-video");

    blurOverlay.style.display = "flex";
    strangerVideo.style.filter = "blur(50px)";
    document.getElementById("blur-warning-text").textContent = reason;
}

// --- LOGGING INCIDENTS IN STATE & SIDEBAR ---
function logIncident(user, type, desc, confidence, action) {
    const incident = {
        id: `INC-${Math.floor(Math.random() * 9000) + 1000}`,
        timestamp: new Date().toLocaleString('vi-VN'),
        user: user,
        type: type,
        desc: desc,
        confidence: confidence,
        status: "flagged"
    };

    // Save to App State
    AppState.incidents.unshift(incident);

    // Update Incidents Tab UI
    const logsList = document.getElementById("incident-logs-list");
    const emptyMsg = document.getElementById("empty-incidents-msg");
    if (emptyMsg) emptyMsg.remove();

    const typeIcons = {
        speech: "fa-volume-xmark",
        image: "fa-eye-slash",
        scam: "fa-money-bill-transfer",
        user_report: "fa-circle-exclamation",
        behavior_warning: "fa-user-slash"
    };

    const typeTitles = {
        speech: "Ngôn ngữ độc hại",
        image: "Hình ảnh nhạy cảm",
        scam: "Hành vi lừa đảo",
        user_report: "Báo cáo người dùng",
        behavior_warning: "Cảnh báo hành vi"
    };

    const item = document.createElement("div");
    item.className = "incident-item";
    item.innerHTML = `
        <div class="incident-item-icon">
            <i class="fa-solid ${typeIcons[type] || 'fa-shield-exclamation'}"></i>
        </div>
        <div class="incident-item-content">
            <div class="incident-item-title">${typeTitles[type]} (${confidence})</div>
            <div class="incident-item-desc"><strong>${user}:</strong> ${desc}</div>
            <div class="incident-item-desc text-danger">Hành động: ${action}</div>
            <span class="incident-item-time">${incident.timestamp}</span>
        </div>
    `;
    logsList.insertBefore(item, logsList.firstChild);

    // Update count in tab header
    const currentCount = parseInt(document.getElementById("incident-count").textContent) || 0;
    document.getElementById("incident-count").textContent = currentCount + 1;
}

// --- FEEDBACK & REPORTING FLOW ---
function initModals() {
    const triggers = document.querySelectorAll("[data-toggle='modal']");
    const closeBtns = document.querySelectorAll("[data-close]");

    triggers.forEach(btn => {
        btn.addEventListener("click", () => {
            const targetId = btn.getAttribute("data-target");
            openModal(targetId);
        });
    });

    closeBtns.forEach(btn => {
        btn.addEventListener("click", () => {
            const targetId = btn.getAttribute("data-close");
            closeModal(targetId);
        });
    });

    // Handle Report Chips Click Selection
    document.querySelectorAll(".report-chip").forEach(chip => {
        chip.addEventListener("click", function () {
            document.querySelectorAll(".report-chip").forEach(c => c.classList.remove("active"));
            this.classList.add("active");
            document.getElementById("selected-report-reason").value = this.getAttribute("data-reason");
        });
    });

    // Handle Report Form Submit
    const reportForm = document.getElementById("report-form");
    reportForm.addEventListener("submit", (e) => {
        e.preventDefault();
        const reason = document.getElementById("selected-report-reason").value;
        const stranger = AppState.currentCall.stranger;
        const reporter = AppState.currentUser.nickname;
        const strangerName = stranger ? stranger.name : "Stranger";

        // Collect 5 latest chat messages from the DOM
        const chatMsgElements = document.querySelectorAll("#chat-messages .message-bubble:not(.warning)");
        const chatLogs = Array.from(chatMsgElements).slice(-5).map(bubble => {
            const author = bubble.querySelector(".message-author")?.textContent || "Hệ thống";
            const text = bubble.querySelector(".chat-original-text")?.textContent || bubble.textContent.replace(author, "").trim();
            return `${author}: ${text}`;
        });

        // Capture evidence frame from the stranger-video or local-video element
        const canvasTemp = document.createElement("canvas");
        const videoEl = document.getElementById("stranger-video") || document.getElementById("local-video");
        let evidenceImage = "";
        if (videoEl && videoEl.readyState >= 2) {
            canvasTemp.width = videoEl.videoWidth || 320;
            canvasTemp.height = videoEl.videoHeight || 240;
            const ctxTemp = canvasTemp.getContext("2d");
            ctxTemp.drawImage(videoEl, 0, 0, canvasTemp.width, canvasTemp.height);
            evidenceImage = canvasTemp.toDataURL("image/jpeg", 0.7);
        }

        // Create Report Object
        const newReport = {
            id: 'REP-' + Date.now(),
            strangerName: strangerName,
            reason: reason,
            chatLogs: chatLogs,
            evidence: evidenceImage,
            riskScore: AppState.currentCall.riskScore,
            timestamp: new Date().toLocaleString('vi-VN')
        };

        // Save to AppState
        AppState.reports.unshift(newReport);
        renderSentReports();

        // Log to Admin Incidents Panel
        logIncident(
            strangerName,
            "user_report",
            `Báo cáo từ ${reporter}. Lý do: ${reason}. Risk score: ${AppState.currentCall.riskScore}%. Chat: ${chatLogs.join(' | ') || 'Không có'}`,
            "100%",
            "Admin Review Pending"
        );

        closeModal("report-modal");

        // Bypassing normal rating modal flow during reports
        AppState.bypassRatingModal = true;
        endCall();

        showToast("Báo cáo thành công", "Báo cáo đã được ghi nhận, đội kiểm duyệt sẽ xem xét trong 24h", "success");
        reportForm.reset();

        // Reset chips to default
        document.querySelectorAll(".report-chip").forEach(c => c.classList.remove("active"));
        const defaultChip = document.querySelector(".report-chip[data-reason='Nội dung nhạy cảm']");
        if (defaultChip) {
            defaultChip.classList.add("active");
            document.getElementById("selected-report-reason").value = "Nội dung nhạy cảm";
        }
    });

    // Handle Verification Account Submit
    const btnVerify = document.getElementById("btn-verify-account");
    btnVerify.addEventListener("click", () => {
        openModal("verify-modal");
    });

    const verifyForm = document.getElementById("verify-form");
    const otpGroup = document.getElementById("otp-group");
    const btnVerifySubmit = document.getElementById("btn-verify-submit");

    verifyForm.addEventListener("submit", (e) => {
        e.preventDefault();
        if (otpGroup.style.display === "none") {
            // Step 1: Send OTP
            otpGroup.style.display = "block";
            btnVerifySubmit.textContent = "Xác nhận OTP";
            showToast("SMS Verification", "Mã OTP đã được gửi đến số điện thoại của bạn.", "warning");
        } else {
            // Step 2: Verify OTP
            AppState.currentUser.verified = true;
            document.querySelector(".user-profile-badge").classList.add("verified");
            document.getElementById("btn-verify-account").innerHTML = `<i class="fa-solid fa-user-check"></i> Đã xác thực`;
            document.getElementById("btn-verify-account").disabled = true;
            document.getElementById("btn-verify-account").className = "btn-secondary btn-sm disabled";

            closeModal("verify-modal");
            showToast("Xác minh thành công", "Hồ sơ của bạn đã nhận được huy hiệu Verified an toàn.", "success");

            // Reset modal state
            otpGroup.style.display = "none";
            btnVerifySubmit.textContent = "Gửi mã OTP";
            verifyForm.reset();
        }
    });
}

function openModal(id) {
    document.getElementById(id).classList.add("active");
}

function closeModal(id) {
    document.getElementById(id).classList.remove("active");
}

// --- ADMIN DASHBOARD & CHARTS (Chart.js) ---
function initAdminPanel() {
    // Populate Initial Admin logs
    populateAdminTable();

    // Reset safety bypass click listener
    const bypassBtn = document.getElementById("btn-admin-bypass");
    bypassBtn.addEventListener("click", () => {
        resetSafetyState();
        showToast("Admin Action", "Đã ghi đè loại bỏ làm mờ camera.", "success");
    });

    // Filter logs
    document.getElementById("filter-incident-type").addEventListener("change", populateAdminTable);

    // Refresh button
    document.getElementById("btn-refresh-admin-logs").addEventListener("click", () => {
        populateAdminTable();
        showToast("Làm mới dữ liệu", "Đã cập nhật danh sách log vi phạm AI.", "success");
    });
}

async function populateAdminTable() {
    const tableBody = document.querySelector("#admin-incidents-table tbody");
    if (!tableBody) return;

    const filter = document.getElementById("filter-incident-type").value;
    tableBody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: var(--text-muted);">Đang tải dữ liệu...</td></tr>`;

    try {
        const res = await fetch('/api/admin/incidents');
        if (!res.ok) {
            const data = await res.json();
            tableBody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: var(--danger); font-weight: 500;">${data.error || "Không thể tải danh sách vi phạm."}</td></tr>`;
            return;
        }

        const { incidents, bannedCount } = await res.json();
        AppState.incidents = incidents;

        // Update Banned Count KPI
        const kpiBanned = document.getElementById("kpi-banned");
        if (kpiBanned) kpiBanned.textContent = bannedCount;

        const filtered = incidents.filter(inc => {
            if (filter === "all") return true;
            return inc.type === filter;
        });

        tableBody.innerHTML = "";
        if (filtered.length === 0) {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="7" style="text-align: center; color: var(--text-muted);">Không tìm thấy bản ghi nào.</td>
                </tr>
            `;
            return;
        }

        filtered.forEach(inc => {
            const tr = document.createElement("tr");

            let typeBadge = "";
            if (inc.type === "speech") typeBadge = `<span class="admin-badge-type badge-speech"><i class="fa-solid fa-volume-xmark"></i> Audio-Speech</span>`;
            else if (inc.type === "image") typeBadge = `<span class="admin-badge-type badge-image"><i class="fa-solid fa-eye-slash"></i> Vision-NSFW</span>`;
            else if (inc.type === "weapon") typeBadge = `<span class="admin-badge-type" style="background: rgba(239, 68, 68, 0.15); color: #ef4444;"><i class="fa-solid fa-gun"></i> Weapon / Violence</span>`;
            else if (inc.type === "scam") typeBadge = `<span class="admin-badge-type badge-scam"><i class="fa-solid fa-money-bill-transfer"></i> Phishing-Scam</span>`;
            else if (inc.type === "user_report") typeBadge = `<span class="admin-badge-type badge-report"><i class="fa-solid fa-circle-exclamation"></i> User Report</span>`;

            let statusBadge = inc.status === "flagged"
                ? `<span class="status-badge status-flagged"><span class="ping-dot" style="background:var(--danger)"></span> Flagged</span>`
                : `<span class="status-badge status-resolved"><i class="fa-solid fa-check"></i> Resolved</span>`;

            tr.innerHTML = `
                <td>${inc.timestamp}</td>
                <td><strong>${inc.user}</strong></td>
                <td>${typeBadge}</td>
                <td>${inc.desc}</td>
                <td><strong>${inc.confidence}</strong></td>
                <td>${statusBadge}</td>
                <td>
                    <div class="table-actions">
                        <button class="btn-primary btn-sm btn-action-resolve" data-id="${inc.id}"><i class="fa-solid fa-check"></i> Duyệt sạch</button>
                        <button class="btn-danger btn-sm btn-action-ban" data-user="${inc.user}"><i class="fa-solid fa-user-slash"></i> Ban User</button>
                    </div>
                </td>
            `;
            tableBody.appendChild(tr);
        });

        // Action listeners for resolve and ban
        document.querySelectorAll(".btn-action-resolve").forEach(btn => {
            btn.addEventListener("click", async () => {
                const id = btn.getAttribute("data-id");
                try {
                    const resResolve = await fetch('/api/admin/resolve', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ id })
                    });
                    if (resResolve.ok) {
                        populateAdminTable();
                        showToast("Admin Action", `Đã xử lý thông qua bản ghi ${id}.`, "success");
                    } else {
                        const errData = await resResolve.json();
                        showToast("Lỗi Admin", errData.error || "Không thể xử lý bản ghi.", "danger");
                    }
                } catch (e) {
                    showToast("Lỗi kết nối", "Lỗi gửi yêu cầu xử lý tới máy chủ.", "danger");
                }
            });
        });

        document.querySelectorAll(".btn-action-ban").forEach(btn => {
            btn.addEventListener("click", async () => {
                const username = btn.getAttribute("data-user");
                try {
                    const resBan = await fetch('/api/admin/ban', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ username })
                    });
                    if (resBan.ok) {
                        populateAdminTable();
                        showToast("Đã cấm người dùng", `Tài khoản ${username} đã bị khóa vĩnh viễn khỏi hệ thống SafeConnect.`, "danger");
                    } else {
                        const errData = await resBan.json();
                        showToast("Lỗi Admin", errData.error || "Không thể cấm người dùng.", "danger");
                    }
                } catch (e) {
                    showToast("Lỗi kết nối", "Lỗi gửi yêu cầu cấm tới máy chủ.", "danger");
                }
            });
        });

    } catch (e) {
        console.error(e);
        tableBody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: var(--danger);">Không thể kết nối với máy chủ admin.</td></tr>`;
    }
}

function renderAdminCharts() {
    const ctxTrend = document.getElementById("safetyTrendChart").getContext("2d");
    const ctxPie = document.getElementById("incidentPieChart").getContext("2d");

    // Destroy existing instances if present
    if (AppState.safetyTrendChart) AppState.safetyTrendChart.destroy();
    if (AppState.incidentPieChart) AppState.incidentPieChart.destroy();

    // Chart 1: Safety Trend Line Chart
    AppState.safetyTrendChart = new Chart(ctxTrend, {
        type: 'line',
        data: {
            labels: ['Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7', 'Chủ Nhật'],
            datasets: [
                {
                    label: 'Tỷ lệ cuộc gọi an toàn (%)',
                    data: [98.1, 98.4, 97.9, 98.2, 98.5, 99.1, 98.4],
                    borderColor: '#10b981',
                    backgroundColor: 'rgba(16, 185, 129, 0.05)',
                    tension: 0.4,
                    fill: true
                },
                {
                    label: 'Sự cố được AI ngăn chặn',
                    data: [42, 38, 55, 49, 62, 70, 48],
                    borderColor: '#3b82f6',
                    backgroundColor: 'rgba(59, 130, 246, 0.05)',
                    tension: 0.4,
                    fill: true
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    labels: { color: '#94a3b8', font: { family: 'Plus Jakarta Sans' } }
                }
            },
            scales: {
                x: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#94a3b8' } },
                y: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#94a3b8' } }
            }
        }
    });

    // Chart 2: Incident Pie
    AppState.incidentPieChart = new Chart(ctxPie, {
        type: 'doughnut',
        data: {
            labels: ['Speech Độc hại', 'Vision-NSFW', 'Lừa đảo/Scam', 'Romance Scam', 'Khác'],
            datasets: [{
                data: [35, 20, 18, 15, 12],
                backgroundColor: ['#f43f5e', '#ec4899', '#f59e0b', '#a78bfa', '#3b82f6'],
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: { color: '#94a3b8', boxWidth: 12, font: { family: 'Plus Jakarta Sans' } }
                }
            }
        }
    });

    // Chart 3: User Growth
    const ctxGrowth = document.getElementById('userGrowthChart');
    if (ctxGrowth) {
        if (AppState.userGrowthChart) AppState.userGrowthChart.destroy();
        AppState.userGrowthChart = new Chart(ctxGrowth.getContext('2d'), {
            type: 'bar',
            data: {
                labels: ['T1', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'],
                datasets: [
                    {
                        label: 'Người dùng mới',
                        data: [320, 450, 380, 520, 610, 580, 720],
                        backgroundColor: 'rgba(59, 130, 246, 0.6)',
                        borderRadius: 6
                    },
                    {
                        label: 'Quay lại (Retention)',
                        data: [180, 220, 200, 310, 350, 420, 480],
                        backgroundColor: 'rgba(16, 185, 129, 0.6)',
                        borderRadius: 6
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { labels: { color: '#94a3b8', font: { family: 'Plus Jakarta Sans' } } }
                },
                scales: {
                    x: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#94a3b8' } },
                    y: { grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: '#94a3b8' } }
                }
            }
        });
    }
}

// --- TOAST SYSTEMS ---
function showToast(title, message, type = "success") {
    const container = document.getElementById("toast-container");
    const toast = document.createElement("div");
    toast.className = `toast toast-${type}`;

    const icons = {
        success: "fa-circle-check",
        warning: "fa-triangle-exclamation",
        danger: "fa-shield-xmark"
    };

    toast.innerHTML = `
        <div class="toast-icon">
            <i class="fa-solid ${icons[type] || 'fa-bell'}"></i>
        </div>
        <div class="toast-body">
            <div class="toast-title">${title}</div>
            <div class="toast-message">${message}</div>
        </div>
    `;

    container.appendChild(toast);

    // Fade out after 4 seconds
    setTimeout(() => {
        toast.style.opacity = "0";
        toast.style.transform = "translateX(-20px)";
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

// --- CHAT TABS SWITCHER ---
const tabButtons = document.querySelectorAll(".tab-btn");
tabButtons.forEach(btn => {
    btn.addEventListener("click", () => {
        tabButtons.forEach(b => b.classList.remove("active"));
        btn.classList.add("active");

        const tabId = btn.getAttribute("data-tab");
        const contents = document.querySelectorAll(".tab-content");
        contents.forEach(c => c.classList.remove("active"));
        document.getElementById(tabId).classList.add("active");
    });
});

// --- BEHAVIORAL ANALYSIS HELPERS ---
function updateBehaviorUI(elementId, text, level) {
    const el = document.getElementById(elementId);
    if (!el) return;
    el.textContent = text;
    el.className = `behavior-value ${level}`;
}

function resetBehaviorFlags() {
    AppState.behaviorFlags = { personalInfo: 0, moneyRequest: 0, romanceScam: 0, messageCount: 0 };
    ['beh-personal-info', 'beh-money-request', 'beh-romance-scam'].forEach(id => {
        updateBehaviorUI(id, 'Chưa phát hiện', 'safe');
    });
    updateBehaviorUI('beh-speed-info', 'Bình thường', 'safe');
}

// --- AUTO-BAN CHECK ---
function checkAutoBan(username) {
    if (!AppState.reportCounts[username]) AppState.reportCounts[username] = 0;
    const userIncidents = AppState.incidents.filter(i => i.user === username && i.status === 'flagged');
    if (userIncidents.length >= 3) {
        AppState.bannedUsersCount++;
        document.getElementById('kpi-banned').textContent = AppState.bannedUsersCount;
        AppState.incidents = AppState.incidents.filter(i => i.user !== username);
        populateAdminTable();
        showToast('AUTO-BAN AI', `Tài khoản ${username} đã bị khóa tự động do ${userIncidents.length} vi phạm liên tiếp.`, 'danger');
        if (AppState.currentCall.active && AppState.currentCall.stranger && AppState.currentCall.stranger.name === username) {
            blurVideoFeed(`Tài khoản ${username} đã bị AI tự động cấm.`);
        }
    }
}

// --- POST-CALL RATING MODAL ---
function initRatingModal() {
    const stars = document.querySelectorAll('#star-rating i');
    const labels = ['Rất tệ', 'Tệ', 'Bình thường', 'Tốt', 'Tuyệt vời'];

    stars.forEach(star => {
        star.addEventListener('click', () => {
            const val = parseInt(star.getAttribute('data-star'));
            AppState.selectedRating = val;
            stars.forEach(s => {
                s.classList.toggle('active', parseInt(s.getAttribute('data-star')) <= val);
            });
            document.getElementById('rating-label').textContent = labels[val - 1];
        });
        star.addEventListener('mouseenter', () => {
            const val = parseInt(star.getAttribute('data-star'));
            stars.forEach(s => {
                s.classList.toggle('active', parseInt(s.getAttribute('data-star')) <= val);
            });
        });
        star.addEventListener('mouseleave', () => {
            stars.forEach(s => {
                s.classList.toggle('active', parseInt(s.getAttribute('data-star')) <= AppState.selectedRating);
            });
        });
    });

    const ratingTags = document.querySelectorAll('.rating-tag');
    ratingTags.forEach(tag => {
        tag.addEventListener('click', () => {
            tag.classList.toggle('active');
            const val = tag.getAttribute('data-tag');
            if (tag.classList.contains('active')) {
                AppState.selectedRatingTags.push(val);
            } else {
                AppState.selectedRatingTags = AppState.selectedRatingTags.filter(t => t !== val);
            }
        });
    });

    // Like/Dislike feedback button handlers
    const btnFeedbackLike = document.getElementById('btn-feedback-like');
    const btnFeedbackDislike = document.getElementById('btn-feedback-dislike');

    if (btnFeedbackLike && btnFeedbackDislike) {
        btnFeedbackLike.addEventListener('click', () => {
            AppState.selectedFeedback = 'like';
            btnFeedbackLike.classList.add('active');
            btnFeedbackDislike.classList.remove('active');
        });

        btnFeedbackDislike.addEventListener('click', () => {
            AppState.selectedFeedback = 'dislike';
            btnFeedbackDislike.classList.add('active');
            btnFeedbackLike.classList.remove('active');
        });
    }

    document.getElementById('btn-submit-rating').addEventListener('click', () => {
        // Record to interactionHistory for AI Smart Recommendation matching
        if (AppState.currentCall.stranger) {
            const stranger = AppState.currentCall.stranger;
            const interactionEntry = {
                name: stranger.name,
                interests: [...(stranger.interests || [])],
                location: stranger.location || "",
                duration: AppState.currentCall.duration,
                rating: AppState.selectedFeedback || 'like' // Default to like
            };
            AppState.interactionHistory.push(interactionEntry);
            console.log("[AI Matcher] Recorded interaction history:", interactionEntry);
        }

        if (AppState.callHistory.length > 0) {
            AppState.callHistory[0].rating = AppState.selectedRating;
            AppState.callHistory[0].tags = [...AppState.selectedRatingTags];
            AppState.callHistory[0].feedback = AppState.selectedFeedback || 'like';
            renderCallHistory();
        }
        closeModal('rating-modal');
        showToast('Cảm ơn bạn!', `Đánh giá của bạn đã được ghi nhận thành công.`, 'success');

        // Reset
        AppState.selectedRating = 0;
        AppState.selectedRatingTags = [];
        AppState.selectedFeedback = null;
        document.querySelectorAll('#star-rating i').forEach(s => s.classList.remove('active'));
        document.querySelectorAll('.rating-tag').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.btn-feedback').forEach(btn => btn.classList.remove('active'));
        document.getElementById('rating-label').textContent = 'Chọn số sao';

        // Go home
        document.getElementById('chat-section').classList.remove('active');
        document.getElementById('portal-section').classList.add('active');
        document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
        document.querySelector("[data-target='portal-section']").classList.add('active');
    });
}

// --- CALL HISTORY ---
function initCallHistory() {
    document.getElementById('btn-clear-history').addEventListener('click', () => {
        AppState.callHistory = [];
        renderCallHistory();
        showToast('Lịch sử', 'Đã xóa toàn bộ lịch sử cuộc gọi.', 'success');
    });
}

function renderCallHistory() {
    const list = document.getElementById('call-history-list');
    if (!list) return;

    if (AppState.callHistory.length === 0) {
        list.innerHTML = `<div class="empty-history"><i class="fa-solid fa-clock-rotate-left"></i><p>Chưa có cuộc gọi nào.</p></div>`;
        return;
    }
    list.innerHTML = '';
    AppState.callHistory.forEach(call => {
        const mins = String(Math.floor(call.duration / 60)).padStart(2, '0');
        const secs = String(call.duration % 60).padStart(2, '0');
        let starsHtml = '';
        for (let i = 1; i <= 5; i++) {
            starsHtml += `<i class="fa-solid fa-star ${i <= call.rating ? '' : 'dim'}"></i>`;
        }
        const safetyClass = call.safetyScore > 70 ? 'safe' : 'risky';
        const safetyLabel = call.safetyScore > 70 ? 'An toàn' : 'Rủi ro';

        const item = document.createElement('div');
        item.className = 'history-item';
        item.innerHTML = `
            <img class="history-avatar" src="${call.stranger.avatar}" alt="">
            <div class="history-info">
                <div class="history-name">${call.stranger.name} (${call.stranger.age}, ${call.stranger.location})</div>
                <div class="history-meta">
                    <span><i class="fa-solid fa-clock"></i> ${mins}:${secs}</span>
                    <span><i class="fa-solid fa-calendar"></i> ${call.timestamp}</span>
                    <span class="history-rating">${starsHtml}</span>
                </div>
            </div>
            <span class="history-safety-badge ${safetyClass}"><i class="fa-solid fa-shield"></i> ${safetyLabel} (${call.safetyScore}%)</span>
        `;
        list.appendChild(item);
    });
}

function renderSentReports() {
    const listContainer = document.getElementById("sent-reports-list");
    if (!listContainer) return;

    if (AppState.reports.length === 0) {
        listContainer.innerHTML = `
            <div class="empty-history" style="padding: 30px; text-align: center; color: var(--text-muted);">
                <i class="fa-solid fa-flag" style="font-size: 24px; margin-bottom: 10px; display: block; opacity: 0.5;"></i>
                <p>Bạn chưa gửi báo cáo vi phạm nào.</p>
            </div>
        `;
        return;
    }

    listContainer.innerHTML = AppState.reports.map(rep => {
        const chatLogsHtml = rep.chatLogs.length > 0
            ? `<div style="background: rgba(0,0,0,0.2); padding: 8px; border-radius: 6px; font-size: 11px; margin-top: 8px; border: 1px solid rgba(255,255,255,0.05);">
                 <strong style="color: var(--text-muted); display:block; margin-bottom:4px;"><i class="fa-solid fa-comments"></i> 5 Tin nhắn gần nhất:</strong>
                 ${rep.chatLogs.map(m => `<div style="margin-bottom:2px; color: var(--text-normal);">${m}</div>`).join('')}
               </div>`
            : '';

        const evidenceHtml = rep.evidence
            ? `<div style="margin-top: 8px;">
                 <strong style="color: var(--text-muted); display:block; margin-bottom:4px; font-size: 11px;"><i class="fa-solid fa-image"></i> Bằng chứng hình ảnh:</strong>
                 <img src="${rep.evidence}" style="width: 120px; border-radius: 6px; border: 1px solid rgba(255,255,255,0.15); display: block;" alt="Evidence Frame">
               </div>`
            : '';

        return `
            <div class="history-item" style="display: flex; flex-direction: column; padding: 12px; background: rgba(255,255,255,0.03); border-radius: 8px; border: 1px solid rgba(255,255,255,0.06); margin-bottom: 10px;">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <span style="font-size: 13px; font-weight: 700; color: #ef4444;"><i class="fa-solid fa-triangle-exclamation"></i> ${rep.reason}</span>
                        <span style="font-size: 11px; color: var(--text-muted);">đối tượng: <strong>${rep.strangerName}</strong></span>
                    </div>
                    <span style="font-size: 11px; color: var(--text-muted);">${rep.timestamp}</span>
                </div>
                <div style="font-size: 12px; color: var(--text-normal); margin-top: 6px;">
                    Risk Score tại thời điểm báo cáo: <strong style="color: ${rep.riskScore > 50 ? '#ef4444' : '#f59e0b'}">${rep.riskScore}%</strong>
                </div>
                ${chatLogsHtml}
                ${evidenceHtml}
            </div>
        `;
    }).join('');
}

// --- BLOCK USER ---
function initBlockUser() {
    document.getElementById('btn-block-user').addEventListener('click', () => {
        if (!AppState.currentCall.active || !AppState.currentCall.stranger) {
            showToast('Block', 'Không có đối tác để chặn.', 'warning');
            return;
        }
        const stranger = AppState.currentCall.stranger;
        if (AppState.blockedUsers.find(u => u.name === stranger.name)) {
            showToast('Block', `${stranger.name} đã bị chặn trước đó.`, 'warning');
            return;
        }
        AppState.blockedUsers.push({ ...stranger, blockedAt: new Date().toLocaleString('vi-VN') });
        renderBlockedUsers();
        showToast('Đã chặn', `${stranger.name} đã bị chặn. Bạn sẽ không bị ghép cặp với người này nữa.`, 'success');
        endCall();
    });
}

function renderBlockedUsers() {
    const list = document.getElementById('blocked-users-list');
    if (!list) return;
    if (AppState.blockedUsers.length === 0) {
        list.innerHTML = `<div class="empty-history"><i class="fa-solid fa-user-check"></i><p>Bạn chưa chặn ai.</p></div>`;
        return;
    }
    list.innerHTML = '';
    AppState.blockedUsers.forEach((u, idx) => {
        const item = document.createElement('div');
        item.className = 'blocked-item';
        item.innerHTML = `
            <img class="history-avatar" src="${u.avatar}" alt="">
            <div class="history-info">
                <div class="history-name">${u.name}</div>
                <div class="history-meta"><span><i class="fa-solid fa-ban"></i> Chặn lúc: ${u.blockedAt}</span></div>
            </div>
            <button class="btn-secondary btn-sm btn-unblock" data-idx="${idx}"><i class="fa-solid fa-unlock"></i> Bỏ chặn</button>
        `;
        list.appendChild(item);
    });
    list.querySelectorAll('.btn-unblock').forEach(btn => {
        btn.addEventListener('click', () => {
            const idx = parseInt(btn.getAttribute('data-idx'));
            const name = AppState.blockedUsers[idx].name;
            AppState.blockedUsers.splice(idx, 1);
            renderBlockedUsers();
            showToast('Bỏ chặn', `Đã bỏ chặn ${name}.`, 'success');
        });
    });
}

// --- SETTINGS MODAL ---
function initSettingsModal() {
    const targetLangSelect = document.getElementById('setting-target-language');
    if (targetLangSelect) {
        targetLangSelect.value = AppState.currentUser.targetLanguage;
    }

    document.getElementById('btn-open-settings').addEventListener('click', () => {
        if (targetLangSelect) {
            targetLangSelect.value = AppState.currentUser.targetLanguage;
        }
        openModal('settings-modal');
    });

    const langSelect = document.getElementById('setting-language');
    if (langSelect) {
        langSelect.addEventListener('change', function () {
            const selectedLang = this.value;
            showToast('Ngôn ngữ AI', `Đã chuyển ngôn ngữ nhận diện sang: ${langSelect.options[langSelect.selectedIndex].text}`, 'success');

            if (AppState.currentCall.speechRecognition) {
                const wasRecognizing = AppState.currentCall.isSpeechRecognizing;
                AppState.currentCall.speechRecognition.lang = selectedLang;
                console.log("Speech recognition language updated to:", selectedLang);

                if (wasRecognizing) {
                    AppState.currentCall.speechRecognition.stop();
                }
            }
        });
    }

    if (targetLangSelect) {
        targetLangSelect.addEventListener('change', function () {
            AppState.currentUser.targetLanguage = this.value;
            showToast('Dịch thuật', `Đã chuyển ngôn ngữ dịch đích sang: ${targetLangSelect.options[targetLangSelect.selectedIndex].text}`, 'success');
        });
    }

    const chkEnableTranslation = document.getElementById('chk-enable-translation');
    if (chkEnableTranslation) {
        chkEnableTranslation.checked = AppState.enableTranslation;

        chkEnableTranslation.addEventListener('change', function () {
            AppState.enableTranslation = this.checked;
            const transSubtitle = document.getElementById('live-translation-subtitle');
            if (transSubtitle) {
                if (AppState.enableTranslation) {
                    transSubtitle.style.display = "block";
                } else {
                    transSubtitle.style.display = "none";
                }
            }
            showToast('Dịch thuật', AppState.enableTranslation ? "Đã BẬT tự động dịch." : "Đã TẮT tự động dịch.", "success");
        });
    }

    const chkNsfw = document.getElementById('setting-nsfw-detection');
    if (chkNsfw) {
        chkNsfw.checked = AppState.enableNsfwDetection;

        chkNsfw.addEventListener('change', function () {
            AppState.enableNsfwDetection = this.checked;
            showToast('AI Shield', AppState.enableNsfwDetection ? "Đã BẬT tự động phát hiện ảnh nhạy cảm." : "Đã TẮT tự động phát hiện ảnh nhạy cảm.", "success");

            if (AppState.currentCall.active) {
                if (AppState.enableNsfwDetection) {
                    startNsfwDetection();
                } else {
                    stopNsfwDetection();
                }
            }
        });
    }
}

// --- CALL TYPE TOGGLE ---
function initCallTypeToggle() {
    const btns = document.querySelectorAll('.call-type-btn');
    btns.forEach(btn => {
        btn.addEventListener('click', () => {
            btns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            AppState.callType = btn.getAttribute('data-type');
            showToast('Chế độ gọi', AppState.callType === 'group' ? 'Đã chuyển sang nhóm (2-4 người)' : 'Đã chuyển sang 1-1', 'success');
        });
    });
}

// --- ONLINE COUNTER SIMULATION ---
function initOnlineCounter() {
    setInterval(() => {
        const el = document.getElementById('online-count');
        if (!el) return;
        const base = 2847;
        const variation = Math.floor(Math.random() * 200) - 100;
        el.textContent = (base + variation).toLocaleString();
    }, 5000);
}

// --- SCREENSHOT PREVENTION ---
function initScreenshotPrevention() {
    document.addEventListener('keyup', (e) => {
        if (e.key === 'PrintScreen' || (e.ctrlKey && e.key === 'p')) {
            if (AppState.currentCall.active && document.getElementById('setting-screenshot')?.checked) {
                showToast('⚠️ Screenshot Detected', 'Hệ thống phát hiện hành vi chụp màn hình. Đối tác sẽ được thông báo.', 'warning');
            }
        }
    });
}

// --- CRITICAL ALERT SCROLL ---
document.addEventListener('DOMContentLoaded', () => {
    const scrollBtn = document.getElementById('btn-scroll-to-incidents');
    if (scrollBtn) {
        scrollBtn.addEventListener('click', () => {
            const table = document.getElementById('admin-incidents-table');
            if (table) table.scrollIntoView({ behavior: 'smooth' });
        });
    }
});

// --- LOUNGE SYSTEM ---
function initLoungeSystem() {
    const searchInput = document.getElementById("lounge-search-input");
    const filterGender = document.getElementById("lounge-filter-gender");
    const filterLocation = document.getElementById("lounge-filter-location");
    const loungeLink = document.getElementById("nav-lounge-link");

    if (searchInput) searchInput.addEventListener("input", renderLoungeProfiles);
    if (filterGender) filterGender.addEventListener("change", renderLoungeProfiles);
    if (filterLocation) filterLocation.addEventListener("change", renderLoungeProfiles);

    if (loungeLink) {
        loungeLink.addEventListener("click", () => {
            renderLoungeProfiles();
        });
    }

    renderLoungeProfiles();
}

function renderLoungeProfiles() {
    const grid = document.getElementById("lounge-profiles-grid");
    if (!grid) return;

    grid.innerHTML = `
        <div class="glass-card" style="grid-column: 1 / -1; padding: 40px; text-align: center; color: var(--text-muted); border: 1px dashed var(--border-color);">
            <i class="fa-solid fa-folder-open" style="font-size: 40px; margin-bottom: 15px; color: var(--primary);"></i>
            <p>Chưa có dữ liệu người dùng thực đang trực tuyến để hiển thị tại Lounge.</p>
        </div>
    `;
}

// --- SECURE SERVER AUTHENTICATION SYSTEM ---
function initAuthSystem() {
    // 1. Initial session check
    checkSession();

    // 2. Auth Modal Bindings
    const authTrigger = document.getElementById("btn-auth-trigger");
    if (authTrigger) {
        authTrigger.addEventListener("click", () => {
            openModal("auth-modal");
        });
    }

    const logoutBtn = document.getElementById("btn-logout");
    if (logoutBtn) {
        logoutBtn.addEventListener("click", handleLogout);
    }

    // Modal tabs toggle
    const btnTabLogin = document.getElementById("btn-tab-login");
    const btnTabRegister = document.getElementById("btn-tab-register");
    const loginForm = document.getElementById("auth-login-form");
    const registerForm = document.getElementById("auth-register-form");

    if (btnTabLogin && btnTabRegister && loginForm && registerForm) {
        btnTabLogin.addEventListener("click", () => {
            btnTabLogin.classList.add("active");
            btnTabLogin.style.borderBottom = "2px solid var(--primary)";
            btnTabLogin.style.color = "var(--text-normal)";
            btnTabRegister.classList.remove("active");
            btnTabRegister.style.borderBottom = "none";
            btnTabRegister.style.color = "var(--text-muted)";

            loginForm.style.display = "block";
            registerForm.style.display = "none";
        });

        btnTabRegister.addEventListener("click", () => {
            btnTabRegister.classList.add("active");
            btnTabRegister.style.borderBottom = "2px solid var(--primary)";
            btnTabRegister.style.color = "var(--text-normal)";
            btnTabLogin.classList.remove("active");
            btnTabLogin.style.borderBottom = "none";
            btnTabLogin.style.color = "var(--text-muted)";

            registerForm.style.display = "block";
            loginForm.style.display = "none";
        });
    }

    // Form Submission: Login
    if (loginForm) {
        loginForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            const username = document.getElementById("login-username").value.trim();
            const password = document.getElementById("login-password").value;

            try {
                console.log('[AUTH] Đang gửi request đăng nhập...');
                const res = await fetch('/api/login', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username, password })
                });

                console.log('[AUTH] Response status:', res.status, res.statusText);
                console.log('[AUTH] Content-Type:', res.headers.get('content-type'));

                // Kiểm tra nếu response không phải JSON
                const contentType = res.headers.get('content-type') || '';
                if (!contentType.includes('application/json')) {
                    const rawText = await res.text();
                    console.error('[AUTH] Server trả về HTML thay vì JSON! Node.js có thể chưa chạy.');
                    console.error('[AUTH] Nội dung phản hồi (200 ký tự đầu):', rawText.substring(0, 200));
                    showToast(
                        "Lỗi kết nối — Server không phản hồi đúng",
                        `Server trả về ${res.status} ${res.statusText} (${contentType || 'không rõ loại'}). ` +
                        `Node.js có thể chưa chạy hoặc hosting chưa proxy đúng. ` +
                        `Phản hồi: ${rawText.substring(0, 80)}`,
                        "danger"
                    );
                    return;
                }

                const data = await res.json();
                if (res.ok) {
                    AppState.currentUser = data.user;
                    updateUIForAuth();
                    closeModal("auth-modal");
                    showToast("Đăng nhập thành công", `Chào mừng trở lại, ${data.user.nickname}!`, "success");
                    loginForm.reset();
                } else {
                    showToast("Đăng nhập thất bại", data.error || "Tên đăng nhập hoặc mật khẩu không chính xác.", "danger");
                }
            } catch (err) {
                console.error("Login fetch error:", err);
                showToast("Lỗi kết nối", "Không thể liên lạc với máy chủ xác thực. Chi tiết: " + err.message, "danger");
            }
        });
    }

    // Form Submission: Register
    if (registerForm) {
        registerForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            const username = document.getElementById("register-username").value.trim();
            const nickname = document.getElementById("register-nickname").value.trim();
            const password = document.getElementById("register-password").value;
            const age = parseInt(document.getElementById("register-age").value, 10);
            const gender = document.getElementById("register-gender").value;
            const location = document.getElementById("register-location").value;
            const role = document.getElementById("register-role").value;

            if (password.length < 6) {
                showToast("Mật khẩu yếu", "Mật khẩu phải chứa ít nhất 6 ký tự.", "warning");
                return;
            }

            try {
                const res = await fetch('/api/register', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username, nickname, password, age, gender, location, role })
                });
                const data = await res.json();
                if (res.ok) {
                    AppState.currentUser = data.user;
                    updateUIForAuth();
                    closeModal("auth-modal");
                    showToast("Đăng ký thành công", `Tài khoản ${data.user.username} đã được kích hoạt.`, "success");
                    registerForm.reset();
                } else {
                    showToast("Đăng ký thất bại", data.error || "Tên đăng nhập đã được sử dụng.", "danger");
                }
            } catch (err) {
                console.error("Register fetch error:", err);
                showToast("Lỗi kết nối", "Không thể liên lạc với máy chủ xác thực. Chi tiết: " + err.message, "danger");
            }
        });
    }
}

async function checkSession() {
    try {
        console.log('[AUTH] Kiểm tra phiên đăng nhập...');
        const res = await fetch('/api/session');
        console.log('[AUTH] /api/session status:', res.status, '| Content-Type:', res.headers.get('content-type'));

        const contentType = res.headers.get('content-type') || '';
        if (!contentType.includes('application/json')) {
            const rawText = await res.text();
            console.error('[AUTH] /api/session không trả về JSON! Node.js chưa chạy hoặc chưa proxy.');
            console.error('[AUTH] Phản hồi thực tế:', rawText.substring(0, 300));
            AppState.currentUser = null;
            updateUIForGuest();
            return;
        }

        const data = await res.json();
        if (data.user) {
            AppState.currentUser = data.user;
            updateUIForAuth();
        } else {
            AppState.currentUser = null;
            updateUIForGuest();
        }
    } catch (e) {
        console.error('[AUTH] Lỗi checkSession:', e.message);
        AppState.currentUser = null;
        updateUIForGuest();
    }
}

function updateUIForAuth() {
    const authTrigger = document.getElementById("btn-auth-trigger");
    const userBadge = document.getElementById("current-user-badge");
    const headerUsername = document.getElementById("header-username");
    const headerAvatar = document.getElementById("header-avatar");
    const headerRole = document.getElementById("header-role-badge");
    const navAdminLink = document.getElementById("nav-admin-link");

    if (authTrigger) authTrigger.style.display = "none";
    if (userBadge) userBadge.style.display = "flex";
    if (headerUsername) headerUsername.textContent = AppState.currentUser.nickname;
    if (headerAvatar) headerAvatar.src = AppState.currentUser.avatar;
    
    if (headerRole) {
        headerRole.textContent = AppState.currentUser.role === 'admin' ? 'ADMIN' : 'USER';
        headerRole.style.background = AppState.currentUser.role === 'admin' ? 'rgba(239,68,68,0.2)' : 'rgba(59,130,246,0.2)';
        headerRole.style.color = AppState.currentUser.role === 'admin' ? '#f87171' : '#60a5fa';
    }

    if (navAdminLink) {
        if (AppState.currentUser.role === 'admin') {
            navAdminLink.style.display = "inline-flex";
        } else {
            navAdminLink.style.display = "none";
            // If user is currently in admin-section but doesn't have permission anymore, force go to portal
            const activeSec = document.querySelector(".app-section.active");
            if (activeSec && activeSec.id === "admin-section") {
                document.querySelector('.nav-item[data-target="portal-section"]')?.click();
            }
        }
    }

    // Show profile nav link
    const navProfileLink = document.getElementById("nav-profile-link");
    if (navProfileLink) navProfileLink.style.display = "inline-flex";

    // Refresh wallet
    updateCoinUI();
    renderTransactionHistory();
}

function updateUIForGuest() {
    const authTrigger = document.getElementById("btn-auth-trigger");
    const userBadge = document.getElementById("current-user-badge");
    const navAdminLink = document.getElementById("nav-admin-link");

    if (authTrigger) authTrigger.style.display = "inline-block";
    if (userBadge) userBadge.style.display = "none";
    if (navAdminLink) navAdminLink.style.display = "none";

    // Hide profile nav link
    const navProfileLink = document.getElementById("nav-profile-link");
    if (navProfileLink) navProfileLink.style.display = "none";

    // If guest is currently in admin-section, force go to portal
    const activeSec = document.querySelector(".app-section.active");
    if (activeSec && activeSec.id === "admin-section") {
        document.querySelector('.nav-item[data-target="portal-section"]')?.click();
    }

    // Set guest balance UI
    const headerBal = document.getElementById("header-coin-balance");
    const modalBal = document.getElementById("modal-coin-balance");
    if (headerBal) headerBal.textContent = "0";
    if (modalBal) modalBal.textContent = "0";

    const list = document.getElementById("coin-transactions-list");
    if (list) {
        list.innerHTML = `
            <div class="empty-transactions" style="text-align: center; padding: 24px; color: var(--text-muted); font-size: 12px;">
                <p>Vui lòng đăng nhập để xem lịch sử.</p>
            </div>
        `;
    }
}

async function handleLogout() {
    try {
        const res = await fetch('/api/logout', { method: 'POST' });
        if (res.ok) {
            AppState.currentUser = null;
            updateUIForGuest();
            showToast("Đã đăng xuất", "Tài khoản của bạn đã được đăng xuất an toàn.", "info");

            // Redirect back to home/portal if currently on admin panel
            const activeSection = document.querySelector(".app-section.active");
            if (activeSection && activeSection.id === "admin-section") {
                document.querySelectorAll(".nav-item").forEach(nav => nav.classList.remove("active"));
                const portalNav = document.querySelector("[data-target='portal-section']");
                if (portalNav) portalNav.classList.add("active");

                document.querySelectorAll(".app-section").forEach(sec => sec.classList.remove("active"));
                const portalSec = document.getElementById("portal-section");
                if (portalSec) portalSec.classList.add("active");
            }
        }
    } catch (e) {
        showToast("Lỗi đăng xuất", "Đã xảy ra lỗi khi đăng xuất.", "danger");
    }
}

// --- ADMIN EXTRA FORUM & USER BLACKLIST CONTROLS ---

async function populateAdminForumTable() {
    const tableBody = document.getElementById("admin-forum-table-body");
    const badge = document.getElementById("admin-video-count-badge");
    if (!tableBody) return;

    try {
        const res = await fetch('/api/forum/videos');
        if (!res.ok) throw new Error("Failed to fetch forum videos");
        const videos = await res.json();
        
        if (badge) badge.textContent = `${videos.length} video`;

        if (videos.length === 0) {
            tableBody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--text-muted); padding: 20px;">Chưa có video nào trên diễn đàn.</td></tr>`;
            return;
        }

        tableBody.innerHTML = videos.map(v => `
            <tr>
                <td style="font-family: monospace; font-size: 11px;">#${v.id}</td>
                <td>
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <img src="https://api.dicebear.com/7.x/bottts/svg?seed=${v.seed}" style="width: 24px; height: 24px; border-radius: 50%;">
                        <span>${v.author}</span>
                    </div>
                </td>
                <td><span class="active-badge" style="background: rgba(168, 85, 247, 0.15); color: #c084fc; font-size: 10px; padding: 2px 6px;">${v.topic}</span></td>
                <td style="max-width: 150px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${v.title}">${v.title}</td>
                <td style="font-size: 11px; color: var(--text-muted);"><i class="fa-solid fa-heart" style="color:#f43f5e;"></i> ${v.likes} | <i class="fa-solid fa-comment" style="color:#60a5fa;"></i> ${v.comments}</td>
                <td>
                    <button class="btn-danger btn-sm" onclick="adminDeleteVideo(${v.id})" style="padding: 4px 8px; font-size: 11px;"><i class="fa-solid fa-trash"></i> Xóa</button>
                </td>
            </tr>
        `).join('');
    } catch (e) {
        console.error("[Admin] Lỗi tải video diễn đàn:", e);
        tableBody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: #f87171; padding: 20px;">Lỗi tải dữ liệu.</td></tr>`;
    }
}

async function populateAdminBlacklist() {
    const container = document.getElementById("admin-blacklist-container");
    const countEl = document.getElementById("admin-banned-count");
    if (!container) return;

    try {
        const res = await fetch('/api/admin/banned-users');
        if (!res.ok) throw new Error("Failed to fetch banned users");
        const data = await res.json();
        const banned = data.banned || [];

        if (countEl) countEl.textContent = banned.length;

        if (banned.length === 0) {
            container.innerHTML = `<div style="text-align: center; color: var(--text-muted); font-size: 12px; padding: 20px;">Không có tài khoản nào bị cấm.</div>`;
            return;
        }

        container.innerHTML = banned.map(username => `
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 6px 10px; background: rgba(239, 68, 68, 0.08); border: 1px solid rgba(239, 68, 68, 0.15); border-radius: 6px; margin-bottom: 6px;">
                <div style="display: flex; align-items: center; gap: 8px;">
                    <i class="fa-solid fa-user-slash" style="color: #ef4444; font-size: 11px;"></i>
                    <strong style="font-size: 12px; color: var(--text-normal);">${username}</strong>
                </div>
                <button class="btn-secondary btn-sm" onclick="adminUnbanUser('${username}')" style="padding: 2px 8px; font-size: 10px; background: rgba(16, 185, 129, 0.15); color: #10b981; border-color: rgba(16, 185, 129, 0.25);"><i class="fa-solid fa-user-check"></i> Bỏ cấm</button>
            </div>
        `).join('');
    } catch (e) {
        console.error("[Admin] Lỗi tải blacklist:", e);
        container.innerHTML = `<div style="text-align: center; color: #f87171; font-size: 12px; padding: 10px;">Lỗi tải dữ liệu.</div>`;
    }
}

async function adminDeleteVideo(videoId) {
    if (!confirm(`Bạn có chắc chắn muốn xóa video #${videoId} khỏi diễn đàn?`)) return;

    try {
        const res = await fetch('/api/admin/delete-video', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ videoId })
        });
        const data = await res.json();
        if (res.ok) {
            showToast("Thành công", "Đã xóa video khỏi diễn đàn.", "success");
            populateAdminForumTable();
            // Nếu forum.js đang hiển thị feed, hãy tải lại feed
            if (typeof loadVideosFromServer === 'function') {
                loadVideosFromServer();
            }
        } else {
            showToast("Lỗi", data.error || "Không thể xóa video.", "danger");
        }
    } catch (e) {
        showToast("Lỗi kết nối", "Không thể liên lạc với máy chủ.", "danger");
    }
}

async function adminBanUser(username) {
    if (!username) {
        showToast("Lỗi", "Vui lòng nhập tên đăng nhập cần cấm.", "warning");
        return;
    }
    if (AppState.currentUser && AppState.currentUser.username === username) {
        showToast("Lỗi", "Bạn không thể tự cấm chính mình!", "warning");
        return;
    }
    if (!confirm(`Bạn chắc chắn muốn CẤM tài khoản "${username}"? Tài khoản này sẽ không thể đăng nhập nữa.`)) return;

    try {
        const res = await fetch('/api/admin/ban', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username })
        });
        const data = await res.json();
        if (res.ok) {
            showToast("Đã cấm user", `Tài khoản ${username} đã được đưa vào blacklist.`, "success");
            const banInput = document.getElementById("admin-ban-username");
            if (banInput) banInput.value = "";
            populateAdminBlacklist();
            // Cập nhật số liệu trên KPI
            const kpiBanned = document.getElementById("kpi-banned");
            if (kpiBanned) kpiBanned.textContent = data.bannedCount;
        } else {
            showToast("Lỗi", data.error || "Không thể cấm tài khoản này.", "danger");
        }
    } catch (e) {
        showToast("Lỗi kết nối", "Không thể thực hiện thao tác cấm.", "danger");
    }
}

async function adminUnbanUser(username) {
    if (!username) return;
    if (!confirm(`Bạn chắc chắn muốn GỠ CẤM cho tài khoản "${username}"?`)) return;

    try {
        const res = await fetch('/api/admin/unban', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username })
        });
        const data = await res.json();
        if (res.ok) {
            showToast("Đã gỡ cấm", `Tài khoản ${username} đã có thể đăng nhập bình thường.`, "success");
            populateAdminBlacklist();
            // Cập nhật số liệu trên KPI
            const kpiBanned = document.getElementById("kpi-banned");
            if (kpiBanned) kpiBanned.textContent = data.bannedCount;
        } else {
            showToast("Lỗi", data.error || "Không thể gỡ cấm.", "danger");
        }
    } catch (e) {
        showToast("Lỗi kết nối", "Không thể thực hiện thao tác.", "danger");
    }
}

// ========== ADMIN USER MANAGEMENT ==========
const AdminUsersState = {
    users: [],
    searchQuery: '',
    roleFilter: 'all'
};

async function loadAdminUsers() {
    const tableBody = document.getElementById("admin-users-table-body");
    if (!tableBody) return;

    try {
        const res = await fetch('/api/admin/users');
        if (!res.ok) throw new Error("Không thể tải danh sách người dùng");
        const data = await res.json();
        AdminUsersState.users = data.users || [];

        // Cập nhật số liệu thật lên KPI Quản trị
        const kpiUsers = document.getElementById("kpi-users");
        if (kpiUsers) kpiUsers.textContent = (data.total || 0).toLocaleString();
        const kpiBanned = document.getElementById("kpi-banned");
        if (kpiBanned && data.bannedCount !== undefined) kpiBanned.textContent = data.bannedCount;

        renderAdminUsersTable();
    } catch (e) {
        console.error("[Admin] Lỗi tải người dùng:", e);
        tableBody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: #f87171; padding: 20px;">Lỗi tải dữ liệu người dùng từ máy chủ.</td></tr>`;
    }
}

function renderAdminUsersTable() {
    const tableBody = document.getElementById("admin-users-table-body");
    if (!tableBody) return;

    let filtered = [...AdminUsersState.users];

    // Lọc theo từ khóa tìm kiếm
    const q = AdminUsersState.searchQuery.toLowerCase().trim();
    if (q) {
        filtered = filtered.filter(u => 
            (u.username && u.username.toLowerCase().includes(q)) || 
            (u.nickname && u.nickname.toLowerCase().includes(q)) ||
            (u.location && u.location.toLowerCase().includes(q))
        );
    }

    // Lọc theo vai trò / trạng thái
    if (AdminUsersState.roleFilter === 'admin') {
        filtered = filtered.filter(u => u.role === 'admin');
    } else if (AdminUsersState.roleFilter === 'user') {
        filtered = filtered.filter(u => u.role !== 'admin');
    } else if (AdminUsersState.roleFilter === 'banned') {
        filtered = filtered.filter(u => u.isBanned);
    } else if (AdminUsersState.roleFilter === 'verified') {
        filtered = filtered.filter(u => u.verified);
    }

    if (filtered.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: var(--text-muted); padding: 30px;"><i class="fa-solid fa-user-xmark" style="font-size: 24px; opacity: 0.4; display: block; margin-bottom: 8px;"></i>Không tìm thấy người dùng nào phù hợp.</td></tr>`;
        return;
    }

    tableBody.innerHTML = filtered.map(u => {
        const isAdmin = u.role === 'admin';
        const isBanned = u.isBanned;
        const isVerified = u.verified;
        const isSelf = AppState.currentUser && AppState.currentUser.username === u.username;

        const roleBadge = isAdmin
            ? `<span style="background: rgba(239, 68, 68, 0.15); color: #f87171; border: 1px solid rgba(239, 68, 68, 0.3); padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 700; text-transform: uppercase;"><i class="fa-solid fa-crown" style="color: #fde047;"></i> Admin</span>`
            : `<span style="background: rgba(59, 130, 246, 0.15); color: #60a5fa; border: 1px solid rgba(59, 130, 246, 0.3); padding: 2px 8px; border-radius: 4px; font-size: 11px; font-weight: 600; text-transform: uppercase;"><i class="fa-solid fa-user"></i> User</span>`;

        const statusBadges = [];
        if (isBanned) {
            statusBadges.push(`<span style="background: rgba(239, 68, 68, 0.2); color: #ef4444; padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight: 700;"><i class="fa-solid fa-ban"></i> Bị khóa</span>`);
        } else {
            statusBadges.push(`<span style="background: rgba(16, 185, 129, 0.15); color: #10b981; padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight: 600;"><i class="fa-solid fa-circle-check"></i> Hoạt động</span>`);
        }
        if (isVerified) {
            statusBadges.push(`<span style="background: rgba(59, 130, 246, 0.2); color: #60a5fa; padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight: 700;" title="Đã xác thực"><i class="fa-solid fa-shield-check"></i> Verified</span>`);
        }

        const selfLabel = isSelf ? `<span style="font-size: 10px; color: #a855f7; font-weight: 700; margin-left: 4px;">(Bạn)</span>` : '';

        return `<tr>
            <td>
                <div style="display: flex; align-items: center; gap: 8px;">
                    <img src="${u.avatar}" alt="${u.username}" style="width: 32px; height: 32px; border-radius: 50%; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1);">
                    <div>
                        <strong style="color: var(--text-normal); font-size: 13px;">@${u.username}</strong>${selfLabel}
                        <div style="font-size: 11px; color: var(--text-muted);">${u.id}</div>
                    </div>
                </div>
            </td>
            <td style="font-weight: 600; color: white;">${u.nickname || 'Chưa đặt'}</td>
            <td>${roleBadge}</td>
            <td>
                <div style="font-size: 12px; color: var(--text-muted);">
                    <span>${u.gender || 'Nam'}, ${u.age || 22}t</span> • <span>${u.location || 'Hà Nội'}</span>
                </div>
            </td>
            <td>
                <div style="display: flex; align-items: center; gap: 6px;">
                    <strong style="color: #fde047; font-size: 13px;">${(u.coinBalance || 0).toLocaleString()} 🪙</strong>
                    <button class="btn-secondary btn-sm" onclick="adminAdjustCoinsPrompt('${u.id}', '${u.username}', ${u.coinBalance || 0})" title="Cộng/Trừ SafeCoin" style="padding: 1px 6px; font-size: 10px;"><i class="fa-solid fa-plus-minus"></i></button>
                </div>
            </td>
            <td>
                <div style="display: flex; gap: 4px; flex-wrap: wrap;">
                    ${statusBadges.join(' ')}
                </div>
            </td>
            <td style="text-align: right;">
                <div style="display: flex; gap: 6px; justify-content: flex-end; align-items: center;">
                    <button class="btn-secondary btn-sm" onclick="adminToggleVerifyUser('${u.id}')" title="${isVerified ? 'Hủy xác minh Verified' : 'Cấp huy hiệu Verified'}" style="padding: 4px 8px; font-size: 11px; background: ${isVerified ? 'rgba(59, 130, 246, 0.2)' : 'rgba(255,255,255,0.05)'}; color: ${isVerified ? '#60a5fa' : 'var(--text-muted)'};">
                        <i class="fa-solid fa-certificate"></i>
                    </button>
                    ${!isSelf ? `
                    <button class="btn-secondary btn-sm" onclick="adminToggleRoleUser('${u.id}', '${u.role}')" title="${isAdmin ? 'Hạ quyền xuống User' : 'Nâng cấp lên Admin'}" style="padding: 4px 8px; font-size: 11px; background: ${isAdmin ? 'rgba(239, 68, 68, 0.15)' : 'rgba(255,255,255,0.05)'}; color: ${isAdmin ? '#f87171' : 'var(--text-muted)'};">
                        <i class="fa-solid fa-crown"></i>
                    </button>
                    <button class="btn-secondary btn-sm" onclick="${isBanned ? `adminUnbanUser('${u.username}')` : `adminBanUser('${u.username}')`}" title="${isBanned ? 'Mở khóa tài khoản' : 'Khóa tài khoản'}" style="padding: 4px 8px; font-size: 11px; background: ${isBanned ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)'}; color: ${isBanned ? '#10b981' : '#ef4444'}; border-color: ${isBanned ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'};">
                        <i class="fa-solid ${isBanned ? 'fa-lock-open' : 'fa-ban'}"></i>
                    </button>
                    <button class="btn-danger btn-sm" onclick="adminDeleteUser('${u.id}', '${u.username}')" title="Xóa tài khoản vĩnh viễn" style="padding: 4px 8px; font-size: 11px;">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                    ` : ''}
                </div>
            </td>
        </tr>`;
    }).join('');
}

async function adminToggleVerifyUser(userId) {
    try {
        const res = await fetch('/api/admin/toggle-verify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId })
        });
        const data = await res.json();
        if (res.ok) {
            showToast("Thành công", `Đã ${data.verified ? 'cấp tích xanh' : 'thu hồi xác minh'} cho người dùng.`, "success");
            loadAdminUsers();
        } else {
            showToast("Lỗi", data.error || "Không thể thay đổi trạng thái xác minh.", "danger");
        }
    } catch (e) {
        showToast("Lỗi kết nối", "Không thể liên lạc máy chủ.", "danger");
    }
}

async function adminToggleRoleUser(userId, currentRole) {
    const nextRole = currentRole === 'admin' ? 'User' : 'Admin';
    if (!confirm(`Bạn có chắc muốn đổi vai trò của người dùng này thành "${nextRole}"?`)) return;

    try {
        const res = await fetch('/api/admin/toggle-role', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId })
        });
        const data = await res.json();
        if (res.ok) {
            showToast("Thành công", `Đã cập nhật quyền thành: ${data.role.toUpperCase()}`, "success");
            loadAdminUsers();
        } else {
            showToast("Lỗi", data.error || "Không thể cập nhật quyền.", "danger");
        }
    } catch (e) {
        showToast("Lỗi kết nối", "Không thể liên lạc máy chủ.", "danger");
    }
}

async function adminAdjustCoinsPrompt(userId, username, currentBalance) {
    const input = prompt(`Nhập số xu SafeCoin muốn cộng hoặc trừ cho @${username}:\n(Ví dụ: +500 để cộng, -200 để trừ)`, "+100");
    if (!input) return;
    const amount = parseInt(input.trim(), 10);
    if (isNaN(amount) || amount === 0) {
        showToast("Lỗi", "Số xu nhập vào không hợp lệ.", "warning");
        return;
    }

    try {
        const res = await fetch('/api/admin/adjust-coins', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId, amount })
        });
        const data = await res.json();
        if (res.ok) {
            showToast("Thành công", `Đã cập nhật số dư của @${username}: ${data.coinBalance} SafeCoin`, "success");
            loadAdminUsers();
        } else {
            showToast("Lỗi", data.error || "Không thể cập nhật số dư.", "danger");
        }
    } catch (e) {
        showToast("Lỗi kết nối", "Không thể liên lạc máy chủ.", "danger");
    }
}

async function adminDeleteUser(userId, username) {
    if (!confirm(`CẢNH BÁO: Bạn có chắc chắn muốn XÓA VĨNH VIỄN tài khoản "@${username}"? Dữ liệu này sẽ không thể khôi phục!`)) return;

    try {
        const res = await fetch('/api/admin/delete-user', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId })
        });
        const data = await res.json();
        if (res.ok) {
            showToast("Đã xóa user", data.message || `Đã xóa tài khoản @${username}.`, "success");
            loadAdminUsers();
            populateAdminBlacklist();
        } else {
            showToast("Lỗi", data.error || "Không thể xóa tài khoản.", "danger");
        }
    } catch (e) {
        showToast("Lỗi kết nối", "Không thể liên lạc máy chủ.", "danger");
    }
}

// ========== PROFILE MANAGEMENT PAGE ==========
function showProfileAlert(type, message) {
    const container = document.getElementById('profile-alert-container');
    if (!container) return;
    container.innerHTML = `<div class="profile-alert ${type}"><i class="fa-solid fa-${type === 'success' ? 'circle-check' : 'circle-exclamation'}"></i> ${message}</div>`;
    setTimeout(() => { container.innerHTML = ''; }, 4000);
}

async function loadProfileData() {
    if (!AppState.currentUser || !AppState.currentUser.id) return;
    
    try {
        const res = await fetch('/api/profile');
        if (!res.ok) return;
        const user = await res.json();

        // Header card
        const avatarEl = document.getElementById('profile-avatar-display');
        if (avatarEl) avatarEl.src = user.avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(user.nickname)}`;

        const nameEl = document.getElementById('profile-display-name');
        if (nameEl) nameEl.textContent = user.nickname || 'Người dùng';

        const usernameEl = document.getElementById('profile-display-username');
        if (usernameEl) usernameEl.textContent = '@' + user.username;

        // Badges
        const roleBadge = document.getElementById('profile-role-badge');
        if (roleBadge) {
            roleBadge.className = 'profile-badge ' + (user.role === 'admin' ? 'role-admin' : 'role-user');
            roleBadge.innerHTML = `<i class="fa-solid fa-${user.role === 'admin' ? 'crown' : 'user'}"></i> ${user.role === 'admin' ? 'Admin' : 'User'}`;
        }

        const verifiedBadge = document.getElementById('profile-verified-badge');
        if (verifiedBadge) verifiedBadge.style.display = user.verified ? 'flex' : 'none';

        const verifiedIcon = document.getElementById('profile-verified-icon');
        if (verifiedIcon) verifiedIcon.style.display = user.verified ? 'flex' : 'none';

        const coinBal = document.getElementById('profile-coin-balance');
        if (coinBal) coinBal.textContent = (user.coinBalance || 0).toLocaleString();

        // Populate form fields
        const nicknameInput = document.getElementById('profile-nickname');
        if (nicknameInput) nicknameInput.value = user.nickname || '';

        const ageInput = document.getElementById('profile-age');
        if (ageInput) ageInput.value = user.age || 22;

        const genderSelect = document.getElementById('profile-gender');
        if (genderSelect) genderSelect.value = user.gender || 'Nam';

        const locationSelect = document.getElementById('profile-location');
        if (locationSelect) locationSelect.value = user.location || 'Hà Nội';

        const purposeSelect = document.getElementById('profile-purpose');
        if (purposeSelect) purposeSelect.value = user.purpose || 'Kết bạn mới';

        // Interest tags
        const interestTags = document.querySelectorAll('#profile-interests-grid .profile-interest-tag');
        const userInterests = user.interests || [];
        interestTags.forEach(tag => {
            const val = tag.dataset.value;
            if (userInterests.includes(val)) {
                tag.classList.add('active');
            } else {
                tag.classList.remove('active');
            }
        });

        // Read-only fields
        const usernameReadonly = document.getElementById('profile-username-readonly');
        if (usernameReadonly) usernameReadonly.value = user.username;

        const roleReadonly = document.getElementById('profile-role-readonly');
        if (roleReadonly) roleReadonly.value = user.role === 'admin' ? 'Quản trị viên (Admin)' : 'Người dùng (User)';

        const verifiedReadonly = document.getElementById('profile-verified-readonly');
        if (verifiedReadonly) verifiedReadonly.value = user.verified ? '✅ Đã xác minh' : '⏳ Chưa xác minh';

        // Stats
        const statCalls = document.getElementById('profile-stat-calls');
        if (statCalls) statCalls.textContent = (AppState.callHistory || []).length;

        const statVideos = document.getElementById('profile-stat-videos');
        if (statVideos) statVideos.textContent = (AppState.currentUser && AppState.currentUser.transactionHistory) ? AppState.currentUser.transactionHistory.filter(t => t.desc && t.desc.includes('video')).length : 0;

    } catch (e) {
        console.error('[Profile] Error loading profile:', e);
    }
}

function initProfilePage() {
    // Interest tag toggles
    document.querySelectorAll('#profile-interests-grid .profile-interest-tag').forEach(tag => {
        tag.addEventListener('click', function() {
            this.classList.toggle('active');
        });
    });

    // Save profile form
    const infoForm = document.getElementById('profile-info-form');
    if (infoForm) {
        infoForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (!AppState.currentUser || !AppState.currentUser.id) {
                showToast('Lỗi', 'Vui lòng đăng nhập.', 'danger');
                return;
            }

            const nickname = document.getElementById('profile-nickname')?.value.trim();
            const age = document.getElementById('profile-age')?.value;
            const gender = document.getElementById('profile-gender')?.value;
            const location = document.getElementById('profile-location')?.value;
            const purpose = document.getElementById('profile-purpose')?.value;
            const interests = [...document.querySelectorAll('#profile-interests-grid .profile-interest-tag.active')]
                .map(t => t.dataset.value);

            if (!nickname) {
                showProfileAlert('error', 'Vui lòng nhập biệt danh.');
                return;
            }

            const btn = document.getElementById('btn-save-profile');
            if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Đang lưu...'; }

            try {
                const res = await fetch('/api/profile', {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ nickname, age, gender, location, interests, purpose })
                });
                const data = await res.json();
                if (res.ok) {
                    // Update AppState
                    AppState.currentUser = { ...AppState.currentUser, ...data.user };
                    updateUIForAuth();
                    loadProfileData();
                    showProfileAlert('success', 'Cập nhật thông tin cá nhân thành công!');
                    showToast('✅ Thành công', 'Hồ sơ cá nhân đã được cập nhật.', 'success');
                } else {
                    showProfileAlert('error', data.error || 'Có lỗi xảy ra.');
                }
            } catch (err) {
                showProfileAlert('error', 'Không thể kết nối đến server.');
            }

            if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Lưu thay đổi'; }
        });
    }

    // Change password form
    const passwordForm = document.getElementById('profile-password-form');
    if (passwordForm) {
        passwordForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const currentPassword = document.getElementById('profile-current-password')?.value;
            const newPassword = document.getElementById('profile-new-password')?.value;
            const confirmPassword = document.getElementById('profile-confirm-password')?.value;

            if (!currentPassword || !newPassword || !confirmPassword) {
                showProfileAlert('error', 'Vui lòng điền đầy đủ tất cả các trường mật khẩu.');
                return;
            }
            if (newPassword !== confirmPassword) {
                showProfileAlert('error', 'Mật khẩu mới và xác nhận mật khẩu không khớp.');
                return;
            }
            if (newPassword.length < 6) {
                showProfileAlert('error', 'Mật khẩu mới phải có ít nhất 6 ký tự.');
                return;
            }

            const btn = document.getElementById('btn-change-password');
            if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Đang xử lý...'; }

            try {
                const res = await fetch('/api/profile/password', {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ currentPassword, newPassword })
                });
                const data = await res.json();
                if (res.ok) {
                    showProfileAlert('success', 'Đổi mật khẩu thành công!');
                    showToast('🔒 Bảo mật', 'Mật khẩu của bạn đã được thay đổi.', 'success');
                    passwordForm.reset();
                } else {
                    showProfileAlert('error', data.error || 'Có lỗi xảy ra khi đổi mật khẩu.');
                }
            } catch (err) {
                showProfileAlert('error', 'Không thể kết nối đến server.');
            }

            if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-key"></i> Đổi mật khẩu'; }
        });
    }
}

// Bind admin controls after DOM load
document.addEventListener("DOMContentLoaded", () => {
    const btnBan = document.getElementById("btn-admin-submit-ban");
    const btnUnban = document.getElementById("btn-admin-submit-unban");
    const banInput = document.getElementById("admin-ban-username");

    if (btnBan) {
        btnBan.addEventListener("click", () => {
            const username = banInput.value.trim();
            adminBanUser(username);
        });
    }

    if (btnUnban) {
        btnUnban.addEventListener("click", () => {
            const username = banInput.value.trim();
            adminUnbanUser(username);
        });
    }

    // Admin User Management Table Controls
    const userSearchInput = document.getElementById("admin-user-search");
    if (userSearchInput) {
        userSearchInput.addEventListener("input", (e) => {
            AdminUsersState.searchQuery = e.target.value;
            renderAdminUsersTable();
        });
    }

    const userRoleFilter = document.getElementById("admin-user-filter-role");
    if (userRoleFilter) {
        userRoleFilter.addEventListener("change", (e) => {
            AdminUsersState.roleFilter = e.target.value;
            renderAdminUsersTable();
        });
    }

    const btnRefreshUsers = document.getElementById("btn-refresh-admin-users");
    if (btnRefreshUsers) {
        btnRefreshUsers.addEventListener("click", () => {
            loadAdminUsers();
            showToast("Đã làm mới", "Danh sách người dùng đã được cập nhật.", "info");
        });
    }
});

