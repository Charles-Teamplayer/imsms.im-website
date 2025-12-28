# IMSMS 데모 시스템 배포 정보

## 🎉 배포 완료

**배포 일시:** 2025-11-03
**버전:** v1.0.0

## 📍 접속 정보

### 웹 주소
- **데모 페이지**: http://13.125.2.83:3000/demo.html
- **API 베이스**: http://13.125.2.83:3000
- **Health Check**: http://13.125.2.83:3000/health

### AWS 리소스
- **EC2 인스턴스 ID**: i-04756612615d93133
- **인스턴스 타입**: t3.micro
- **Public IP**: 13.125.2.83
- **Private IP**: 172.31.39.252
- **리전**: ap-northeast-2 (서울)
- **가용 영역**: ap-northeast-2c
- **스토리지**: 15GB gp3

### 보안 설정
- **Security Group**: sg-0ece51e9f432d2266 (imsms-demo-sg)
- **개방 포트**:
  - 22 (SSH)
  - 80 (HTTP)
  - 443 (HTTPS)
  - 3000 (Node.js 앱)

### SSH 접속
```bash
ssh -i ~/.ssh/ollama-chatbot-key.pem ubuntu@13.125.2.83
```

## 🔧 실행 환경

### 서버 스펙
- **OS**: Ubuntu 22.04 LTS (Jammy)
- **Node.js**: v18.20.8
- **npm**: 10.8.2
- **PM2**: v6.0.13

### 환경 변수
```bash
PORT=3000
NODE_ENV=production
CALLBACK_URL=http://13.125.2.83:3000
IMSMS_BASE_URL=http://ec2-3-34-72-7.ap-northeast-2.compute.amazonaws.com:9999
IMSMS_AGENT_ID=ims-demo-web-kr
IMSMS_API_KEY=d49855bc-0da6-4214-baf1-543564b25cfc
```

## ✅ 작동 확인

### 테스트 결과 (2025-11-03)

#### 1. Health Check ✅
```bash
curl http://13.125.2.83:3000/health
```
**결과**: `{"status":"ok","activeSessions":0}`

#### 2. LookUp API (iPhone 검증) ✅
- 콜백 수신 정상
- 전화번호 검증 성공
- 응답 시간: ~2초

#### 3. Send API (메시지 발송) ✅
```
resultCd: '000'
resultMsg: 'OK'
imsId: 'ce9707b7-b1a0-4523-88e6-65818859bf30'
```
- 메시지 발송 성공
- imsId 정상 수신
- 전체 플로우 완료 시간: ~5초

### 전체 플로우 테스트
```bash
# 1. 데모 시작
curl -X POST http://13.125.2.83:3000/api/demo/start \
  -H "Content-Type: application/json" \
  -d '{"phoneNumber": "+821067051080"}'

# 응답: sessionId 받음

# 2. 상태 확인 (5초 후)
curl http://13.125.2.83:3000/api/demo/status/{sessionId}

# 응답: status="completed", imsId 받음
```

## 📊 PM2 프로세스 관리

### 프로세스 상태
```bash
pm2 list
```
```
┌────┬───────────────┬─────────┬─────────┬──────────┬────────┬──────┬───────────┐
│ id │ name          │ version │ mode    │ pid      │ uptime │ ↺    │ status    │
├────┼───────────────┼─────────┼─────────┼──────────┼────────┼──────┼───────────┤
│ 0  │ imsms-demo    │ 1.4.0   │ fork    │ 3661     │ 실행중  │ 4    │ online    │
└────┴───────────────┴─────────┴─────────┴──────────┴────────┴──────┴───────────┘
```

### 유용한 명령어
```bash
# 로그 확인
pm2 logs imsms-demo

# 재시작
pm2 restart imsms-demo

# 중지
pm2 stop imsms-demo

# 시작
pm2 start imsms-demo

# 프로세스 모니터링
pm2 monit
```

## 🔄 업데이트 방법

### 코드 업데이트
```bash
# 로컬에서 수정 후
scp -i ~/.ssh/ollama-chatbot-key.pem demo-server.js demo.html ubuntu@13.125.2.83:~/imsms-demo/

# 서버에서 재시작
ssh -i ~/.ssh/ollama-chatbot-key.pem ubuntu@13.125.2.83
cd ~/imsms-demo
pm2 restart imsms-demo
```

