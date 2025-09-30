# IMSMS.im - 공식 웹사이트

## 프로젝트 개요
IMSMS(Intelligent Message Service Management System)의 공식 웹사이트입니다.
Apple iMessage 기반 프리미엄 기업 메시징 솔루션을 소개합니다.

## 🌐 라이브 사이트
- **URL**: https://imsms.im
- **CloudFront**: https://d2unsff4mplluw.cloudfront.net

## 🚀 주요 특징
- **1+1 메시지 혁명**: xMS 보내면 IMSMS 무료
- **비용 절감**: 기존 SMS 대비 최대 90% 비용 절감
- **완벽한 호환성**: 별도 앱 설치 없이 iPhone 기본 메시지 앱 사용
- **대용량 처리**: 시간당 100만 건, 1회 최대 10만 건 발송
- **리치 미디어**: 이미지, 동영상, 파일 등 다양한 형식 지원

## 📁 프로젝트 구조
```
imsms-website/
├── index.html           # 메인 페이지
├── assets/
│   ├── images/         # 이미지 파일
│   │   ├── imsms-logo.png
│   │   ├── imsms-logo-header.png
│   │   └── imsms-logo-original.png
│   ├── css/            # 스타일시트
│   └── js/             # JavaScript 파일
├── docs/               # 문서
└── README.md          # 프로젝트 문서
```

## 🛠 기술 스택
- **Frontend**: HTML5, CSS3, Vanilla JavaScript
- **Design**: Liquid Glass UI, 3D Transforms
- **Animation**: CSS Animations, Intersection Observer API
- **Hosting**: AWS S3 + CloudFront CDN
- **Domain**: Route 53

## 📱 반응형 디자인
- Desktop (1200px+)
- Tablet (768px - 1199px)
- Mobile (< 768px)

## 🎨 디자인 컨셉
- **Primary Color**: #B92B27 (IMSMS Red)
- **Glass Morphism**: 투명도와 blur 효과 활용
- **Liquid Design**: 유동적이고 부드러운 인터랙션
- **3D Effects**: 입체적인 카드 효과

## 🚀 배포 방법

### S3 업로드
```bash
aws s3 sync . s3://imsms-website/ --exclude ".git/*" --exclude "*.md" --delete
```

### CloudFront 캐시 무효화
```bash
aws cloudfront create-invalidation --distribution-id [DISTRIBUTION_ID] --paths "/*"
```

## 📝 업데이트 이력

### 2024-09-30
- 프로젝트 별도 디렉토리 분리
- 구조화된 폴더 구성
- README 문서 작성

## 📞 문의
- **이메일**: support@imsms.im
- **전화**: 1522-8061
- **주소**: 경기도 용인시 기흥구 동백로 22

## 📄 라이선스
Copyright © 2024 TEAMPLAYER Inc. All rights reserved.