#!/bin/bash

# IMSMS 데모 시스템 테스트 스크립트

BASE_URL="${1:-http://localhost:3000}"
PHONE_NUMBER="${2:-+821012345678}"

echo "========================================="
echo "IMSMS 데모 시스템 테스트"
echo "========================================="
echo "서버: $BASE_URL"
echo "전화번호: $PHONE_NUMBER"
echo ""

# 1. Health Check
echo "1. Health Check 테스트..."
HEALTH_RESPONSE=$(curl -s "$BASE_URL/health")
echo "응답: $HEALTH_RESPONSE"
echo ""

# 2. 데모 시작
echo "2. 데모 시작 테스트..."
START_RESPONSE=$(curl -s -X POST "$BASE_URL/api/demo/start" \
  -H "Content-Type: application/json" \
  -d "{\"phoneNumber\": \"$PHONE_NUMBER\"}")

echo "응답: $START_RESPONSE"

# sessionId 추출
SESSION_ID=$(echo $START_RESPONSE | grep -o '"sessionId":"[^"]*' | cut -d'"' -f4)

if [ -z "$SESSION_ID" ]; then
    echo "❌ 세션 ID를 받지 못했습니다. 서버를 확인하세요."
    exit 1
fi

echo "✅ 세션 ID: $SESSION_ID"
echo ""

# 3. 상태 조회 (5번 반복)
echo "3. 상태 조회 테스트 (5번 폴링)..."
for i in {1..5}; do
    echo "[$i/5] 상태 조회 중..."
    STATUS_RESPONSE=$(curl -s "$BASE_URL/api/demo/status/$SESSION_ID")

    # status 필드 추출
    STATUS=$(echo $STATUS_RESPONSE | grep -o '"status":"[^"]*' | cut -d'"' -f4)
    echo "  - 현재 상태: $STATUS"
    echo "  - 전체 응답: $STATUS_RESPONSE"

    # completed 또는 error 상태면 종료
    if [ "$STATUS" == "completed" ] || [ "$STATUS" == "error" ]; then
        echo "✅ 최종 상태: $STATUS"
        break
    fi

    sleep 3
done

echo ""
echo "========================================="
echo "테스트 완료"
echo "========================================="
