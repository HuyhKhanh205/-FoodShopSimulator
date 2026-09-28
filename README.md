# 🍜 Quán Ăn Của Tôi — Food Shop Simulator

Game giả lập mở quán ăn, viết bằng **Expo (SDK 57) + React Native + TypeScript**. Chạy trên trình duyệt máy tính và điện thoại (Expo Go).

Bạn vay 10 triệu để mở quán. Mỗi ngày: đi chợ mua nguyên liệu → mở cửa 10 phút (7:00–21:00 trong game, khách tới thưa, dễ thở) → sơ chế, nấu, phục vụ → xem tổng kết. Trả hết nợ trước ngày 33 (30 ngày kinh doanh + 3 ngày làm quen)!

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
| Thao tác với đồ vật bên cạnh | Tự làm khi tới nơi (không có bảng nút, cảnh 3D kín màn hình) | **E / Space / Enter** |

- **Thớt** 🔪: sơ chế · **Bếp** 🔥 / **Quầy** 🥤: chọn món để nấu, tới lại khi chín là tự nhấc lên tay · **Quầy ra món** 🛎️: tới nơi là tự cầm món (món khách đang chờ lên trước) tới khi đầy tay · **Bàn** 🪑 / **Cửa** 🚪: tới nơi là tự đưa món đang cầm khớp đơn (không bao giờ tự đưa món có hành cho khách dặn "không hành") · **Thùng rác** 🗑️: tự bỏ món hỏng đang cầm (không có món hỏng thì bỏ hết) · **Lau dọn** 🧽: tự lau. Mỗi việc tự làm hiện chữ nổi ngắn (🤲 +🥪, 🗑️, 🧽 ✨). Nhãn 🤲 góc dưới cho biết đang cầm gì. Bản đồ 2D dự phòng (máy không có WebGL) vẫn có bảng nút.
- Cầm tối đa **2 món**. Bàn có viền xanh = khách đang chờ món bạn cầm.
- Nhân viên cũng hiện trên bản đồ, mặc đồng phục theo vị trí: đầu bếp áo trắng khăn đỏ đội mũ đầu bếp (đứng bếp), phụ bếp áo xanh lá mũ lưỡi trai (ở thớt), phục vụ áo đỏ tạp dề đen (chạy tới bàn).
- Khách mỗi người một màu áo, quần, tóc, da khác nhau, nhiều người đội mũ lưỡi trai / nón lá / khăn — mô hình KayKit được tô lại màu theo từng vùng (áo, khăn, quần, tóc, da) bằng texture bảng màu sinh sẵn (`scripts/build-palettes.mjs`). Ảnh texture trong file GLB được bỏ khi nhúng (`scripts/embed-models.mjs`) và thay bằng bảng màu này — Safari iPhone trong khung Artifact không nạp được ảnh qua `blob:` nên trước đây nội thất bị mất màu.
- Nút **📋 Bảng / 🗺️ Bản đồ** trên thanh đồng hồ để chuyển qua lại với bảng điều khiển bấm nút (lựa chọn được ghi nhớ).

### 🎮 Hai chế độ: Đơn giản / 3D (theo góp ý thiết kế "Chợ Nổi Quán")
Nút chuyển nằm giữa HUD, đổi ngay mà giữ nguyên đơn, khách và nồi đang nấu (nhớ lựa chọn cho lần sau).
- **HUD mới**: một dải kem to ở trên (giờ, tiền, ★ / độ sạch, chữ ≥ 16px), chỉ còn ⏸ và ❗; các nút khác xuống **thanh hành động có nhãn** ở đáy: 🛒 Chợ · 🧽 Lau · 📦 Kho (xem tồn kho) · 📋 Bảng · 🧱 Bố trí.
- **3D**: vẫn là cảnh KayKit, camera **isometric khoá 45°**, nút ⟲ xoay theo nấc 90° (xoay ra sau thì tường sau tự hạ thấp) và + / − zoom 2 mức; sàn bếp gạch bông pastel; đèn treo không dây, chóp trong mờ; quầy ra món rút còn 3 ô để có lối đi hai bên; **chip màu cố định** trên mỗi trạm (Bếp 1–2, Quầy pha, Thớt, Kho, Quầy ra món, Rửa · lau, Rác) kèm trạng thái — chạm chip là đi tới trạm; bong bóng gọi món to hơn với **vòng đếm giờ** (xanh dương = món đang nấu), chạm bong bóng là tới bàn đó. Ô "+" (chỗ chưa mua) chỉ hiện ở chế độ **Bố trí**, chạm để mở màn Nâng cấp.
- **Đơn giản**: mặt bằng 2D cố định — khu BẾP và PHÒNG ĂN, mỗi trạm là ô màu nhóm (hồng thịt · xanh trời cá · vàng bơ trứng · bạc hà rau) kèm trạng thái; **chạm là làm luôn**, không cần dẫn nhân vật; phiếu đơn ở trên và nút lớn "🍽️ Ra món bàn N" khi đang cầm đúng món. Máy chậm (FPS < 30 vài giây) hoặc pin < 20% thì game gợi ý chuyển sang Đơn giản (hỏi một lần). Máy không có WebGL thì chỉ có chế độ Đơn giản.

