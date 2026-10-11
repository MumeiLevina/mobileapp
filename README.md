# Mori

Mori Live: [architecture and audit](docs/MORI_LIVE_ARCHITECTURE.md),
[Windows mock setup](docs/MORI_LIVE_SETUP.md),
[milestone status and test evidence](docs/MORI_LIVE_STATUS.md).
Start the verified Milestone A transport demo with `npm run live:smoke`.

Ứng dụng AI emotional companion + self-care, ưu tiên tiếng Việt. Expo React Native + NestJS + Supabase PostgreSQL/pgvector. Mori không phải bác sĩ hay nhà trị liệu, không chẩn đoán và không tối ưu thời gian người dùng ở trong ứng dụng.

## Chạy ngay bản demo

Yêu cầu Node.js 22.13+ (đã kiểm tra với Node 24) và npm.

```sh
npm ci
npm run dev:web
```

Để chạy mobile: `npm run dev:mobile`, mở bằng development build phù hợp Expo SDK 57. Bản demo mặc định không cần khóa API, có nhãn **Bản trải nghiệm · AI giả lập**, lưu dữ liệu thử trên thiết bị/trình duyệt. Không nhập dữ liệu nhạy cảm thật vào demo.

Để xem bản web đã build:

```sh
npm run export:web
npm run preview:web
```

Mở http://localhost:8081. Có thể nạp nhật ký, lịch sử cảm xúc, ký ức mẫu trong **Của bạn → Nạp dữ liệu mẫu**. Tài khoản mới bắt đầu bằng khu vườn trống; không giả mạo lịch sử cá nhân. Ba trạng thái vườn mẫu nằm trong `services/demo.ts`.

Cấu hình native nằm trong `apps/mobile/eas.json`: `development` cho development client nội bộ, `preview` cho closed beta và `production` cho artifact store-ready. Các profile không tự publish. Xem [chiến lược environment](docs/ENVIRONMENTS.md) và [checklist QA thiết bị](docs/NATIVE_QA.md) trước khi tạo build beta.

## Chế độ backend thật

1. Tạo Supabase project, hoặc chạy Supabase CLI với Docker bằng `supabase start` trong thư mục dự án.
2. Áp dụng tất cả file trong `supabase/migrations` theo thứ tự tên rồi chạy `supabase/seed.sql`. Với local CLI dùng `supabase db reset` **chỉ trên cơ sở dữ liệu local có thể xóa**. Với hosted project, dùng migration workflow của Supabase hoặc SQL Editor. Không chạy reset trên dữ liệu thật.
3. Sao chép `apps/api/.env.example` thành `apps/api/.env`; cấu hình URL, anon key, service-role key của Supabase.
4. Sao chép `apps/mobile/.env.example` thành `apps/mobile/.env`; đặt `EXPO_PUBLIC_DEMO_MODE=false`, URL API và Supabase anon key. Trên điện thoại thật, URL API phải là IP LAN/HTTPS truy cập được, không phải `localhost` của máy tính.
5. Chạy `npm run dev:api` và `npm run dev:mobile` ở hai terminal. Khởi động lại Metro sau khi thay biến môi trường.
6. Đăng ký/đăng nhập bằng email và mật khẩu. Hosted Supabase có thể yêu cầu xác nhận email. Trigger tạo profile, garden và notification preferences. Mọi request cần JWT hợp lệ; không có development auth bypass.

Kiểm thử tích hợp với Supabase development/staging là opt-in để CI mặc định không cần secrets:

```sh
RUN_SUPABASE_INTEGRATION_TESTS=true \
SUPABASE_INTEGRATION_URL=... \
SUPABASE_INTEGRATION_ANON_KEY=... \
SUPABASE_INTEGRATION_SERVICE_ROLE_KEY=... \
npm run test:supabase
```

Test tạo hai tài khoản tạm thời và xóa chúng sau khi kiểm tra. Chỉ chạy với project development/staging có thể tạo dữ liệu thử; không dùng production.

