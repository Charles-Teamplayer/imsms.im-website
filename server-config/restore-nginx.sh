#!/bin/bash
# IMSMS Nginx 설정 복구 스크립트
# 사용법: ./restore-nginx.sh

set -e

SSH_KEY="$HOME/.ssh/ollama-chatbot-key.pem"
SERVER="ubuntu@13.125.2.83"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "🔧 IMSMS nginx 설정 복구 시작..."

# 설정 파일 복사
echo "📤 설정 파일 업로드 중..."
scp -i "$SSH_KEY" "$SCRIPT_DIR/nginx-imsms-demo.conf" "$SERVER:/tmp/"

# 서버에서 설정 적용
echo "⚙️  서버에 설정 적용 중..."
ssh -i "$SSH_KEY" "$SERVER" << 'ENDSSH'
    sudo cp /tmp/nginx-imsms-demo.conf /etc/nginx/sites-available/imsms-demo
    sudo rm -f /etc/nginx/sites-enabled/default
    sudo ln -sf /etc/nginx/sites-available/imsms-demo /etc/nginx/sites-enabled/imsms-demo
    sudo nginx -t
    sudo systemctl reload nginx
    echo "✅ nginx 설정 복구 완료!"
ENDSSH

# 테스트
echo "🧪 서비스 테스트 중..."
sleep 2
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" https://demo.imsms.im)

if [ "$HTTP_CODE" = "200" ]; then
    echo "✅ demo.imsms.im 정상 작동 (HTTP $HTTP_CODE)"
else
    echo "❌ 문제 발생! HTTP 코드: $HTTP_CODE"
    exit 1
fi

echo ""
echo "🎉 복구 완료!"
