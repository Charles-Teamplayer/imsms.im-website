# IMSMS 데모 시스템

## 📱 개요
iPhone 사용자가 IMSMS 프리미엄 메시지를 직접 체험할 수 있는 데모 시스템입니다.

## 🔄 동작 플로우

```
사용자 전화번호 입력 (+82 형식)
    ↓
1. LookUp API 호출 (iPhone 검증)
    ↓
2. LookUp Callback 수신
    ↓ (iPhone인 경우)
3. 샘플 메시지 즉시 발송 (Send API)
    ↓
완료 (iMessage 수신)
```

**참고:** 수신동의 기능은 API 엔드포인트가 제공되지 않아 현재 버전에서는 제외되었습니다.

## 📁 파일 구조

```
imsms.im-website/
├── demo.html              # 프론트엔드 랜딩 페이지
├── demo-server.js         # 백엔드 서버
├── package.json           # Node.js 의존성
├── .env.example           # 환경 변수 예제
└── README-DEMO.md         # 이 문서
```

## 🚀 설치 및 실행

### 1. 의존성 설치
```bash
npm install
```

### 2. 환경 변수 설정
`.env.example`을 복사하여 `.env` 파일을 생성하고 필요한 값을 설정합니다:

```bash
cp .env.example .env
```

**주요 환경 변수:**
- `PORT`: 서버 포트 (기본값: 3000)
- `CALLBACK_URL`: 콜백을 받을 서버의 공개 URL
- `IMSMS_API_KEY`: IMSMS API 키
- `IMSMS_AGENT_ID`: IMSMS 에이전트 ID

### 3. 서버 실행

**개발 모드 (nodemon):**
```bash
npm run dev
```

**프로덕션 모드:**
```bash
npm start
```

서버가 정상 실행되면:
```
🚀 IMSMS Demo Server running on port 3000
📍 Callback URL: http://localhost:3000
🔑 Agent ID: ims-demo-web-kr
```

### 4. 프론트엔드 접속
브라우저에서 `demo.html` 파일을 열거나, 웹 서버를 통해 접속합니다.

## 🔌 API 엔드포인트

### 1. 데모 시작
```http
POST /api/demo/start
Content-Type: application/json

{
  "phoneNumber": "+821012345678"
}
```

**응답:**
```json
{
  "success": true,
  "sessionId": "uuid-v4",
  "message": "iPhone 검증 중입니다"
}
```

### 2. 상태 조회
```http
GET /api/demo/status/:sessionId
```

**응답:**
```json
{
  "success": true,
  "sessionId": "uuid-v4",
  "phoneNumber": "+821012345678",
  "status": "consent_requested",
  "isCompatible": true,
  "createdAt": "2024-01-01T00:00:00.000Z",
  "updatedAt": "2024-01-01T00:00:30.000Z"
}
```

**상태 값:**
- `initiated`: 시작됨
- `lookup`: LookUp API 호출 중
- `not_compatible`: iPhone 아님
- `consent_requested`: 수신동의 요청 발송됨
- `consent_received`: 수신동의 응답 받음
- `consent_declined`: 수신 거부됨
- `demo_sent`: 데모 메시지 발송됨
- `completed`: 완료
- `error`: 오류 발생

### 3. LookUp Callback (IMSMS → 서버)
```http
POST /api/callback/lookup
Content-Type: application/json

{
  "phoneNumber": "+821012345678",
  "isCompatible": true,
  "metadata": {
    "sessionId": "uuid-v4"
  }
}
```

### 4. 수신동의 Callback (IMSMS → 서버)
```http
POST /api/callback/consent
Content-Type: application/json

{
  "imsAgentId": "ims-demo-web-kr",
  "consentRecipient": "+821012345678",
  "consentProcess": "completed",
  "consentStatus": true,
  "consentRequestDttm": "2024-01-01T00:00:00Z",
  "consentStatusUpdateDttm": "2024-01-01T00:00:30Z",
  "metadata": {
    "sessionId": "uuid-v4"
  }
}
```

### 5. Health Check
```http
GET /health
```