### 🏪 Chợ bên sông (sạp, người bán, trả giá)
Màn chợ là **cảnh 3D chợ trên bờ sông** (mô hình Kenney + KayKit, CC0): 4 sạp mái che sọc màu nhóm, hàng bày trên bàn, ghe xuồng dưới sông, dừa, khách đi chợ qua lại. Chạm sạp (hoặc tên sạp) → chủ quán đi tới và mở **bảng sạp**:
- **4 sạp**: 🥩 Thịt & tôm (Cô Bảy) · 🥚 Trứng & bột (Bà Năm) · 🥬 Rau (Dì Sáu) · 🧋 Tạp hoá đồ uống (Chú Ba); người bán **rao giá** bằng số tiền cụ thể ("Rau chiều bớt 700đ nè con!").
- **Giỏ hàng**: chọn − số lượng + (hoặc +5) rồi **💳 Trả tiền** một lần; **🧾 Mua theo menu** bỏ sẵn đủ đồ cho khoảng một ngày bán; nút − khi giỏ trống là trả lại đồ mua dư hôm nay (hoàn đúng tiền đã trả).
- **Mọi khoản bớt là số tiền (đồng), không dùng phần trăm**: giá gốc gạch ngang, từng dòng "Thân thiết cấp 2: bớt 500đ", "Trả giá: bớt 1.000đ", khuyến mãi trong ngày (một món buổi sáng; **rau và hành buổi chiều** khi đi chợ giữa giờ bán); giá không dưới một nửa giá chợ.
- **🤝 Trả giá**: mỗi sạp 2 lượt mỗi ngày; được thì cả sạp bớt tiền hôm đó, không được thì người bán kém vui một chút.
- **♥ Thân thiết**: mua nhiều ở sạp nào thì người bán thân hơn (cấp 1–5) và bớt sẵn mỗi phần.
- **📦 Kho có sức chứa**: 300 phần, mỗi cấp Tủ lạnh +150 (kèm đồ tươi lâu hơn).
- Dữ liệu người bán (thân thiết, lượt trả giá) nằm trong bản lưu **trên máy người chơi**, không gửi đi đâu.
- Chế độ **Đơn giản**: 4 ô sạp lớn tô màu nhóm, chạm là mở sạp ngay.

### 🛶 Đường sông — biết ngay việc cần làm
Dải sông nhỏ ở màn chợ, trong quán và lúc tổng kết cho thấy tiến trình một ngày: **🛶 Chợ nổi → 🔪 Sơ chế → 🍳 Nấu ăn → 🍽️ Phục vụ → 🌙 Tổng kết**.
- Bến đã làm có **✓**, bến đang làm có ghe 🛶 nhấp nhô và nhãn **ĐANG**. Trong giờ bán, Sơ chế ↺ Nấu ↺ Phục vụ là một vòng: bến "ĐANG" là việc cần nhất lúc đó (chưa thái đồ → sơ chế; khách chờ → nấu; món chín / đang cầm → mang ra bàn).
- Nút **▶ Tiếp tục…** chỉ viền vàng vào chỗ cần bấm, trong quán còn tự đi tới thớt / bếp / quầy ra món / bàn khách; ở chợ thì điền sẵn giỏ theo menu. Chạm một bến để Chú Tư đọc gợi ý.

