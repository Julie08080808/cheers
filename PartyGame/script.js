// ===== 房間管理功能 =====
let myPlayerId = null;
let roomStatePollingInterval = null;
let heartbeatInterval = null;

// 檢查玩家登入狀態（頁面載入時呼叫）
async function checkPlayerSession() {
    try {
        const response = await fetch('/api/player/state', {
            credentials: 'include'
        });

        if (!response.ok) {
            console.log('無法取得玩家狀態');
            return null;
        }

        const playerState = await response.json();
        console.log('📊 玩家狀態:', playerState);

        // 如果玩家在系統中，儲存 player_id
        if (playerState.status !== 'not_found') {
            // 從 cookie 讀取 player_id
            const cookies = document.cookie.split(';');
            for (let cookie of cookies) {
                const [key, value] = cookie.trim().split('=');
                if (key === 'player_id') {
                    myPlayerId = value;
                    console.log('✅ 從 cookie 恢復玩家 ID:', myPlayerId);
                    break;
                }
            }
        }

        return playerState;
    } catch (error) {
        console.error('❌ 檢查玩家狀態錯誤:', error);
        return null;
    }
}

// 根據玩家狀態自動導向
function autoRedirectBasedOnState(playerState, currentPage) {
    if (!playerState || playerState.status === 'not_found') {
        console.log('玩家未登入，留在當前頁面');
        return;
    }

    console.log('🔀 檢查是否需要導向，當前頁面:', currentPage);

    // 如果玩家在排隊中
    if (playerState.status === 'in_queue') {
        console.log('📝 玩家在排隊中，位置:', playerState.queue_position);
        // 如果不在 setup 頁面，導向到 setup 顯示排隊訊息
        if (currentPage !== 'setup') {
            console.log('導向到 setup 頁面');
            window.location.href = '/setup';
        }
        return;
    }

    // 如果玩家在遊戲中
    if (playerState.status === 'in_game') {
        const targetScreen = playerState.screen;
        console.log('🎮 玩家在遊戲中，目標畫面:', targetScreen);

        // 根據目標畫面導向
        if (targetScreen === 'setup' && currentPage !== 'setup') {
            console.log('導向到 setup 頁面（等待房間）');
            window.location.href = '/setup';
        } else if (targetScreen === 'wheel' && currentPage !== 'setup') {
            console.log('導向到 setup 頁面（轉盤）');
            window.location.href = '/setup';
        } else if (targetScreen === 'game' && currentPage !== 'game') {
            console.log('導向到 game 頁面');
            window.location.href = '/game';
        } else {
            console.log('已在正確頁面，不需導向');
        }
    }
}

// 加入房間
async function joinRoom() {
    console.log('準備加入房間...');

    const playerNameInput = document.getElementById('playerNameInput');
    if (!playerNameInput) {
        console.error('找不到 playerNameInput 元素');
        alert('頁面元素錯誤，請重新整理');
        return;
    }

    const playerName = playerNameInput.value.trim();
    console.log('玩家名稱:', playerName);

    if (!playerName) {
        alert('請輸入你的名稱');
        return;
    }

    if (playerName.length > 10) {
        alert('名稱不能超過 10 個字');
        return;
    }

    try {
        console.log('發送加入房間請求...');
        const response = await fetch('/api/room/join', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ player_name: playerName })
        });

        console.log('收到回應:', response.status);
        const data = await response.json();
        console.log('回應資料:', data);

        if (response.ok && data.success) {
            myPlayerId = data.player_id;
            console.log('✅ 成功加入，玩家ID:', myPlayerId);

            // 檢查是否在排隊中
            if (data.status === 'in_queue') {
                console.log('📝 進入排隊列表，位置:', data.queue_position);
                alert(`房間已滿！\n你是第 ${data.queue_position} 位排隊玩家\n當有玩家離開時會自動進入房間`);

                // 隱藏加入區域，顯示排隊訊息
                const joinSection = document.getElementById('joinSection');
                if (joinSection) joinSection.style.display = 'none';

                // TODO: 可以在這裡顯示排隊專用的 UI
                // 目前先用 alert 處理

                // 開始心跳保持連線
                startHeartbeat();

                // 開始輪詢房間狀態（檢查是否進入房間）
                startRoomStatePolling();
            } else {
                // 成功進入房間
                console.log('✅ 成功進入房間');

                // 隱藏加入區域，顯示等待區域
                const joinSection = document.getElementById('joinSection');
                const waitingSection = document.getElementById('waitingSection');

                if (joinSection) joinSection.style.display = 'none';
                if (waitingSection) waitingSection.style.display = 'block';

                // 手動添加 is_host 欄位（因為 API 返回的 room_state 沒有這個欄位）
                data.room_state.is_host = (data.player_id === data.room_state.host_id);
                data.room_state.my_player_id = data.player_id;

                console.log('房間狀態:', data.room_state);
                console.log('我是房主嗎？', data.room_state.is_host);

                // 更新房間狀態
                updateRoomUI(data.room_state);

                // 開始輪詢房間狀態
                startRoomStatePolling();

                // 開始心跳
                startHeartbeat();
            }
        } else {
            console.error('❌ 加入失敗:', data);
            alert(data.detail || data.message || '加入房間失敗');
        }
    } catch (error) {
        console.error('❌ 加入房間錯誤:', error);
        alert('連線失敗，請檢查網路連線和服務是否啟動\n錯誤: ' + error.message);
    }
}

// 離開房間
async function leaveRoom() {
    if (!myPlayerId) return;

    try {
        await fetch('/api/room/leave', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ player_id: myPlayerId })
        });
    } catch (error) {
        console.error('離開房間錯誤:', error);
    }

    // 停止輪詢和心跳
    stopRoomStatePolling();
    stopHeartbeat();

    // 清除前端暫存，確保狀態重置
    sessionStorage.clear();

    // 返回模式選擇頁
    window.location.href = '/mode';
}

// 開始輪詢房間狀態
function startRoomStatePolling() {
    // 立即獲取一次
    pollRoomState();

    // 每秒輪詢一次
    roomStatePollingInterval = setInterval(pollRoomState, 1000);
}

// 停止輪詢
function stopRoomStatePolling() {
    if (roomStatePollingInterval) {
        clearInterval(roomStatePollingInterval);
        roomStatePollingInterval = null;
    }
}

// ===== 轉盤狀態輪詢 =====
let wheelStatePollingInterval = null;
let wheelHasSpun = false;  // 追蹤轉盤是否已經轉過

// 開始輪詢轉盤狀態
function startWheelStatePolling() {
    console.log('🔄 [重要] 開始輪詢轉盤狀態...');
    console.log('   - 輪詢間隔: 每 0.5 秒');
    console.log('   - 玩家ID:', myPlayerId);

    // 重置轉盤狀態（重要！確保可以偵測新的轉盤）
    wheelHasSpun = false;
    console.log('   - 重置 wheelHasSpun = false');

    // 停止舊的輪詢（如果有）
    if (wheelStatePollingInterval) {
        clearInterval(wheelStatePollingInterval);
        wheelStatePollingInterval = null;
    }

    // 立即執行一次
    pollWheelState();

    // 然後每 0.5 秒輪詢一次
    wheelStatePollingInterval = setInterval(pollWheelState, 500);
}

// 停止輪詢轉盤狀態
function stopWheelStatePolling() {
    if (wheelStatePollingInterval) {
        clearInterval(wheelStatePollingInterval);
        wheelStatePollingInterval = null;
    }
}

// 輪詢轉盤狀態
async function pollWheelState() {
    try {
        const response = await fetch('/api/wheel/state', {
            credentials: 'include'
        });

        if (!response.ok) {
            console.error('❌ 轉盤狀態請求失敗:', response.status);
            return;
        }

        const wheelState = await response.json();

        // 詳細日誌（包含候選人資訊）
        console.log('📊 [輪詢] 轉盤狀態:', {
            spinning: wheelState.wheel_spinning,
            finished: wheelState.wheel_finished,
            seed: wheelState.spin_seed,
            winner: wheelState.winner_index,
            hasSpun: wheelHasSpun,
            candidates: wheelState.candidates?.length || 0
        });

        // 如果轉盤開始旋轉，且還沒轉過
        if (wheelState.wheel_spinning && !wheelHasSpun) {
            console.log('🎰 [所有玩家] 轉盤開始旋轉！');
            console.log('   - 種子:', wheelState.spin_seed);
            console.log('   - 中獎索引:', wheelState.winner_index);
            console.log('   - 候選人數:', wheelState.candidates?.length);

            wheelHasSpun = true;

            // 更新提示訊息
            const hostMessage = document.getElementById('hostMessage');
            const viewerMessage = document.getElementById('viewerMessage');
            if (hostMessage) hostMessage.style.display = 'none';
            if (viewerMessage) {
                viewerMessage.textContent = '🎰 轉盤正在旋轉中...';
                viewerMessage.style.display = 'block';
            }

            // 驗證必要參數
            if (wheelState.spin_seed && wheelState.winner_index !== null && wheelState.winner_index !== undefined) {
                console.log('✅ 啟動同步轉盤動畫');
                // 使用同步的隨機種子和中獎索引來啟動轉盤動畫
                startSyncedWheelSpin(wheelState.spin_seed, wheelState.winner_index);
            } else {
                console.error('❌ 轉盤參數不完整:', wheelState);
            }
        }

        // 如果轉盤已完成
        if (wheelState.wheel_finished && wheelState.player_order && wheelState.player_order.length > 0) {
            console.log('✅ [所有玩家] 轉盤完成！');
            console.log('   - 玩家順序:', wheelState.player_order);

            stopWheelStatePolling();

            // 更新提示訊息
            const viewerMessage = document.getElementById('viewerMessage');
            if (viewerMessage) {
                viewerMessage.textContent = '✅ 抽籤完成！順序如下：';
                viewerMessage.style.color = 'var(--neon-green)';
                viewerMessage.style.display = 'block';
            }

            // 顯示結果
            displayWheelResult(wheelState.player_order);
        }
    } catch (error) {
        console.error('❌ 輪詢轉盤狀態錯誤:', error);
    }
}

