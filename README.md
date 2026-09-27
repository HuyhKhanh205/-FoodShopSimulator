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

## 🌐 Bản web một file (chơi không cần máy chủ)

```bash
npm run build:html   # tạo dist/foodshop.html
```
File `dist/foodshop.html` chứa toàn bộ game, mở bằng bất kỳ trình duyệt nào (kể cả điện thoại) là chơi được. Tiến trình lưu trong trình duyệt.

## 📱 Chạy trên điện thoại (Expo Go)

1. Cài app **Expo Go** (App Store / CH Play), mở một lần. Trên iPhone, khi được hỏi quyền **"Mạng cục bộ / Local Network"** thì bấm **Cho phép**.
2. Máy tính và điện thoại **cùng một mạng Wi-Fi**. Trong thư mục dự án chạy:
   ```bash
   npm start
   ```
   (không phải `npm run web`). Terminal sẽ in ra **một mã QR lớn** và dòng `Metro waiting on exp://192.168.x.x:8081`.
3. Quét mã QR:
   - **iPhone:** trong Expo Go **không có nút quét** — mở **app Camera mặc định** của iPhone, hướng vào mã QR trên màn hình máy tính, rồi bấm dòng thông báo **"Mở trong Expo Go"** hiện ra.
   - **Android:** mở Expo Go → bấm **"Scan QR code"**.
4. Camera không nhận mã? Mở Expo Go → **"Enter URL manually"** → gõ đúng địa chỉ `exp://192.168.x.x:8081` in trong terminal.
5. Vẫn không vào được (Wi-Fi trường/quán cà phê chặn thiết bị kết nối với nhau, hoặc tường lửa): chạy
   ```bash
   npm run tunnel
   ```
   rồi quét lại mã QR mới. Trên Windows, nếu hiện hộp thoại Firewall thì cho phép **Node.js** ở mạng **Private**.
6. Expo Go báo *"incompatible SDK"* → cập nhật Expo Go lên bản mới nhất (dự án dùng Expo SDK 57).

Kiểm tra kiểu: `npm run typecheck` · Mô phỏng cân bằng game (không cần giao diện): `npx tsx scripts/simulate.ts` · Kiểm tra bản đồ: `npx tsx scripts/check-map.ts`

## Lối chơi

| Giai đoạn | Việc cần làm |
|---|---|
| ☀️ Chợ sáng | Mua nguyên liệu (giá dao động mỗi ngày, đồ tươi hỏng sau 1–2 ngày), thuê/sa thải nhân viên, nâng cấp quán, mở khóa món mới, trả nợ |
| 🏮 Mở cửa | **Sơ chế** thịt/rau/hành → **nấu** trên bếp (nhấc sớm = sống, để lâu = cháy) → chọn món ở quầy ra món → **bấm vào khách** để phục vụ |
| 🌙 Tổng kết | Thu chi, số bàn phục vụ/bỏ về, lỗi nhân viên, đánh giá sao của khách |

### 🗺️ Góc nhìn nhân vật (chế độ bản đồ 3D — mặc định)
Giờ mở cửa hiển thị quán dạng **3D nhìn chéo từ trên** (three.js + react-three-fiber): chủ quán, nhân viên và khách là nhân vật 3D low-poly có bóng đổ, tay chân vung khi đi, cầm đĩa món trên tay; bếp có lửa và khói khi sắp cháy. Trên điện thoại cầm dọc, camera tự xoay để quán nằm dọc màn hình. Thiết bị không có WebGL sẽ tự dùng bản đồ 2D. Bố cục quán: bếp, quầy pha chế, kho, thớt ở trên; quầy ra món ở giữa; bàn khách và cửa ra vào ở dưới. Bạn điều khiển chủ quán 🧑‍🍳 đi lại:

| Thao tác | Điện thoại | Máy tính |
|---|---|---|
| Đi tới đồ vật / ô sàn | Chạm vào đó | Nhấp chuột, hoặc **WASD / phím mũi tên** |
| Thao tác với đồ vật bên cạnh | Tự hiện bảng hành động khi tới nơi | **E / Space / Enter** |

- **Thớt** 🔪: sơ chế · **Bếp** 🔥 / **Quầy** 🥤: chọn món để nấu, tới lại khi chín là tự nhấc lên tay · **Quầy ra món** 🛎️: cầm / đặt món · **Bàn** 🪑 / **Cửa** 🚪: tới nơi là tự đưa món đang cầm khớp đơn (không bao giờ tự đưa món có hành cho khách dặn "không hành") · **Thùng rác** 🗑️ · **Lau dọn** 🧽 · **Kho** 🧊: xem tồn kho.
- Cầm tối đa **2 món**. Bàn có viền xanh = khách đang chờ món bạn cầm.
- Nhân viên cũng hiện trên bản đồ, mặc đồng phục theo vị trí: đầu bếp áo trắng khăn đỏ đội mũ đầu bếp (đứng bếp), phụ bếp áo xanh lá mũ lưỡi trai (ở thớt), phục vụ áo đỏ tạp dề đen (chạy tới bàn).
- Khách mỗi người một màu áo, quần, tóc, da khác nhau, nhiều người đội mũ lưỡi trai / nón lá / khăn — mô hình KayKit được tô lại màu theo từng vùng (áo, khăn, quần, tóc, da) bằng shader.
- Nút **📋 Bảng / 🗺️ Bản đồ** trên thanh đồng hồ để chuyển qua lại với bảng điều khiển bấm nút (lựa chọn được ghi nhớ).