### 📒 Sổ tay chủ quán — nhiệm vụ, nhật ký, vé thưởng, sao hy vọng
Bấm **📒 Sổ** (chấm đỏ = có thưởng chờ nhận). Sổ giấy kẻ dòng, tab bên phải:
- **📋 Việc hôm nay**: mỗi sáng 3 nhiệm vụ (mua, sơ chế, nấu, phục vụ, bán món đặc biệt, thử công thức mới…), **từ ngày 3 thêm 1 nhiệm vụ KHÓ** (không bàn nào bỏ về, lãi ít nhất X, nhận N đánh giá 5★). Xong thì bấm **🎁 Nhận**: thưởng **💰 tiền + 🎟️ vé thưởng**; việc khó có thêm **⭐ sao hy vọng**. Quên nhận thì sang ngày tự nhận. Mục tiêu co giãn theo số bàn mấy ngày gần đây.
- **🌟 Món đặc biệt hôm nay**: bán món này được **XP ×2**, nhiệm vụ món đặc biệt thưởng ×2.
- **✍️ Nhật ký**: chọn mặt cười, nhãn dán, viết tối đa 300 chữ; có dòng tóm tắt ngày tự sinh; lật xem trang cũ. Trang đầu mỗi ngày +1 🎟️. Chỉ lưu trong máy.
- **👛 Túi**: tiền, 🎟️ vé (sau này mua nội thất), ⭐ sao (sau này quay thưởng) — hai cửa hàng này **sắp mở**.

### 🛒 Đi chợ giữa giờ bán
Hết nguyên liệu giữa ngày? Bấm **🛒** trên màn chơi để chạy ra chợ (thời gian vẫn trôi).
- **Chưa có nhân viên nào đang làm** → quán **treo biển tạm đóng**: không đón khách mới; khách đang ngồi vẫn chờ và có thể bỏ về, món trên bếp vẫn có thể cháy.
- **Có nhân viên** → quán vẫn bán bình thường trong lúc bạn đi chợ.
- Bấm **🏃 Về quán** để quay lại.

### 👀 Bếp của tôi — góc nhìn thứ nhất (bếp + thớt chung một cảnh)
Tới **thớt** hoặc **bếp** là vào màn **Bếp của tôi**: nhìn qua mắt chủ quán (kiểu Kebab Chefs, không vẽ tay) một cảnh 3D duy nhất — **dãy bếp ở phía trên (xa)**, **thớt ở phía dưới (gần)**, không phải chuyển trang:
- **Không cần chọn bếp**: 🔥 Nấu tự đặt vào bếp trống đầu tiên. **Chạm vào nồi / chảo** để khuấy, nồi chín (vòng xanh) thì chạm là lấy ra; sắp cháy có vòng đỏ. **Chạm vào thớt** để thái. Trên máy tính: Space / E thái (khi đang thái) hoặc khuấy nồi gần chín nhất, phím 1–9 khuấy / lấy món ở bếp tương ứng.
- Bảng điều khiển bên dưới: phần cố định (không phải cuộn) gồm **thẻ từng bếp** (món, tiến độ, nút **🍽️ Lấy** riêng khi chín, **Lấy hết** khi có từ 2 món chín) và **nồi tự chọn + 🔥 Nấu**; phần cuộn là **món trong menu** (món khách đang gọi lên đầu, có huy hiệu **×số phần còn cần nấu**) và **nguyên liệu**. Nguyên liệu cần thái mà chưa có phần thái sẵn có dấu 🔪: chạm vào là bắt đầu thái trên thớt; nồi thiếu phần đã thái thì nút Nấu đổi thành **🔪 Thái**.
- **Nồi tự chọn**: chạm nguyên liệu để bỏ vào nồi (tối đa 4, chạm lại để lấy ra), xem trước món sẽ ra (😋 Ngon / 🤔 Lạ / 🧟 Quái dị, có trong menu chưa, thiếu gì) rồi bấm **🔥 Nấu**. Ô món trong menu là nút điền nhanh đủ nguyên liệu. Bỏ 🧅 ra khỏi nồi = món "không hành". Quầy pha chế dùng cùng kiểu nồi.
- **Quầy pha chế** (trà đá, cà phê, gỏi cuốn) vẫn là màn riêng khi đi tới quầy.
- **Thanh phiếu order** dưới tiêu đề (cả ở bếp và quầy): ô 🔥 cho biết còn phải nấu bao nhiêu món mỗi loại (đã trừ món đang nấu, trên quầy ra món và trên tay), tiếp theo là phiếu từng bàn 🪑 / cửa 🚪 / shipper 🛵 với món gọi (🚫 = không hành, ✅ = đã mang), thanh kiên nhẫn; bàn gấp nhất xếp trước và viền đỏ.
- Thớt: chạm ô nguyên liệu có 🔪 rồi **chạm thớt liên tục** để thái nhanh hơn (mỗi nhát rút 0,35 giây). Nguyên liệu vẽ chi tiết: miếng bò bít tết, ba chỉ heo nhiều lớp nạc – mỡ – bì, đùi gà, hành lá gốc trắng có rễ, xà lách, tôm có đốt – đuôi – râu; thái tới đâu nguyên liệu ngắn lại tới đó, đống thịt thái / hành cắt khoanh / tôm bóc vỏ to dần, xong thì vào bát.
- Bếp: bỏ nguyên liệu vào nồi rồi 🔥 Nấu, **chạm để khuấy**; chín rồi còn ít nhất 8 giây mới cháy. Phở, cơm gà nấu trong nồi; bún chả, bánh mì trứng làm trên chảo. Món đổi màu dần từ sống → chín → cháy: thịt bò tái chuyển nâu, chả nướng có vệt cháy, trứng từ trong sang trắng; sắp cháy thì bốc khói đen.
- **Nhấc ra** thì món lên tay (tối đa 2) và **vẫn ở lại bếp** để làm tiếp; bấm **🍽️ Ra phục vụ** (hoặc **⬅ Rời bếp**, phím Esc) để quay ra quán. Space / E để thái – khuấy trên máy tính.
- Món mang ra bàn, đặt trên quầy ra món hay cầm trên tay đều là mô hình chi tiết: bát phở có bánh, thịt, hành; đĩa cơm gà; bún chả; ổ bánh mì; gỏi cuốn thấy tôm bên trong; ly trà đá, cà phê sữa có đá.

