# Script tự động tạo 6 Checkpoint Issues trên GitHub cho dự án safeconnect-anonymous-video-chat-ai
param (
    [string]$GithubToken = ""
)

if (-not $GithubToken) {
    Write-Host "Vui long nhap Personal Access Token cua GitHub." -ForegroundColor Yellow
    Write-Host "Vi du: .\create_github_issues.ps1 -GithubToken 'ghp_xxxx...'" -ForegroundColor Cyan
    exit
}

$repoOwner = "limianguyentkhd-web"
$repoName = "anonymous-video-chat-ai"
$apiUrl = "https://api.github.com/repos/$repoOwner/$repoName/issues"

$headers = @{
    "Authorization" = "token $GithubToken"
    "Accept"        = "application/vnd.github.v3+json"
}

$issues = @(
    @{
        title = "[Checkpoint 01] Dang ky de tai & Xac dinh pham vi du an"
        body  = "### NOI DUNG CHECKPOINT 01`n- Ten de tai: SafeConnect - Anonymous Video Chat AI`n- Muc tieu: Xay dung ung dung chat video an danh an toan tich hop AI kiem duyyet am thanh.`n- Pham vi & Cong nghe: Node.js, Express, WebRTC, PeerJS, TensorFlow.js, Socket.IO.`n`n**Trang thai**: Hoan thanh"
        labels = @("checkpoint", "documentation")
    },
    @{
        title = "[Checkpoint 02] Phan tich yeu cau nghiep vu & Luong du lieu"
        body  = "### NOI DUNG CHECKPOINT 02`n- Phan tich luong ghep cap ngau nhien P2P.`n- Phan tich luong phan tich am thanh thoi gian thuc.`n- Xac dinh cac yeu cau dau vao/dau ra va rang buoc an toan.`n`n**Trang thai**: Hoan thanh"
        labels = @("checkpoint", "analysis")
    },
    @{
        title = "[Checkpoint 03] Thiet ke Kien truc, CSDL & Giao dien UI/UX"
        body  = "### NOI DUNG CHECKPOINT 03`n- Thiet ke kien truc He thong Express + Signaling Server.`n- Thiet ke CSDL MySQL / Postgres va che do JSON Storage fallback.`n- Thiet ke giao dien UI/UX nguoi dung (index.html, style.css, forum.css).`n`n**Trang thai**: Hoan thanh"
        labels = @("checkpoint", "design")
    },
    @{
        title = "[Checkpoint 04] Trien khai lap trinh chuc nang cot loi (Core Implementation)"
        body  = "### NOI DUNG CHECKPOINT 04`n- Lap trinh Signaling Server & PeerJS Server (`server.js`).`n- Lap trinh Module AI kiem duyyet am thanh thoi gian thuc (`js/audio-classifier.js`).`n- Lap trinh Giao dien Chat Video va Dien dan an danh (`js/app.js`, `js/forum.js`).`n`n**Trang thai**: Dang thuc hien (Link Git/commit)"
        labels = @("checkpoint", "enhancement")
    },
    @{
        title = "[Checkpoint 05] Kiem thu he thong, du lieu mau & Sua loi"
        body  = "### NOI DUNG CHECKPOINT 05`n- Xay dung bang kieu thu Test Cases cho chuc nang Video Call & AI Shield.`n- Kiem thu do tre va kha nang phat hien tieng la/am thanh doc hai.`n- Sua loi ket noi va toi uu hieu nang he thong.`n`n**Trang thai**: Chua lam (Han: 26/09/2026)"
        labels = @("checkpoint", "testing")
    },
    @{
        title = "[Checkpoint 06] Bao cao do an, Video Demo & Tong ket"
        body  = "### NOI DUNG CHECKPOINT 06`n- Hoan thien bao cao do an cuoi ky.`n- Quay video demo san pham va dong goi mã nguon.`n- Chuan bi ho so bao ve do an truoc hoi dong.`n`n**Trang thai**: Chua lam (Han: 10/10/2026)"
        labels = @("checkpoint", "documentation")
    }
)

foreach ($issue in $issues) {
    $jsonBody = $issue | ConvertTo-Json -Depth 3 -Compress
    try {
        $response = Invoke-RestMethod -Uri $apiUrl -Method Post -Headers $headers -Body $jsonBody -ContentType "application/json; charset=utf-8"
        Write-Host "Da tao thanh cong Issue: $($response.title) (#$($response.number))" -ForegroundColor Green
    } catch {
        Write-Host "Loi khi tao Issue '$($issue.title)': $_" -ForegroundColor Red
    }
}
