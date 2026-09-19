/* SafeConnect Forum JS */
const ForumState = {
    videos: [], currentTopic: 'all', commentVideoId: null,
    interestVector: {}, watchedCount: 0, users: [],
    likedVideos: new Set(), savedVideos: new Set(),
    onboardingDone: false, fsIndex: 0,
    radarScanned: false, // State of the GPS scan
    userLocation: null
};

const TOPIC_COLORS = {
    'Âm nhạc':'#ec4899','Du lịch':'#10b981','Công nghệ':'#6366f1',
    'Ẩm thực':'#f59e0b','Thể thao':'#3b82f6','Điện ảnh':'#ef4444',
    'Vlog':'#14b8a6','Giáo dục':'#8b5cf6','Game':'#f97316',
    'Thời trang':'#e879f9','Sức khoẻ':'#22d3ee','Hài hước':'#facc15'
};

let MOCK_VIDEOS = [];

async function loadVideosFromServer() {
    try {
        const res = await fetch('/api/forum/videos');
        if (res.ok) {
            MOCK_VIDEOS = await res.json();
            renderFeed(ForumState.currentTopic || 'all');
        }
    } catch (e) {
        console.error('[Forum] Lỗi tải video từ server:', e);
    }
}

const MOCK_USERS = [
    {id:'u1',name:'Hải Nam',seed:'HaiNam',topics:['Âm nhạc','Du lịch'],score:94, distance: 1.5},
    {id:'u2',name:'Phương Anh',seed:'PhuongAnh',topics:['Công nghệ','Giáo dục'],score:88, distance: 2.8},
    {id:'u3',name:'Đức Minh',seed:'DucMinh',topics:['Thể thao','Ẩm thực'],score:82, distance: 2.1},
    {id:'u4',name:'Trang Thu',seed:'TrangThu',topics:['Điện ảnh','Vlog'],score:79, distance: 3.9},
    {id:'u5',name:'Lan Anh',seed:'LanAnh',topics:['Âm nhạc','Hài hước'],score:95, distance: 0.8}
];

const TRENDING = [
    {topic:'#SapaChillOut',count:'128K video'},
    {topic:'#CoverAcoustic',count:'94K video'},
    {topic:'#WorkoutTaiNha',count:'87K video'},
    {topic:'#ReviewCongNghe',count:'61K video'},
    {topic:'#VietnamFood',count:'55K video'}
];

const COMMENTS_DB = {
    1:[{user:'Lan Anh',seed:'LanAnh',text:'Hay quá bạn ơi! 🎸',time:'5 phút trước',likes:12}],
    3:[{user:'Dev Hùng',seed:'HungDev',text:'Camera AI quá đỉnh!',time:'10 phút trước',likes:7}]
};

function renderVideoCard(v) {
    const c = TOPIC_COLORS[v.topic]||'#a855f7';
    const liked = ForumState.likedVideos.has(v.id);
    // Show nearby badge if radar scanned and video has distance info
    const nearbyBadge = (ForumState.radarScanned && v.distance !== undefined) 
        ? `<div class="video-near-badge"><i class="fa-solid fa-location-dot"></i> Gần bạn (${v.distance} km)</div>` 
        : '';

    const isAdmin = (typeof AppState !== 'undefined' && AppState.currentUser && AppState.currentUser.role === 'admin');
    const adminDeleteBtn = isAdmin 
        ? `<button class="video-admin-delete-btn" onclick="event.stopPropagation(); adminDeleteVideo(${v.id})" title="Xoá video (Admin)"><i class="fa-solid fa-trash"></i> Xóa</button>` 
        : '';

    // Determine if this video has a real video file
    const hasRealVideo = v.videoUrl && v.videoUrl.startsWith('/');
    const videoElement = hasRealVideo
        ? `<video class="forum-real-video" src="${v.videoUrl}" preload="metadata" loop playsinline muted></video>`
        : `<div class="forum-video-bg" style="background:${v.g};position:absolute;inset:0;"></div>`;

    return `<div class="video-card" data-vid="${v.id}">
      ${adminDeleteBtn}
      <div class="video-player-wrap" onclick="handleCardClick(${v.id},event)">
        <div class="video-player-inner">
          ${videoElement}
          <div class="video-overlay-gradient"></div>
          <div class="video-info-overlay">
            <div class="video-author-row">
              <img src="https://api.dicebear.com/7.x/bottts/svg?seed=${v.seed}" class="video-author-avatar" alt="${v.author}">
              <span class="video-author-name">${v.author}</span>
            </div>
            <div class="video-title-text">${v.title}</div>
            <div class="video-tags-row">${v.desc.split(' ').map(t=>`<span class="video-tag-pill">${t}</span>`).join('')}</div>
          </div>
          <div class="video-right-actions">
            <button class="vra-btn ${liked?'liked':''}" onclick="event.stopPropagation();toggleLike(${v.id})">
              <i class="fa-${liked?'solid':'regular'} fa-heart"></i><span id="lc-${v.id}">${v.likes.toLocaleString()}</span>
            </button>
            <button class="vra-btn" onclick="event.stopPropagation();openCommentPanel(${v.id})">
              <i class="fa-regular fa-comment"></i><span>${v.comments}</span>
            </button>
            <button class="vra-btn" onclick="event.stopPropagation();shareVideo(${v.id})">
              <i class="fa-solid fa-share-nodes"></i><span>Chia sẻ</span>
            </button>
          </div>
          <div class="video-duration-badge"><i class="fa-solid fa-clock"></i> ${v.duration}</div>
          ${nearbyBadge}
          <div class="video-topic-badge-overlay" style="background:${c}22;color:${c}">${v.topic}</div>
          <button class="video-expand-btn" onclick="event.stopPropagation();openFullscreen(${v.id})" title="Xem toàn màn hình">
            <i class="fa-solid fa-expand"></i>
          </button>
          <div class="video-play-btn-overlay" id="playbtn-${v.id}"><i class="fa-solid fa-play"></i></div>
        </div>
      </div>
    </div>`;
}