### 의존성 업데이트
```bash
ssh -i ~/.ssh/ollama-chatbot-key.pem ubuntu@13.125.2.83
cd ~/imsms-demo
npm install
pm2 restart imsms-demo
```

## 📈 모니터링

### 서버 리소스
```bash
# CPU/메모리 사용량
pm2 monit

# 시스템 리소스
htop

# 디스크 사용량
df -h
```

### 로그 위치
- **PM2 로그**: `/home/ubuntu/.pm2/logs/`
- **Out 로그**: `/home/ubuntu/.pm2/logs/imsms-demo-out.log`
- **Error 로그**: `/home/ubuntu/.pm2/logs/imsms-demo-error.log`

## 🛡️ nginx 설정 백업 & 복구

### 설정 파일 구조
```
서버 설정:
├── /etc/nginx/sites-available/imsms-demo  ← 메인 설정 (apt 재설치에도 안전)
├── /etc/nginx/sites-enabled/imsms-demo    ← 심볼릭 링크
└── /etc/nginx/backup/                     ← 자동 백업 위치

로컬 백업:
└── server-config/
    ├── nginx-imsms-demo.conf              ← 설정 파일 백업
    └── restore-nginx.sh                   ← 복구 스크립트
```

### 자동 보호 시스템
1. **별도 설정 파일**: `imsms-demo` (default 대신 사용, apt 재설치에도 유지)
2. **일일 백업**: 매일 자정 `/etc/nginx/backup/`에 자동 백업
3. **apt 훅**: nginx 재설치 시 자동으로 설정 백업 & 복원

### demo.imsms.im 안 열릴 때 (nginx 문제)
```bash
# 방법 1: 로컬에서 복구 스크립트 실행
./server-config/restore-nginx.sh

# 방법 2: 수동 복구
ssh -i ~/.ssh/ollama-chatbot-key.pem ubuntu@13.125.2.83
sudo cp /etc/nginx/backup/imsms-demo.backup /etc/nginx/sites-available/imsms-demo
sudo ln -sf /etc/nginx/sites-available/imsms-demo /etc/nginx/sites-enabled/imsms-demo
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx
```

### nginx 로그 확인
```bash
# 백업 로그
cat /var/log/nginx-backup.log

# nginx 에러 로그
sudo tail -f /var/log/nginx/error.log
```

## 🚨 트러블슈팅

### 서버가 응답하지 않을 때
```bash
# PM2 프로세스 확인
pm2 status

# 로그 확인
pm2 logs imsms-demo --err

# 재시작
pm2 restart imsms-demo
```

### demo.imsms.im 404 에러 시
```bash
# nginx 설정 확인
ssh -i ~/.ssh/ollama-chatbot-key.pem ubuntu@13.125.2.83
cat /etc/nginx/sites-enabled/imsms-demo

# 설정이 없거나 잘못됐으면 복구
./server-config/restore-nginx.sh
```

### 포트 충돌 시
```bash
# 포트 사용 확인
lsof -i :3000

# 프로세스 종료
pm2 delete imsms-demo
pm2 start demo-server.js --name imsms-demo
```

### 메모리 부족 시
```bash
# 메모리 사용량 확인
free -h

# PM2 재시작
pm2 restart imsms-demo
```

## 🔒 보안 고려사항

1. **API 키 보호**: .env 파일은 Git에 커밋되지 않음
2. **SSH 키**: ollama-chatbot-key.pem 안전하게 보관
3. **방화벽**: Security Group으로 포트 제한
4. **HTTPS**: 추후 SSL 인증서 적용 권장

## 📞 지원

### 문제 발생 시
1. PM2 로그 확인: `pm2 logs imsms-demo`
2. Health Check 확인: `curl http://13.125.2.83:3000/health`
3. 서버 재시작: `pm2 restart imsms-demo`

### 연락처
- 이메일: support@imsms.im
- 전화: 1522-8061

---

**최종 업데이트**: 2025-12-21
**배포 담당**: Claude Code
**상태**: ✅ 정상 운영 중