`MOCK_AI=true` chỉ giả lập AI phía server; dữ liệu và Auth vẫn thật. Đặt `MOCK_AI=false` và cấu hình `LLM_BASE_URL`, `LLM_API_KEY`, `LLM_MODEL`, `LLM_EMBEDDING_MODEL` để dùng adapter HTTP tương thích chat-completions/embeddings. Embedding phải hỗ trợ **1536 chiều**. Không đổi model embedding mà giữ nguyên vector cũ: cần re-embed các ký ức đã duyệt. Chế độ production từ chối mock AI.

Timeout của provider được cấu hình riêng qua `LLM_TEXT_TIMEOUT_MS`, `LLM_CLASSIFICATION_TIMEOUT_MS` và `LLM_EMBEDDING_TIMEOUT_MS`; giá trị mặc định nằm trong `apps/api/.env.example`.

Khóa service-role và AI chỉ nằm trong API server. Mobile chỉ có anon key. Trung tâm dữ liệu cho phép xuất gói JSON đã lọc trường nội bộ; web tải tệp trực tiếp và native mở bảng chia sẻ hệ thống. Luồng đồng bộ hiện dành cho tài khoản quy mô MVP.

## Các luồng đã có

- Wave 1: Ask Mori với nguồn dữ liệu đã lưu, Life Map do người dùng duyệt, Memory provenance, Reflection Timeline và Life Patterns có ngưỡng bằng chứng.
- Guided Journals: thư viện curated, bản nháp riêng trên thiết bị, review trước khi lưu thành Journal thông thường.
- Morning Ritual và Evening Ritual tùy chọn, không streak; lời nhắc sáng/tối độc lập và mặc định tắt.
- Mori Moments sau mood check-in: người dùng tự chọn nói, viết, Phòng yên, thở, rời màn hình hoặc liên hệ người tin tưởng.
- Quiet Room: năm khung cảnh metadata, ngồi yên/thở/viết và timer tùy chọn; không gọi AI hay lưu lịch sử sử dụng.
- Mori First Aid: grounding curated, breathing, Talk, Quiet Room, kết nối con người và crisis UI dùng lại `CrisisResponseService`.
- Home là Daily Experience hub với Garden, mood, một CTA Talk, ba hành động tức thời, một ritual theo giờ địa phương và First Aid.
- Wave 3 Personal World: Ý định nhỏ có ba trạng thái `active/completed/archived`, tối đa năm điều đang giữ và không có deadline, streak hay trạng thái thất bại.
- Garden 2.0 là sanctuary 2D có các khu mở theo sự kiện rõ ràng: trang viết, ký ức đã duyệt, thư, Nhà yên, bài thở, nhìn lại tuần và Ý định nhỏ. Không có decay, cây chết hay phạt khi vắng mặt.
- Thư gửi chính mình nằm trong kho riêng, chỉ mở từ ngày người dùng chọn và không tự đi vào ngữ cảnh AI. Trò chuyện riêng tư chỉ tồn tại trong phiên cho đến khi người dùng chủ động chọn Lưu.
- “Những dấu mốc nhỏ” ghi nhận một lần cho mỗi khoảnh khắc mở khu, không có badge, XP, bảng xếp hạng hay trang thành tích. Export schema v6 bao gồm Letters, Soft Goals, Garden Unlocks và Personal Milestones.