// --- COSINE SIMILARITY & RECOMMENDER MATHEMATICAL ENGINE ---

/**
 * Calculates Cosine Similarity between two key-value weight vectors:
 * Sim(A, B) = (A . B) / (||A|| * ||B||)
 */
function calculateCosineSimilarity(vecA, vecB) {
    if (!vecA || !vecB) return 0;
    const keysA = Object.keys(vecA);
    const keysB = Object.keys(vecB);
    if (keysA.length === 0 || keysB.length === 0) return 0;

    const allKeys = new Set([...keysA, ...keysB]);
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (const key of allKeys) {
        const valA = Number(vecA[key]) || 0;
        const valB = Number(vecB[key]) || 0;
        dotProduct += valA * valB;
        normA += valA * valA;
        normB += valB * valB;
    }

    if (normA === 0 || normB === 0) return 0;
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Converts an array of topics or tags into a frequency weight vector.
 */
function arrayToVector(arr, defaultWeight = 10) {
    const vec = {};
    if (!Array.isArray(arr)) return vec;
    for (const item of arr) {
        if (typeof item === 'string') {
            const clean = item.replace(/^#/, '').trim();
            if (clean) vec[clean] = (vec[clean] || 0) + defaultWeight;
        }
    }
    return vec;
}

/**
 * Computes overall compatibility percentage (65% - 99%) between user and partner
 * using Cosine Similarity of learned interest vectors + tag/purpose overlap.
 */
function calculateUserCompatibility(userA, userB, interestVectorA) {
    if (!userA || !userB) return 80;
    
    // 1. Vector user B
    const vecB = (userB.interestVector && Object.keys(userB.interestVector).length > 0)
        ? userB.interestVector
        : arrayToVector(userB.topics || userB.interests || []);

    // 2. Vector user A (Explicit Profile + Forum Learned Behavior)
    const explicitVecA = arrayToVector(userA.interests || []);
    const learnedVecA = interestVectorA || ForumState.interestVector || {};
    const vecA = { ...explicitVecA };
    for (const [k, v] of Object.entries(learnedVecA)) {
        vecA[k] = (vecA[k] || 0) + v;
    }

    // 3. Cosine Similarity
    const cosineSim = calculateCosineSimilarity(vecA, vecB);

    // 4. Bonus overlap (Purpose & Location)
    let bonus = 0;
    if (userA.purpose && userB.purpose && userA.purpose.toLowerCase() === userB.purpose.toLowerCase()) {
        bonus += 0.08;
    }
    if (userA.location && userB.location && userA.location.toLowerCase() === userB.location.toLowerCase()) {
        bonus += 0.04;
    }

    // Map into realistic human compatibility range: 65% - 98%
    let finalScore = Math.round((cosineSim * 0.70 + bonus + 0.22) * 100);
    if (isNaN(finalScore) || finalScore < 65) finalScore = 65;
    if (finalScore > 98) finalScore = 98;

    return finalScore;
}

function renderFeed(topic='all') {
    const feed = document.getElementById('forum-video-feed');
    if (!feed) return;
    
    let list = topic==='all' ? [...MOCK_VIDEOS] : MOCK_VIDEOS.filter(v=>v.topic===topic);
    
    if (topic === 'all' && Object.keys(ForumState.interestVector).length > 0) {
        // AI Content-Based Personalization: Sort by match score with user interest vector
        list.sort((a, b) => {
            const vecA = arrayToVector([a.topic, ...(a.desc ? a.desc.split(' ') : [])]);
            const vecB = arrayToVector([b.topic, ...(b.desc ? b.desc.split(' ') : [])]);
            const scoreA = calculateCosineSimilarity(ForumState.interestVector, vecA);
            const scoreB = calculateCosineSimilarity(ForumState.interestVector, vecB);
            return scoreB - scoreA;
        });
    } else if (ForumState.radarScanned) {
        list.sort((a, b) => {
            const distA = a.distance !== undefined ? a.distance : 999;
            const distB = b.distance !== undefined ? b.distance : 999;
            return distA - distB;
        });
    }

    feed.innerHTML = list.map(renderVideoCard).join('');
}

function renderTrending() {
    const el = document.getElementById('forum-trending-list');
    if (!el) return;
    el.innerHTML = TRENDING.map((t,i)=>`
    <div class="trending-item">
      <div class="trending-rank ${i<3?'top':''}">${i+1}</div>
      <div class="trending-info"><div class="trending-topic">${t.topic}</div><div class="trending-count">${t.count}</div></div>
    </div>`).join('');
}

function renderSidebarMatches(matches) {
    const body = document.getElementById('forum-match-body');
    if (!body||!matches.length) return;
    body.innerHTML = matches.map(u=>`
    <div class="match-user-card" onclick="openInterestModal()">
      <img src="https://api.dicebear.com/7.x/bottts/svg?seed=${u.seed}" class="match-user-avatar" alt="${u.name}">
      <div style="flex:1">
        <div class="match-user-name">${u.name}</div>
        <div class="match-user-tags">${u.topics.map(t=>`<span class="match-user-tag">${t}</span>`).join('')}</div>
      </div>
      <span class="match-score-badge">${u.score}%</span>
      <button class="match-action-btn" onclick="event.stopPropagation();connectUser('${u.id}')"><i class="fa-solid fa-video"></i></button>
    </div>`).join('');
}

function handleCardClick(id, e) {
    const wrap = e.currentTarget;
    const btn = document.getElementById('playbtn-'+id);
    const playing = wrap.classList.toggle('playing');
    if (btn) btn.innerHTML = playing?'<i class="fa-solid fa-pause"></i>':'<i class="fa-solid fa-play"></i>';
    
    // Handle real video play/pause
    const realVideo = wrap.querySelector('.forum-real-video');
    if (realVideo) {
        if (playing) {
            realVideo.muted = false;
            realVideo.play().catch(err => console.log('Video play prevented:', err));
        } else {
            realVideo.pause();
        }
    }
    
    if (playing) {
        const v = MOCK_VIDEOS.find(x => x.id === id);
        if (v) trackInterest(v.topic, 5, 'xem video');
    }
}

function toggleLike(id) {
    const v = MOCK_VIDEOS.find(x=>x.id===id);
    if (!v) return;
    const btn = document.querySelector(`[data-vid="${id}"] .vra-btn.liked, [data-vid="${id}"] .vra-btn:first-child`);
    const cnt = document.getElementById('lc-'+id);
    if (ForumState.likedVideos.has(id)) {
        ForumState.likedVideos.delete(id); v.likes--;
        if(btn){btn.classList.remove('liked');btn.querySelector('i').className='fa-regular fa-heart';}
    } else {
        ForumState.likedVideos.add(id); v.likes++;
        if(btn){btn.classList.add('liked');btn.querySelector('i').className='fa-solid fa-heart';}
        trackInterest(v.topic, 10, 'thích (like)');
    }
    if(cnt) cnt.textContent=v.likes.toLocaleString();
}

function shareVideo(id) {
    const v = MOCK_VIDEOS.find(x => x.id === id);
    if (v) trackInterest(v.topic, 10, 'chia sẻ');
    if(typeof showToast==='function') showToast('Chia sẻ','Đã sao chép link video!','success');
}

function trackInterest(topic, weight = 5, reason = 'xem video') {
    if (!topic) return;
    const cleanTopic = topic.replace(/^#/, '').trim();
    if (!cleanTopic) return;

    ForumState.interestVector[cleanTopic] = (ForumState.interestVector[cleanTopic] || 0) + weight;
    ForumState.watchedCount++;

    // Sync to AppState & localStorage
    if (typeof AppState !== 'undefined' && AppState.currentUser) {
        AppState.currentUser.interestVector = { ...ForumState.interestVector };
    }
    try {
        localStorage.setItem('safeconnect_interest_vector', JSON.stringify(ForumState.interestVector));
    } catch(e) {}

    updateInterestBar();
    updateIPB();
    buildMatches();
    
    console.log(`[AI Recommender] Implicit Feedback: +${weight}đ cho "${cleanTopic}" (Hành vi: ${reason}). Profile:`, ForumState.interestVector);
}

function updateInterestBar() {
    const el = document.getElementById('aib-tags');
    if (!el) return;
    
    const entries = Object.entries(ForumState.interestVector);
    if (!entries.length) {
        el.innerHTML = '<span class="aib-tag"><i class="fa-solid fa-spinner fa-spin"></i> Đang phân tích...</span>';
        return;
    }

    const totalWeight = entries.reduce((sum, [, w]) => sum + w, 0);
    const sorted = entries.sort((a, b) => b[1] - a[1]);

    el.innerHTML = sorted.map(([t, w], index) => {
        const pct = Math.round((w / totalWeight) * 100);
        const isTop = index === 0;
        return `<span class="aib-tag ${isTop ? 'strong' : ''}" style="display:inline-flex; align-items:center; gap:4px;">
            ${t} <b>${pct}%</b> <small style="opacity:0.7">(${w}đ)</small>
        </span>`;
    }).join('');
}

function updateIPB() {
    const fill = document.getElementById('ipb-fill'), label = document.getElementById('ipb-label');
    const pct = Math.min((ForumState.watchedCount / 3) * 100, 100);
    if (fill) fill.style.width = pct + '%';
    if (label) label.textContent = `${Math.min(ForumState.watchedCount, 3)} / 3 video đã phân tích (AI Live)`;
}

function buildMatches() {
    const userA = (typeof AppState !== 'undefined' && AppState.currentUser) 
        ? AppState.currentUser 
        : { nickname: 'Tôi', interests: ['Âm nhạc', 'Ngoại ngữ'], purpose: 'Kết bạn mới' };

    // Calculate real mathematical Cosine Similarity for each candidate user
    const scoredUsers = MOCK_USERS.map(u => {
        const realScore = calculateUserCompatibility(userA, u, ForumState.interestVector);
        return {
            ...u,
            score: realScore
        };
    }).sort((a, b) => b.score - a.score);

    renderSidebarMatches(scoredUsers.slice(0, 3));
    ForumState.users = scoredUsers;
}

/* ===== COMMENTS ===== */
function openCommentPanel(id) {
    ForumState.commentVideoId=id;
    const o=document.getElementById('comment-panel-overlay'); if(o) o.classList.add('active');
    renderComments(id);
}
function closeCommentPanel() { const o=document.getElementById('comment-panel-overlay'); if(o) o.classList.remove('active'); }
function renderComments(id) {
    const list=document.getElementById('comment-list'); if(!list) return;
    const arr=COMMENTS_DB[id]||[];
    if(!arr.length){list.innerHTML='<div style="text-align:center;padding:40px;color:var(--text-muted);font-size:13px"><i class="fa-regular fa-comment" style="font-size:28px;opacity:0.3;display:block;margin-bottom:10px"></i>Chưa có bình luận nào!</div>';return;}
    list.innerHTML=arr.map(c=>`<div class="comment-item"><img src="https://api.dicebear.com/7.x/bottts/svg?seed=${c.seed}" class="comment-avatar-sm"><div class="comment-body"><div class="comment-author">${c.user}</div><div class="comment-text">${c.text}</div><div class="comment-meta">${c.time} <button class="comment-like-btn"><i class="fa-regular fa-heart"></i> ${c.likes}</button></div></div></div>`).join('');
}
function sendComment() {
    const inp=document.getElementById('comment-input'); if(!inp||!inp.value.trim()) return;
    const id=ForumState.commentVideoId;
    if(!COMMENTS_DB[id]) COMMENTS_DB[id]=[];
    const nick=(typeof AppState!=='undefined'&&AppState.currentUser)?AppState.currentUser.nickname:'Bạn';
    COMMENTS_DB[id].unshift({user:nick,seed:'SafeUser',text:inp.value.trim(),time:'Vừa xong',likes:0});
    inp.value='';
    renderComments(id);
    
    // Implicit Feedback for commenting
    const v = MOCK_VIDEOS.find(x => x.id === id);
    if (v) trackInterest(v.topic, 15, 'bình luận (comment)');
}

/* ===== FULLSCREEN ===== */
function openFullscreen(startId) {
    const fs=document.getElementById('tiktok-fullscreen'); if(!fs) return;
    fs.classList.add('active');
    const topic=ForumState.currentTopic;
    const list=topic==='all'?MOCK_VIDEOS:MOCK_VIDEOS.filter(v=>v.topic===topic);
    const feed=document.getElementById('tiktok-fs-feed'); if(!feed) return;
    feed.innerHTML=list.map(v=>renderFsCard(v)).join('');
    ForumState.fsIndex=list.findIndex(v=>v.id===startId)||0;
    const cards=feed.querySelectorAll('.tiktok-fs-card');
    if(cards[ForumState.fsIndex]) cards[ForumState.fsIndex].scrollIntoView({behavior:'instant'});
    trackInterest(list[ForumState.fsIndex]?.topic);
}

function renderFsCard(v) {
    const liked=ForumState.likedVideos.has(v.id);
    const hasRealVideo = v.videoUrl && v.videoUrl.startsWith('/');
    const videoElement = hasRealVideo
        ? `<video class="tiktok-fs-real-video" src="${v.videoUrl}" autoplay loop playsinline></video>`
        : `<div class="tiktok-fs-video-bg" style="background:${v.g};"></div>`;

    return `<div class="tiktok-fs-card" data-vid="${v.id}">
      <div class="tiktok-fs-bg" style="background:${v.g};"></div>
      <div class="tiktok-fs-video-area" style="width:100%;max-width:calc(100vh*9/16);">
        ${videoElement}
        <div class="tiktok-fs-overlay"></div>
        <div class="tiktok-fs-info">
          <div class="tiktok-fs-author">
            <img src="https://api.dicebear.com/7.x/bottts/svg?seed=${v.seed}" class="tiktok-fs-avatar" alt="${v.author}">
            <div>
              <div class="tiktok-fs-name">${v.author}</div>
              <div style="font-size:11px;color:rgba(255,255,255,0.6)">${v.views} lượt xem</div>
            </div>
          </div>
          <div class="tiktok-fs-title">${v.title}</div>
          <div class="tiktok-fs-tags">${v.desc}</div>
        </div>
        <div class="tiktok-fs-actions">
          <button class="tiktok-fs-btn ${liked?'liked':''}" onclick="toggleLike(${v.id});this.classList.toggle('liked');this.querySelector('i').className=ForumState.likedVideos.has(${v.id})?'fa-solid fa-heart':'fa-regular fa-heart'">
            <i class="fa-${liked?'solid':'regular'} fa-heart"></i><span>${v.likes.toLocaleString()}</span>
          </button>
          <button class="tiktok-fs-btn" onclick="openCommentPanel(${v.id})"><i class="fa-regular fa-comment"></i><span>${v.comments}</span></button>
          <button class="tiktok-fs-btn" onclick="shareVideo(${v.id})"><i class="fa-solid fa-share-nodes"></i><span>Chia sẻ</span></button>
          <button class="tiktok-fs-btn" onclick="openInterestModal()"><i class="fa-solid fa-user-plus"></i><span>Kết nối</span></button>
        </div>
        <div class="tiktok-fs-music">
          <div class="tiktok-fs-disc"><i class="fa-solid fa-music" style="font-size:14px;color:white;"></i></div>
          <marquee style="flex:1;font-size:12px;">🎵 ${v.topic} · ${v.author} · SafeConnect Forum</marquee>
        </div>
      </div>
    </div>`;
}

function closeFullscreen() {
    const fs=document.getElementById('tiktok-fullscreen');
    if(fs) {
        fs.classList.remove('active');
        fs.querySelectorAll('video').forEach(vid => vid.pause());
    }
}

/* ===== ONBOARDING ===== */
let selectedTopics=[];
function initOnboarding() {
    const modal=document.getElementById('forum-onboarding-modal');
    if(!modal) return;
    if(localStorage.getItem('sc_forum_onboarded')) { modal.classList.remove('active'); return; }
    modal.classList.add('active');
    document.querySelectorAll('.fo-topic-chip').forEach(chip=>{
        chip.addEventListener('click',function(){
            this.classList.toggle('selected');
            const t=this.dataset.topic;
            if(this.classList.contains('selected')) { if(!selectedTopics.includes(t)) selectedTopics.push(t); }
            else { selectedTopics=selectedTopics.filter(x=>x!==t); }
            updateOnboardUI();
        });
    });
    document.getElementById('fo-next-btn')?.addEventListener('click',goOnboardStep2);
    document.getElementById('fo-skip-btn')?.addEventListener('click',skipOnboard);
}

function updateOnboardUI() {
    const n=selectedTopics.length, btn=document.getElementById('fo-next-btn'), cnt=document.getElementById('fo-selected-count');
    if(btn) btn.disabled=n<3;
    if(cnt) {
        if(n===0) cnt.textContent='Chọn ít nhất 3 chủ đề';
        else if(n<3) cnt.textContent=`Đã chọn ${n} — cần thêm ${3-n} nữa`;
        else cnt.style.color='#10b981', cnt.textContent=`✅ Đã chọn ${n} chủ đề — Sẵn sàng!`;
    }
}

function goOnboardStep2() {
    document.getElementById('fo-step-1').style.display='none';
    document.getElementById('fo-step-2').style.display='block';
    const prev=document.getElementById('fo-selected-preview');
    if(prev) prev.innerHTML=selectedTopics.map(t=>`<span class="fo-preview-chip">${t}</span>`).join('');
    const fill=document.getElementById('fo-loading-fill'), txt=document.getElementById('fo-loading-text');
    const steps=['Đang phân tích sở thích...','Tìm kiếm video phù hợp...','Cá nhân hoá feed của bạn...','Hoàn tất! 🎉'];
    let i=0;
    const iv=setInterval(()=>{
        i++;
        if(fill) fill.style.width=(i/steps.length*100)+'%';
        if(txt&&steps[i]) txt.textContent=steps[i];
        if(i>=steps.length-1) { clearInterval(iv); setTimeout(finishOnboard,600); }
    },700);
}

function finishOnboard() {
    selectedTopics.forEach(t=>{ ForumState.interestVector[t]=2; });
    ForumState.watchedCount=3;
    localStorage.setItem('sc_forum_onboarded','1');
    const modal=document.getElementById('forum-onboarding-modal'); if(modal) modal.classList.remove('active');
    updateInterestBar(); buildMatches();
    if(typeof showToast==='function') showToast('🎉 Sẵn sàng!','Feed của bạn đã được cá nhân hoá!','success');
}

function skipOnboard() {
    localStorage.setItem('sc_forum_onboarded','1');
    const modal=document.getElementById('forum-onboarding-modal'); if(modal) modal.classList.remove('active');
}

/* ===== INTEREST MODAL ===== */
function openInterestModal() {
    const list=document.getElementById('interest-match-list'); if(!list) return;
    const myTopics=Object.keys(ForumState.interestVector);
    list.innerHTML=MOCK_USERS.map(u=>`<div class="im-card">
      <img src="https://api.dicebear.com/7.x/bottts/svg?seed=${u.seed}" class="im-avatar" alt="${u.name}">
      <div class="im-info">
        <div class="im-name">${u.name}</div>
        <div class="im-topics">${u.topics.map(t=>`<span class="im-topic-tag">${t}</span>`).join('')}</div>
        <div class="im-shared"><i class="fa-solid fa-link" style="color:#a855f7"></i> Cùng: <b>${u.topics.filter(t=>myTopics.includes(t)).join(', ')||'Đang phân tích...'}</b></div>
      </div>
      <div class="im-actions"><div class="im-score">${u.score}%</div>
        <button class="im-connect-btn" onclick="connectUser('${u.id}')"><i class="fa-solid fa-video"></i> Kết nối</button>
      </div>
    </div>`).join('');
    if(typeof openModal==='function') openModal('interest-match-modal');
}

function connectUser(id) {
    const u=MOCK_USERS.find(x=>x.id===id); if(!u) return;
    if(typeof showToast==='function') showToast('🎉 Kết nối!',`Đang kết nối video call với ${u.name}...`,'success');
}

/* ===== UPLOAD ===== */
function initUpload() {
    document.getElementById('btn-upload-video')?.addEventListener('click',()=>{ if(typeof openModal==='function') openModal('upload-video-modal'); });
    
    const fileInput = document.getElementById('upload-file-input');
    const fileName = document.getElementById('upload-file-name');
    const dropZone = document.getElementById('upload-drop-zone');

    fileInput?.addEventListener('change',function(){
        if(fileName && this.files[0]) fileName.textContent='✅ '+this.files[0].name;
    });

    if (dropZone && fileInput) {
        ['dragenter', 'dragover'].forEach(eventName => {
            dropZone.addEventListener(eventName, (e) => {
                e.preventDefault();
                dropZone.classList.add('drag-over');
            }, false);
        });
        ['dragleave', 'drop'].forEach(eventName => {
            dropZone.addEventListener(eventName, (e) => {
                e.preventDefault();
                dropZone.classList.remove('drag-over');
            }, false);
        });
        dropZone.addEventListener('drop', (e) => {
            const dt = e.dataTransfer;
            const files = dt.files;
            if (files.length) {
                fileInput.files = files;
                if(fileName && files[0]) fileName.textContent='✅ '+files[0].name;
            }
        }, false);
    }

    document.getElementById('btn-submit-upload')?.addEventListener('click',submitUpload);
    document.querySelectorAll('#upload-tags-container .tag').forEach(t=>t.addEventListener('click',function(){this.classList.toggle('active');}));
}

async function submitUpload() {
    const title = document.getElementById('upload-title')?.value.trim();
    if (!title) {
        if (typeof showToast === 'function') showToast('Lỗi', 'Vui lòng nhập tiêu đề!', 'danger');
        return;
    }
    const tags = [...document.querySelectorAll('#upload-tags-container .tag.active')].map(t => t.dataset.value);
    const topic = tags[0] || 'Vlog';
    const desc = tags.map(t => '#' + t.replace(/\s+/g, '')).join(' ') + ' ' + (document.getElementById('upload-desc')?.value.trim() || '');
    const fileInput = document.getElementById('upload-file-input');
    const videoFile = fileInput && fileInput.files[0] ? fileInput.files[0] : null;

    try {
        const formData = new FormData();
        formData.append('title', title);
        formData.append('topic', topic);
        formData.append('desc', desc);
        if (videoFile) {
            formData.append('videoFile', videoFile);
        }

        // Show upload progress
        const submitBtn = document.getElementById('btn-submit-upload');
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Đang tải lên...';
        }

        const res = await fetch('/api/forum/upload', {
            method: 'POST',
            body: formData
        });
        const data = await res.json();
        if (res.ok) {
            const m = document.getElementById('upload-video-modal');
            if (m) m.classList.remove('active');
            
            // Reset form
            document.getElementById('upload-title').value = '';
            document.getElementById('upload-desc').value = '';
            document.getElementById('upload-file-name').textContent = '';
            if (fileInput) fileInput.value = '';
            document.querySelectorAll('#upload-tags-container .tag').forEach(t => t.classList.remove('active'));

            await loadVideosFromServer();

            if (typeof showToast === 'function') showToast('🎉 Đăng thành công!', 'Video của bạn đã lên diễn đàn!', 'success');
        } else {
            if (typeof showToast === 'function') showToast('Lỗi đăng video', data.error || 'Vui lòng đăng nhập trước.', 'danger');
        }

        // Restore button
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = '<i class="fa-solid fa-paper-plane"></i> Đăng lên Forum';
        }
    } catch (e) {
        console.error('[Forum] Lỗi upload:', e);
        if (typeof showToast === 'function') showToast('Lỗi kết nối', 'Không thể gửi video lên server.', 'danger');
        const submitBtn = document.getElementById('btn-submit-upload');
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = '<i class="fa-solid fa-paper-plane"></i> Đăng lên Forum';
        }
    }
}

