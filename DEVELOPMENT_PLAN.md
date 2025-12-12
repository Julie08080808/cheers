# 醉加損友 - 開發計畫文檔

> 📅 最後更新：2025-12-12
> 👤 由 Claude Code 協助開發

---

## 📊 專案狀態總覽

### ✅ 已完成 (Phase 1 & 2 - 後端)

**Phase 1: 基礎架構**
- [x] 清理舊代碼，建立新專案結構
- [x] 配置 `pyproject.toml` 使用 uv 管理依賴
- [x] 實作 `app/config.py` 統一配置管理
- [x] 實作 `app/database.py` SQLAlchemy 連接

**Phase 2: 核心 API**
- [x] 資料庫模型 (Game, Player, DrinkStack)
- [x] Pydantic schemas 用於 API 驗證
- [x] 遊戲 CRUD API (創建/查詢/開始/擲骰子/下一回合/更新積分/加酒/重置)
- [x] 骰子事件引擎 (支援闔家歡/酒鬼模式)
- [x] 題庫 API (LSA 問答、真心話大冒險)
- [x] 測試通過，API 正常運行

### ⏳ 待完成 (Phase 3 & 4 - 前端)

**Phase 3: 前端基礎**
- [ ] 建立 CSS 設計系統 (`frontend/css/style.css`)
- [ ] 實作 `frontend/index.html` (首頁 - 模式選擇)
- [ ] 實作 `frontend/js/api.js` (API 封裝)

**Phase 4: 遊戲核心 (前端)**
- [ ] 實作 `frontend/js/wheel.js` (轉盤模組)
- [ ] 實作 `frontend/js/dice.js` (骰子顯示)
- [ ] 實作 `frontend/js/modal.js` (彈窗系統)
- [ ] 實作 `frontend/js/app.js` (主應用邏輯)
- [ ] 實作 `frontend/js/polling.js` (即時同步)
- [ ] 實作 `frontend/game.html` (遊戲主頁面)

**Phase 5: 整合測試**
- [ ] 單人遊戲流程測試
- [ ] 多人即時同步測試
- [ ] 修復任何問題

---

## 🏗️ 專案架構

```
cheers/
├── backend/
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py              # FastAPI 入口 ✅
│   │   ├── config.py            # 配置管理 ✅
│   │   ├── database.py          # 資料庫連線 ✅
│   │   ├── models/              # SQLAlchemy 模型 ✅
│   │   │   ├── game.py          # Game, DrinkStack
│   │   │   └── player.py        # Player
│   │   ├── schemas/             # Pydantic 驗證 ✅
│   │   │   ├── game.py
│   │   │   ├── player.py
│   │   │   └── drink.py
│   │   ├── routers/             # API 路由 ✅
│   │   │   ├── game.py          # 遊戲 CRUD
│   │   │   └── questions.py     # 題庫 API
│   │   ├── services/            # 業務邏輯 ✅
│   │   │   └── dice_engine.py   # 骰子引擎
│   │   └── utils/               # 工具函式
│   ├── data/                    # 資料檔案 ✅
│   │   ├── questions_lsa.json
│   │   ├── questions_truth.json
│   │   └── cheers.db
│   └── pyproject.toml           # uv 依賴配置 ✅
│
├── frontend/                    # ⏳ 待實作
│   ├── index.html               # 首頁 (模式選擇)
│   ├── game.html                # 遊戲頁面
│   ├── css/
│   │   └── style.css            # 統一樣式
│   ├── js/
│   │   ├── api.js               # API 封裝
│   │   ├── app.js               # 主應用邏輯
│   │   ├── wheel.js             # 轉盤模組
│   │   ├── dice.js              # 骰子模組
│   │   ├── modal.js             # 彈窗模組
│   │   └── polling.js           # 輪詢同步
│   └── assets/
│       └── images/
│
├── dev-start.sh                 # 啟動開發環境 ✅
├── dev-stop.sh                  # 停止服務 ✅
├── dev-restart.sh               # 重啟服務 ✅
└── dev-status.sh                # 查看狀態 ✅
```

---

## 🚀 快速開始

### 啟動開發環境

```bash
# 啟動後端 + 前端服務
./dev-start.sh

# 服務會運行在：
# - 後端 API: http://localhost:8000
# - API 文檔: http://localhost:8000/docs
# - 前端頁面: http://localhost:3000
```

### 其他指令

```bash
./dev-stop.sh      # 停止所有服務
./dev-restart.sh   # 重啟服務
./dev-status.sh    # 查看服務狀態
```