Trên điện thoại cảnh quán được phóng to 30% và camera đi theo nhân vật.

### 👨‍🍳 Chú Tư bếp trưởng dẫn đường
Chơi mới là **Chú Tư bếp trưởng** (nhân vật 3D KayKit có hoạt ảnh vẫy tay, giải thích) trượt lên màn hình và dẫn từng bước ngày đầu: mua 🥖🥚🥫🧅 → 🏮 mở cửa → vào 🔪 thớt → thái hành → bỏ 🥪 vào nồi và nấu → lấy món → mang cho khách. Mỗi bước chỉ vào đúng nút cần bấm (viền vàng nhấp nháy + 👆), làm xong tự sang bước sau; có ⏭️ bỏ qua, chạm vào bếp trưởng để thu nhỏ, 🔊 để nghe **giọng nam của Chú Tư** (tốc độ 1,2). Mọi câu cố định (hướng dẫn, tin lên cấp / món mới / trend...) được thu sẵn bằng `scripts/gen-voice.py`: mô hình Piper `vi_VN-vais1000-medium` (sherpa-onnx) rồi đổi sang giọng nam bằng vocoder WORLD (hạ cao độ, dời formant), nhúng MP3 vào game và phát qua Web Audio — nên iPhone (chỉ có giọng Việt nữ) vẫn nghe giọng nam, kể cả khi gạt im lặng. Câu không có sẵn (món tự sáng tạo) dùng giọng máy đọc trầm. Sửa câu thoại thì chạy lại `npx tsx scripts/voice-lines.ts` + `scripts/gen-voice.py` (kiểm thử `check-map` báo câu nào thiếu giọng). Sau đó Chú Tư chỉ xuất hiện khi có tin mới (lên cấp, món mới, trend, mở vị trí nhân viên) hoặc khi bấm ❗ ở bất kỳ màn nào.

