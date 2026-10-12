# Hướng dẫn lấy và cấu hình biến môi trường

Tài liệu này dành cho Mori mobile (Expo), API (NestJS) và các tính năng Mori Live tùy chọn. Để chạy ứng dụng với backend thật, bạn cần Supabase; AI thật là tùy chọn. Không gửi giá trị secret qua chat, ảnh chụp màn hình, issue hoặc commit Git.

## 1. Chọn chế độ cần chạy

| Mục tiêu                                | Cần cấu hình                                                       |
| --------------------------------------- | ------------------------------------------------------------------ |
| Chỉ xem demo                            | `apps/mobile/.env`; không cần tài khoản dịch vụ                    |
| Mobile + dữ liệu/Auth thật + AI giả lập | Supabase, API `MOCK_AI=true`, mobile connected mode                |
| Mobile + dữ liệu/Auth thật + AI thật    | Supabase, API `MOCK_AI=false`, nhà cung cấp LLM tương thích OpenAI |
| Build EAS preview/production            | Ba giá trị public của mobile trong EAS                             |
| Mori Live/TTS                           | Biến `MORI_LIVE_*`; Azure Speech chỉ khi cần giọng thật            |

## 2. Tạo hai file cấu hình local

Chạy tại thư mục gốc của repository bằng PowerShell:

```powershell
Copy-Item apps/api/.env.example apps/api/.env
Copy-Item apps/mobile/.env.example apps/mobile/.env
```

Hai file `.env` đã bị Git bỏ qua. Chỉ commit các file `.env.example` chứa placeholder.

## 3. Lấy thông tin Supabase

