# 🍜 Quán Ăn Của Tôi — Food Shop Simulator

Game giả lập mở quán ăn, viết bằng **Expo (SDK 57) + React Native + TypeScript**. Chạy trên trình duyệt máy tính và điện thoại (Expo Go).

Bạn vay 10 triệu để mở quán. Mỗi ngày: đi chợ mua nguyên liệu → mở cửa 3 phút (7:00–21:00 trong game) → sơ chế, nấu, phục vụ → xem tổng kết. Trả hết nợ trước ngày 30!

## Chạy trên máy tính

```bash
git clone https://github.com/HuyhKhanh205/-FoodShopSimulator.git
cd -- -FoodShopSimulator
npm install
npm run web          # mở http://localhost:8081
```

Chạy trên điện thoại: `npm start` rồi quét QR bằng app **Expo Go**.

Kiểm tra kiểu: `npm run typecheck` · Mô phỏng cân bằng game (không cần giao diện): `npx tsx scripts/simulate.ts`

## Lối chơi

| Giai đoạn | Việc cần làm |
|---|---|
| ☀️ Chợ sáng | Mua nguyên liệu (giá dao động mỗi ngày, đồ tươi hỏng sau 1–2 ngày), thuê/sa thải nhân viên, nâng cấp quán, mở khóa món mới, trả nợ |
| 🏮 Mở cửa | **Sơ chế** thịt/rau/hành → **nấu** trên bếp (nhấc sớm = sống, để lâu = cháy) → chọn món ở quầy ra món → **bấm vào khách** để phục vụ |
| 🌙 Tổng kết | Thu chi, số bàn phục vụ/bỏ về, lỗi nhân viên, đánh giá sao của khách |

### Nhân viên (có tỉ lệ làm sai)
- **Đầu bếp** tự nấu, **phụ bếp** tự sơ chế, **phục vụ** tự mang món, lau dọn, chặn khách bùng tiền.
- Tỉ lệ sai = gốc theo vị trí × (1 − 0.9 × tay nghề) × tâm trạng × giờ cao điểm × tính cách.
- Lỗi có thể xảy ra: nấu nhầm món, để cháy, quên ghi chú "không hành", mang nhầm bàn, sơ chế làm hỏng nguyên liệu.
- Tính cách: Nhanh nhưng ẩu, Chậm mà chắc, Hay đi trễ, Khéo miệng (+tip), Lười.
- Lương thấp hơn mặt bằng → tâm trạng giảm → sai nhiều hơn → có thể nghỉ việc. Tay nghề tăng dần theo kinh nghiệm.

### Tình huống ngẫu nhiên
- **Khách:** khó tính, dị ứng hành, food reviewer ẩn danh (ảnh hưởng danh tiếng ×3), khách quen (tip ×2), shipper (trừ 20% phí sàn), khách bùng tiền, nhóm 1–3 người, đơn công ty 6 phần.
- **Buổi sáng:** giá thịt tăng vọt, ngày lễ (khách ×1.8), mưa bão (nhiều đơn giao), quán đối thủ khai trương, nhà cung cấp giao thiếu, nhân viên ốm, lên báo địa phương.
- **Trong ngày:** cúp điện, hết gas, thanh tra vệ sinh (phạt nếu bẩn/có đồ hết hạn), chuột trong kho, nhân viên cãi khách / đòi tăng lương / ăn vụng, em bé làm vỡ bát, có tóc trong đồ ăn.

Mỗi tình huống có nhiều lựa chọn với hậu quả khác nhau (tiền, danh tiếng, tâm trạng nhân viên).

## Cấu trúc mã

```
src/game/          Logic thuần (không phụ thuộc React) — dễ kiểm thử
  data.ts          Nguyên liệu, công thức, nâng cấp, hằng số cân bằng
  engine.ts        Vòng lặp tick, hành động người chơi, AI nhân viên, đóng/mở ngày
  customers.ts     Sinh khách, phục vụ, thanh toán, đánh giá
  events.ts        Các tình huống ngẫu nhiên và lựa chọn
  storage.ts       Lưu/tải bằng AsyncStorage (tự lưu ngoài giờ mở cửa)
  GameContext.tsx  Kết nối engine với React (đồng hồ 200ms, tự lưu)
src/screens/       Home, Game (Chợ / Mở cửa / Tổng kết), Nhân viên, Nâng cấp
src/components/    CustomerCard, CookSlotCard, EventModal, Hud, ui
scripts/simulate.ts  Bot chơi thử 30 ngày để cân bằng số liệu
```

Màn hình rộng (≥ 900px, máy tính) hiển thị 3 cột; màn hình hẹp (điện thoại) chia tab.