### ⭐ Cấp độ & 📖 Sổ món & Menu
- Mỗi món mang cho khách được điểm kinh nghiệm; **lên cấp mở khoá nguyên liệu mới**: cấp 1 🥖🥚🥫🧅🍵🧊 · cấp 2 🍚🍗 · cấp 3 🍜🥩🥬 · cấp 4 🫘🥛 · cấp 5 🍝🥓 · cấp 6 🫓🦐.
- Menu **không có sẵn**: bắt đầu chỉ có 🥪 Bánh mì trứng và 🧋 Trà đá. Vào **📖 Sổ món & Menu** (ở chợ hoặc màn nâng cấp), chọn 2–4 nguyên liệu rồi bấm **🧪 Nấu thử**: **mọi tổ hợp đều ra món**, được ghi vào sổ; bấm **➕ Thêm vào menu** để khách bắt đầu gọi. Chạm món trong sổ để bật / tắt trong menu (menu luôn còn ít nhất 1 món).
  - **😋 Món chuẩn** (15 món: bánh mì trứng / pate / bò / thịt, cơm gà, cơm chiên trứng, cơm tấm, cơm chiên tôm, phở bò, bún chả, gỏi cuốn, trà đá, trà sữa, cà phê sữa đá): khách thích.
  - **🤔 Món lạ** (ví dụ Cơm bò hành, Bún tôm, Sữa đá): tên và giá tự sinh; khách thỉnh thoảng khen (+boa) hoặc chê nhẹ.
  - **🧟 Món quái dị** (trộn đồ uống với đồ ăn, hai loại tinh bột… ví dụ Bò xào trà đá): giá rẻ hơn, hình bát "nhớt" xanh sủi bọt; khách hay **phàn nàn** 🤢 (trả ít tiền, trừ danh tiếng, chê trong đánh giá) — nhưng có khi **quay clip lên mạng** và món thành trend.
  - Thử ra món không chuẩn nhiều lần sẽ lộ gợi ý món chuẩn còn bí ẩn.
- **🔥 Trend**: một món hot trong **3 ngày**, độ hot giảm dần: giá **+20%**, danh tiếng từ món đó **+20%**, lượng khách **+150%**, khách gọi món đó nhiều hơn hẳn. Nguồn: món lạ / quái dị gây sốt, sự kiện **📱 Food reviewer đăng clip**, món mới ra mắt (30%). Dải 🔥 Trend hiện ở chợ và HUD quán, huy hiệu 🔥 trên ô món và phiếu order.
- **🆕 Món mới** thêm vào menu được khách gọi **gấp 3** trong ngày bán đầu tiên.

### ⏳ Khách chờ
- Khách thường chờ được khoảng 2,5 phút (điều hoà, ngày làm quen cho chờ lâu hơn); mỗi món gọi thêm cộng 15 giây.
- Món của khách **đang nấu hoặc đã xong** (trên bếp, quầy ra món, trên tay) thì khách chờ **thong thả gấp đôi**: thanh kiên nhẫn chuyển xanh dương kèm ⏳ trên bong bóng và phiếu order.
- Mỗi món mang ra bàn **hồi 15% kiên nhẫn**.
- Đang cầm món thì bàn chờ đúng món đó sáng xanh dưới sàn, bong bóng to viền xanh kèm 👇.

### 🐣 3 ngày làm quen
Ngày 1 chỉ khoảng 1/3 lượng khách, ngày 2 một nửa, ngày 3 khoảng 3/4; khách đi một mình, gọi 1 món, kiên nhẫn hơn; ngày 1–2 không có sự cố, ngày 3 rất ít; tiền mặt bằng giảm theo. Từ ngày 4 quán đông bình thường.

### 💬 Khách trò chuyện
Khách ngồi bàn thỉnh thoảng nói chuyện đời sống (thời tiết, gia đình, công việc, trường học, bóng đá, kẹt xe, giá chợ, lễ Tết, thú cưng…) trong bong bóng trên đầu; khách bàn bên đôi khi đáp lời. Thỉnh thoảng khách **hỏi chủ quán** (bong bóng ❓ vàng): chạm vào ❓ (hoặc tới bàn) để chọn câu trả lời bằng hình — trả lời khéo thì khách chờ lâu hơn và boa thêm, trả lời phũ thì khách kém vui. Đang trong bếp thì nút ra quán có huy hiệu 💬❓.

### 🛒 Mua dư thì bớt
Ở chợ mỗi thẻ nguyên liệu có nút **−** để bớt phần vừa mua hôm nay (trả lại đúng giá đã mua); đồ mua từ hôm trước thì không trả được.

### 🧒 Dễ chơi cho bé (ít chữ, nhiều hình)
Luồng chơi giữ nguyên (chợ → mở cửa → thái → nấu → mang món → tổng kết) nhưng giao diện dùng **ô hình to**: nguyên liệu ở chợ là thẻ có 📦 số trong kho và nút **+1 / +5**; món nấu là ô hình món, thiếu gì thì hiện hình nhỏ của thứ thiếu; thanh chỉ số bằng biểu tượng (📅 💰 💳 ⭐ 🧽); tổng kết chỉ còn ⭐, 💰 lãi/lỗ, 😊/😡 và nút ☀️ Ngày mới (bấm 📊 để xem chi tiết).
- Nút **❗** tròn màu cam ở mỗi màn mở **hướng dẫn bằng hình** (mỗi bước một hình to + một câu ngắn, có **🔊 Đọc** để máy đọc to trên trình duyệt, **➕ Thêm** cho phần dành cho người lớn). Hướng dẫn chỉ tự mở **một lần** cho mỗi màn (nhớ cả khi tải lại trang), sau đó chỉ mở khi bấm ❗.