// 輪詢房間狀態
async function pollRoomState() {
    try {
        const response = await fetch('/api/room/state', {
            credentials: 'include'
        });

        const state = await response.json();
        console.log('📊 [房間輪詢] 遊戲狀態:', {
            game_started: state.game_started,
            player_count: state.player_count,
            my_id: myPlayerId,
            host_id: state.host_id
        });

        // 如果已經不在房間中，返回模式選擇頁
        if (!state.is_in_room) {
            stopRoomStatePolling();
            stopHeartbeat();
            alert('你已被移出房間');
            window.location.href = '/mode';
            return;
        }

        // 如果遊戲已開始，顯示轉盤區域
        const wheelSection = document.getElementById('wheelSection');
        const waitingSection = document.getElementById('waitingSection');

        if (state.game_started && wheelSection && wheelSection.style.display !== 'block') {
            console.log('🎰 [重要] 遊戲已開始，切換到轉盤畫面！');
            console.log('   - 我的ID:', myPlayerId);
            console.log('   - 房主ID:', state.host_id);
            console.log('   - 我是房主:', myPlayerId === state.host_id);

            if (waitingSection) waitingSection.style.display = 'none';
            wheelSection.style.display = 'block';

            // 設定轉盤
            setupWheelFromPlayers(state.players);

            // 判斷是否為房主，只有房主可以轉盤
            const isHost = (myPlayerId === state.host_id);
            const spinBtn = document.getElementById('spinBtn');
            const hostMessage = document.getElementById('hostMessage');
            const viewerMessage = document.getElementById('viewerMessage');

            if (isHost) {
                // 房主可以控制轉盤
                spinBtn.disabled = false;
                spinBtn.style.opacity = '1';
                if (hostMessage) hostMessage.style.display = 'block';
                if (viewerMessage) viewerMessage.style.display = 'none';
                console.log('✅ 你是房主，可以控制轉盤');
            } else {
                // 其他玩家只能觀看
                spinBtn.disabled = true;
                spinBtn.style.opacity = '0.5';
                if (hostMessage) hostMessage.style.display = 'none';
                if (viewerMessage) viewerMessage.style.display = 'block';
                console.log('👀 你不是房主，等待房主轉動轉盤');
            }

            // 停止房間狀態輪詢，改為輪詢轉盤狀態
            stopRoomStatePolling();
            startWheelStatePolling();
        } else {
            // 更新 UI
            updateRoomUI(state);
        }
    } catch (error) {
        console.error('輪詢房間狀態錯誤:', error);
    }
}

// 更新房間 UI
function updateRoomUI(state) {
    console.log('更新房間 UI，狀態:', state);

    // 更新玩家數量
    const playerCountEl = document.getElementById('playerCount');
    if (playerCountEl) {
        playerCountEl.textContent = state.player_count;
    }

    // 更新玩家列表
    const playerList = document.getElementById('playerList');
    if (playerList) {
        if (state.player_count === 0) {
            playerList.innerHTML = '<li style="color: #666; text-align: center;">等待玩家加入...</li>';
        } else {
            playerList.innerHTML = state.players.map((player, index) => {
                const hostBadge = player.is_host ? ' <span style="color: var(--neon-pink);">👑 房主</span>' : '';
                const meBadge = player.player_id === myPlayerId ? ' <span style="color: var(--neon-green);">(我)</span>' : '';
                return `<li class="order-item">
                    <span>${index + 1}. ${player.player_name}${hostBadge}${meBadge}</span>
                </li>`;
            }).join('');
        }
    }

    // 判斷是否為房主（直接比對玩家ID和房主ID）
    const isHost = (myPlayerId && myPlayerId === state.host_id);

    const startGameBtn = document.getElementById('startGameBtn');
    const waitingText = document.getElementById('waitingText');

    console.log('我的玩家ID:', myPlayerId);
    console.log('房主ID:', state.host_id);
    console.log('我是房主嗎:', isHost);
    console.log('可以開始遊戲:', state.can_start);

    // 更新偵錯面板
    const debugMyId = document.getElementById('debugMyId');
    const debugHostId = document.getElementById('debugHostId');
    const debugIsHost = document.getElementById('debugIsHost');
    const debugCanStart = document.getElementById('debugCanStart');

    if (debugMyId) debugMyId.textContent = myPlayerId || '未設定';
    if (debugHostId) debugHostId.textContent = state.host_id || '無';
    if (debugIsHost) {
        debugIsHost.textContent = isHost ? '✅ 是' : '❌ 否';
        debugIsHost.style.color = isHost ? '#0f0' : '#f00';
    }
    if (debugCanStart) {
        debugCanStart.textContent = state.can_start ? '✅ 是' : '❌ 否';
        debugCanStart.style.color = state.can_start ? '#0f0' : '#f00';
    }

    if (isHost) {
        console.log('✅ 顯示房主的「開始遊戲」按鈕');
        if (startGameBtn) {
            startGameBtn.style.display = 'inline-block';
            startGameBtn.disabled = !state.can_start;
            console.log('按鈕狀態:', startGameBtn.disabled ? '禁用' : '可用');
        }
        if (waitingText) {
            waitingText.style.display = 'none';
        }
    } else {
        console.log('⏳ 顯示「等待房主」文字');
        if (startGameBtn) {
            startGameBtn.style.display = 'none';
        }
        if (waitingText) {
            waitingText.style.display = 'block';
        }
    }
}

// 開始遊戲（房主）
async function startGame() {
    console.log('🎮 房主點擊「開始遊戲」');
    console.log('玩家ID:', myPlayerId);

    if (!myPlayerId) {
        console.error('❌ 沒有玩家ID，無法開始遊戲');
        alert('錯誤：無法獲取玩家ID');
        return;
    }

    try {
        console.log('發送開始遊戲請求...');
        const response = await fetch('/api/room/start', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ player_id: myPlayerId })
        });

        console.log('收到回應:', response.status);
        const data = await response.json();
        console.log('回應資料:', data);

        if (response.ok && data.success) {
            console.log('✅ 遊戲開始成功！所有玩家即將進入轉盤畫面');
            // 輪詢會自動檢測到遊戲已開始，並切換到轉盤畫面
        } else {
            console.error('❌ 開始遊戲失敗:', data);
            alert(data.detail || data.message || '開始遊戲失敗');
        }
    } catch (error) {
        console.error('❌ 開始遊戲錯誤:', error);
        alert('開始遊戲失敗：' + error.message);
    }
}

// 心跳保持連線
function startHeartbeat() {
    heartbeatInterval = setInterval(async () => {
        if (!myPlayerId) return;

        try {
            await fetch('/api/room/heartbeat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ player_id: myPlayerId })
            });
        } catch (error) {
            console.error('心跳錯誤:', error);
        }
    }, 5000); // 每 5 秒一次心跳
}

function stopHeartbeat() {
    if (heartbeatInterval) {
        clearInterval(heartbeatInterval);
        heartbeatInterval = null;
    }
}

// 從玩家列表設定轉盤
function setupWheelFromPlayers(players) {
    numPlayers = players.length;

    // 儲存玩家資料（包含名稱）
    window.allPlayers = players.map(p => ({
        player_id: p.player_id,
        player_name: p.player_name,
        score: 0
    }));

    // 設定轉盤
    canvas = document.getElementById("wheelCanvas");
    if (!canvas) {
        console.error('找不到 wheelCanvas');
        return;
    }

    ctx = canvas.getContext("2d");
    arc = (2 * Math.PI) / numPlayers;
    startAngle = 0;

    // 繪製轉盤
    drawWheelWithNames();

    // 注意：按鈕的啟用狀態由 pollRoomState 控制
    // 這裡不修改按鈕，避免覆蓋 HTML 中的 onclick="spinWheel()"

    // 更新順序列表
    document.getElementById("orderList").innerHTML = '<li style="color: #666; text-align: center;">等待抽籤...</li>';

    console.log('✅ 轉盤已設定完成，玩家數:', numPlayers);
}

// 繪製帶有玩家名稱的轉盤
function drawWheelWithNames() {
    if (!canvas || !ctx) return;

    const outsideRadius = 190;
    const textRadius = 150;
    const insideRadius = 40;

    ctx.clearRect(0, 0, 400, 400);
    ctx.strokeStyle = "#0f0c29";
    ctx.lineWidth = 2;

    for (let i = 0; i < numPlayers; i++) {
        let angle = startAngle + i * arc;
        ctx.fillStyle = colors[i % colors.length];
        ctx.beginPath();
        ctx.arc(200, 200, outsideRadius, angle, angle + arc, false);
        ctx.arc(200, 200, insideRadius, angle + arc, angle, true);
        ctx.stroke();
        ctx.fill();

        // 繪製玩家名稱
        ctx.save();
        ctx.fillStyle = "white";
        ctx.font = "bold 18px Arial";
        ctx.translate(
            200 + Math.cos(angle + arc / 2) * textRadius,
            200 + Math.sin(angle + arc / 2) * textRadius
        );
        ctx.rotate(angle + arc / 2 + Math.PI / 2);

        const playerName = window.allPlayers[i].player_name;
        const text = playerName.length > 6 ? playerName.substring(0, 6) + '...' : playerName;
        ctx.fillText(text, -ctx.measureText(text).width / 2, 0);
        ctx.restore();
    }
}

