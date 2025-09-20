# 新竹市即時事故通報（模擬版）

本專案為純前端多頁式網站，使用 Leaflet 顯示地圖、以 `localStorage` 模擬資料儲存與通知，不會呼叫任何真實 API。

## 功能
- 首頁地圖（`index.html`）
  - 顯示事故標記、按狀態/嚴重度顏色區分
  - 側欄事故列表、篩選（類別/嚴重度/狀態）
  - 模擬通知清單（對符合訂閱與高危險事故顯示）
- 通報頁（`report.html`）
  - 使用目前位置或點擊地圖選點
  - 填寫事故資料（類別、嚴重度、標題、描述）
  - 送出後以 Reported 狀態寫入 `localStorage`
- 訂閱頁（`subscribe.html`）
  - 選擇中心點與半徑、類別、最低嚴重度
  - 儲存到 `localStorage` 的訂閱規則
- 管理審核頁（`admin.html`）
  - 查看所有事故、調整狀態（Reported → Accepted → Verified & Warned → Resolved / Rejected）
  - 指派單位欄位
  - 在設為 Verified & Warned 時，對符合的訂閱推送模擬通知

## 啟動方式
- 直接以瀏覽器開啟 `index.html`（或其他頁面）即可。
- 若瀏覽器限制地理定位於本機檔案，可使用任意靜態伺服器（例如 VSCode Live Server、`python -m http.server` 等）。

## 資料結構（localStorage）
- `incidents`：事故清單（Array）
```json
{
  "id": "inc_...",
  "title": "...",
  "description": "...",
  "type": "fire|traffic|lighting|road|other",
  "severity": "low|medium|high",
  "status": "Reported|Accepted|VerifiedWarned|Resolved|Rejected",
  "location": { "lat": 24.8, "lng": 121.0, "address": "" },
  "assignedAgency": "",
  "source": "public|official",
  "createdAt": 0,
  "updatedAt": 0
}
```
- `subscriptions`：訂閱規則（Array）
```json
{
  "id": "sub_...",
  "center": { "lat": 24.8, "lng": 121.0 },
  "radiusMeters": 1000,
  "categories": ["fire", "traffic"],
  "minSeverity": "medium"
}
```
- `notifications`：通知佇列（Array）
```json
{
  "id": "ntf_...",
  "incidentId": "inc_...",
  "title": "...",
  "message": "...",
  "createdAt": 0,
  "read": false
}
```

## 注意
- 所有資料皆存於瀏覽器 `localStorage`，清除瀏覽資料會一併清除。
- 地圖底圖使用 Leaflet + OSM，請保持網路連線以載入底圖瓦片。