### 🏠 Màn đầu
Nền là **chợ bên sông 3D đang sống** (camera đung đưa, Chú Tư và chủ quán vẫy chào, khách đi chợ; máy không có WebGL thì dùng nền 2D có ghe trôi, đèn lồng lắc lư). Bên dưới là thẻ **▶ Chơi tiếp** (tên quán · ngày · tiền) và 4 ô:
- **🆕 Chơi mới** — setup quán cơ bản: ① **tên quán + tên chủ** (nút 🎲 gợi ý), ② **món đặc trưng khởi đầu**: 🥪 Bánh mì trứng (dễ nhất) · 🍳 Cơm chiên trứng (mở sẵn gạo) · 🍛 Cơm gà (mở sẵn gạo, gà; lãi cao). Hướng dẫn ngày đầu, nhiệm vụ và món đặc biệt ngày 1 đổi theo món đã chọn. Đã có quán thì hỏi lại, có nút **📤 Sao lưu trước**.
- **🧑‍🍳 Nhân vật** — chỉnh ngoại hình (lưu riêng, dùng cho mọi quán mới; cập nhật luôn quán đang chơi).
- **📖 Hướng dẫn** — vòng một ngày (5 bến đường sông) + các thẻ chủ đề bằng hình, có 🔊 đọc.
- **⚙️ Cài đặt** — 🔊 giọng Chú Tư bật / tắt, âm lượng; 🎮 3D / Đơn giản, chất lượng (tiết kiệm pin / đẹp); 💾 **sao lưu tiến độ**: tải file hoặc 📋 sao chép mã, 📥 nhập lại từ file / mã dán (có mã kiểm tra, xem trước rồi mới ghi đè). Mọi thứ chỉ nằm trên máy.

### 🧑‍🍳 Tạo nhân vật
Ô **🧑‍🍳 Nhân vật** ở màn đầu (xem trước 3D xoay tròn): giới tính, kiểu tóc (ngắn, dựng, dài, búi, trọc), màu tóc, màu da, màu áo / tạp dề (khăn – viền áo) / quần — **tô được lên cả 4 nhân vật KayKit**, mũ (mũ đầu bếp, lưỡi trai, nón lá, khăn trùm) và kính; có nút 🎲 Ngẫu nhiên. Trong game, ô **🧑‍🍳 Chủ quán** ở màn chợ sửa được cả tên.

### Nhân viên (có tỉ lệ làm sai)
- **Mở dần theo cấp**: 🔪 **phụ bếp** từ cấp 3 (tự sơ chế), 👨‍🍳 **đầu bếp** từ cấp 4 (tự nấu), 🍽️ **phục vụ** từ cấp 5 (tự mang món, lau dọn, chặn khách bùng tiền). Vị trí chưa mở hiện 🔒 ⭐N.
- **🎓 Sinh viên làm thêm**: mỗi ngày mỗi vị trí có 1 ứng viên sinh viên, lương khoảng 45%, tay nghề thấp, sai gấp 1,8 lần; đội mũ lưỡi trai xanh trên cảnh 3D.
- **Sự cố của phục vụ** (có hoạt ảnh): **vấp té** — ngã sấp, đĩa bay vòng cung rồi vỡ, mảnh văng và vệt thức ăn trên sàn, chữ 💥; **đổ thức ăn lên khách** — thức ăn bắn lên người khách, vết bẩn trên áo, khách 😡💦 mất kiên nhẫn, trừ danh tiếng; **mang nhầm bàn** — khách 🤨. Tổng kết ngày đếm số lần vấp / đổ và số lời phàn nàn.
- Tỉ lệ sai = gốc theo vị trí × (1 − 0.9 × tay nghề) × tâm trạng × giờ cao điểm × tính cách.
- Lỗi có thể xảy ra: nấu nhầm món, để cháy, quên ghi chú "không hành", mang nhầm bàn, sơ chế làm hỏng nguyên liệu.
- Tính cách: Nhanh nhưng ẩu, Chậm mà chắc, Hay đi trễ, Khéo miệng (+tip), Lười.
- Lương thấp hơn mặt bằng → tâm trạng giảm → sai nhiều hơn → có thể nghỉ việc. Tay nghề tăng dần theo kinh nghiệm.

