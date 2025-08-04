// 유튜브 스팸 댓글 차단기 - Popup Script
// 작성자: YouTube SpamComment Blocker KR
// 기능: 팝업 UI 제어 및 통계 표시

document.addEventListener("DOMContentLoaded", () => {
    const toggle = document.getElementById("toggleEnabled");
    const statusText = document.getElementById("statusText");
    const blockedCountEl = document.getElementById("blockedCount");
    const resetCountBtn = document.getElementById("resetCount");

    // 초기 상태 불러오기
    loadInitialState();

    // 토글 이벤트 리스너
    toggle.addEventListener("change", () => {
        const enabled = toggle.checked;
        chrome.storage.local.set({ enabled });
        updateStatusText(enabled);
        
        // 활성화 상태 변경 시 현재 탭에 메시지 전송
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs[0] && tabs[0].url && tabs[0].url.includes("youtube.com")) {
                chrome.tabs.sendMessage(tabs[0].id, { 
                    action: "toggleState", 
                    enabled: enabled 
                });
            }
        });
    });

    // 초기화 버튼 이벤트 리스너
    resetCountBtn.addEventListener("click", () => {
        if (confirm("차단된 댓글 수를 초기화하시겠습니까?")) {
            chrome.storage.local.set({ blockedCount: 0 }, () => {
                blockedCountEl.textContent = "0";
                showNotification("차단 수가 초기화되었습니다.");
            });
        }
    });

    // 초기 상태 로드 함수
    function loadInitialState() {
        chrome.storage.local.get(["enabled", "blockedCount"], data => {
            const enabled = data.enabled ?? true;
            const blockedCount = data.blockedCount ?? 0;
            
            toggle.checked = enabled;
            updateStatusText(enabled);
            updateBlockedCount(blockedCount);
        });
    }

    // 상태 텍스트 업데이트 함수
    function updateStatusText(enabled) {
        if (enabled) {
            statusText.textContent = "✅ 활성화됨";
            statusText.className = "status-text enabled";
        } else {
            statusText.textContent = "⛔ 비활성화됨";
            statusText.className = "status-text disabled";
        }
    }

    // 차단된 댓글 수 업데이트 함수
    function updateBlockedCount(count) {
        blockedCountEl.textContent = count.toLocaleString();
        
        // 숫자에 따른 애니메이션 효과
        if (count > 0) {
            blockedCountEl.style.transform = "scale(1.1)";
            setTimeout(() => {
                blockedCountEl.style.transform = "scale(1)";
            }, 200);
        }
    }

    // 알림 표시 함수
    function showNotification(message) {
        const notification = document.createElement("div");
        notification.textContent = message;
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: #28a745;
            color: white;
            padding: 10px 15px;
            border-radius: 5px;
            font-size: 12px;
            z-index: 1000;
            animation: slideIn 0.3s ease;
        `;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.style.animation = "slideOut 0.3s ease";
            setTimeout(() => {
                document.body.removeChild(notification);
            }, 300);
        }, 2000);
    }

    // 스토리지 변경 감지 (실시간 업데이트)
    chrome.storage.onChanged.addListener((changes, namespace) => {
        if (namespace === "local") {
            if (changes.blockedCount) {
                updateBlockedCount(changes.blockedCount.newValue);
            }
            if (changes.enabled) {
                updateStatusText(changes.enabled.newValue);
            }
        }
    });

    // 다크모드 상태 적용 (옵션과 연동)
    chrome.storage.local.get("darkmode", data => {
        if (data.darkmode === true || localStorage.getItem("darkmode") === "true") {
            document.body.classList.add("dark");
        } else {
            document.body.classList.remove("dark");
        }
    });

    // CSS 애니메이션 추가
    const style = document.createElement("style");
    style.textContent = `
        @keyframes slideIn {
            from { transform: translateX(100%); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
        }
        @keyframes slideOut {
            from { transform: translateX(0); opacity: 1; }
            to { transform: translateX(100%); opacity: 0; }
        }
    `;
    document.head.appendChild(style);

    // 주기적으로 차단 수 업데이트 (백업)
    setInterval(() => {
        chrome.storage.local.get("blockedCount", data => {
            if (data.blockedCount !== undefined) {
                updateBlockedCount(data.blockedCount);
            }
        });
    }, 3000);
});