- Welcome/onboarding: mục tiêu, phong cách Mori, giới hạn AI, quyền riêng tư, lời nhắc mặc định tắt và check-in đầu tiên.
- Bốn tab: Khu vườn, Tâm sự, Nhật ký, Của bạn. Theme sáng/tối/theo thiết bị; catalog tiếng Việt/Anh; chữ hỗ trợ dấu tiếng Việt.
- Mood sheet: 5 cảm xúc, cường độ, tags, ghi chú, bỏ qua chi tiết, chọn tâm sự hoặc ngồi yên.
- Trò chuyện: ba chế độ, lịch sử, bản nháp, retry, phản hồi khẩn cấp riêng, ký ức chờ duyệt, xóa cuộc trò chuyện, bản nháp nhật ký cần xác nhận.
- Nhật ký: tìm kiếm, lịch tháng, tạo/sửa/xóa, bản nháp trên thiết bị. Nội dung người dùng không bị dịch tự động.
- Ký ức: nhóm theo loại, thêm/sửa/duyệt/xóa/xóa hết; retrieval chỉ dùng approved + active + đúng chủ sở hữu.
- 10 hoạt động curated, bắt đầu/tạm dừng/hoàn thành, nhịp thở có reduced motion, garden growth không phạt cảm xúc buồn hoặc bỏ ngày.
- Weekly reflection opt-in, lời nhắc local trên native sau khi cấp quyền.
- Trung tâm dữ liệu: xuất JSON, quản lý/xóa toàn bộ ký ức, nhật ký hoặc cuộc trò chuyện, và xóa tài khoản sau bước xác nhận riêng.

## Kiểm tra

```sh
npm run typecheck
npm run lint
npm test
npm run test:mobile
npm run test:database
npm run build:api
npm run export:web
npm run export:native
npm exec -- playwright install chromium
npm run test:e2e
```

### Engineering safety eval

```sh
npm run eval:safety
```

Lệnh này chạy bộ eval offline, tất định trong `tests/evals` và báo cáo tổng số case, số pass/fail, false positive, false negative và critical false negative. Các nhóm hiện có gồm normal, distress, self-harm gián tiếp/rõ ràng, imminent crisis, violence, diagnosis, medication, dependency, romantic attachment, prompt injection, memory grounding và advice permission bằng tiếng Việt/Anh.

Đây là **engineering safety eval**, không phải clinical validation và không đo chất lượng của model thật khi chưa cấu hình provider. False negative trong nhóm self-harm/crisis được đánh dấu mức nghiêm trọng cao nhất. Trước khi phát hành vẫn cần chạy đánh giá với model production trên staging, red-team song ngữ và clinical/editorial review độc lập.

Với staging đã cấu hình, dùng `npm run test:supabase`, `npm run verify:staging` và `npm run eval:safety:staging`. Các lệnh này tạo dữ liệu tổng hợp tạm thời, không chứa secrets trong code và từ chối target production. Xem [hướng dẫn xác minh staging](docs/STAGING_VERIFICATION.md). Không có credentials trong repository nên kết quả dịch vụ thật phải được ghi nhận riêng sau khi chạy.

Kiểm thử database chạy SQL thật bằng PGlite + pgvector với lớp Auth giả lập tối thiểu; không thay thế kiểm tra tích hợp Supabase hosted. E2E chạy bản export ở cổng 8081, kiểm tra onboarding → mood → conversation → memory approval → journal confirmation → care → garden, cũng như khôi phục draft và xóa memory. Ảnh giao diện ở `artifacts/home-light.png` và `artifacts/home-dark.png`.

## Trạng thái và giới hạn

Xem [kiến trúc](docs/ARCHITECTURE.md), [API](docs/API.md), [các việc cần xác minh trước phát hành](docs/RELEASE.md), [privacy nội bộ](docs/PRIVACY.md), [retention](docs/DATA_RETENTION.md), [AI disclosure](docs/AI_DISCLOSURE.md), [safety](docs/SAFETY.md), [quy trình crisis resources](docs/CRISIS_RESOURCES.md) và [deployment runbook](docs/DEPLOYMENT.md). Đây là MVP phát triển có demo end-to-end, chưa phải sản phẩm được thẩm định lâm sàng hay bản phát hành App Store. Không có khóa Supabase/AI thật trong workspace, nên kết nối dịch vụ thật và thông báo trên thiết bị cần được kiểm tra sau khi cấu hình.

Tham chiếu kỹ thuật: [Expo SDK](https://docs.expo.dev/versions/latest/), [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security), [PGlite extensions](https://pglite.dev/extensions/). Dependency native được căn theo `expo/bundledNativeModules.json` của phiên bản đã cài, không theo phiên bản latest không tương thích.