### Tình huống ngẫu nhiên
- **Khách:** khó tính, dị ứng hành, food reviewer ẩn danh (ảnh hưởng danh tiếng ×3), khách quen (tip ×2), shipper (trừ 20% phí sàn), khách bùng tiền, nhóm 1–3 người, đơn công ty 6 phần.
- **Buổi sáng:** giá thịt tăng vọt, ngày lễ (khách ×1.8), mưa bão (nhiều đơn giao), quán đối thủ khai trương, nhà cung cấp giao thiếu, nhân viên ốm, lên báo địa phương.
- **Trong ngày:** cúp điện, hết gas, thanh tra vệ sinh (phạt nếu bẩn/có đồ hết hạn), chuột trong kho, nhân viên cãi khách / đòi tăng lương / ăn vụng, em bé làm vỡ bát, có tóc trong đồ ăn.

Mỗi tình huống có nhiều lựa chọn với hậu quả khác nhau (tiền, danh tiếng, tâm trạng nhân viên).

## 👫 Chơi online co-op
Đang ở giai đoạn kế hoạch — xem [`docs/COOP_PLAN.md`](docs/COOP_PLAN.md).

## Cấu trúc mã

```
src/game/          Logic thuần (không phụ thuộc React) — dễ kiểm thử
  data.ts          Nguyên liệu, công thức, nâng cấp, hằng số cân bằng
  engine.ts        Vòng lặp tick, hành động người chơi, AI nhân viên, đóng/mở ngày
  customers.ts     Sinh khách, phục vụ, thanh toán, đánh giá
  events.ts        Các tình huống ngẫu nhiên và lựa chọn
  market.ts        Chợ: sạp, người bán, giá bớt bằng số tiền, trả giá, thân thiết, giỏ hàng, sức chứa kho
  missions.ts      Sổ tay: nhiệm vụ hằng ngày, món đặc biệt, thưởng (tiền / vé / sao), nhật ký
  dayflow.ts       Đường sông: bước đang làm trong ngày + việc tiếp theo
  dishes.ts        Tổ hợp nguyên liệu → món (chuẩn / lạ / quái dị), tên, giá, hình
  trend.ts         Trend: độ hot giảm dần, hệ số giá / khách / danh tiếng
  progression.ts   Cấp độ, mở khoá nguyên liệu / vị trí nhân viên, thử món, menu
  layout.ts        Bố cục bản đồ quán + tìm đường (BFS) cho chế độ góc nhìn nhân vật
  staffTarget.ts   Nhân viên đứng ở đâu trên bản đồ theo việc đang làm
  storage.ts       Lưu/tải bằng AsyncStorage (tự lưu ngoài giờ mở cửa)
  migrate.ts       Nâng cấp bản lưu cũ + xuất / nhập mã sao lưu
  settings.ts      Cài đặt (giọng, âm lượng, chất lượng) + ngoại hình lưu riêng
  GameContext.tsx  Kết nối engine với React (đồng hồ 200ms, tự lưu)
src/screens/       Home, NewGame, Settings, Guide, Game (Chợ / Mở cửa / Tổng kết), Nhân vật, Nhân viên, Nâng cấp
src/components/    CustomerCard, CookSlotCard, EventModal, Hud, ShopTopBar, ui
  map/             Bản đồ 2D dự phòng + bảng hành động
  scene/           Cảnh 3D: camera, nhân vật low-poly, đồ vật, lớp chữ nổi, HUD
scripts/simulate.ts  Bot chơi thử 30 ngày để cân bằng số liệu
scripts/check-map.ts Kiểm tra bản đồ và việc cầm/đưa món
```

Màn hình rộng (≥ 900px, máy tính) hiển thị 3 cột; màn hình hẹp (điện thoại) chia tab.

## Ghi công mô hình 3D
Nhân vật và đồ vật nhà hàng dùng mô hình **KayKit** của Kay Lousberg (Character Pack: Adventurers, Restaurant Bits, Furniture Bits) — giấy phép **CC0**. Xem `assets/models/LICENSE.md`; tạo lại bằng `scripts/build-models.mjs` và `scripts/embed-models.mjs`.
