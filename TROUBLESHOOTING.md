# 🔧 問題修復記錄

## 修復時間
2025-12-12

## 遇到的問題

### 問題 1: 前端無法連接後端 API
**錯誤訊息**:
```
GET http://localhost:3000/api/health 404 (File not found)
```

**原因**:
- 前端服務器在端口 3000
- 後端 API 在端口 8000
- 前端錯誤地向自己（3000）發送 API 請求

**解決方案**:
修改 `frontend/js/api.js`，動態判斷後端 URL：
```javascript
const API_BASE_URL = (() => {
    const protocol = window.location.protocol;
    const hostname = window.location.hostname;
    return `${protocol}//${hostname}:8000/api`;
})();
```

---

### 問題 2: CORS 錯誤
**錯誤訊息**:
```
Access to fetch at 'http://localhost:8000/api/game/' has been blocked by CORS policy
```

**原因**:
資料庫模型錯誤導致後端 500 錯誤，CORS headers 沒有正確返回。

**解決方案**:
1. 修復 `models/game.py`，添加缺少的 `ForeignKey`：
```python
from sqlalchemy import ForeignKey  # 添加導入

class DrinkStack(Base):
    game_id = Column(String, ForeignKey("games.id"), nullable=False)
```

2. 刪除舊資料庫重新創建：
```bash
rm backend/data/cheers.db
```

---

### 問題 3: 307 重定向導致 CORS 失敗
**錯誤訊息**:
```
POST /api/game HTTP/1.1" 307 Temporary Redirect
```

**原因**:
FastAPI 自動重定向（添加尾部斜線），導致 CORS 預檢失敗。

**解決方案**:
1. 在 `main.py` 禁用自動重定向：
```python
app = FastAPI(
    redirect_slashes=False
)
```

2. 在前端所有 API 請求 URL 末尾添加斜線：
```javascript
// 修復前
CheersAPI.request('/game', ...)

// 修復後
CheersAPI.request('/game/', ...)
```

---

## 修復的文件清單

### 後端
1. ✅ `backend/models/game.py` - 添加 ForeignKey 導入和定義
2. ✅ `backend/main.py` - 添加 `redirect_slashes=False`

### 前端
3. ✅ `frontend/js/api.js` - 動態判斷後端 URL
4. ✅ `frontend/js/api.js` - 所有 API 路徑添加尾部斜線

---

## 測試驗證

### 1. 健康檢查
```bash
curl http://localhost:8000/health/
# ✅ 返回: {"status":"healthy"}
```

### 2. 創建遊戲
```bash
curl -X POST http://localhost:8000/api/game/ \
  -H "Content-Type: application/json" \
  -d '{"mode":"family","player_count":4}'
# ✅ 返回遊戲數據
```

### 3. 獲取題目
```bash
curl http://localhost:8000/api/questions/lsa/random/
# ✅ 返回 LSA 問題
```

### 4. 前端測試
訪問: `http://localhost:3000`
- ✅ 可以選擇遊戲模式
- ✅ 可以創建遊戲
- ✅ API 請求成功

---

## 當前狀態

### ✅ 已解決
- [x] 前端 API URL 配置
- [x] CORS 跨域問題
- [x] 資料庫模型關聯
- [x] URL 重定向問題
- [x] 所有 API 端點正常工作

### 🎮 可以正常使用
- [x] 電腦瀏覽器訪問: `http://localhost:3000`
- [x] 手機訪問（同網路）: `http://[IP]:3000`
- [x] 創建遊戲
- [x] API 通訊

---

## 關鍵學習點

1. **多服務器架構**: 前端（3000）和後端（8000）分離
2. **動態 URL 配置**: 根據當前主機名動態生成 API URL
3. **CORS 配置**: 後端必須正確配置 CORS middleware
4. **URL 一致性**: FastAPI 路由的尾部斜線必須一致
5. **資料庫關聯**: SQLAlchemy 需要正確定義 ForeignKey

---

## 預防措施

### 開發時檢查清單
- [ ] 確認前後端端口配置
- [ ] 檢查 CORS 設置
- [ ] 測試 API 端點（使用 curl 或測試頁面）
- [ ] 驗證資料庫模型關聯
- [ ] 確保 URL 格式一致（尾部斜線）

### 測試工具
1. **測試頁面**: `http://localhost:3000/test-api.html`
2. **API 文檔**: `http://localhost:8000/docs`
3. **狀態檢查**: `./dev-status.sh`

---

## 快速啟動

```bash
# 停止舊服務
./dev-stop.sh

# 啟動新服務
./dev-start.sh

# 檢查狀態
./dev-status.sh

# 訪問測試頁面
http://localhost:3000/test-api.html
```

---

## 問題排查流程

1. **檢查服務狀態**:
   ```bash
   ./dev-status.sh
   ```

2. **查看後端日誌**:
   ```bash
   tail -f backend.log
   ```

3. **查看前端日誌**:
   ```bash
   tail -f frontend.log
   ```

4. **測試 API**:
   ```bash
   curl http://localhost:8000/health/
   ```

5. **瀏覽器開發者工具**:
   - Console: 查看 JavaScript 錯誤
   - Network: 查看 API 請求狀態
   - 查看 `API_BASE_URL` 值

---

## 總結

所有問題已成功解決！系統現在可以：
- ✅ 正常啟動前端和後端服務器
- ✅ 正確處理跨域請求（CORS）
- ✅ 創建和管理遊戲
- ✅ 支持手機訪問
- ✅ 所有 API 端點正常工作

**現在可以開始遊戲了！🎉🍻**
