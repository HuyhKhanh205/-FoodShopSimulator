# Kế hoạch chơi online co-op — Quán Ăn Của Tôi

> Trạng thái: **kế hoạch** (chưa code). Mục tiêu: 2–4 người (ví dụ bố mẹ + bé) cùng điều hành **một quán**, mỗi người điều khiển một nhân vật theo thời gian thực, chơi được trên điện thoại.

## 1. Trải nghiệm người chơi

1. Màn chính có thêm nút **👫 Chơi cùng nhau** → **🏠 Tạo phòng** hoặc **🔢 Vào phòng**.
2. Người tạo phòng (chủ phòng) nhận **mã 4 số** (vd `4821`) + mã QR; người khác nhập mã / quét QR là vào.
3. **Phòng chờ**: mỗi người chọn nhân vật và màu áo (dùng lại màn Tạo nhân vật), thấy ảnh đại diện của nhau; chủ phòng bấm **🏮 Mở cửa**.
4. Trong quán: mỗi người đi lại, thái, nấu, bưng món độc lập; trên đầu mỗi nhân vật có **bảng tên màu** riêng. Tiền, kho, danh tiếng, khách là **chung**.
5. Buổi sáng đi chợ: ai cũng bấm mua được (tiền chung); chỉ chủ phòng bấm **Mở cửa** / **Sang ngày mới**.
6. An toàn cho trẻ: **không có ô chat**, chỉ có **biểu cảm nhanh** (👍 ❤️ 😂 🆘 "Giúp mình với!"); không thu thập tên thật, email hay vị trí.

## 2. Kiến trúc đề xuất: chủ phòng làm "trọng tài" (host-authoritative)

```
 Người chơi B ──(ý định: đi tới, thái, nấu...)──┐
 Người chơi C ──────────────────────────────────┤      Máy chủ chuyển tiếp (relay)
                                                ▼      chỉ nhận / gửi tin, không chạy game
                               Chủ phòng A: chạy engine.ts (tick 200 ms, rng có seed)
                                                │
      ◀──(trạng thái game 5 lần/giây + vị trí nhân vật 15 lần/giây)──┘
```

- **Tái dùng engine hiện có**: `src/game/engine.ts` là hàm thuần (nhận `GameState`, sửa bản nháp, rng có seed) — rất hợp để một máy chạy, các máy khác chỉ gửi **ý định** (intent). Không phải viết lại luật game.
- **Ý định** (tin nhỏ, JSON): `move{to}`, `prep{ingredient}`, `chop`, `cook{recipe, slotId, noGarnish}`, `stir{slotId}`, `takeOut{slotId}`, `pickUp{dishId}`, `serve{dishId, customerId}`, `buy{id, qty}`, `emote{icon}`.
- **Chủ phòng** kiểm tra lại mọi ý định bằng chính các hàm `player*` (sai thì bỏ qua) → chống gian lận cơ bản, không cần máy chủ hiểu luật.
- **Đồng bộ trạng thái**: chủ phòng gửi *ảnh chụp* `run` (khách, bếp, món, kho) mỗi 200 ms — nén bằng cách chỉ gửi phần thay đổi (JSON diff); ảnh chụp đầy đủ mỗi 5 giây / khi có người mới vào.
- **Vị trí nhân vật**: mỗi máy tự đi (dự đoán ngay khi bấm, không chờ mạng) và gửi vị trí 15 lần/giây; máy khác **nội suy** (trễ ~100 ms) cho mượt — dùng lại `useWalker`.

## 3. Chọn đường truyền

| Cách | Ưu | Nhược | Dùng khi |
|---|---|---|---|
| **WebSocket relay tự viết** (Node + `ws`, ~150 dòng) chạy trên Fly.io / Render / Cloudflare Durable Objects | Rẻ (miễn phí gói nhỏ), toàn quyền, độ trễ thấp | Tự vận hành | **Đề xuất cho giai đoạn đầu** |
| PartyKit / Colyseus | Có sẵn phòng, mã phòng, kết nối lại | Thêm thư viện, học cách dùng | Nếu muốn nhanh hơn và chấp nhận phụ thuộc |
| Supabase Realtime (broadcast) | Không cần tự dựng server, có đăng nhập nếu cần | Giới hạn số tin/giây ở gói miễn phí | Nếu sau này cần tài khoản, bảng xếp hạng |
| Dữ liệu chung của Artifact | Chia sẻ link là chơi | Không đủ nhanh cho thời gian thực | Chỉ hợp cho phòng chờ / lưu kết quả |

