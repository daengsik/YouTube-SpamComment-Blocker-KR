// 유튜브 스팸 댓글 차단기 - Content Script
// 작성자: YouTube SpamComment Blocker KR
// 기능: 유튜브 댓글에서 스팸 패턴을 감지하여 차단

// 차단된 댓글 수 추적
let blockedCount = 0;
let processedComments = new Set();
let isEnabled = true;
let blockedNicknames = new Set(); // 차단된 닉네임 수집
let observer = null; // MutationObserver 참조 저장
let processTimeout = null; // 디바운싱 타이머 참조



// 사용자 정의 정규식 패턴 (동적으로 로드됨)
let customSpamPatterns = [];

// Observer 정리 함수
function cleanupObserver() {
    try {
        if (observer) {
            observer.disconnect();
            observer = null;
        }
        if (processTimeout) {
            clearTimeout(processTimeout);
            processTimeout = null;
        }
    } catch (error) {
        console.warn('[Observer 정리 중 에러]', error);
    }
}

// Observer 생성 함수
function createObserver() {
    try {
        // 기존 observer가 있다면 정리
        cleanupObserver();
        
        // 새로운 observer 생성
        observer = new MutationObserver((mutations) => {
            let shouldProcess = false;
            
            mutations.forEach(mutation => {
                if (mutation.type === 'childList') {
                    mutation.addedNodes.forEach(node => {
                        if (node.nodeType === Node.ELEMENT_NODE) {
                            if (node.matches && (node.matches("ytd-comment-thread-renderer") || node.matches("ytd-comment-renderer"))) {
                                shouldProcess = true;
                            }
                            if (node.querySelector && node.querySelector("ytd-comment-thread-renderer, ytd-comment-renderer")) {
                                shouldProcess = true;
                            }
                        }
                    });
                }
            });
            
            if (shouldProcess) {
                debouncedProcessComments();
            }
        });
        
        // Observer 시작
        observer.observe(document.body, { 
            childList: true, 
            subtree: true 
        });
        
        console.log('[Observer 생성 완료]');
    } catch (error) {
        console.error('[Observer 생성 실패]', error);
        // 에러 발생 시 잠시 후 재시도
        setTimeout(() => {
            if (isEnabled) {
                createObserver();
            }
        }, 1000);
    }
}

// 스팸 감지 함수 (키워드 중심 로직)
function isSpam(name) {
    if (!name || name.length < 2) return false;
    
    const lowerName = name.toLowerCase();
    
    // 1. 핵심 스팸 키워드 매칭 (앞뒤 문자열과 관계없이 차단)
    for (const keyword of coreSpamKeywords) {
        if (lowerName.includes(keyword.toLowerCase())) {
            console.log(`[핵심 키워드 차단] "${name}" - 키워드: "${keyword}"`);
            return true;
        }
    }
    
    // 2. 극단적인 정규식 패턴만 검사 (성능 최적화)
    const allPatterns = [...defaultSpamPatterns, ...customSpamPatterns];
    for (const pattern of allPatterns) {
        if (pattern.test(name)) {
            console.log(`[극단적 패턴 차단] "${name}" - 패턴: "${pattern.source}"`);
            return true;
        }
    }
    
    return false;
}

// 작성자 이름 추출 함수
function extractAuthorName(authorEl) {
    if (!authorEl) return "";
    const span = authorEl.querySelector("span");
    if (span) return span.textContent.trim();
    return authorEl.textContent.trim();
}

// 댓글 차단 함수
function hideCommentBox(box, reason) {
    if (!box || box.dataset.blocked) return;
    
    box.style.display = "none";
    box.dataset.blocked = "true";
    box.dataset.blockReason = reason;
    
    blockedCount++;
    
    console.log(`[차단됨] "${reason}" (총 차단: ${blockedCount}개)`);
    
    // 차단된 댓글 수를 storage에 저장
    try {
        chrome.storage.local.set({ blockedCount });
    } catch (error) {
        console.warn('[Storage 저장 실패]', error);
    }
    
    // 차단된 닉네임 수집이 활성화된 경우에만 수집
    try {
        chrome.storage.local.get("nicknameCollectionEnabled", data => {
            if (data.nicknameCollectionEnabled !== false) { // 기본값: true
                blockedNicknames.add(reason);
                chrome.storage.local.set({ 
                    blockedNicknames: Array.from(blockedNicknames)
                });
            }
        });
    } catch (error) {
        console.warn('[닉네임 수집 실패]', error);
    }
}

// 댓글 처리 함수
function processComments() {
    if (!isEnabled) return;
    
    try {
        const commentBoxes = document.querySelectorAll("ytd-comment-thread-renderer, ytd-comment-renderer");

        commentBoxes.forEach(box => {
            // 이미 처리된 댓글은 건너뛰기
            if (processedComments.has(box)) return;
            
            const authorEl = box.querySelector("#author-text");
            if (!authorEl) return;
            
            const name = extractAuthorName(authorEl);
            if (!name) return;

            if (isSpam(name)) {
                hideCommentBox(box, name);
            }
            
            // 처리된 댓글으로 표시
            processedComments.add(box);
        });
    } catch (error) {
        console.warn('[댓글 처리 중 에러]', error);
    }
}

// 디바운싱을 적용한 댓글 처리
function debouncedProcessComments() {
    try {
        if (processTimeout) {
            clearTimeout(processTimeout);
        }
        processTimeout = setTimeout(() => processComments(), 100);
    } catch (error) {
        console.warn('[디바운싱 처리 중 에러]', error);
    }
}

// 메시지 리스너 (팝업에서 토글 상태 변경 시)
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    try {
        if (message.action === "toggleState") {
            isEnabled = message.enabled;
            console.log(`차단 기능 ${isEnabled ? '활성화' : '비활성화'}`);
            
            if (isEnabled) {
                // 활성화 시 observer 재생성 및 즉시 처리
                createObserver();
                processComments();
            } else {
                // 비활성화 시 observer 정리
                cleanupObserver();
            }
        }
    } catch (error) {
        console.warn('[메시지 처리 중 에러]', error);
    }
});

// 페이지 언로드 시 정리
window.addEventListener('beforeunload', cleanupObserver);
window.addEventListener('unload', cleanupObserver);

// 메인 실행 로직
try {
    chrome.storage.local.get(["enabled", "blockedCount", "blockedNicknames", "customRegexPatterns"], ({ enabled = true, blockedCount: storedCount = 0, blockedNicknames: storedNicknames = [], customRegexPatterns = [] }) => {
        isEnabled = enabled;
        if (!isEnabled) return;

        // 저장된 차단 수와 닉네임 복원
        blockedCount = storedCount;
        blockedNicknames = new Set(storedNicknames);

        // 사용자 정의 정규식 패턴 로드
        customSpamPatterns = customRegexPatterns.map(pattern => {
            try {
                return new RegExp(pattern, "i");
            } catch (e) {
                console.warn(`잘못된 정규식 패턴: ${pattern}`);
                return null;
            }
        }).filter(Boolean);

        // 초기 댓글 처리
        processComments();
        
        // Observer 생성
        createObserver();
        
        // 주기적으로 차단 수와 닉네임 동기화
        setInterval(() => {
            try {
                chrome.storage.local.set({ 
                    blockedCount,
                    blockedNicknames: Array.from(blockedNicknames)
                });
            } catch (error) {
                console.warn('[주기적 동기화 실패]', error);
            }
        }, 5000);
    });
} catch (error) {
    console.error('[메인 로직 실행 실패]', error);
}