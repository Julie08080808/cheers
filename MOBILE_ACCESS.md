# 📱 手機訪問指南

## 如何用手機玩遊戲

### 前提條件
- 手機和電腦在同一個 Wi-Fi 網路下
- 開發環境已啟動（執行 `./dev-start.sh`）

### 步驟 1: 獲取電腦 IP 位址

執行開發腳本時會自動顯示，或者手動查詢：

```bash
# Linux/Mac
hostname -I | awk '{print $1}'

# 或者使用
ip addr show | grep "inet " | grep -v 127.0.0.1
```

例如：`172.28.27.114`

### 步驟 2: 在手機瀏覽器輸入網址

```
http://[你的電腦IP]:3000
```

例如：`http://172.28.27.114:3000`

### 步驟 3: 開始遊戲 🎮

1. 選擇遊戲模式（闔家歡或酒鬼模式）
2. 選擇玩家人數
3. 點擊「開始遊戲」

## 網路架構

```
┌─────────────┐
│   手機      │
│   瀏覽器    │ ← http://192.168.x.x:3000
└──────┬──────┘
       │ Wi-Fi
       │
┌──────▼──────────────────────┐
│   電腦 (192.168.x.x)        │
│                             │
│  ┌──────────────────────┐  │
│  │ 前端服務器 :3000     │  │
│  │ (Python http.server) │  │
│  └──────────┬───────────┘  │
│             │ API 請求      │
│  ┌──────────▼───────────┐  │
│  │ 後端 API :8000       │  │
│  │ (FastAPI)            │  │
│  └──────────────────────┘  │
└─────────────────────────────┘
```

## 跨域請求 (CORS)

後端已配置允許所有來源的請求：

```python
# backend/main.py
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # 允許所有來源
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

✅ 手機可以直接向後端 API 發送請求

## 防火牆設定

如果手機無法訪問，請檢查防火牆：

### Ubuntu/Debian (UFW)
```bash
sudo ufw allow 3000/tcp
sudo ufw allow 8000/tcp
```

### CentOS/RHEL (firewalld)
```bash
sudo firewall-cmd --permanent --add-port=3000/tcp
sudo firewall-cmd --permanent --add-port=8000/tcp
sudo firewall-cmd --reload
```

### 使用自動腳本
```bash
sudo ./firewall-setup.sh
```

## 疑難排解

### 問題 1: 手機無法訪問

**檢查項目**：
```bash
# 1. 確認服務運行
./dev-status.sh

# 2. 確認端口監聽
netstat -tuln | grep -E "3000|8000"

# 3. 測試本機訪問
curl http://localhost:3000
curl http://localhost:8000/health
```

**解決方案**：
- 確認手機和電腦在同一網路
- 檢查電腦防火牆設定
- 確認服務綁定到 `0.0.0.0` 而非 `127.0.0.1`

### 問題 2: API 請求失敗

**檢查**：
```bash
# 查看後端日誌
tail -f backend.log

# 測試 API
curl http://localhost:8000/api/game
```

**解決方案**：
- 確認 CORS 設定正確
- 檢查前端 `api.js` 中的 API_BASE_URL
- 查看瀏覽器開發者工具的 Console 和 Network 標籤

### 問題 3: 前端顯示但無法創建遊戲

**可能原因**：
- 前端無法連接到後端 API
- 檢查 `frontend/js/api.js` 的 `API_BASE_URL`
- 應該是 `window.location.origin + '/api'`

**測試**：
在手機瀏覽器的開發者工具（如果可用）或桌面瀏覽器模擬手機模式：
1. 打開開發者工具
2. 查看 Console 是否有錯誤
3. 查看 Network 標籤，確認 API 請求狀態

## 性能優化建議

### 本地網路優化
- 使用 5GHz Wi-Fi 頻段（速度更快）
- 減少網路中的其他設備流量
- 確保路由器與電腦/手機距離適中

### 服務器優化
- 生產環境使用 Docker + NGINX（見 README.md）
- 開發環境適合 2-4 個玩家同時測試
- 更多玩家建議使用生產模式

## 測試 Checklist

- [ ] 電腦啟動開發環境 `./dev-start.sh`
- [ ] 電腦瀏覽器訪問 `http://localhost:3000` 成功
- [ ] 獲取電腦 IP 位址
- [ ] 手機連接同一 Wi-Fi
- [ ] 手機瀏覽器訪問 `http://[電腦IP]:3000` 成功
- [ ] 手機成功創建遊戲
- [ ] 手機可以看到遊戲狀態更新
- [ ] 測試完成後執行 `./dev-stop.sh` 停止服務

## 多玩家測試

可以同時使用多個設備訪問：
- 電腦瀏覽器：`http://localhost:3000`
- 手機 1：`http://192.168.x.x:3000`
- 手機 2：`http://192.168.x.x:3000`
- 平板：`http://192.168.x.x:3000`

每個設備可以獨立創建遊戲或加入不同遊戲。

## 生產部署

如果要讓外網（非同一 Wi-Fi）的用戶訪問：

1. 使用 Docker Compose 部署
2. 配置 NGINX 反向代理
3. 設定域名和 HTTPS
4. 配置雲端服務器（AWS、GCP、Azure 等）

詳見 README.md 的「生產環境部署」章節。
