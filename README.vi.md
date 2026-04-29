## Đóng góp / Donation

Nếu bạn thấy dự án hữu ích và muốn ủng hộ tác giả duy trì/hoàn thiện dự án, bạn có thể donation theo thông tin dưới đây:

- **MoMo:** `0799640848`
- **VietinBank:** `0799640848` — **Đoàn Thanh Lực**

Xin cảm ơn bạn đã ủng hộ! 🙏

---

# Lazie Steam Project

Dự án gồm 2 phần:
- **server**: backend API
- **client**: frontend

Tài liệu này hướng dẫn cài đặt/chạy dự án cho **người mới**.

---

## Yêu cầu hệ thống

- **Node.js 20.x (khuyến nghị 20.xx)**
- npm (đi kèm khi cài Node.js)

> Nếu máy bạn đang dùng Node phiên bản khác, nên cài đúng **Node 20.x** để tránh lỗi phụ thuộc.

---

## 1) Cài Node.js 20.x

1. Vào trang chủ Node.js để tải bản **Node.js 20.x (LTS)**:
   - https://nodejs.org/
2. Chọn bản phù hợp hệ điều hành (Windows/macOS/Linux) và cài đặt như bình thường.
3. Kiểm tra đã cài thành công:

```bash
node -v
npm -v
```

Kết quả `node -v` nên hiển thị dạng `v20.xx.x`.

---

## 2) Cài đặt & chạy Server (Backend)

Mở Terminal (hoặc PowerShell/CMD) tại thư mục dự án, chạy:

```bash
cd server
npm i
npm run start
```

- `npm i`: cài thư viện phụ thuộc
- `npm run start`: khởi chạy server

> Nếu server có file `.env`, hãy đảm bảo bạn đã cấu hình theo hướng dẫn của dự án (nếu có).

---

## 3) Cài đặt & chạy Client (Frontend)

Mở **một Terminal mới** (hoặc dừng server nếu bạn muốn chạy lần lượt), rồi chạy:

```bash
cd ../client
npm i
npm start
```

- `npm i`: cài thư viện phụ thuộc cho client  
- `npm start`: chạy ứng dụng client ở chế độ phát triển (development)

---

## 4) Cách chạy đúng (khuyến nghị)

Bạn nên chạy **song song**:
- Terminal 1: chạy **server**
- Terminal 2: chạy **client**

Như vậy client có thể gọi API từ server trong quá trình phát triển.

---

## Xử lý lỗi thường gặp

### 1) Sai phiên bản Node
Nếu gặp lỗi liên quan đến cú pháp / dependency, hãy kiểm tra lại Node:

```bash
node -v
```

Khuyến nghị dùng **Node 20.x**.

### 2) Cài phụ thuộc lỗi / bị cache
Thử xóa `node_modules` và cài lại:

```bash
# trong từng thư mục server hoặc client
rm -rf node_modules package-lock.json
npm i
```

Trên Windows PowerShell:

```powershell
Remove-Item -Recurse -Force node_modules
Remove-Item package-lock.json
npm i
```

---


## License

Xem file `LICENSE` để biết thông tin giấy phép sử dụng.