// 轉盤抽順序
function spinWheelForOrder() {
    if (isSpinning) return;
    isSpinning = true;

    const spinBtn = document.getElementById("spinBtn");
    if (spinBtn) spinBtn.disabled = true;

    document.getElementById("orderList").innerHTML = '<li style="color: #666; text-align: center;">抽籤中...</li>';

    spinArcStart = Math.random() * 10 + 10;
    spinTime = 0;
    spinTimeTotal = Math.random() * 3000 + 4000;
    rotateWheelForOrder();
}

// 轉動轉盤
function rotateWheelForOrder() {
    spinTime += 30;
    if (spinTime >= spinTimeTotal) {
        stopRotateWheelForOrder();
        return;
    }
    let spinAngle = spinArcStart - easeOut(spinTime, 0, spinArcStart, spinTimeTotal);
    startAngle += (spinAngle * Math.PI / 180);
    drawWheelWithNames();
    spinTimeout = setTimeout(rotateWheelForOrder, 30);
}

// 停止轉盤並顯示結果
function stopRotateWheelForOrder() {
    clearTimeout(spinTimeout);
    isSpinning = false;

    // 計算中獎索引
    const degrees = startAngle * 180 / Math.PI + 90;
    const arcd = 360 / numPlayers;
    let index = Math.floor((360 - (degrees % 360)) / arcd) % numPlayers;
    let winnerIndex = index;

    // 從中獎者開始排序
    let orderedPlayers = [];
    for (let i = winnerIndex; i < numPlayers; i++) {
        orderedPlayers.push(window.allPlayers[i]);
    }
    for (let i = 0; i < winnerIndex; i++) {
        orderedPlayers.push(window.allPlayers[i]);
    }

    // 儲存排序後的玩家列表
    gamePlayers = orderedPlayers.map((player, idx) => ({
        name: player.player_name,
        player_id: player.player_id,
        score: 0,
        order: idx + 1
    }));

    sessionStorage.setItem('cheers_players', JSON.stringify(gamePlayers));
    sessionStorage.setItem('cheers_round', '1');
    sessionStorage.setItem('cheers_turn', '0');

    // 顯示順序結果
    let listHtml = "";
    orderedPlayers.forEach((player, index) => {
        listHtml += `<li class="order-item">
            <span>第 ${index + 1} 順位</span>
            <strong>${player.player_name}</strong>
        </li>`;
    });
    document.getElementById("orderList").innerHTML = listHtml;

    // 修改按鈕為進入遊戲
    const btn = document.getElementById("spinBtn");
    if (btn) {
        btn.disabled = false;
        btn.innerText = "進入遊戲";
        btn.onclick = () => {
            console.log('進入遊戲，玩家順序:', gamePlayers);
            goToPage('/game');
        };
    }
}

// --- 狀態管理 (從 sessionStorage 讀取) ---
let gamePlayers = JSON.parse(sessionStorage.getItem('cheers_players') || '[]');
let currentGameMode = sessionStorage.getItem('cheers_mode') || 'family';
let currentRound = parseInt(sessionStorage.getItem('cheers_round') || '1');
let currentPlayerIndex = parseInt(sessionStorage.getItem('cheers_turn') || '0');

// --- 常數與設定 ---
const totalRounds = 5;
const LOSE_THRESHOLD = 3;
let isRolling = false;
let currentOpponentIndex = -1;

const wineColors = {
    red: { bg: "#ff4d4d", shadow: "#ff0000" },
    blue: { bg: "#4d4dff", shadow: "#0000ff" },
    yellow: { bg: "#ffcc00", shadow: "#ffa500" },
    green: { bg: "#39ff14", shadow: "#00cc00" } 
};

// 題目現在從後端 API 獲取，不再硬編碼

// --- 狀態保存函式 ---
function saveGameState() {
    sessionStorage.setItem('cheers_players', JSON.stringify(gamePlayers));
    sessionStorage.setItem('cheers_mode', currentGameMode);
    sessionStorage.setItem('cheers_round', currentRound);
    sessionStorage.setItem('cheers_turn', currentPlayerIndex);
}

// --- 回合管理函式 ---
async function incrementRound() {
    // 闔家歡模式：有人喝酒就增加回合數
    if (currentGameMode !== 'family') {
        return; // 酒鬼模式不使用回合制
    }

    currentRound++;
    console.log(`🍺 有人喝酒！回合 +1 → ${currentRound}/${totalRounds}`);

    // 同步到後端（後端會自動檢查是否結束）
    try {
        await fetch('/api/game/increment-round', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
                player_id: myPlayerId,
                new_round: currentRound
            })
        });
    } catch (error) {
        console.error('❌ 回合同步失敗:', error);
    }

    saveGameState();
    updateRoundDisplay();

    // 遊戲結束檢查由後端處理，所有玩家通過輪詢同步
}

// --- 頁面導航 ---
function goToPage(url) {
    window.location.href = url;
}

// --- 模式選擇頁面邏輯 ---
function initFamilyMode() { 
    sessionStorage.setItem('cheers_mode', 'family'); 
    goToPage('/setup'); 
}
function initAlcoholicMode() { 
    sessionStorage.setItem('cheers_mode', 'drunk'); 
    goToPage('/setup'); 
}

// --- 設定頁面 (轉盤) 邏輯 ---
let canvas, ctx, numPlayers, arc, startAngle = 0, spinTimeout = null, spinArcStart = 10, spinTime = 0, spinTimeTotal = 0, isSpinning = false;
const colors = ["#FF0055", "#00F2FE", "#FFE600", "#39ff14", "#9D00FF", "#FF6B6B", "#4facfe", "#FF9900"];

function setupWheel() {
    let input = document.getElementById("playerCount").value;
    numPlayers = parseInt(input);
    if(numPlayers < 2) { alert("人數至少 2 人"); return; }
    arc = (2 * Math.PI) / numPlayers;
    canvas = document.getElementById("wheelCanvas");
    if (canvas) {
        ctx = canvas.getContext("2d");
        drawWheel();
        const spinBtn = document.getElementById("spinBtn");
        spinBtn.disabled = false;
        spinBtn.innerText = "開始轉盤";
        spinBtn.onclick = spinWheel;
        document.getElementById("orderList").innerHTML = '<li style="color: #666; text-align: center;">準備完成，請按開始</li>';
    }
}

function drawWheel() {
    if (canvas.getContext) {
        let outsideRadius = 190; let textRadius = 150; let insideRadius = 40;
        ctx.clearRect(0, 0, 400, 400); ctx.strokeStyle = "#0f0c29"; ctx.lineWidth = 2;
        for(let i = 0; i < numPlayers; i++) {
            let angle = startAngle + i * arc;
            ctx.fillStyle = colors[i % colors.length];
            ctx.beginPath(); ctx.arc(200, 200, outsideRadius, angle, angle + arc, false);
            ctx.arc(200, 200, insideRadius, angle + arc, angle, true);
            ctx.stroke(); ctx.fill();
            ctx.save(); ctx.shadowOffsetX = 2; ctx.shadowOffsetY = 2; ctx.shadowBlur = 4; ctx.shadowColor = "rgba(0,0,0,0.5)";
            ctx.fillStyle = "white"; ctx.font = "bold 24px Arial";
            ctx.translate(200 + Math.cos(angle + arc / 2) * textRadius, 200 + Math.sin(angle + arc / 2) * textRadius);
            ctx.rotate(angle + arc / 2 + Math.PI / 2);
            let text = (i + 1) + "號"; ctx.fillText(text, -ctx.measureText(text).width / 2, 0); ctx.restore();
        }
    }
}

// 房主點擊「開始轉盤」按鈕
async function spinWheel() {
    if (isSpinning) return;

    console.log('🎰 房主點擊開始轉盤');

    if (!myPlayerId) {
        console.error('❌ 沒有玩家ID');
        alert('錯誤：無法獲取玩家ID');
        return;
    }

    try {
        const response = await fetch('/api/wheel/spin', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ player_id: myPlayerId })
        });

        const data = await response.json();

        if (response.ok && data.success) {
            console.log('✅ 轉盤API呼叫成功，種子:', data.spin_seed, '中獎索引:', data.winner_index);
            // 房主也會透過輪詢來啟動轉盤動畫，確保和其他玩家同步
        } else {
            console.error('❌ 轉盤API失敗:', data);
            alert(data.detail || '轉盤啟動失敗');
        }
    } catch (error) {
        console.error('❌ 轉盤API錯誤:', error);
        alert('轉盤啟動失敗：' + error.message);
    }
}

// 所有玩家同步啟動轉盤動畫（使用相同的隨機種子）
function startSyncedWheelSpin(seed, winnerIndex) {
    if (isSpinning) return;

    console.log('🎰 啟動同步轉盤動畫，種子:', seed, '中獎索引:', winnerIndex);

    isSpinning = true;

    const spinBtn = document.getElementById("spinBtn");
    if (spinBtn) spinBtn.disabled = true;

    document.getElementById("orderList").innerHTML = '<li style="color: #666; text-align: center;">抽籤中...</li>';

    // 使用種子來生成一致的旋轉參數
    const seededRandom = seed / 10000;  // 0-1 之間的值
    spinArcStart = seededRandom * 10 + 10;  // 10-20 之間
    spinTime = 0;
    spinTimeTotal = seededRandom * 3000 + 4000;  // 4000-7000ms

    // 儲存中獎索引，稍後用於顯示結果
    window.syncedWinnerIndex = winnerIndex;

    rotateSyncedWheel();
}

