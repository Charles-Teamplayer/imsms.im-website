const { SESClient, SendEmailCommand } = require('@aws-sdk/client-ses');

const ses = new SESClient({ region: 'ap-northeast-2' });

exports.handler = async (event) => {
    // CORS headers
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Content-Type': 'application/json'
    };

    // Handle preflight request (Lambda Function URL format)
    const method = event.requestContext?.http?.method || event.httpMethod;
    if (method === 'OPTIONS') {
        return {
            statusCode: 200,
            headers,
            body: ''
        };
    }

    console.log('Received event:', JSON.stringify(event));

    try {
        const body = JSON.parse(event.body);
        const { companyName, contactName, email, phone, monthlyVolume, message } = body;

        // Validate required fields
        if (!companyName || !contactName || !email || !phone) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: '필수 항목을 모두 입력해주세요.' })
            };
        }

        const emailParams = {
            Source: 'IMSMS <support@teamplayer.co.kr>',
            ReplyToAddresses: [email],
            Destination: {
                ToAddresses: ['charles@teamplayer.co.kr']
            },
            Message: {
                Subject: {
                    Data: `[IMSMS 견적문의] ${companyName}`,
                    Charset: 'UTF-8'
                },
                Body: {
                    Html: {
                        Data: `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>
        body { font-family: 'Malgun Gothic', sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #B92B27, #8B1A1A); color: white; padding: 20px; border-radius: 10px 10px 0 0; }
        .content { background: #f9f9f9; padding: 30px; border: 1px solid #ddd; border-top: none; border-radius: 0 0 10px 10px; }
        .info-row { display: flex; padding: 12px 0; border-bottom: 1px solid #eee; }
        .info-label { font-weight: bold; min-width: 150px; color: #B92B27; }
        .info-value { flex: 1; }
        .message-box { background: white; padding: 20px; margin-top: 20px; border-radius: 8px; border-left: 4px solid #B92B27; }
        .footer { text-align: center; margin-top: 20px; color: #999; font-size: 12px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h2 style="margin: 0;">💌 IMSMS 견적 문의</h2>
        </div>
        <div class="content">
            <div class="info-row">
                <div class="info-label">고객사명</div>
                <div class="info-value"><strong>${companyName}</strong></div>
            </div>
            <div class="info-row">
                <div class="info-label">담당자명</div>
                <div class="info-value">${contactName}</div>
            </div>
            <div class="info-row">
                <div class="info-label">이메일</div>
                <div class="info-value"><a href="mailto:${email}">${email}</a></div>
            </div>
            <div class="info-row">
                <div class="info-label">연락처</div>
                <div class="info-value">${phone}</div>
            </div>
            <div class="info-row">
                <div class="info-label">예상 월 발송량</div>
                <div class="info-value">${monthlyVolume || '미선택'}</div>
            </div>

            ${message ? `
            <div class="message-box">
                <h3 style="margin-top: 0; color: #B92B27;">📝 문의 내용</h3>
                <p style="white-space: pre-wrap; margin: 0;">${message}</p>
            </div>
            ` : ''}

            <div class="footer">
                <p>발신일시: ${new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}</p>
                <p>이 메일은 IMSMS 웹사이트(www.imsms.im)에서 자동 발송되었습니다.</p>
            </div>
        </div>
    </div>
</body>
</html>
                        `.trim(),
                        Charset: 'UTF-8'
                    },
                    Text: {
                        Data: `
견적 문의 정보
━━━━━━━━━━━━━━━━━━━━━━
고객사명: ${companyName}
담당자명: ${contactName}
이메일: ${email}
연락처: ${phone}
예상 월 발송량: ${monthlyVolume || '미선택'}

━━━━━━━━━━━━━━━━━━━━━━
문의 내용:
${message || '없음'}
━━━━━━━━━━━━━━━━━━━━━━

발신일시: ${new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}
                        `.trim(),
                        Charset: 'UTF-8'
                    }
                }
            }
        };

        const command = new SendEmailCommand(emailParams);
        console.log('Sending email with params:', JSON.stringify(emailParams, null, 2));

        const result = await ses.send(command);
        console.log('Email sent successfully:', JSON.stringify(result));

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                message: '견적 문의가 성공적으로 전송되었습니다.',
                messageId: result.MessageId
            })
        };

    } catch (error) {
        console.error('Error details:', {
            message: error.message,
            code: error.code,
            statusCode: error.$metadata?.httpStatusCode,
            stack: error.stack
        });

        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({
                success: false,
                error: '메일 전송 중 오류가 발생했습니다.',
                details: error.message
            })
        };
    }
};
