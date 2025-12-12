# 開發待辦清單

> 📅 最後更新：2025-12-12

## ✅ 已完成

### Phase 1 & 2: 後端重建
- [x] 清理舊代碼，建立新專案結構
- [x] 配置 pyproject.toml + uv 依賴管理
- [x] 實作資料庫模型 (Game, Player, DrinkStack)
- [x] 實作 Pydantic schemas
- [x] 實作遊戲 CRUD API (8 個端點)
- [x] 實作骰子事件引擎
- [x] 實作題庫 API (LSA + 真心話大冒險)
- [x] 後端測試通過 ✅
- [x] Git commit + push
- [x] 建立開發文檔

---

## ⏳ 待完成

### Phase 3: 前端基礎

- [ ] **建立 CSS 設計系統** (`frontend/css/style.css`)
  - 定義顏色變數 (霓虹風格)
  - 定義字型和間距
  - 實作通用動畫效果
  - 響應式設計

- [ ] **實作首頁** (`frontend/index.html`)
  - 遊戲標題 + 動畫
  - 模式選擇卡片 (闔家歡 vs 酒鬼)
  - 玩家人數選擇 (2-8人)
  - 開始遊戲按鈕
  - 連線狀態指示

- [ ] **實作 API 封裝** (`frontend/js/api.js`)
  - CheersAPI 類別
  - 通用請求方法
  - 遊戲 API 封裝
  - 題庫 API 封裝

### Phase 4: 遊戲核心

- [ ] **轉盤模組** (`frontend/js/wheel.js`)
  - Canvas 繪製轉盤
  - 旋轉動畫
  - 決定玩家順序

- [ ] **骰子模組** (`frontend/js/dice.js`)
  - 3x3 網格顯示
  - 擲骰子動畫
  - 顯示結果

- [ ] **彈窗模組** (`frontend/js/modal.js`)
  - 通用彈窗系統
  - LSA 問答彈窗
  - 真心話大冒險彈窗
  - 顏色選擇彈窗

- [ ] **輪詢同步** (`frontend/js/polling.js`)
  - GamePoller 類別
  - 1秒輪詢間隔
  - 狀態變化監聽器

- [ ] **主應用邏輯** (`frontend/js/app.js`)
  - GameApp 類別
  - 遊戲初始化
  - 事件處理器
  - UI 更新邏輯

- [ ] **遊戲主頁面** (`frontend/game.html`)
  - 轉盤區域
  - 骰子顯示區
  - 計分板
  - 酒堆疊顯示
  - 當前玩家指示

### Phase 5: 測試與優化

- [ ] **單人遊戲測試**
  - 創建遊戲流程
  - 轉盤決定順序
  - 擲骰子測試
  - 所有事件測試
  - 計分系統測試

- [ ] **多人同步測試**
  - 多裝置連接測試
  - 輪詢同步測試
  - 狀態一致性測試

- [ ] **問題修復**
  - 修復測試中發現的問題
  - 優化性能
  - 改善使用者體驗

---

## 🚀 快速開始

```bash
# 1. 啟動開發環境
./dev-start.sh

# 2. 在瀏覽器中訪問
# - 前端: http://localhost:3000
# - API 文檔: http://localhost:8000/docs

# 3. 使用 Claude Code 繼續開發
# 對 Claude Code 說：
# "請幫我實作 Phase 3 的 CSS 設計系統，參考 DEVELOPMENT_PLAN.md"
```

---

## 📚 參考文檔

- **[DEVELOPMENT_PLAN.md](./DEVELOPMENT_PLAN.md)** - 完整開發計畫 (必讀！)
- **[CLAUDE.md](./CLAUDE.md)** - Claude Code 指引
- **[README.md](./README.md)** - 專案說明

---

**當前進度：Phase 2 完成 ✅ | 前端待實作 ⏳**