// 旋轉轉盤（同步版本）
function rotateSyncedWheel() {
    spinTime += 30;
    if (spinTime >= spinTimeTotal) {
        stopSyncedWheel();
        return;
    }
    let spinAngle = spinArcStart - easeOut(spinTime, 0, spinArcStart, spinTimeTotal);
    startAngle += (spinAngle * Math.PI / 180);
    drawWheelWithNames();
    spinTimeout = setTimeout(rotateSyncedWheel, 30);
}

// 停止轉盤並通知後端完成
async function stopSyncedWheel() {
    clearTimeout(spinTimeout);
    isSpinning = false;

    console.log('🎰 轉盤動畫完成，通知後端...');

    // 呼叫後端API完成轉盤
    try {
        const response = await fetch('/api/wheel/finish', {
            method: 'POST'
        });

        const data = await response.json();

        if (response.ok && data.success) {
            console.log('✅ 轉盤完成通知成功');
        }
    } catch (error) {
        console.error('❌ 轉盤完成通知失敗:', error);
    }
}

// 顯示轉盤結果
function displayWheelResult(playerOrder) {
    console.log('📋 顯示玩家順序:', playerOrder);

    const orderList = document.getElementById("orderList");
    if (!orderList) return;

    let listHtml = playerOrder.map(p =>
        `<li>${p.order}. ${p.player_name}</li>`
    ).join('');

    orderList.innerHTML = listHtml;

    // 儲存玩家順序到全域變數，供遊戲使用
    gamePlayers = playerOrder.map(p => ({
        name: p.player_name,
        player_id: p.player_id,
        score: 0,
        order: p.order
    }));

    currentPlayerIndex = 0;
    currentRound = 1;

    // ✅ 重要：儲存到 sessionStorage，確保頁面跳轉後資料不遺失
    sessionStorage.setItem('cheers_players', JSON.stringify(gamePlayers));
    sessionStorage.setItem('cheers_round', '0');
    sessionStorage.setItem('cheers_turn', '0');
    sessionStorage.setItem('new_game_timestamp', Date.now().toString()); // ✅ 標記新遊戲開始時間

    console.log('✅ 遊戲玩家順序已設定並儲存:', gamePlayers);

    // 3秒後跳轉到遊戲頁面
    setTimeout(() => {
        console.log('🎮 跳轉到遊戲頁面...');
        window.location.href = '/game';
    }, 3000);
}

function rotateWheel() {
    spinTime += 30; if(spinTime >= spinTimeTotal) { stopRotateWheel(); return; }
    let spinAngle = spinArcStart - easeOut(spinTime, 0, spinArcStart, spinTimeTotal);
    startAngle += (spinAngle * Math.PI / 180); drawWheel(); spinTimeout = setTimeout('rotateWheel()', 30);
}

function stopRotateWheel() {
    clearTimeout(spinTimeout);
    isSpinning = false;
    const degrees = startAngle * 180 / Math.PI + 90; 
    const arcd = 360 / numPlayers;
    let index = Math.floor((360 - (degrees % 360)) / arcd) % numPlayers;
    let winnerIndex = index; 
    let players = [];
    for(let i = winnerIndex; i < numPlayers; i++) { players.push(i + 1); }
    for(let i = 0; i < winnerIndex; i++) { players.push(i + 1); }
    
    // 初始化遊戲數據並保存
    gamePlayers = players.map(id => ({ id: id, score: 0 }));
    currentRound = 1;
    currentPlayerIndex = 0;
    saveGameState();

    let listHtml = "";
    players.forEach((p, index) => {
        listHtml += `<li class="order-item"><span>第${index+1}順位</span><strong>${p} 號玩家</strong></li>`;
    });
    document.getElementById("orderList").innerHTML = listHtml;
    const btn = document.getElementById("spinBtn");
    btn.disabled = false;
    btn.innerText = "進入遊戲";
    btn.onclick = () => goToPage('/game');
}

function easeOut(t, b, c, d) { let ts = (t/=d)*t; let tc = ts*t; return b+c*(tc + -3*ts + 3*t); }

// --- 遊戲頁面邏輯 ---
let gameStatePollingInterval = null;

async function initGamePage() {
    if (!gamePlayers || gamePlayers.length === 0) {
        console.error('❌ 沒有玩家資料，返回設定頁面');
        alert("請先進行設定！");
        goToPage('/setup');
        return;
    }

    console.log('🎮 初始化遊戲頁面');
    console.log('   - 我的ID:', myPlayerId);
    console.log('   - 玩家列表:', gamePlayers);
    console.log('   - 當前回合:', currentPlayerIndex);

    // ✅ 確保有玩家ID（從 cookie 獲取）
    if (!myPlayerId) {
        // 從 cookie 獲取玩家 ID
        const cookies = document.cookie.split(';');
        for (let cookie of cookies) {
            const [key, value] = cookie.trim().split('=');
            if (key === 'player_id') {
                myPlayerId = value;
                console.log('✅ 從 cookie 恢復玩家 ID:', myPlayerId);
                break;
            }
        }

        if (!myPlayerId) {
            console.error('❌ 無法獲取玩家 ID，返回設定頁面');
            alert('無法獲取玩家 ID，請重新加入遊戲');
            goToPage('/setup');
            return;
        }
    }

    // ✅ 檢查是否已有基底酒，只有房主能設定基底酒
    try {
        const response = await fetch('/api/game/state', { credentials: 'include' });
        if (response.ok) {
            const state = await response.json();

            // 檢查我是否是房主
            const isHost = state.host_id === myPlayerId;
            console.log('👑 房主檢查:', { isHost, myId: myPlayerId, hostId: state.host_id });

            if (!state.base_wine_color) {
                // 只有房主能設定基底酒
                if (isHost) {
                    console.log('🍷 我是房主，設定基底酒');
                    await resetBaseWine();
                } else {
                    console.log('⏳ 我不是房主，等待房主設定基底酒...');
                    // 其他玩家等待輪詢同步（不自己設定）
                }
            } else {
                // 使用現有的基底酒顏色
                console.log('🍷 使用現有基底酒:', state.base_wine_color);
                const baseCircle = document.getElementById("baseColorCircle");
                if (baseCircle) {
                    baseCircle.className = `base-circle base-${state.base_wine_color}`;
                }
            }
        } else {
            console.log('⚠️ 無法取得遊戲狀態，等待輪詢同步');
        }
    } catch (error) {
        console.error('❌ 取得遊戲狀態失敗:', error);
    }

    // 先從後端同步遊戲狀態，再更新 UI
    console.log('🔄 從後端同步遊戲狀態...');
    await pollGameState();

    updateRoundDisplay();
    renderScoreboard();
    updateTurnInfo();

    // 開始輪詢遊戲狀態（多人同步）
    console.log('🔄 開始輪詢遊戲狀態（所有玩家同步）');
    startGameStatePolling();
}

// 開始輪詢遊戲狀態
function startGameStatePolling() {
    // 立即獲取一次
    pollGameState();

    // 每 1 秒輪詢一次
    gameStatePollingInterval = setInterval(pollGameState, 1000);
}

// 停止輪詢
function stopGameStatePolling() {
    if (gameStatePollingInterval) {
        clearInterval(gameStatePollingInterval);
        gameStatePollingInterval = null;
    }
}