### 🛒 Đi chợ giữa giờ bán
Hết nguyên liệu giữa ngày? Bấm **🛒** trên màn chơi để chạy ra chợ (thời gian vẫn trôi).
- **Chưa có nhân viên nào đang làm** → quán **treo biển tạm đóng**: không đón khách mới; khách đang ngồi vẫn chờ và có thể bỏ về, món trên bếp vẫn có thể cháy.
- **Có nhân viên** → quán vẫn bán bình thường trong lúc bạn đi chợ.
- Bấm **🏃 Về quán** để quay lại.

### 👀 Bếp của tôi — góc nhìn thứ nhất (thớt + bếp + quầy chung một màn)
Tới **thớt**, **bếp** hoặc **quầy pha chế** là vào màn **Bếp của tôi**: nhìn qua mắt chủ quán (kiểu Kebab Chefs, không vẽ tay) cả dãy bếp — thớt, các bếp, quầy pha chế nằm cạnh nhau. Không cần đi qua lại trên bản đồ nữa:
- Thanh trên cùng **🔪 Thớt · 🔥 Bếp 1 · 🔥 Bếp 2 · 🧋 Quầy** (hoặc nút ‹ › hai bên, phím ← → / A D / 1–9) để camera lướt sang trạm khác. Mỗi trạm có huy hiệu: % đang nấu, ✅ chín, ⚠️ sắp cháy (viền đỏ), 👤 nhân viên đang nấu — thái rau mà vẫn canh được nồi phở.
- Thớt: chọn nguyên liệu rồi **chạm liên tục** để thái nhanh hơn (mỗi nhát rút 0,35 giây). Nguyên liệu vẽ chi tiết: miếng bò bít tết, ba chỉ heo nhiều lớp nạc – mỡ – bì, đùi gà, hành lá gốc trắng có rễ, xà lách, tôm có đốt – đuôi – râu; thái tới đâu nguyên liệu ngắn lại tới đó, đống thịt thái / hành cắt khoanh / tôm bóc vỏ to dần, xong thì vào bát.
- Bếp: chọn món (nấu đúng bếp đang đứng), **chạm để khuấy**. Phở, cơm gà nấu trong nồi; bún chả, bánh mì trứng làm trên chảo. Món đổi màu dần từ sống → chín → cháy: thịt bò tái chuyển nâu, chả nướng có vệt cháy, trứng từ trong sang trắng; sắp cháy thì bốc khói đen.
- **Nhấc ra** thì món lên tay (tối đa 2) và **vẫn ở lại bếp** để làm tiếp; bấm **🍽️ Ra phục vụ** (hoặc **⬅ Rời bếp**, phím Esc) để quay ra quán. Space / E để thái – khuấy trên máy tính.
- Món mang ra bàn, đặt trên quầy ra món hay cầm trên tay đều là mô hình chi tiết: bát phở có bánh, thịt, hành; đĩa cơm gà; bún chả; ổ bánh mì; gỏi cuốn thấy tôm bên trong; ly trà đá, cà phê sữa có đá.

Trên điện thoại cảnh quán được phóng to 30% và camera đi theo nhân vật.

### 🧑‍🍳 Tạo nhân vật
Khi bấm **Chơi mới**, bạn tạo chủ quán (xem trước 3D xoay tròn): tên chủ quán, tên quán, giới tính, kiểu tóc (ngắn, dựng, dài, búi, trọc), màu tóc, màu da, màu áo / tạp dề (khăn – viền áo) / quần — **tô được lên cả 4 nhân vật KayKit**, mũ (mũ đầu bếp, lưỡi trai, nón lá, khăn trùm) và kính; có nút 🎲 Ngẫu nhiên. Sửa lại được mỗi buổi sáng bằng nút **🧑‍🍳 Nhân vật** ở màn chợ.

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
  layout.ts        Bố cục bản đồ quán + tìm đường (BFS) cho chế độ góc nhìn nhân vật
  staffTarget.ts   Nhân viên đứng ở đâu trên bản đồ theo việc đang làm
  storage.ts       Lưu/tải bằng AsyncStorage (tự lưu ngoài giờ mở cửa)
  GameContext.tsx  Kết nối engine với React (đồng hồ 200ms, tự lưu)
src/screens/       Home, Game (Chợ / Mở cửa / Tổng kết), Nhân viên, Nâng cấp
src/components/    CustomerCard, CookSlotCard, EventModal, Hud, ShopTopBar, ui
  map/             Bản đồ 2D dự phòng + bảng hành động
  scene/           Cảnh 3D: camera, nhân vật low-poly, đồ vật, lớp chữ nổi, HUD
scripts/simulate.ts  Bot chơi thử 30 ngày để cân bằng số liệu
scripts/check-map.ts Kiểm tra bản đồ và việc cầm/đưa món
```

Màn hình rộng (≥ 900px, máy tính) hiển thị 3 cột; màn hình hẹp (điện thoại) chia tab.

## Ghi công mô hình 3D
Nhân vật và đồ vật nhà hàng dùng mô hình **KayKit** của Kay Lousberg (Character Pack: Adventurers, Restaurant Bits, Furniture Bits) — giấy phép **CC0**. Xem `assets/models/LICENSE.md`; tạo lại bằng `scripts/build-models.mjs` và `scripts/embed-models.mjs`.
