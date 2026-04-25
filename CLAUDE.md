# 프로젝트 규칙

## API Route 작성 체크리스트

새 route를 만들거나 기존 route를 수정할 때 아래 항목을 **반드시** 확인한다.

### 1. 인증/인가
- `getSessionFromCookies()` 로 session 확인
- `session.role` 이 해당 route에 맞는 역할인지 확인 (ADMIN / PARTNER / CUSTOMER)
- 인증 없이 접근 가능한 상태로 두지 않는다

### 2. 멀티테넌트 스코프
- 모든 DB 조회/수정에 `organizationId: session.orgId ?? "4nwn"` 포함
- `findById(id)` 단독 사용 금지 → 반드시 `findOne({ _id: id, organizationId: orgId })` 사용
- 소유권 확인이 필요한 경우 `partnerId` / `customerId` 도 조건에 포함

### 3. 트랜잭션
- 두 개 이상의 컬렉션을 수정하는 경우 `mongoose.startSession()` + `withTransaction()` 사용
- Wallet 차감/적립은 항상 트랜잭션 안에서 처리

### 4. 원자성
- 상태 변경(PENDING→CONFIRMED 등)은 `findOneAndUpdate({ status: "PENDING" }, ...)` 패턴 사용
- `findOne` 후 `save()` 패턴은 race condition 위험 — 상태 변경에는 사용 금지
- Mongoose 중첩 객체 전체 교체 시 `markModified("fieldName")` 호출

### 5. 쿼리 안전성
- `find()` 에는 항상 `.limit(n)` 추가 (기본 100, 목록 페이지는 50)
- `ObjectId` 변환 전 `mongoose.Types.ObjectId.isValid(id)` 검사
- 입력값은 `String()`, `Number()`, `.trim()` 으로 정제

### 6. 에러 처리
- 모든 async handler는 try-catch로 감싼다
- 에러 응답에 내부 스택/쿼리 정보 노출 금지

### 7. 응답 데이터
- `passwordHash`, `socialAccounts`, `__v` 등 민감 필드는 응답에서 제외
- `select()` 또는 응답 매핑으로 필요한 필드만 반환

### 8. Rate Limiting 적용 대상
아래 유형의 엔드포인트에는 반드시 `isRateLimited()` 적용:
- 로그인 / 비밀번호 재설정 / 이메일 인증
- QR 스캔 (고객-제휴사 쌍 기준 15초)
- 파일 업로드 URL 발급
- 외부 API 호출을 트리거하는 엔드포인트

### 9. Ledger 생성 규칙
Ledger 도큐먼트 생성 시 아래 필드를 모두 채운다:
```
accountId     : 잔액이 변동되는 지갑 소유자
userId        : 거래의 직접 대상 (accountId와 동일한 경우 많음)
actorId       : 행위자 (관리자 / 제휴사 등)
counterpartyId: 상대방 (ISSUE면 고객, USE면 제휴사, TOPUP이면 관리자)
type          : TOPUP / ISSUE / USE / ADJUST
amount        : 차감이면 음수(-), 적립이면 양수(+)
```

### 10. PENDING 중복 방지 패턴
같은 사용자가 동일 상태로 중복 생성되면 안 되는 경우 partial unique index 사용:
```typescript
Schema.index(
  { organizationId: 1, partnerId: 1 },
  { unique: true, partialFilterExpression: { status: "PENDING" } }
);
```
그리고 POST 핸들러에서 `error.code === 11000` 처리 추가.

### 11. 소셜 로그인 (Kakao / Naver) 패턴
기존 유저 재로그인 시 이름이 기본값("카카오 사용자" 등)이면 소셜에서 받은 실제 이름으로 갱신:
```typescript
if (user && socialName && (!user.name || user.name === "카카오 사용자")) {
  user.name = socialName;
  await user.save();
}
```

### 12. 민감한 순서가 있는 작업
토큰 사용 처리처럼 "검증 → A 처리 → B 처리" 순서에서 A·B가 모두 성공해야 하는 경우:
- 토큰/상태를 **먼저** `findOneAndUpdate`로 원자적으로 소비 처리
- 이후 핵심 로직 실행
- 순서를 반대로 하면 핵심 로직 성공 후 토큰 처리 실패 시 재사용 가능

## 기술 스택
- Next.js 14 App Router
- MongoDB + Mongoose
- 인증: JWT (httpOnly cookie) + `getSessionFromCookies()`
- 잔액: `debitWallet` / `creditWallet` (services/wallet.ts) — 음수 방지 내장
- Rate limit: `isRateLimited(key, limit, windowMs)` (lib/rateLimit.ts)
- 비밀번호: bcrypt 12 rounds + `validatePassword()` (lib/validatePassword.ts)
- QR 토큰: JWT + `jwtid` (randomUUID) + Redis `qr:used:{jti}` 로 일회성 보장