// 輪詢遊戲狀態
async function pollGameState() {
    try {
        const response = await fetch('/api/game/state', {
            credentials: 'include'
        });

        if (!response.ok) {
            console.log('遊戲尚未開始或已結束');
            return;
        }

        const state = await response.json();
        console.log('🎮 [遊戲狀態]', {
            turn: state.current_turn_index,
            round: state.current_round,
            is_my_turn: state.is_my_turn,
            dice: state.dice_values,
            base_wine: state.base_wine_color,
            game_ended: state.game_ended
        });

        // ✅ 判斷是否為剛開始遊戲的緩衝期 (10秒內)
        const newGameTime = parseInt(sessionStorage.getItem('new_game_timestamp') || '0');
        const isNewGameBuffer = (Date.now() - newGameTime < 10000);

        // ✅ 檢查遊戲是否結束（所有玩家同步）
        if (state.game_ended && state.game_result) {
            // ✅ 安全檢查：如果是剛開始遊戲 (10秒內)，忽略後端傳來的結束訊號 (可能是舊紀錄)
            if (isNewGameBuffer) {
                console.warn('⚠️ 忽略剛開始遊戲時的 game_ended 訊號 (可能是後端未重置)');
                return; // ✅ 忽略舊的結束訊號，不更新狀態，維持初始畫面
            } else {
                console.log('🏁 遊戲結束！所有玩家同步顯示結束畫面');
                stopGameStatePolling();  // 停止輪詢

                // 強制停用擲骰子按鈕，防止繼續操作
                const rollBtn = document.getElementById("rollBtn");
                if (rollBtn) {
                    rollBtn.disabled = true;
                    rollBtn.style.opacity = "0.5";
                    rollBtn.innerText = "遊戲結束";
                }

                showGameEndModal(state.game_result);  // 顯示結束畫面
                return;
            }
        }

        // 更新當前玩家索引和回合
        currentPlayerIndex = state.current_turn_index;
        
        // ✅ 如果是新遊戲緩衝期，不要從後端同步回合數 (避免同步到舊的 Round 5)
        if (!isNewGameBuffer) {
            currentRound = state.current_round;
        }

        // 同步骰子狀態（所有玩家看到相同的骰子）
        if (state.dice_values && state.dice_values.length === 2) {
            // ✅ 如果是新遊戲緩衝期，忽略後端舊的骰子紀錄
            if (!isNewGameBuffer) {
                const die1 = document.getElementById("die1");
                const die2 = document.getElementById("die2");
                if (die1 && die2) {
                    die1.dataset.value = state.dice_values[0];
                    die2.dataset.value = state.dice_values[1];
                }
            }
        }

        // 同步基底酒顏色（所有玩家看到相同的基底）
        if (state.base_wine_color) {
            const baseCircle = document.getElementById("baseColorCircle");
            if (baseCircle) {
                baseCircle.className = `base-circle base-${state.base_wine_color}`;
            }
        }

        // 同步酒堆疊（所有玩家看到相同的酒堆疊）
        if (state.wine_stack !== undefined) {
            const stack = document.getElementById("wineStack");
            if (stack) {
                // 檢查是否需要更新（避免不必要的重繪）
                const currentStackLength = stack.children.length;
                if (currentStackLength !== state.wine_stack.length) {
                    console.log(`🍷 同步酒堆疊: ${currentStackLength} → ${state.wine_stack.length}`);

                    // 清空並重新繪製
                    stack.innerHTML = "";
                    state.wine_stack.forEach(colorKey => {
                        const colorData = wineColors[colorKey];
                        if (colorData) {
                            const div = document.createElement("div");
                            div.className = "stack-circle";
                            div.style.backgroundColor = colorData.bg;
                            div.style.boxShadow = `0 0 10px ${colorData.shadow}`;
                            stack.appendChild(div);
                        }
                    });
                }
            }
        }

        // 同步積分（所有玩家看到相同的積分）
        if (state.player_scores) {
            for (let i = 0; i < gamePlayers.length; i++) {
                const player = gamePlayers[i];
                if (player && player.player_id && state.player_scores[player.player_id] !== undefined) {
                    const serverScore = state.player_scores[player.player_id];
                    if (player.score !== serverScore) {
                        console.log(`📊 同步積分: 玩家 ${i} (${player.name}) ${player.score} → ${serverScore}`);
                        player.score = serverScore;

                        // 更新 UI
                        const scoreEl = document.getElementById(`score-${i}`);
                        if (scoreEl) scoreEl.innerText = player.score;
                    }
                }
            }
        }

        // 更新 UI
        updateTurnInfo();
        renderScoreboard();
        updateRoundDisplay();

        // ✅ 前端額外檢查：酒鬼模式是否達到結束條件 (防止後端 game_ended 延遲或未發送)
        if (currentGameMode === 'drunk') {
            // ✅ 同樣加入安全檢查：剛開始遊戲不觸發本地結束判斷
            const newGameTime = parseInt(sessionStorage.getItem('new_game_timestamp') || '0');
            if (Date.now() - newGameTime < 10000) {
                return;
            }

            const loser = gamePlayers.find(p => p.score >= LOSE_THRESHOLD);
            if (loser) {
                console.log('🍺 前端偵測到酒鬼模式結束條件達成 (本地觸發)');
                stopGameStatePolling();

                // 強制停用擲骰子按鈕
                const rollBtn = document.getElementById("rollBtn");
                if (rollBtn) {
                    rollBtn.disabled = true;
                    rollBtn.style.opacity = "0.5";
                    rollBtn.innerText = "遊戲結束";
                }

                // 建構本地結果物件
                const result = {
                    mode: 'drunk',
                    loser: {
                        player_name: loser.name,
                        score: loser.score
                    },
                    losers: [{
                        player_name: loser.name,
                        score: loser.score
                    }]
                };
                
                showGameEndModal(result);
                return;
            }
        }

        // 控制擲骰子按鈕
        const rollBtn = document.getElementById("rollBtn");
        if (rollBtn && !isRolling) {
            if (state.is_my_turn) {
                rollBtn.disabled = false;
                rollBtn.style.opacity = "1";
            } else {
                rollBtn.disabled = true;
                rollBtn.style.opacity = "0.5";
                console.log('⏳ 還沒輪到我，等待中...');
            }
        }
    } catch (error) {
        console.error('輪詢遊戲狀態錯誤:', error);
    }
}

async function resetBaseWine() {
    console.log('🍷 觸發重置基底酒（由後端隨機選擇）');

    // ✅ 呼叫後端 API，讓後端隨機選擇並同步到所有玩家
    try {
        const response = await fetch('/api/game/set-base-wine', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
                player_id: myPlayerId
                // 不傳遞 color，讓後端隨機選擇
            })
        });

        if (response.ok) {
            const data = await response.json();
            const chosenColor = data.base_wine_color;
            console.log('✅ 基底酒已由後端設定:', chosenColor, '幫浦:', data.base_pump_id);

            // 更新本地顯示（使用與輪詢相同的方式，確保一致性）
            const circle = document.getElementById("baseColorCircle");

            if (circle) {
                circle.className = `base-circle base-${chosenColor}`;
                document.getElementById("wineStack").innerHTML = "";
            }

            // 調用API加入基底酒（喝完酒後事件）
            await pourBaseWine(chosenColor, 'after_drink');

            // 立即觸發一次輪詢，確保所有玩家同步
            await pollGameState();
        } else {
            console.error('❌ 基底酒同步失敗');
        }
    } catch (error) {
        console.error('❌ 基底酒 API 錯誤:', error);
    }
}

// 加入基底酒的函數
// event: 'game_start' 或 'after_drink'
async function pourBaseWine(color, event = 'game_start') {
    try {
        // ✅ 呼叫後端 API 觸發幫浦
        const response = await fetch('/api/game/event', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                mode: currentGameMode,
                event: event,
                score: null
            })
        });
        const data = await response.json();

        if (data.success) {
            console.log(`🎮 遊戲事件 (${event}) 觸發成功，幫浦已啟動:`, data);
        } else {
            throw new Error('加基底酒失敗');
        }
    } catch (error) {
        console.error('❌ 加基底酒失敗:', error);
        // 失敗時不影響遊戲繼續進行
    }
}
async function addColorToStack(colorKey) {
    console.log('🍷 添加酒到堆疊:', colorKey);

    // 呼叫後端 API 同步到所有玩家
    try {
        const response = await fetch('/api/game/add-wine', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
                player_id: myPlayerId,
                color: colorKey
            })
        });

        if (response.ok) {
            const data = await response.json();
            console.log('✅ 酒已同步到所有玩家:', data.wine_stack);

            // 更新本地顯示（其他玩家會透過輪詢看到）
            const stack = document.getElementById("wineStack");
            const colorData = wineColors[colorKey];
            const div = document.createElement("div");
            div.className = "stack-circle";
            div.style.backgroundColor = colorData.bg;
            div.style.boxShadow = `0 0 10px ${colorData.shadow}`;
            stack.appendChild(div);
        } else {
            console.error('❌ 添加酒同步失敗');
        }
    } catch (error) {
        console.error('❌ 添加酒 API 錯誤:', error);
    }
}
function renderScoreboard() {
    const board = document.getElementById("scoreboard");
    if (!board) return;
    board.innerHTML = "";
    const unitText = currentGameMode === 'drunk' ? "🍺 杯數" : "積分";

    gamePlayers.forEach((p, index) => {
        const div = document.createElement("div");
        div.className = `player-card ${index === currentPlayerIndex ? 'active' : ''}`;
        div.id = `p-card-${index}`;

        // 使用玩家名稱而不是號碼
        const playerName = p.name || `玩家 ${index + 1}`;
        div.innerHTML = `
            <div class="p-order">第 ${index + 1} 順位</div>
            <div class="p-name">${playerName}</div>
            <div style="font-size:0.8rem; color:#aaa; margin-top:5px;">${unitText}</div>
            <div class="p-score" id="score-${index}">${p.score}</div>
        `;
        board.appendChild(div);
    });
}
function updateTurnInfo() {
    document.querySelectorAll('.player-card').forEach(c => c.classList.remove('active'));
    const activeCard = document.getElementById(`p-card-${currentPlayerIndex}`);
    if (activeCard) {
        activeCard.classList.add('active');
        activeCard.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }

    // 使用玩家名稱
    const currentPlayer = gamePlayers[currentPlayerIndex];
    const playerName = currentPlayer.name || `玩家 ${currentPlayerIndex + 1}`;
    const nameEl = document.getElementById("turnPlayerName");
    if (nameEl) nameEl.innerText = playerName;

    // ✅ 檢查是否輪到我（詳細日誌）
    const isMyTurn = currentPlayer && currentPlayer.player_id === myPlayerId;
    const rollBtn = document.getElementById("rollBtn");
    const actionHint = document.getElementById("actionHint");

    console.log('🎮 [回合檢查]');
    console.log('   - 當前玩家索引:', currentPlayerIndex);
    console.log('   - 當前玩家ID:', currentPlayer?.player_id);
    console.log('   - 我的玩家ID:', myPlayerId);
    console.log('   - 是否輪到我:', isMyTurn);

    if (rollBtn && !isRolling) {
        if (isMyTurn) {
            // ✅ 輪到我：啟用按鈕
            rollBtn.disabled = false;
            rollBtn.style.opacity = "1";
            rollBtn.innerText = "擲骰子";
            if (actionHint) {
                actionHint.innerHTML = `輪到 <span style="color: var(--neon-yellow); font-weight: bold;">你</span> 了！`;
            }
            console.log('✅ 輪到我了，按鈕已啟用');
        } else {
            // ❌ 不是我的回合：禁用按鈕
            rollBtn.disabled = true;
            rollBtn.style.opacity = "0.5";
            rollBtn.innerText = "等待中...";
            if (actionHint) {
                actionHint.innerHTML = `輪到 <span style="color: var(--neon-yellow)">${playerName}</span>（觀看中）`;
            }
            console.log('⏳ 還沒輪到我，按鈕已禁用');
        }
    }

    saveGameState();
}
function updateRoundDisplay() {
    const displaySpan = document.getElementById('roundStatusText');
    if (!displaySpan) return;
    if (currentGameMode === 'family') {
        displaySpan.innerHTML = `ROUND <span style="color: var(--neon-pink)">${currentRound}</span> / <span>${totalRounds}</span>`;
    } else {
        let maxDrinks = 0;
        gamePlayers.forEach(p => {
            if (p.score > maxDrinks) maxDrinks = p.score;
        });
        let cupsLeft = LOSE_THRESHOLD - maxDrinks;
        if (cupsLeft < 0) cupsLeft = 0;
        if (cupsLeft === 3) {
            displaySpan.innerHTML = `<span style="font-size: 1.8rem;">💀 喝 <span style="color: var(--neon-pink)">3</span> 杯就結束囉!</span>`;
        } else if (cupsLeft > 1) {
            displaySpan.innerHTML = `<span style="font-size: 1.8rem;">⚠️ 還差 <span style="color: var(--neon-yellow)">${cupsLeft}</span> 杯有人就輸了!</span>`;
        } else if (cupsLeft === 1) {
            displaySpan.innerHTML = `<span style="font-size: 1.8rem;">🔥 危險！再 <span style="color: red">1</span> 杯就結束！</span>`;
        } else {
            displaySpan.innerHTML = `<span style="font-size: 1.8rem; color: var(--neon-pink);">🚫 遊戲結束！</span>`;
        }
    }
}