1. Tạo hoặc mở project tại [Supabase Dashboard](https://supabase.com/dashboard).
2. Mở nút **Connect** để lấy Project URL và publishable key. Muốn xem đầy đủ key, mở **Project Settings → API Keys**.
3. Nếu project chưa có key mới, tạo một **publishable key** và một **secret key**.
4. Ánh xạ các giá trị như sau:

| Giá trị Supabase                     | `apps/api/.env`             | `apps/mobile/.env`              | Có bí mật?               |
| ------------------------------------ | --------------------------- | ------------------------------- | ------------------------ |
| Project URL                          | `SUPABASE_URL`              | `EXPO_PUBLIC_SUPABASE_URL`      | Không                    |
| Publishable key `sb_publishable_...` | `SUPABASE_ANON_KEY`         | `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Không, nhưng vẫn cần RLS |
| Secret key `sb_secret_...`           | `SUPABASE_SERVICE_ROLE_KEY` | Không bao giờ đặt ở mobile      | Có, quyền cao            |

Tên `*_ANON_KEY` và `*_SERVICE_ROLE_KEY` trong code được giữ để tương thích cấu hình cũ; chúng có thể nhận publishable/secret key mới tương ứng. Nếu project chỉ có legacy key, `anon` đi vào biến public và `service_role` chỉ đi vào API server.

Secret/service-role key bỏ qua Row Level Security. Nếu key này từng xuất hiện trong Git, log, ảnh hoặc tin nhắn, hãy tạo key mới, cập nhật server rồi thu hồi key cũ.

Sau khi tạo Supabase, áp dụng migrations trong `supabase/migrations` theo thứ tự tên. Với Supabase local có thể dùng `supabase db reset`, nhưng không chạy lệnh reset trên project có dữ liệu thật.

## 4. Cấu hình API

### Phương án A — dùng AI giả lập

Trong `apps/api/.env`:

```dotenv
NODE_ENV=development
PORT=3001
CORS_ORIGIN=http://localhost:8081
MOCK_AI=true
SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
SUPABASE_ANON_KEY=sb_publishable_REPLACE_ME
SUPABASE_SERVICE_ROLE_KEY=sb_secret_REPLACE_ME
```

Các biến `LLM_*` có thể giữ nguyên placeholder vì không được sử dụng khi `MOCK_AI=true`.

### Phương án B — dùng AI thật

Adapter hiện tại yêu cầu nhà cung cấp có hai endpoint tương thích OpenAI:

- `POST {LLM_BASE_URL}/chat/completions`
- `POST {LLM_BASE_URL}/embeddings`

Ví dụ với OpenAI:

1. Tạo API key trong [OpenAI Platform](https://platform.openai.com/api-keys). API key là secret và chỉ được đặt ở API server.
2. Đặt `LLM_BASE_URL=https://api.openai.com/v1`.
3. Chọn một model mà tài khoản có quyền dùng và hỗ trợ Chat Completions cho `LLM_MODEL`.
4. Đặt `LLM_EMBEDDING_MODEL=text-embedding-3-small`. Dự án gửi `dimensions: 1536` và từ chối vector không đủ đúng 1536 phần tử.

```dotenv
MOCK_AI=false
LLM_BASE_URL=https://api.openai.com/v1
LLM_API_KEY=REPLACE_WITH_SERVER_SIDE_KEY
LLM_MODEL=REPLACE_WITH_AN_AVAILABLE_CHAT_MODEL
LLM_EMBEDDING_MODEL=text-embedding-3-small
LLM_TEXT_TIMEOUT_MS=30000
LLM_CLASSIFICATION_TIMEOUT_MS=10000
LLM_EMBEDDING_TIMEOUT_MS=10000
```

Không đổi embedding model khi database đã có vector cũ nếu chưa có kế hoạch re-embed. `NODE_ENV=production` bắt buộc `MOCK_AI=false`.

## 5. Cấu hình mobile

### Demo local

```dotenv
EXPO_PUBLIC_DEMO_MODE=true
EXPO_PUBLIC_API_URL=http://localhost:3001
```

### Kết nối backend thật

```dotenv
EXPO_PUBLIC_DEMO_MODE=false
EXPO_PUBLIC_API_URL=http://localhost:3001
EXPO_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_REPLACE_ME
```

Chọn `EXPO_PUBLIC_API_URL` theo nơi app chạy:

| Thiết bị                             | URL API local thường dùng         |
| ------------------------------------ | --------------------------------- |
| Web hoặc iOS Simulator trên cùng máy | `http://localhost:3001`           |
| Android Emulator                     | `http://10.0.2.2:3001`            |
| Điện thoại thật cùng Wi-Fi           | `http://IP_LAN_CUA_MAY_TINH:3001` |
| Preview/production                   | URL HTTPS của API đã deploy       |

`EXPO_PUBLIC_*` được đóng gói vào ứng dụng và người dùng có thể đọc được. Chỉ đặt Project URL và publishable/anon key ở đây. Không đặt `LLM_API_KEY`, Supabase secret/service-role key, database password hoặc token quản trị vào mobile.

Sau khi sửa `.env`, dừng và khởi động lại Metro để giá trị mới được nạp.

## 6. Chạy và kiểm tra local

Mở hai terminal tại thư mục gốc:

```powershell
npm run dev:api
```

```powershell
npm run dev:mobile
```

Nếu app chạy trên điện thoại thật nhưng không gọi được API:

1. Kiểm tra điện thoại và máy tính cùng mạng.
2. Dùng IP LAN, không dùng `localhost`.
3. Cho phép cổng `3001` qua firewall chỉ trên mạng phát triển tin cậy.
4. Kiểm tra `CORS_ORIGIN`; web cần origin thực tế, native không nên được xử lý bằng cách đưa `*` vào production.
5. Khởi động lại Metro sau khi đổi biến.

Các kiểm tra không in giá trị secret:

```powershell
npm run typecheck
npm run lint
npm run build:api
```

## 7. EAS preview và production

Trong Expo project, vào **Project settings → Environment variables**, chọn đúng môi trường `preview` hoặc `production`, rồi thêm:

```text
EXPO_PUBLIC_DEMO_MODE=false
EXPO_PUBLIC_API_URL=https://api.example.com
EXPO_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_...
```

Có thể dùng EAS CLI, ví dụ:

```powershell
npx eas-cli env:set --name EXPO_PUBLIC_DEMO_MODE --value false --environment preview --visibility plaintext
```

Các profile `preview` và `production` trong dự án sẽ từ chối build nếu demo chưa tắt, URL không phải HTTPS remote hoặc thiếu publishable key. Không thêm secret server vào EAS mobile chỉ vì EAS hỗ trợ visibility `secret`; secret đã đóng vào app vẫn có thể bị trích xuất từ artifact/runtime.

## 8. Biến staging và test tích hợp

Các biến này không phải cấu hình runtime của mobile; chúng chỉ phục vụ preflight/test staging:

| Biến                                    | Lấy từ đâu                                   |
| --------------------------------------- | -------------------------------------------- |
| `STAGING_TARGET`                        | Tự đặt `development` hoặc `staging`          |
| `STAGING_API_URL`                       | URL HTTPS của API staging đã deploy          |
| `SUPABASE_INTEGRATION_URL`              | Project URL của Supabase staging             |
| `SUPABASE_INTEGRATION_ANON_KEY`         | Publishable/anon key staging                 |
| `SUPABASE_INTEGRATION_SERVICE_ROLE_KEY` | Secret/service-role key staging              |
| `RUN_SUPABASE_INTEGRATION_TESTS`        | Tự đặt `true` khi chủ động chạy test         |
| `RUN_PROVIDER_SAFETY_EVALS`             | Tự đặt `true` khi chủ động gọi provider thật |

Đặt thêm cùng bộ `LLM_*` và `EXPO_PUBLIC_*`, sau đó chạy:

```powershell
npm run preflight:staging
```

Preflight chỉ kiểm tra sự hiện diện, URL và việc key private có bị đặt nhầm vào biến public hay không; nó không in secret và không gọi mạng. Chỉ chạy test tích hợp trên development/staging, không chạy trên production.

## 9. Mori Live và các phần tùy chọn

### Token nội bộ Mori Live

`scripts/start-mori-live.ps1` tự tạo `MORI_LIVE_API_TOKEN` và yêu cầu nhập `MORI_LIVE_OPERATOR_TOKEN` an toàn nếu bạn chưa đặt. Hai token phải khác nhau và dài 32–256 ký tự chữ/số/`_`/`-`. Không cần mua hoặc lấy token này từ dịch vụ bên ngoài.

### Azure Speech

Chỉ cần khi chạy `-Voice azure`. Tạo Speech resource trong Azure, mở resource và lấy **Key** cùng **Region**, rồi đặt trong phiên PowerShell hiện tại:

```powershell
$ttsKey = Read-Host 'Azure Speech key' -AsSecureString
$env:MORI_TTS_KEY = [System.Net.NetworkCredential]::new('', $ttsKey).Password
$env:MORI_TTS_REGION = Read-Host 'Azure Speech region (vi du: southeastasia)'
$env:MORI_TTS_VOICE = 'vi-VN-HoaiMyNeural'
```

Nếu không có Azure key, dùng `./scripts/start-mori-live.ps1 -Voice mock`.

### YouTube OAuth

Module YouTube hiện nhận `client_id` và `client_secret` qua code khởi tạo, chưa đọc chúng từ biến môi trường. Nếu tích hợp module này:

1. Tạo Google Cloud project và bật **YouTube Data API v3**.
2. Cấu hình OAuth consent screen.
3. Tạo OAuth client loại **Web application**, cấu hình localhost callback mà module mở, rồi lấy Client ID/Client Secret.
4. Không commit `client_secret.json` hoặc refresh token.
5. `MORI_YOUTUBE_TOKEN_FILE` chỉ đổi nơi lưu token OAuth; mặc định là `~/.mori-youtube-token.json`.

Không dùng service account cho luồng YouTube Live thông thường.

### Live2D

`MORI_LIVE2D_ROOT` là đường dẫn local tới SDK/model private, không phải key. `MORI_LIVE2D_ENABLED=1` bật config plugin khi build native. Xem `docs/LIVE2D_PROTOTYPE.md` trước khi bật.

## 10. Checklist chống lộ secret

- Chỉ mobile nhận publishable/anon key; API server giữ secret/service-role và LLM key.
- Không commit `.env`, token OAuth, `client_secret.json` hoặc file credential.
- Không chụp màn hình trang key; không dán secret vào issue, log hoặc chat.
- Dùng project Supabase và key riêng cho development, staging, production.
- Nếu nghi ngờ lộ key, thay key ở mọi runtime, xác minh hệ thống rồi thu hồi key cũ.
- Trước khi commit, chạy `git status --short` và kiểm tra không có file credential ngoài ý muốn.

## Nguồn chính thức

- [Supabase API keys](https://supabase.com/docs/guides/getting-started/api-keys)
- [Expo EAS environment variables](https://docs.expo.dev/eas/environment-variables/manage/)
- [OpenAI Chat Completions API](https://platform.openai.com/docs/api-reference/chat/create)
- [OpenAI API keys](https://platform.openai.com/api-keys)
- [Azure Speech text-to-speech quickstart](https://learn.microsoft.com/azure/ai-services/speech-service/get-started-text-to-speech)
- [YouTube OAuth for server-side apps](https://developers.google.com/youtube/v3/guides/auth/server-side-web-apps)