/* ===== RADAR & LOCATION SCAN ===== */
function initRadarMap() {
    const btnScan = document.getElementById('btn-trigger-radar');
    if (!btnScan) return;
    btnScan.addEventListener('click', startRadarScan);
}

function startRadarScan() {
    const btnScan = document.getElementById('btn-trigger-radar');
    const sonarWrap = document.querySelector('.sonar-wrapper');
    const statusBadge = document.getElementById('radar-status-badge');
    const infoText = document.getElementById('radar-info-text');
    const nearbyList = document.getElementById('nearby-users-list');

    if (!btnScan || !sonarWrap) return;

    // Reset view
    btnScan.disabled = true;
    btnScan.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Đang định vị GPS...`;
    if (statusBadge) {
        statusBadge.textContent = 'Đang định vị...';
        statusBadge.style.background = 'rgba(234, 179, 8, 0.2)';
        statusBadge.style.color = '#eab308';
    }
    if (infoText) infoText.textContent = 'Đang lấy toạ độ GPS của thiết bị...';

    // Step 1: Request Real Geolocation (or fallback to simulated)
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            (position) => {
                ForumState.userLocation = {
                    lat: position.coords.latitude,
                    lng: position.coords.longitude
                };
                console.log('[GPS] Lấy vị trí thật thành công:', ForumState.userLocation);
                runSonarScan(2500);
            },
            (error) => {
                console.warn('[GPS] Không lấy được vị trí thật, chuyển sang định vị giả lập:', error.message);
                // Fallback coordinates (Hanoi center)
                ForumState.userLocation = { lat: 21.0285, lng: 105.8542 };
                runSonarScan(2500);
            },
            { timeout: 4000 }
        );
    } else {
        ForumState.userLocation = { lat: 21.0285, lng: 105.8542 };
        runSonarScan(2500);
    }
}

function runSonarScan(duration) {
    const btnScan = document.getElementById('btn-trigger-radar');
    const sonarWrap = document.querySelector('.sonar-wrapper');
    const statusBadge = document.getElementById('radar-status-badge');
    const infoText = document.getElementById('radar-info-text');

    sonarWrap.classList.add('scanning');
    if (btnScan) btnScan.innerHTML = `<i class="fa-solid fa-satellite-dish fa-spin"></i> Đang quét xung quanh...`;
    if (statusBadge) {
        statusBadge.textContent = 'Đang quét...';
        statusBadge.style.background = 'rgba(168, 85, 247, 0.2)';
        statusBadge.style.color = '#c084fc';
    }
    if (infoText) infoText.textContent = 'Phát sóng sonar tìm kiếm thiết bị lân cận...';

    // Hide any previous dots
    document.querySelectorAll('.sonar-dot').forEach(dot => dot.style.display = 'none');

    setTimeout(() => {
        // Scan completed
        sonarWrap.classList.remove('scanning');
        ForumState.radarScanned = true;

        if (statusBadge) {
            statusBadge.textContent = '📍 Đã kết nối';
            statusBadge.style.background = 'rgba(16, 185, 129, 0.2)';
            statusBadge.style.color = '#10b981';
        }
        if (infoText) infoText.textContent = 'Đã phát hiện 3 người dùng trong bán kính 3km!';
        if (btnScan) {
            btnScan.disabled = false;
            btnScan.innerHTML = `<i class="fa-solid fa-arrows-rotate"></i> Quét Lại Vị Trí`;
        }

        // Show dots on Radar map (simulated positions)
        document.querySelectorAll('.sonar-dot').forEach((dot, index) => {
            setTimeout(() => {
                dot.style.display = 'flex';
                // Add soft entrance animation effect
                dot.style.animation = 'pulse-dot 1.5s infinite, bounce 0.5s ease-out';
            }, index * 400);
        });

        // Display the list of nearby users
        renderNearbyUsers();

        // Reprioritize and render the feed
        renderFeed(ForumState.currentTopic);

        if (typeof showToast === 'function') {
            showToast('📍 Vị trí', 'Đã quét xong! Các video từ người dùng ở gần bạn đã được ưu tiên hiển thị trước.', 'success');
        }
    }, duration);
}

function renderNearbyUsers() {
    const listEl = document.getElementById('nearby-users-list');
    if (!listEl) return;

    // Filter users that have distance info and sort by distance
    const nearby = MOCK_USERS.filter(u => u.distance !== undefined).sort((a,b) => a.distance - b.distance);

    listEl.innerHTML = nearby.map(u => `
        <div class="nearby-user-item" onclick="openInterestModal()">
            <img src="https://api.dicebear.com/7.x/bottts/svg?seed=${u.seed}" class="nearby-user-avatar" alt="${u.name}">
            <div class="nearby-user-info">
                <div class="nearby-user-name">${u.name}</div>
                <div class="nearby-user-distance">
                    <i class="fa-solid fa-location-dot"></i> cách ${u.distance} km
                </div>
            </div>
            <button class="nearby-connect-btn" onclick="event.stopPropagation();connectUser('${u.id}')">
                <i class="fa-solid fa-video"></i> Gọi
            </button>
        </div>
    `).join('');

    listEl.style.display = 'block';
}

/* ===== INIT ===== */
function initForum() {
    loadVideosFromServer(); renderTrending();
    document.querySelectorAll('.ftopic-btn').forEach(b=>{
        b.addEventListener('click',function(){
            document.querySelectorAll('.ftopic-btn').forEach(x=>x.classList.remove('active'));
            this.classList.add('active');
            ForumState.currentTopic=this.dataset.topic;
            renderFeed(ForumState.currentTopic);
        });
    });
    document.getElementById('btn-find-similar-users')?.addEventListener('click',openInterestModal);
    document.getElementById('btn-close-comment-panel')?.addEventListener('click',closeCommentPanel);
    document.getElementById('comment-panel-overlay')?.addEventListener('click',function(e){if(e.target===this)closeCommentPanel();});
    document.getElementById('btn-send-comment')?.addEventListener('click',sendComment);
    document.getElementById('comment-input')?.addEventListener('keydown',e=>{if(e.key==='Enter')sendComment();});
    document.getElementById('tiktok-fs-close')?.addEventListener('click',closeFullscreen);
    document.addEventListener('keydown',e=>{if(e.key==='Escape')closeFullscreen();});
    const feed=document.getElementById('tiktok-fs-feed');
    if(feed){
        feed.addEventListener('scroll',()=>{
            const cards=[...feed.querySelectorAll('.tiktok-fs-card')];
            cards.forEach((c,i)=>{
                const r=c.getBoundingClientRect();
                const video = c.querySelector('.tiktok-fs-real-video');
                if(r.top>=0&&r.top<window.innerHeight/2){
                    ForumState.fsIndex=i;
                    trackInterest(MOCK_VIDEOS[i]?.topic);
                    if (video) {
                        video.play().catch(err => console.log('Autoplay prevented:', err));
                    }
                } else {
                    if (video) {
                        video.pause();
                    }
                }
            });
        });
    }
    const stats=[['fcs-videos',1284],['fcs-users',4821],['fcs-matches',892]];
    stats.forEach(([id,target])=>{const el=document.getElementById(id);if(!el)return;let cur=0,step=target/40;const iv=setInterval(()=>{cur=Math.min(cur+step,target);el.textContent=Math.floor(cur).toLocaleString();if(cur>=target)clearInterval(iv);},30);});
    initUpload();
    initRadarMap();
    setTimeout(initOnboarding,500);
    console.log('[Forum] Ready ✅');
}

if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',()=>setTimeout(initForum,300));
else setTimeout(initForum,300);