function rollDice() {
    // 檢查是否正在擲骰子
    if(isRolling) {
        console.log('⏳ 骰子正在旋轉中...');
        return;
    }

    // 檢查是否輪到我
    const currentPlayer = gamePlayers[currentPlayerIndex];
    const isMyTurn = currentPlayer && currentPlayer.player_id === myPlayerId;

    if (!isMyTurn) {
        console.log('❌ 還沒輪到你，不能擲骰子');
        showPopup('還沒輪到你！\n請等待其他玩家操作');
        return;
    }

    console.log('🎲 開始擲骰子...');
    isRolling = true;
    document.getElementById("rollBtn").disabled = true;

    const die1 = document.getElementById("die1");
    const die2 = document.getElementById("die2");
    die1.classList.add("shake");
    die2.classList.add("shake");

    let tempRolls = 0;
    let interval = setInterval(() => {
        die1.dataset.value = Math.floor(Math.random() * 6) + 1;
        die2.dataset.value = Math.floor(Math.random() * 6) + 1;
        tempRolls++;
        if(tempRolls > 10) {
            clearInterval(interval);
            finalizeRoll();
        }
    }, 50);
}
async function finalizeRoll() {
    const die1El = document.getElementById("die1");
    const die2El = document.getElementById("die2");
    die1El.classList.remove("shake");
    die2El.classList.remove("shake");

    // 生成骰子值
    const v1 = Math.floor(Math.random() * 6) + 1;
    const v2 = Math.floor(Math.random() * 6) + 1;

    console.log('🎲 骰子結果:', v1, v2);

    // ✅ 呼叫後端 API 同步到所有玩家
    try {
        const response = await fetch('/api/game/roll-dice', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
                player_id: myPlayerId,
                dice1: v1,
                dice2: v2
            })
        });

        if (response.ok) {
            console.log('✅ 骰子已同步到所有玩家');

            // 設定本地骰子（其他玩家會透過輪詢看到）
            die1El.dataset.value = v1;
            die2El.dataset.value = v2;

            const sum = v1 + v2;
            const isDouble = (v1 === v2);

            // ✅ 只有輪到的玩家才執行遊戲邏輯（顯示對話框、互動等）
            // 其他玩家只是觀看骰子結果
            const currentPlayer = gamePlayers[currentPlayerIndex];
            const isMyTurn = currentPlayer && currentPlayer.player_id === myPlayerId;

            if (isMyTurn) {
                console.log('✅ 輪到我，執行遊戲邏輯');
                // 處理遊戲邏輯（只有當前玩家會看到對話框和互動）
                if (currentGameMode === 'family') {
                    handleFamilyModeEvents(sum, isDouble);
                } else {
                    handleAlcoholicModeEvents(sum, isDouble);
                }
            } else {
                console.log('👀 觀看中，等待當前玩家操作');
                // 其他玩家只重置 isRolling 狀態
                isRolling = false;
            }
        } else {
            console.error('❌ 骰子同步失敗');
            isRolling = false;
            document.getElementById("rollBtn").disabled = false;
        }
    } catch (error) {
        console.error('❌ 骰子 API 錯誤:', error);
        isRolling = false;
        document.getElementById("rollBtn").disabled = false;
    }
}

// --- 事件處理 ---
function handleFamilyModeEvents(sum, isDouble) { if (sum === 9 || isDouble) { handleDrinkAndResetFamily(); return; } switch (sum) { case 3: case 5: handleLSAQuestion(); break; case 4: case 8: handleAddRandomColor(sum); break; case 6: handleBlackWhiteFamily(); break; case 7: handlePickColor(sum); break; case 10: case 11: handleTruthOrDare(); break; default: nextTurn(); break; } }
function handleAlcoholicModeEvents(sum, isDouble) { if (isDouble) { handleDirectDrink("擲出對子 (豹子)！"); return; } switch(sum) { case 3: handleNeverHaveIEver(); break; case 4: case 8: handleAddRandomColor(sum); break; case 5: handleArmWrestling(); break; case 6: handleBlackWhiteAlcoholic(); break; case 7: handlePickColor(sum); break; case 9: handleDragonGate(); break; case 10: case 11: handleTruthOrDare(); break; default: nextTurn(); break; } }

async function handleDrinkAndResetFamily() {
    showPopup("9 或 豹子！開喝！\n積分+1, 換新基底！");
    await updateScore(currentPlayerIndex, 1);
    await incrementRound(); // 有人喝酒，回合 +1
    setTimeout(() => {
        resetBaseWine();
        nextTurn();
    }, 1500);
}
async function handleDirectDrink(reason) {
    showPopup(`${reason}\n罰喝一杯！換新基底！`);
    await updateScore(currentPlayerIndex, 1);
    await incrementRound(); // 有人喝酒，回合 +1（闔家歡模式）
    setTimeout(() => {
        resetBaseWine();
        nextTurn();
    }, 1500);
}

function handleNeverHaveIEver() { let opponentIndices = gamePlayers.map((_, i) => i).filter(i => i !== currentPlayerIndex); currentOpponentIndex = opponentIndices[Math.floor(Math.random() * opponentIndices.length)]; let opponent = gamePlayers[currentOpponentIndex]; openLoserSelectionModal("我有你沒有", `<p>對手是：<strong style="color:var(--neon-pink)">${opponent.name}</strong></p><p>請實體進行遊戲！</p><p style="margin-top:20px; color:var(--neon-yellow);">誰輸了？</p>`, currentPlayerIndex, currentOpponentIndex); }
function handleArmWrestling() { let opponentIndices = gamePlayers.map((_, i) => i).filter(i => i !== currentPlayerIndex); currentOpponentIndex = opponentIndices[Math.floor(Math.random() * opponentIndices.length)]; let opponent = gamePlayers[currentOpponentIndex]; openLoserSelectionModal("掰手腕對決 💪", `<p>對手是：<strong style="color:var(--neon-pink)">${opponent.name}</strong></p><p>請進行實體掰手腕！</p><p style="margin-top:20px; color:var(--neon-yellow);">誰輸了？</p>`, currentPlayerIndex, currentOpponentIndex); }
function handleBlackWhiteFamily() { let opponentIndices = gamePlayers.map((_, i) => i).filter(i => i !== currentPlayerIndex); currentOpponentIndex = opponentIndices[Math.floor(Math.random() * opponentIndices.length)]; let opponent = gamePlayers[currentOpponentIndex]; openModal("黑白切對決！", `<p>對手是：<strong style="color:var(--neon-pink)">${opponent.name}</strong></p><p>快去實體對決！誰贏了？</p>`, `<button class="option-btn" onclick="resolveBW(true)">我贏了 (我+1, 對手-1)</button><button class="option-btn" onclick="resolveBW(false)">我輸了 (我-1, 對手+1)</button>`); }
function handleBlackWhiteAlcoholic() { let opponentIndices = gamePlayers.map((_, i) => i).filter(i => i !== currentPlayerIndex); currentOpponentIndex = opponentIndices[Math.floor(Math.random() * opponentIndices.length)]; let opponent = gamePlayers[currentOpponentIndex]; openLoserSelectionModal("黑白切對決", `<p>對手是：<strong style="color:var(--neon-pink)">${opponent.name}</strong></p><p>請實體進行對決！</p><p style="margin-top:20px; color:var(--neon-yellow);">誰輸了？</p>`, currentPlayerIndex, currentOpponentIndex); }

function openLoserSelectionModal(title, bodyContent, p1Index, p2Index) { const p1Name = gamePlayers[p1Index].name + " (我)"; const p2Name = gamePlayers[p2Index].name + " (對手)"; const actions = `<button class="option-btn" onclick="handlePenalty(${p1Index})">${p1Name} 輸了</button><button class="option-btn" onclick="handlePenalty(${p2Index})">${p2Name} 輸了</button>`; openModal(title, bodyContent, actions); }
window.handlePenalty = async function(loserIndex) {
    closeModal();
    const loserName = gamePlayers[loserIndex].name;
    showPopup(`${loserName} 輸了！\n罰喝一杯！換基底！`);
    await updateScore(loserIndex, 1);
    await incrementRound(); // 有人喝酒，回合 +1（闔家歡模式）
    setTimeout(() => {
        resetBaseWine();
        nextTurn();
    }, 1500);
}
window.resolveBW = function(playerWins) { closeModal(); if(playerWins) { showPopup("恭喜獲勝！我方+1 對手-1"); updateScore(currentPlayerIndex, 1); updateScore(currentOpponentIndex, -1); } else { showPopup("可惜輸了... 我方-1 對手+1"); updateScore(currentPlayerIndex, -1); updateScore(currentOpponentIndex, 1); } setTimeout(nextTurn, 1000); }