Bản web một file (`build:html`) và app Expo đều dùng được WebSocket, nên cùng một đoạn mã mạng chạy cho cả hai.

## 4. Thay đổi cần làm trong engine (M0)

- `DayRuntime.carrying: string[]` → `carrying: Record<PlayerId, string[]>`; `playerPrep` → `Record<PlayerId, PrepJob | null>`.
- `GameState.profile` → `players: Record<PlayerId, { profile: PlayerProfile; online: boolean }>` (giữ `profile` cũ = người chơi 1 để bản lưu cũ vẫn mở được — viết hàm chuyển đổi trong `storage.ts`).
- Mọi hàm `player*` (`playerPrep`, `playerChop`, `playerCook`, `playerStir`, `playerTakeOut`, `pickUpDish`, `serveCarried`, …) nhận thêm `playerId`. Chơi một mình dùng `playerId = 'p1'` → không đổi hành vi.
- **Tranh chấp**: hai người cùng nhấc một món / cùng nấu một bếp → chủ phòng xử lý theo thứ tự tin đến, người đến sau nhận thông báo nhỏ "🙅 Bạn khác đã lấy".
- Khách: độ khó tăng nhẹ theo số người (thêm khách, `PATIENCE_BONUS` giảm dần) để vẫn vui mà không quá dễ.
- Kiểm thử: mở rộng `scripts/check-map.ts` với 2 người chơi giả lập song song; `scripts/simulate.ts` thêm kịch bản 2–3 người.

## 5. Tình huống mạng

- **Mất kết nối**: nhân vật đứng yên, mờ đi, có biểu tượng 📶❌; vào lại bằng cùng mã phòng trong 2 phút là nhận lại nhân vật và món đang cầm.
- **Chủ phòng thoát**: game tự **tạm dừng** ở mọi máy; chủ phòng quay lại là chơi tiếp. (Giai đoạn sau: chuyển quyền chủ phòng cho người khác bằng ảnh chụp trạng thái mới nhất.)
- **Mạng chậm**: hiển thị chấm màu độ trễ; vượt 500 ms thì tăng thời gian nội suy.
- **Lưu game**: chỉ chủ phòng lưu (như hiện nay, AsyncStorage). Người khác không lưu gì.

## 6. Lộ trình

| Mốc | Nội dung | Ước lượng |
|---|---|---|
| **M0** | Engine nhiều người chơi + chuyển đổi bản lưu + kiểm thử 2 người trên một máy (chia đôi màn hình để thử) | 3–4 ngày |
| **M1** | Máy chủ relay WebSocket, mã phòng 4 số, phòng chờ, QR | 2–3 ngày |
| **M2** | Gửi ý định + ảnh chụp trạng thái, nội suy vị trí, bảng tên, biểu cảm | 4–5 ngày |
| **M3** | Mất kết nối / vào lại, chủ phòng thoát → tạm dừng, chống tranh chấp | 2–3 ngày |
| **M4** | Thử trên điện thoại thật (Expo Go, iPhone + Android), tối ưu pin / nhiệt, phát hành | 3–5 ngày |

## 7. Chi phí & vận hành

- Máy chủ relay chỉ chuyển tin: một máy nhỏ (256 MB) chịu được hàng trăm phòng. Gói miễn phí / ~5 USD mỗi tháng là đủ giai đoạn đầu.
- Mỗi phòng 4 người ≈ 4 × 15 tin vị trí + 5 ảnh chụp mỗi giây ≈ 10–20 KB/giây.
- Không lưu dữ liệu người dùng trên máy chủ (phòng tự xoá sau 30 phút không hoạt động).

## 8. Kiểm thử

- Tự động: engine 2–4 người (check-map, simulate); máy chủ relay (Node test: tạo phòng, vào phòng, mất kết nối).
- Playwright mở 2–3 tab trình duyệt cùng một phòng, chơi hết một ngày, so sánh trạng thái cuối giữa các tab phải khớp.
- Thử tay: 2 điện thoại khác mạng (Wi-Fi + 4G), mạng chậm giả lập.

## 9. Rủi ro

- **Chủ phòng dùng điện thoại yếu** → engine + cảnh 3D cùng chạy có thể nóng máy. Cách giảm: chủ phòng tự tắt bớt hiệu ứng (đã có chế độ nhẹ cho màn nhỏ).
- **Trẻ em bấm lung tung**: ý định sai bị chủ phòng bỏ qua, không làm hỏng game.
- **Safari iPhone ngủ khi tắt màn hình** → mất kết nối: xử lý bằng cơ chế vào lại (M3).
