// 유튜브 스팸 댓글 차단기 - Options Script
// 작성자: YouTube SpamComment Blocker KR
// 기능: 추가 키워드 설정 관리 및 차단된 닉네임 내보내기



document.addEventListener("DOMContentLoaded", () => {
    // DOM 요소들
    const defaultKeywordsTextarea = document.getElementById("defaultKeywords");
    const customKeywordsTextarea = document.getElementById("customKeywords");
    const testInput = document.getElementById("testInput");
    const previewResult = document.getElementById("previewResult");
    const defaultList = document.getElementById("defaultList");
    const customKeywordList = document.getElementById("customKeywordList");
    const darkToggle = document.getElementById("darkToggle");
    
    // 정규식 패턴 편집 요소들
    const regexPatternsTextarea = document.getElementById("regexPatterns");
    const saveRegexBtn = document.getElementById("saveRegex");
    const resetRegexBtn = document.getElementById("resetRegex");
    const regexList = document.getElementById("regexList");
    
    // 통계 요소들
    const totalBlocked = document.getElementById("totalBlocked");
    const totalKeywords = document.getElementById("totalKeywords");
    const regexCount = document.getElementById("regexCount");

    // 🌙 다크모드 초기화
    if (localStorage.getItem("darkmode") === "true") {
        document.body.classList.add("dark");
        darkToggle.checked = true;
    }

    darkToggle.addEventListener("change", () => {
        if (darkToggle.checked) {
            document.body.classList.add("dark");
            localStorage.setItem("darkmode", "true");
        } else {
            document.body.classList.remove("dark");
            localStorage.setItem("darkmode", "false");
        }
    });

    // 고급설정 접기/펼치기 기능
    const advancedToggle = document.getElementById("advancedToggle");
    const advancedContent = document.getElementById("advancedContent");
    const advancedIcon = document.getElementById("advancedIcon");
    const advancedToggleText = document.getElementById("advancedToggleText");
    
    // 고급설정 상태 복원
    if (localStorage.getItem("advancedExpanded") === "true") {
        advancedContent.classList.add("show");
        advancedIcon.textContent = "🔽";
        advancedToggleText.textContent = "접기";
    }
    
    advancedToggle.addEventListener("click", () => {
        const isExpanded = advancedContent.classList.contains("show");
        
        if (isExpanded) {
            advancedContent.classList.remove("show");
            advancedIcon.textContent = "▶️";
            advancedToggleText.textContent = "펼치기";
            localStorage.setItem("advancedExpanded", "false");
        } else {
            advancedContent.classList.add("show");
            advancedIcon.textContent = "🔽";
            advancedToggleText.textContent = "접기";
            localStorage.setItem("advancedExpanded", "true");
        }
    });

    // 초기 데이터 로드
    loadAllData();

    // 기본 키워드 관리 (읽기 전용)
    defaultKeywordsTextarea.value = coreSpamKeywords.join("\n");
    renderKeywordList(coreSpamKeywords, defaultList, false);

    // 사용자 추가 키워드 로딩 및 렌더링
    chrome.storage.local.get("customKeywords", data => {
        const custom = data.customKeywords || [];
        customKeywordsTextarea.value = custom.join("\n");
        renderKeywordList(custom, customKeywordList, true);
        updatePreview(testInput.value, custom, defaultSpamPatterns);
    });

    // 정규식 패턴 로딩 및 렌더링
    chrome.storage.local.get("customRegexPatterns", data => {
        const customRegex = data.customRegexPatterns || defaultSpamPatterns;
        regexPatternsTextarea.value = customRegex.join("\n");
        renderRegexList(customRegex, regexList, true);
        updatePreview(testInput.value, customKeywordsTextarea.value.split("\n").map(k => k.trim()).filter(Boolean), customRegex);
    });

    // 버튼 이벤트 리스너들
    setupEventListeners();

    // 실시간 테스트
    testInput.addEventListener("input", () => {
        const customKeywords = customKeywordsTextarea.value.split("\n").map(k => k.trim()).filter(Boolean);
        const customRegex = regexPatternsTextarea.value.split("\n").map(r => r.trim()).filter(Boolean);
        updatePreview(testInput.value, customKeywords, customRegex);
    });

    // 모든 데이터 로드 함수
    function loadAllData() {
        chrome.storage.local.get(["customKeywords", "customRegexPatterns", "blockedCount", "blockedNicknames"], data => {
            const custom = data.customKeywords || [];
            const customRegex = data.customRegexPatterns || defaultSpamPatterns;
            const blockedCount = data.blockedCount || 0;
            const blockedNicknames = data.blockedNicknames || [];

            // 통계 업데이트
            updateStats(custom, customRegex, blockedCount, blockedNicknames);
        });
    }

    // 이벤트 리스너 설정
    function setupEventListeners() {
        // 사용자 키워드 저장
        document.getElementById("saveCustom").addEventListener("click", () => {
            const keywords = customKeywordsTextarea.value.split("\n").map(k => k.trim()).filter(Boolean);
            chrome.storage.local.set({ customKeywords: keywords }, () => {
                showNotification("추가 키워드가 저장되었습니다!", "success");
                renderKeywordList(keywords, customKeywordList, true);
                updatePreview(testInput.value, keywords, regexPatternsTextarea.value.split("\n").map(r => r.trim()).filter(Boolean));
                updateStats(keywords, regexPatternsTextarea.value.split("\n").map(r => r.trim()).filter(Boolean));
            });
        });

        // 사용자 키워드 전체 삭제
        document.getElementById("clearCustom").addEventListener("click", () => {
            if (confirm("모든 추가 키워드를 삭제하시겠습니까?")) {
                customKeywordsTextarea.value = "";
                chrome.storage.local.set({ customKeywords: [] }, () => {
                    showNotification("추가 키워드가 모두 삭제되었습니다!", "warning");
                    renderKeywordList([], customKeywordList, true);
                    updatePreview(testInput.value, [], regexPatternsTextarea.value.split("\n").map(r => r.trim()).filter(Boolean));
                });
            }
        });

        // 정규식 패턴 저장
        saveRegexBtn.addEventListener("click", () => {
            const patterns = regexPatternsTextarea.value.split("\n").map(p => p.trim()).filter(Boolean);
            
            // 정규식 유효성 검사
            const invalidPatterns = [];
            patterns.forEach(pattern => {
                try {
                    new RegExp(pattern, "i");
                } catch (e) {
                    invalidPatterns.push(pattern);
                }
            });
            
            if (invalidPatterns.length > 0) {
                showNotification(`잘못된 정규식 패턴이 있습니다: ${invalidPatterns.join(", ")}`, "error");
                return;
            }
            
            chrome.storage.local.set({ customRegexPatterns: patterns }, () => {
                showNotification("정규식 패턴이 저장되었습니다!", "success");
                renderRegexList(patterns, regexList, true);
                updatePreview(testInput.value, customKeywordsTextarea.value.split("\n").map(k => k.trim()).filter(Boolean), patterns);
                updateStats(customKeywordsTextarea.value.split("\n").map(k => k.trim()).filter(Boolean), patterns);
            });
        });

        // 정규식 패턴 초기화
        resetRegexBtn.addEventListener("click", () => {
            if (confirm("정규식 패턴을 기본값으로 초기화하시겠습니까?")) {
                regexPatternsTextarea.value = defaultSpamPatterns.join("\n");
                chrome.storage.local.set({ customRegexPatterns: defaultSpamPatterns }, () => {
                    showNotification("정규식 패턴이 기본값으로 초기화되었습니다!", "warning");
                    renderRegexList(defaultSpamPatterns, regexList, true);
                    updatePreview(testInput.value, customKeywordsTextarea.value.split("\n").map(k => k.trim()).filter(Boolean), defaultSpamPatterns);
                });
            }
        });

        // 차단된 닉네임 수집 토글
        const collectionToggle = document.getElementById("collectionToggle");
        
        // 수집 상태 로드
        chrome.storage.local.get("nicknameCollectionEnabled", data => {
            collectionToggle.checked = data.nicknameCollectionEnabled !== false; // 기본값: true
        });
        
        collectionToggle.addEventListener("change", () => {
            const enabled = collectionToggle.checked;
            chrome.storage.local.set({ nicknameCollectionEnabled: enabled }, () => {
                showNotification(`차단된 닉네임 수집이 ${enabled ? '활성화' : '비활성화'}되었습니다.`, enabled ? "success" : "warning");
            });
        });

        // 차단된 닉네임 내보내기
        document.getElementById("exportBlocked").addEventListener("click", () => {
            chrome.storage.local.get(["blockedNicknames", "blockedCount"], data => {
                const blockedNicknames = data.blockedNicknames || [];
                const blockedCount = data.blockedCount || 0;
                
                if (blockedNicknames.length === 0) {
                    showNotification("차단된 닉네임이 없습니다.", "warning");
                    return;
                }

                const exportData = {
                    exportDate: new Date().toISOString(),
                    totalBlocked: blockedCount,
                    uniqueNicknames: blockedNicknames.length,
                    blockedNicknames: blockedNicknames.sort(),
                    version: "1.3"
                };

                // JSON 파일로 내보내기
                const jsonBlob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" });
                const jsonUrl = URL.createObjectURL(jsonBlob);
                const jsonLink = document.createElement("a");
                jsonLink.href = jsonUrl;
                jsonLink.download = `blocked_nicknames_${new Date().toISOString().split('T')[0]}.json`;
                jsonLink.click();
                URL.revokeObjectURL(jsonUrl);

                // TXT 파일로도 내보내기
                const txtContent = `차단된 닉네임 목록\n` +
                    `내보내기 날짜: ${new Date().toLocaleString('ko-KR')}\n` +
                    `총 차단 수: ${blockedCount}\n` +
                    `고유 닉네임 수: ${blockedNicknames.length}\n` +
                    `\n=== 차단된 닉네임 목록 ===\n` +
                    blockedNicknames.sort().join('\n');

                const txtBlob = new Blob([txtContent], { type: "text/plain;charset=utf-8" });
                const txtUrl = URL.createObjectURL(txtBlob);
                const txtLink = document.createElement("a");
                txtLink.href = txtUrl;
                txtLink.download = `blocked_nicknames_${new Date().toISOString().split('T')[0]}.txt`;
                txtLink.click();
                URL.revokeObjectURL(txtUrl);

                showNotification(`${blockedNicknames.length}개의 닉네임을 내보냈습니다!`, "success");
            });
        });

        // 차단된 닉네임 초기화
        document.getElementById("clearBlocked").addEventListener("click", () => {
            if (confirm("차단된 닉네임 목록을 초기화하시겠습니까?")) {
                chrome.storage.local.set({ blockedNicknames: [], blockedCount: 0 }, () => {
                    showNotification("차단된 닉네임 목록이 초기화되었습니다!", "warning");
                    updateStats(customKeywordsTextarea.value.split("\n").map(k => k.trim()).filter(Boolean), regexPatternsTextarea.value.split("\n").map(r => r.trim()).filter(Boolean), 0, []);
                });
            }
        });

        // 테스트 버튼
        document.getElementById("testButton").addEventListener("click", () => {
            const customKeywords = customKeywordsTextarea.value.split("\n").map(k => k.trim()).filter(Boolean);
            const customRegex = regexPatternsTextarea.value.split("\n").map(r => r.trim()).filter(Boolean);
            updatePreview(testInput.value, customKeywords, customRegex);
        });
    }

    // 테스트 함수 (키워드 중심 로직)
    function updatePreview(testString, customKeywords, customRegex) {
        if (!testString) {
            previewResult.innerHTML = "테스트할 닉네임을 입력하세요.";
            previewResult.className = "";
            return;
        }

        const allKeywords = [...coreSpamKeywords, ...customKeywords];
        const lowerTestString = testString.toLowerCase();
        
        // 1. 핵심 스팸 키워드 매칭 검사 (앞뒤 문자열과 관계없이 차단)
        let matchedKeyword = null;
        for (const keyword of allKeywords) {
            if (lowerTestString.includes(keyword.toLowerCase())) {
                matchedKeyword = keyword;
                break;
            }
        }
        
        // 2. 극단적인 정규식 패턴만 검사 (성능 최적화)
        let matchedPattern = null;
        for (const pattern of customRegex) {
            try {
                const regex = new RegExp(pattern, "i");
                if (regex.test(testString)) {
                    matchedPattern = pattern;
                    break;
                }
            } catch (e) {
                // 잘못된 정규식은 무시
            }
        }

        if (matchedKeyword || matchedPattern) {
            let matchReason = "";
            if (matchedKeyword) {
                matchReason += `핵심 키워드: "${matchedKeyword}"`;
            }
            if (matchedPattern) {
                if (matchReason) matchReason += ", ";
                matchReason += `극단적 패턴: "${matchedPattern}"`;
            }
            
            previewResult.innerHTML = `✅ <span class="match">매칭됨 → 차단됨</span><br><small>${matchReason}</small>`;
            previewResult.className = "match";
        } else {
            previewResult.innerHTML = `❌ <span class="no-match">매칭되는 패턴 없음</span>`;
            previewResult.className = "no-match";
        }
    }

    // 키워드 렌더링
    function renderKeywordList(keywords, container, allowDelete) {
        container.innerHTML = "";
        
        if (keywords.length === 0) {
            container.innerHTML = '<div style="text-align: center; color: #6c757d; padding: 20px;">키워드가 없습니다.</div>';
            return;
        }

        keywords.forEach(keyword => {
            const item = document.createElement("span");
            item.className = "keyword-item";
            item.textContent = keyword;

            if (allowDelete) {
                const delBtn = document.createElement("button");
                delBtn.textContent = "❌";
                delBtn.title = "삭제";
                delBtn.addEventListener("click", () => {
                    const updated = keywords.filter(k => k !== keyword);
                    customKeywordsTextarea.value = updated.join("\n");
                    chrome.storage.local.set({ customKeywords: updated }, () => {
                        renderKeywordList(updated, container, true);
                        updatePreview(testInput.value, updated, regexPatternsTextarea.value.split("\n").map(r => r.trim()).filter(Boolean));
                        updateStats(updated, regexPatternsTextarea.value.split("\n").map(r => r.trim()).filter(Boolean));
                    });
                });
                item.appendChild(delBtn);
            }

            container.appendChild(item);
        });
    }

    // 정규식 패턴 렌더링
    function renderRegexList(patterns, container, allowDelete) {
        container.innerHTML = "";
        
        if (patterns.length === 0) {
            container.innerHTML = '<div style="text-align: center; color: #6c757d; padding: 20px;">정규식 패턴이 없습니다.</div>';
            return;
        }

        patterns.forEach(pattern => {
            const item = document.createElement("div");
            item.className = "regex-item";
            item.innerHTML = `<code>${pattern}</code>`;

            if (allowDelete) {
                const delBtn = document.createElement("button");
                delBtn.textContent = "❌";
                delBtn.title = "삭제";
                delBtn.addEventListener("click", () => {
                    const updated = patterns.filter(p => p !== pattern);
                    regexPatternsTextarea.value = updated.join("\n");
                    chrome.storage.local.set({ customRegexPatterns: updated }, () => {
                        renderRegexList(updated, container, true);
                        updatePreview(testInput.value, customKeywordsTextarea.value.split("\n").map(k => k.trim()).filter(Boolean), updated);
                        updateStats(customKeywordsTextarea.value.split("\n").map(k => k.trim()).filter(Boolean), updated);
                    });
                });
                item.appendChild(delBtn);
            }

            container.appendChild(item);
        });
    }

    // 통계 업데이트
    function updateStats(customKeywords, customRegex, blockedCount = 0, blockedNicknames = []) {
        const totalKeywordsCount = coreSpamKeywords.length + customKeywords.length;
        const regexPatternsCount = customRegex.length;

        totalBlocked.textContent = blockedCount.toLocaleString();
        totalKeywords.textContent = totalKeywordsCount.toLocaleString();
        regexCount.textContent = regexPatternsCount.toLocaleString();
    }

    // 알림 표시 함수
    function showNotification(message, type = "info") {
        const notification = document.createElement("div");
        notification.textContent = message;
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 12px 20px;
            border-radius: 6px;
            font-size: 14px;
            font-weight: 500;
            z-index: 1000;
            animation: slideIn 0.3s ease;
            max-width: 300px;
            word-wrap: break-word;
        `;

        // 타입별 스타일
        switch (type) {
            case "success":
                notification.style.background = "#28a745";
                notification.style.color = "white";
                break;
            case "error":
                notification.style.background = "#dc3545";
                notification.style.color = "white";
                break;
            case "warning":
                notification.style.background = "#ffc107";
                notification.style.color = "#212529";
                break;
            default:
                notification.style.background = "#17a2b8";
                notification.style.color = "white";
        }

        document.body.appendChild(notification);

        setTimeout(() => {
            notification.style.animation = "slideOut 0.3s ease";
            setTimeout(() => {
                if (document.body.contains(notification)) {
                    document.body.removeChild(notification);
                }
            }, 300);
        }, 3000);
    }

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
        .regex-item {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 8px 12px;
            margin: 4px 0;
            background: #f8f9fa;
            border-radius: 6px;
            border: 1px solid #e9ecef;
        }
        .regex-item code {
            font-family: 'Courier New', monospace;
            font-size: 12px;
            color: #495057;
            word-break: break-all;
        }
        .regex-item button {
            background: #dc3545;
            color: white;
            border: none;
            border-radius: 4px;
            padding: 2px 6px;
            cursor: pointer;
            font-size: 10px;
        }
    `;
    document.head.appendChild(style);

    // 주기적으로 통계 업데이트
    setInterval(() => {
        chrome.storage.local.get(["customKeywords", "customRegexPatterns", "blockedCount", "blockedNicknames"], data => {
            const custom = data.customKeywords || [];
            const customRegex = data.customRegexPatterns || defaultSpamPatterns;
            const blockedCount = data.blockedCount || 0;
            const blockedNicknames = data.blockedNicknames || [];
            updateStats(custom, customRegex, blockedCount, blockedNicknames);
        });
    }, 5000);
});