function handleDragonGate() { const c1 = Math.floor(Math.random() * 13) + 1; let c2 = Math.floor(Math.random() * 13) + 1; while(c1 === c2) c2 = Math.floor(Math.random() * 13) + 1; const minC = Math.min(c1, c2); const maxC = Math.max(c1, c2); openModal("射龍門", `<div style="text-align:center;"><div style="margin-bottom:10px;">龍柱</div><div><span class="poker-card ${[1,13].includes(c1)?'red':''}">${getCardDisplay(c1)}</span><span class="poker-card ${[1,13].includes(c2)?'red':''}">${getCardDisplay(c2)}</span></div><div style="margin:20px 0; font-size:1.2rem;">第三張牌需在 <span style="color:var(--neon-blue)">${minC} ~ ${maxC}</span> 之間 (不含)</div><div id="dragonResultArea" style="min-height:140px; display:flex; justify-content:center; align-items:center;"><button id="draw3rdBtn" class="neon-btn" style="padding:10px 30px; margin:0;" onclick="drawDragonCard(${minC}, ${maxC})">抽第三張</button></div></div>`, ""); }
window.drawDragonCard = function(min, max) { const c3 = Math.floor(Math.random() * 13) + 1; const isSafe = (c3 > min && c3 < max); const resultHtml = `<div style="display:flex; flex-direction:column; align-items:center;"><span class="poker-card ${[1,13].includes(c3)?'red':''}">${getCardDisplay(c3)}</span><div style="margin-top:10px; font-weight:bold; font-size:1.5rem; color:${isSafe ? '#00ff00' : 'red'}">${isSafe ? '過關！' : '撞柱/射偏！喝！'}</div><button class="option-btn" style="margin-top:15px;" onclick="closeDragonModal(${isSafe})">確定</button></div>`; document.getElementById("dragonResultArea").innerHTML = resultHtml; }
window.closeDragonModal = function(isSafe) { closeModal(); if (isSafe) { showPopup("安全過關！"); setTimeout(nextTurn, 1000); } else { handleDirectDrink("射龍門失敗！"); } }
function getCardDisplay(num) { if(num === 1) return 'A'; if(num === 11) return 'J'; if(num === 12) return 'Q'; if(num === 13) return 'K'; return num; }

async function handleLSAQuestion() {
    try {
        const response = await fetch('/api/lsa');
        const qData = await response.json();

        // 將答案選項轉換為按鈕
        let actions = "";
        qData.options.forEach((opt, idx) => {
            const optionLetter = opt.charAt(0); // 取得 A, B, C, D
            actions += `<button class="option-btn" onclick="checkAnswer('${optionLetter}', '${qData.answer}')">${opt}</button>`;
        });

        openModal("LSA 知識大考驗", `<p style="margin-bottom:10px;">${qData.question}</p>`, actions);
    } catch (error) {
        console.error('獲取 LSA 題目失敗:', error);
        showPopup("載入題目失敗，請重試");
        setTimeout(nextTurn, 1000);
    }
}

window.checkAnswer = function(selected, correct) {
    closeModal();
    if(selected === correct) {
        showPopup("答對了！積分 +1");
        updateScore(currentPlayerIndex, 1);
    } else {
        showPopup("答錯囉！積分 -1");
        updateScore(currentPlayerIndex, -1);
    }
    setTimeout(nextTurn, 1000);
};

async function handleAddRandomColor(diceSum) {
    try {
        // ✅ 呼叫後端 API 觸發幫浦（根據遊戲邏輯）
        const response = await fetch('/api/game/event', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                mode: currentGameMode,
                event: 'score',
                score: diceSum
            })
        });
        const data = await response.json();

        if (data.success) {
            console.log('🎮 遊戲事件觸發成功:', data);
            // 隨機選擇顏色加入酒杯
            const keys = Object.keys(wineColors);
            const randomKey = keys[Math.floor(Math.random() * keys.length)];
            showPopup(`電腦選了：${getColorName(randomKey)}\n幫浦已啟動 ${data.duration || 0}秒`);
            addColorToStack(randomKey);
            setTimeout(nextTurn, 1000);
        } else {
            throw new Error('加酒失敗');
        }
    } catch (error) {
        console.error('❌ 加酒失敗:', error);
        // 如果API調用失敗，使用原來的邏輯
        const keys = Object.keys(wineColors);
        const randomKey = keys[Math.floor(Math.random() * keys.length)];
        showPopup(`電腦選了：${getColorName(randomKey)}\n(GPIO控制失敗)`);
        addColorToStack(randomKey);
        setTimeout(nextTurn, 1000);
    }
}
// 儲存當前骰子總和，供 pickColor 使用
let currentDiceSum = 0;

function handlePickColor(diceSum) {
    currentDiceSum = diceSum; // 儲存骰子總和
    openModal("選擇一種顏色加入基底", "請選擇：", `<div class="color-choice-btn" style="background:${wineColors.red.bg}" onclick="pickColor('red')"></div><div class="color-choice-btn" style="background:${wineColors.blue.bg}" onclick="pickColor('blue')"></div><div class="color-choice-btn" style="background:${wineColors.yellow.bg}" onclick="pickColor('yellow')"></div><div class="color-choice-btn" style="background:${wineColors.green.bg}" onclick="pickColor('green')"></div>`);
}
window.pickColor = async function(key) {
    closeModal();

    try {
        // ✅ 呼叫後端 API 觸發幫浦（根據遊戲邏輯）
        const response = await fetch('/api/game/event', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                mode: currentGameMode,
                event: 'score',
                score: currentDiceSum
            })
        });
        const data = await response.json();

        if (data.success) {
            console.log('🎮 遊戲事件觸發成功:', data);
            showPopup(`已選擇 ${getColorName(key)}\n幫浦已啟動 ${data.duration || 0}秒`);
            addColorToStack(key);
            setTimeout(nextTurn, 500);
        } else {
            throw new Error('加酒失敗');
        }
    } catch (error) {
        console.error('❌ 加酒失敗:', error);
        // 如果API調用失敗，使用原來的邏輯
        showPopup(`已選擇 ${getColorName(key)}\n(GPIO控制失敗)`);
        addColorToStack(key);
        setTimeout(nextTurn, 500);
    }
}

async function handleTruthOrDare() {
    try {
        // 隨機選擇真心話或大冒險
        const isTruth = Math.random() < 0.5;
        const apiUrl = isTruth ? '/api/truth' : '/api/dare';
        const title = isTruth ? '真心話' : '大冒險';

        const response = await fetch(apiUrl);
        const data = await response.json();
        const selectedQuestion = data.question;

        openModal(`真心話大冒險 - ${title}`, `<div style="font-size: 1.5rem; font-weight: bold; color: var(--neon-pink); margin-bottom: 20px;">${selectedQuestion}</div>`, `<button class="option-btn" onclick="closeModal(); nextTurn();">挑戰完成 (下一位)</button>`);
    } catch (error) {
        console.error('獲取真心話大冒險題目失敗:', error);
        showPopup("載入題目失敗，請重試");
        setTimeout(nextTurn, 1000);
    }
}

async function updateScore(playerIdx, delta) {
    if (playerIdx < 0 || playerIdx >= gamePlayers.length) {
        console.error('❌ 無效的玩家索引:', playerIdx);
        return;
    }

    const player = gamePlayers[playerIdx];
    if (!player || !player.player_id) {
        console.error('❌ 玩家資料不完整:', player);
        return;
    }

    console.log(`📊 更新積分: 玩家 ${playerIdx} (${player.name}), 變化: ${delta > 0 ? '+' : ''}${delta}`);

    // ✅ 呼叫後端 API 同步積分到所有玩家
    try {
        const response = await fetch('/api/game/update-score', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
                player_id: player.player_id,
                score_delta: delta
            })
        });

        if (response.ok) {
            const data = await response.json();
            console.log('✅ 積分已同步:', data);

            // 更新本地積分（其他玩家會透過輪詢看到）
            gamePlayers[playerIdx].score = data.new_score;

            // 更新 UI
            const scoreEl = document.getElementById(`score-${playerIdx}`);
            if (scoreEl) scoreEl.innerText = gamePlayers[playerIdx].score;

            saveGameState();
            updateRoundDisplay();

            // 遊戲結束檢查由後端處理，所有玩家通過輪詢同步
        } else {
            console.error('❌ 積分同步失敗');
        }
    } catch (error) {
        console.error('❌ 積分 API 錯誤:', error);
    }
}
function getColorName(key) { if(key === 'red') return '紅色'; if(key === 'blue') return '藍色'; if(key === 'yellow') return '黃色'; return '綠色'; }
function showPopup(text) { const popup = document.getElementById("msgPopup"); popup.innerText = text; popup.style.opacity = 1; popup.style.top = "40%"; setTimeout(() => { popup.style.opacity = 0; popup.style.top = "50%"; }, 1500); }
function openModal(title, bodyHtml, actionsHtml) { document.getElementById("modalTitle").innerText = title; document.getElementById("modalBody").innerHTML = bodyHtml; document.getElementById("modalActions").innerHTML = actionsHtml; document.getElementById("gameModal").classList.remove("hidden"); }
window.closeModal = function() { document.getElementById("gameModal").classList.add("hidden"); }