**응답:**
```json
{
  "status": "ok",
  "activeSessions": 5,
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

## 🔧 IMSMS API 통합

### LookUp API
iPhone 검증을 위한 API입니다.

```javascript
await axios.post(
  'http://ec2-3-34-72-7.ap-northeast-2.compute.amazonaws.com:9999/api/imsms/phone/lookup',
  {
    phoneNumbers: ['+821012345678'],
    callbackUrl: 'http://your-server.com/api/callback/lookup',
    metadata: { sessionId: 'uuid' }
  },
  {
    headers: {
      'Content-Type': 'application/json',
      'X-API-KEY': 'your-api-key'
    }
  }
);
```

### Consent Request API
수신동의 요청 메시지를 발송합니다.

```javascript
await axios.post(
  'http://ec2-3-34-72-7.ap-northeast-2.compute.amazonaws.com:9999/api/imsms/consent/request',
  {
    agentId: 'ims-demo-web-kr',
    recipient: '+821012345678',
    callbackUrl: 'http://your-server.com/api/callback/consent',
    metadata: { sessionId: 'uuid' }
  },
  {
    headers: {
      'Content-Type': 'application/json',
      'X-API-KEY': 'your-api-key'
    }
  }
);
```

### Send API
샘플 메시지를 발송합니다.

```javascript
await axios.post(
  'http://ec2-3-34-72-7.ap-northeast-2.compute.amazonaws.com:9999/api/imsms/send',
  {
    agentId: 'ims-demo-web-kr',
    recipient: '+821012345678',
    message: {
      title: '🎉 IMSMS 데모 메시지',
      body: '안녕하세요! IMSMS 프리미엄 메시지입니다.',
      imageUrl: 'https://imsms.im/assets/images/imsms-logo.png'
    }
  },
  {
    headers: {
      'Content-Type': 'application/json',
      'X-API-KEY': 'your-api-key'
    }
  }
);
```

## 🌐 배포

### AWS EC2 배포

1. **서버 접속**
```bash
ssh -i your-key.pem ubuntu@your-server-ip
```

2. **코드 업로드**
```bash
scp -r demo.html demo-server.js package.json ubuntu@your-server-ip:/home/ubuntu/imsms-demo/
```

3. **의존성 설치 및 실행**
```bash
cd /home/ubuntu/imsms-demo/
npm install
```

4. **PM2로 서버 실행**
```bash
npm install -g pm2
pm2 start demo-server.js --name imsms-demo
pm2 save
pm2 startup
```

5. **Nginx 리버스 프록시 설정**
```nginx
server {
    listen 80;
    server_name demo.imsms.im;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### Callback URL 설정
배포 후 `.env` 파일의 `CALLBACK_URL`을 실제 서버 URL로 업데이트해야 합니다:

```bash
CALLBACK_URL=https://demo.imsms.im
```

**중요:** IMSMS 서비스 측에도 콜백 URL을 등록해야 합니다.

## 🧪 테스트

### 1. Health Check
```bash
curl http://localhost:3000/health
```

### 2. 데모 시작 테스트
```bash
curl -X POST http://localhost:3000/api/demo/start \
  -H "Content-Type: application/json" \
  -d '{"phoneNumber": "+821012345678"}'
```

### 3. 상태 조회 테스트
```bash
curl http://localhost:3000/api/demo/status/your-session-id
```

## 🐛 디버깅

### 로그 확인
서버는 각 단계에서 상세한 로그를 출력합니다:

```
[session-id] Starting LookUp for +821012345678
[session-id] iPhone verified: +821012345678
[session-id] Consent request sent to +821012345678
[session-id] Consent status: true (completed)
[session-id] Sending demo message to +821012345678
[session-id] Demo message sent successfully
[session-id] Demo completed
```

### PM2 로그 (배포 시)
```bash
pm2 logs imsms-demo
```

## ⚠️ 주의사항

1. **Callback URL**: 반드시 공개적으로 접근 가능한 URL이어야 합니다
2. **API 키 보안**: `.env` 파일은 절대 Git에 커밋하지 마세요
3. **세션 관리**: 현재는 메모리에 세션을 저장합니다. 프로덕션에서는 Redis 등 사용 권장
4. **에러 처리**: 네트워크 오류나 API 실패에 대한 추가적인 에러 처리 필요
5. **Rate Limiting**: 남용 방지를 위한 요청 제한 구현 권장

## 📞 문의
- **이메일**: support@imsms.im
- **전화**: 1522-8061

## 📄 라이선스
Copyright © 2024 TEAMPLAYER Inc. All rights reserved.