---

## 📡 API 端點總覽

### 遊戲 API (`/api/game`)

| 方法 | 路徑 | 功能 |
|------|------|------|
| POST | `/api/game/` | 創建遊戲 |
| GET | `/api/game/{id}` | 獲取遊戲狀態 (輪詢用) |
| POST | `/api/game/{id}/start` | 開始遊戲 |
| POST | `/api/game/{id}/roll` | 擲骰子 |
| POST | `/api/game/{id}/next-turn` | 下一位玩家 |
| POST | `/api/game/{id}/add-drink` | 加酒到堆疊 |
| POST | `/api/game/{id}/update-score` | 更新玩家積分 |
| POST | `/api/game/{id}/reset-base` | 重置基底酒 |

### 題庫 API (`/api/questions`)

| 方法 | 路徑 | 功能 |
|------|------|------|
| GET | `/api/questions/lsa/random` | 隨機 LSA 問題 |
| GET | `/api/questions/lsa/all` | 所有 LSA 問題 |
| GET | `/api/questions/truth/random` | 隨機真心話大冒險 |
| GET | `/api/questions/truth/all` | 所有真心話大冒險 |

### 測試範例

```bash
# 健康檢查
curl http://localhost:8000/health

# 創建遊戲
curl -X POST http://localhost:8000/api/game/ \
  -H "Content-Type: application/json" \
  -d '{"mode":"family","player_count":4}'

# 獲取遊戲狀態
curl http://localhost:8000/api/game/{game_id}

# 擲骰子
curl -X POST http://localhost:8000/api/game/{game_id}/roll
```

---

## 🎨 前端實作指南 (Phase 3 & 4)

### 1. CSS 設計系統 (`frontend/css/style.css`)

需要實作的設計變數：

```css
:root {
    /* 顏色變數 */
    --bg-primary: #0f0c29;
    --bg-secondary: #302b63;
    --neon-blue: #00f2fe;
    --neon-pink: #ff0055;
    --neon-yellow: #ffe600;

    /* 酒色 */
    --drink-red: #ff4d4d;
    --drink-blue: #4d4dff;
    --drink-yellow: #ffcc00;

    /* 字型 */
    --font-main: 'Microsoft JhengHei', sans-serif;

    /* 間距 */
    --spacing-sm: 8px;
    --spacing-md: 16px;
    --spacing-lg: 24px;
}
```

**風格特色：**
- 霓虹漸變效果
- 深色背景
- 流暢動畫過渡
- 響應式設計 (支援手機/桌面)

### 2. API 封裝 (`frontend/js/api.js`)

需要封裝的 API 類別：

```javascript
class CheersAPI {
    static BASE_URL = (() => {
        const { protocol, hostname } = window.location;
        return `${protocol}//${hostname}:8000/api`;
    })();

    static async request(endpoint, options = {}) {
        // 實作通用請求方法
    }

    static game = {
        create: (mode, playerCount) => { },
        getState: (gameId) => { },
        start: (gameId) => { },
        roll: (gameId) => { },
        nextTurn: (gameId) => { },
        updateScore: (gameId, playerIndex, delta) => { },
        resetBase: (gameId) => { },
        addDrink: (gameId, color) => { },
    };

    static questions = {
        getLSA: () => { },
        getTruthDare: () => { },
    };
}
```

### 3. 輪詢同步 (`frontend/js/polling.js`)

實作遊戲狀態輪詢：

```javascript
class GamePoller {
    constructor(gameId, interval = 1000) {
        this.gameId = gameId;
        this.interval = interval;
        this.listeners = [];
        this.polling = false;
    }

    start() {
        // 每秒輪詢遊戲狀態
        this.polling = true;
        this.poll();
    }

    async poll() {
        // 獲取最新遊戲狀態並通知所有 listeners
    }

    addListener(callback) {
        // 註冊狀態變化回調
    }

    stop() {
        this.polling = false;
    }
}
```

### 4. 遊戲主邏輯 (`frontend/js/app.js`)

需要實作的核心功能：

- 遊戲初始化（從 localStorage 讀取 gameId）
- 轉盤決定順序
- 擲骰子動畫
- 事件處理（LSA 問答、加酒、黑白切等）
- UI 更新（計分板、酒堆疊、當前玩家）
- 輪詢同步整合

### 5. 首頁 (`frontend/index.html`)

需要實作的功能：

- 遊戲標題 + 動畫
- 模式選擇卡片 (闔家歡 vs 酒鬼)
- 玩家人數選擇 (2-8人)
- 開始遊戲按鈕
- 連線狀態指示器

---

## 🔧 使用 Claude Code 繼續開發

### 給下一位開發者的提示

當你使用 Claude Code 繼續這個專案時，可以這樣說：

```
請幫我實作前端 Phase 3 的內容：
1. 建立 CSS 設計系統 (frontend/css/style.css)
2. 實作首頁 index.html (模式選擇)
3. 實作 API 封裝 (frontend/js/api.js)