function showRules() { if (currentGameMode === 'family') { openModal("闔家歡模式遊戲規則", `<div style="text-align: left;"><p style="color:var(--neon-yellow); font-weight:bold; margin-bottom:5px;">1. 基底酒機制</p><ul class="rules-list"><li>電腦隨機選色作為基底。</li><li><strong>結算：</strong>每 5 回合結算。</li></ul><p style="color:var(--neon-yellow); font-weight:bold; margin-bottom:5px;">2. 骰子事件表</p><table class="rules-table"><thead><tr><th width="30%">點數</th><th>事件說明</th></tr></thead><tbody><tr><td>3 或 5</td><td>LSA 選擇題</td></tr><tr><td>4 或 8</td><td>電腦加酒</td></tr><tr><td>6</td><td>黑白切</td></tr><tr><td>7</td><td>自選加酒</td></tr><tr><td>9 或對子</td><td>喝酒 (積分+1)</td></tr><tr><td>10 或 11</td><td>真心話大冒險</td></tr></tbody></table></div>`, `<button class="option-btn" onclick="closeModal()">了解</button>`); } else { openModal("無乃酒鬼模式規則", `<div style="text-align: left;"><p style="color:var(--neon-yellow); font-weight:bold; margin-bottom:5px;">模式核心</p><ul class="rules-list"><li><strong>無回合限制</strong>，直到有人喝滿 3 杯。</li></ul><p style="color:var(--neon-yellow); font-weight:bold; margin-bottom:5px;">骰子事件表</p><table class="rules-table"><thead><tr><th width="30%">點數</th><th>事件說明</th></tr></thead><tbody><tr><td>3</td><td>我有你沒有</td></tr><tr><td>4 或 8</td><td>電腦加酒</td></tr><tr><td>5</td><td>掰手腕</td></tr><tr><td>6</td><td>黑白切</td></tr><tr><td>7</td><td>自選加酒</td></tr><tr><td>9</td><td>射龍門</td></tr><tr><td>對子</td><td>直接喝一杯！</td></tr><tr><td>10 或 11</td><td>真心話大冒險</td></tr></tbody></table></div>`, `<button class="option-btn" onclick="closeModal()">了解</button>`); } }

async function nextTurn() {
    console.log('切換到下一個玩家');

    // 調用後端 API 來同步下一個回合
    try {
        const response = await fetch('/api/game/next-turn', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
                player_id: myPlayerId
            })
        });

        if (response.ok) {
            const data = await response.json();
            console.log('✅ 已切換到下一個玩家:', data);

            // 本地更新（輪詢會自動同步）
            currentPlayerIndex = data.current_turn_index;

            updateTurnInfo();
            isRolling = false;
            saveGameState();

            // 立即輪詢一次來更新所有玩家的狀態
            await pollGameState();
        }
    } catch (error) {
        console.error('切換回合錯誤:', error);
        // 如果 API 失敗，使用本地邏輯（向下兼容）
        currentPlayerIndex++;
        if (currentPlayerIndex >= gamePlayers.length) {
            currentPlayerIndex = 0;
        }
        updateTurnInfo();
        isRolling = false;
        saveGameState();
    }
}

// 顯示遊戲結束畫面（所有玩家同步）
function showGameEndModal(result) {
    console.log('📊 遊戲結束結果:', result);

    let bodyHtml = "";

    if (result.mode === 'family') {
        // 闔家歡模式結果
        const winnersHtml = result.winners.map(w => `<strong>${w.player_name}</strong>`).join(", ");
        const losersHtml = result.losers.map(l => `<strong>${l.player_name}</strong>`).join(", ");

        bodyHtml = `
            <div style="text-align: center; font-size: 1.2rem; line-height: 2;">
                <img src="gameover.png" style="max-width: 60%; height: auto; margin-bottom: 10px; border-radius: 10px;">
                <p style="font-size: 1.5rem; margin-bottom: 20px;">🎉 已完成 5 回合！</p>
                <p style="color: var(--neon-green);">🏆 最高分：${result.max_score} 分</p>
                <p>贏家：${winnersHtml}</p>
                <p style="margin-top: 20px; color: var(--neon-pink);">😢 最低分：${result.min_score} 分</p>
                <p>輸家：${losersHtml}</p>
            </div>
        `;
    } else {
        // 酒鬼模式結果
        // 兼容後端回傳 losers 陣列或單一 loser 物件
        const loser = (result.losers && result.losers.length > 0) ? result.losers[0] : result.loser;
        const loserName = loser ? loser.player_name : "玩家";
        const loserScore = loser ? loser.score : 3;

        bodyHtml = `
            <div style="text-align: center; font-size: 1.2rem; line-height: 2;">
                <img src="gameover.png" style="max-width: 80%; height: auto; margin-bottom: 15px; border-radius: 10px; box-shadow: 0 0 15px var(--neon-pink);">
                <p style="font-size: 1.5rem; margin-bottom: 20px; color: var(--neon-pink);">🍺 遊戲結束！</p>
                <p><strong>${loserName}</strong> 已經喝了 <span style="color: var(--neon-pink); font-size: 2rem;">${loserScore}</span> 杯！</p>
                <p style="margin-top: 20px;">🤮 是今晚的酒醉輸家！</p>
            </div>
        `;
    }

    openModal(
        "🏁 遊戲結束",
        bodyHtml,
        `<button class="option-btn" onclick="fullResetGame()">返回首頁 (重新開始)</button>`
    );
}

function endGame() {
    let msg = "";
    if (currentGameMode === 'family') {
        // 闔家歡模式：5回合結束，顯示最高分和最低分
        let maxScore = -999;
        let minScore = 999;
        gamePlayers.forEach(p => {
            if (p.score > maxScore) maxScore = p.score;
            if (p.score < minScore) minScore = p.score;
        });
        let winners = gamePlayers.filter(p => p.score === maxScore).map(p => p.name || `玩家${p.order}`);
        let losers = gamePlayers.filter(p => p.score === minScore).map(p => p.name || `玩家${p.order}`);
        msg = `🎉 遊戲結束！已完成 5 回合\n\n🏆 最高分：${maxScore} 分\n贏家：${winners.join(", ")}\n\n😢 最低分：${minScore} 分\n輸家：${losers.join(", ")}`;
    } else {
        // 酒鬼模式：有人喝滿 3 杯就結束
        let loser = gamePlayers.find(p => p.score >= LOSE_THRESHOLD);
        if (loser) {
            msg = `🍺 遊戲結束！\n\n${loser.name || `玩家${loser.order}`} 已經喝了 ${LOSE_THRESHOLD} 杯！\n你是今晚的酒醉輸家！🤮`;
        } else {
            msg = `遊戲結束！`;
        }
    }
    alert(msg);
    fullResetGame();
}

// --- 初始化 ---
window.onload = async function() {
    // 判斷當前頁面
    const path = window.location.pathname;
    let currentPage = 'index';
    if (path.includes('/mode')) currentPage = 'mode';
    else if (path.includes('/setup')) currentPage = 'setup';
    else if (path.includes('/game')) currentPage = 'game';

    console.log('🌐 頁面載入:', currentPage);

    // ✅ 如果是首頁，強制清空所有暫存資料，確保是全新的開始
    if (currentPage === 'index') {
        console.log('🧹 首頁載入，執行狀態清理...');
        sessionStorage.clear();
    }

    // 檢查玩家登入狀態（除了首頁和模式選擇頁）
    if (currentPage !== 'index' && currentPage !== 'mode') {
        const playerState = await checkPlayerSession();
        if (playerState) {
            autoRedirectBasedOnState(playerState, currentPage);

            // 如果玩家已登入且在遊戲中，自動開始心跳和輪詢
            if (playerState.status === 'in_game' && myPlayerId) {
                console.log('✅ 玩家已登入，自動恢復連線');

                // 如果在 setup 頁面，恢復 UI 狀態並開始輪詢
                if (currentPage === 'setup') {
                    // 隱藏加入區域，顯示等待區域
                    const joinSection = document.getElementById('joinSection');
                    const waitingSection = document.getElementById('waitingSection');

                    if (joinSection) joinSection.style.display = 'none';
                    if (waitingSection && playerState.screen === 'setup') {
                        waitingSection.style.display = 'block';
                    }

                    startRoomStatePolling();
                    startHeartbeat();

                    // 如果遊戲已開始（轉盤畫面），等待輪詢自動切換
                    if (playerState.screen === 'wheel') {
                        console.log('🎰 遊戲已開始，等待輪詢切換到轉盤畫面');
                    }
                }

                // 如果在遊戲頁面，開始遊戲狀態輪詢
                if (currentPage === 'game') {
                    startHeartbeat();
                    pollGameState();
                    setInterval(pollGameState, 1000);
                }
            }
        }
    }

    // 原有的初始化邏輯
    // 注意：wheelCanvas 的設定現在由 setupWheelFromPlayers() 處理，不再需要手動 setupWheel()
    if (document.getElementById("scoreboard")) {
        initGamePage();
    }
};

// 完全重置遊戲狀態並返回首頁
// 完全重置遊戲狀態並返回首頁
async function fullResetGame() {
    console.log('🔄 執行完全重置...');
    
    // 1. 清除前端暫存（包括遊戲狀態、擲骰子記錄等）
    sessionStorage.clear();
    localStorage.clear(); // 也清除 localStorage 確保沒有殘留
    
    // 2. 嘗試通知後端離開房間並重置遊戲狀態
    if (myPlayerId) {
        try {
            // 先呼叫重置遊戲的 API
            await fetch('/api/game/reset', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include'
            });
            
            // 然後離開房間
            await fetch('/api/room/leave', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ player_id: myPlayerId })
            });
        } catch (error) {
            console.error('重置請求失敗:', error);
        }
    }

    // 3. 清除 Cookie (確保不抓到舊的 player_id)
    document.cookie = "player_id=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
    
    // 4. 停止所有計時器
    stopRoomStatePolling();
    stopHeartbeat();
    
    // 5. 返回首頁
    window.location.href = '/';
}