請參考 DEVELOPMENT_PLAN.md 中的架構和設計指南。
後端已經完成並測試通過，API 端點可以直接使用。
```

或者針對特定功能：

```
請幫我實作轉盤模組 (frontend/js/wheel.js)，需要：
- 使用 HTML5 Canvas 繪製轉盤
- 支援 2-8 位玩家
- 旋轉動畫效果
- 返回最終選中的玩家順序

請參考 CLAUDE.md 中的遊戲機制說明。
```

### 重要提醒

1. **後端已完全重建**：舊的 HTML 文件（game.html）已被刪除，需要重新實作前端
2. **API 端點無尾部斜線**：所有 API 路徑不使用尾部斜線（如 `/api/game/{id}` 不是 `/api/game/{id}/`）
3. **CORS 已配置**：後端已設定 CORS，前端可以從 localhost:3000 訪問 API
4. **輪詢間隔**：建議使用 1 秒間隔輪詢遊戲狀態
5. **遊戲 ID 管理**：使用 localStorage 儲存 `currentGameId`

---

## 📝 開發注意事項

### 骰子事件映射

**闔家歡模式：**
- 3, 5: LSA 問答
- 4, 8: 隨機加酒
- 6: 黑白切
- 7: 選擇酒色
- 9 或對子: 喝酒重置
- 10, 11: 真心話大冒險

**酒鬼模式：**
- 3: 我有你沒有
- 5: 掰手腕
- 4, 8: 隨機加酒
- 6: 黑白切
- 7: 選擇酒色
- 9: 射龍門
- 對子: 罰喝一杯
- 10, 11: 真心話大冒險

### 遊戲流程

1. **首頁** → 選擇模式 + 人數 → 創建遊戲
2. **轉盤** → 決定玩家順序
3. **遊戲循環**：
   - 當前玩家擲骰子
   - 顯示骰子結果 + 事件
   - 執行事件（問答/加酒/小遊戲）
   - 更新積分/酒堆疊
   - 下一位玩家

### 多人同步

- 所有玩家共享同一個 `gameId`
- 前端每秒輪詢 `/api/game/{id}` 獲取最新狀態
- 只有當前回合玩家可以操作（擲骰子等）
- 其他玩家只能觀看

---

## 🐛 已知問題與解決方案

### 問題 1: 模組導入錯誤

**症狀：** `ImportError: cannot import name 'Player' from 'app.models.game'`

**原因：** Player 模型在獨立的 `app/models/player.py` 文件中

**解決：**
```python
# ❌ 錯誤
from app.models.game import Game, Player

# ✅ 正確
from app.models.game import Game
from app.models.player import Player
```

### 問題 2: uvicorn 找不到模組

**症狀：** `Error loading ASGI app. Could not import module "main"`

**原因：** 主應用在 `app.main` 而非 `main`

**解決：**
```bash
# ❌ 錯誤
uvicorn main:app

# ✅ 正確
uvicorn app.main:app
```

---

## 📚 相關文檔

- [CLAUDE.md](./CLAUDE.md) - Claude Code 指引 (專案概述、分支架構)
- [TROUBLESHOOTING.md](./TROUBLESHOOTING.md) - 故障排除記錄
- [MOBILE_ACCESS.md](./MOBILE_ACCESS.md) - 手機訪問設定
- [README.md](./README.md) - 專案說明

---

## 🎯 下一步行動

**立即可以開始：**

1. **建立 CSS 設計系統** → 定義顏色、字型、動畫變數
2. **實作 API 封裝** → 建立前後端通訊基礎
3. **實作首頁** → 讓用戶可以創建遊戲

**建議順序：**

```
CSS 設計系統 → API 封裝 → 首頁 →
轉盤模組 → 骰子模組 → 彈窗模組 →
輪詢同步 → 主應用邏輯 → 遊戲頁面 →
測試整合
```

---

**祝開發順利！ 🍻**

如有任何問題，請查看相關文檔或使用 Claude Code 詢問。
