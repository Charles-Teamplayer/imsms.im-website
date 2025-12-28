require('dotenv').config();

const express = require('express');
const cors = require('cors');
const axios = require('axios');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs').promises;
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Serve static files
app.use(express.static(__dirname));

// IMSMS API Configuration
const IMSMS_CONFIG = {
    baseUrl: process.env.IMSMS_BASE_URL || 'http://ec2-3-34-72-7.ap-northeast-2.compute.amazonaws.com:9999',
    agentId: process.env.IMSMS_AGENT_ID || 'ims-demo-web-kr',
    apiKey: process.env.IMSMS_API_KEY || 'd49855bc-0da6-4214-baf1-543564b25cfc'
};

// Callback URL (이 서버의 공개 URL - 배포 후 업데이트 필요)
const CALLBACK_BASE_URL = process.env.CALLBACK_URL || 'http://localhost:3000';

// In-memory session storage (프로덕션에서는 Redis 등 사용 권장)
const sessions = new Map();

// DB 파일 경로
const CONSENTED_NUMBERS_DB = path.join(__dirname, 'consented-numbers.json');

/**
 * Session 상태 정의:
 * - initiated: 시작됨
 * - lookup: LookUp API 호출 중
 * - not_compatible: iPhone 아님
 * - consent_requested: 수신동의 요청 발송됨
 * - consent_received: 수신동의 응답 받음
 * - demo_sent: 데모 메시지 발송됨
 * - completed: 완료
 * - error: 오류 발생
 */

// Helper: IMSMS API 호출 (POST)
async function callIMSMSApi(endpoint, data) {
    try {
        const response = await axios.post(
            `${IMSMS_CONFIG.baseUrl}${endpoint}`,
            data,
            {
                headers: {
                    'Content-Type': 'application/json',
                    'X-API-KEY': IMSMS_CONFIG.apiKey
                }
            }
        );
        return response.data;
    } catch (error) {
        console.error(`IMSMS API Error [${endpoint}]:`, error.response?.data || error.message);
        throw error;
    }
}

// Helper: IMSMS API 호출 (GET) - API v1.0 문서 기준
async function callIMSMSApiGet(endpoint, params = {}) {
    try {
        const response = await axios.get(
            `${IMSMS_CONFIG.baseUrl}${endpoint}`,
            {
                params,
                headers: {
                    'X-API-KEY': IMSMS_CONFIG.apiKey
                }
            }
        );
        return response.data;
    } catch (error) {
        console.error(`IMSMS API GET Error [${endpoint}]:`, error.response?.data || error.message);
        throw error;
    }
}

// Helper: 전화번호 정규화 (+ 형식으로 변환)
function normalizePhoneNumber(phone) {
    // 숫자만 추출
    let cleaned = phone.replace(/\D/g, '');

    // 0으로 시작하면 82로 변환 (예: 01012345678 → 821012345678)
    if (cleaned.startsWith('0')) {
        cleaned = '82' + cleaned.substring(1);
    }

    // 국가번호가 없으면 82 추가
    if (!cleaned.startsWith('82') && !cleaned.startsWith('1')) {
        cleaned = '82' + cleaned;
    }

    // + 기호 추가
    return '+' + cleaned;
}

// 1. 데모 시작 API
app.post('/api/demo/start', async (req, res) => {
    try {
        let { phoneNumber } = req.body;

        if (!phoneNumber) {
            return res.status(400).json({
                success: false,
                message: '전화번호를 입력해주세요'
            });
        }

        // 전화번호 정규화
        phoneNumber = normalizePhoneNumber(phoneNumber);

        // 세션 생성
        const sessionId = uuidv4();
        const session = {
            sessionId,
            phoneNumber,
            status: 'initiated',
            createdAt: new Date(),
            updatedAt: new Date()
        };

        sessions.set(sessionId, session);

        // LookUp API 호출 (iPhone 검증) - LookUp API 문서 기준
        // POST /api/imsms/phone/lookup
        // Body: { phoneNumbers: Array, callbackUrl: String (선택) }
        console.log(`[${sessionId}] Starting LookUp for ${phoneNumber}`);

        const lookupCallbackUrl = `${CALLBACK_BASE_URL}/api/callback/lookup`;

        try {
            const lookupResult = await callIMSMSApi('/api/imsms/phone/lookup', {
                phoneNumbers: [phoneNumber],
                callbackUrl: lookupCallbackUrl,
                metadata: { sessionId } // 세션 추적용
            });

            console.log(`[${sessionId}] LookUp API Response:`, lookupResult);
            // Response: { requestId, resultCd, count, requestDttm }

            // 상태 업데이트
            session.status = 'lookup';
            session.updatedAt = new Date();
            sessions.set(sessionId, session);

            res.json({
                success: true,
                sessionId,
                message: 'iPhone 검증 중입니다'
            });
        } catch (error) {
            session.status = 'error';
            session.error = 'LookUp API 호출 실패';
            sessions.set(sessionId, session);

            res.status(500).json({
                success: false,
                message: 'iPhone 검증 요청에 실패했습니다'
            });
        }
    } catch (error) {
        console.error('Start demo error:', error);
        res.status(500).json({
            success: false,
            message: '서버 오류가 발생했습니다'
        });
    }
});

// 2. LookUp Callback 처리 - LookUp API 문서 기준
// Callback Response: { phoneNumber, requestId, resultCd, isCompatible, requestDttm, finishDttm }
app.post('/api/callback/lookup', async (req, res) => {
    try {
        console.log('LookUp Callback received:', JSON.stringify(req.body, null, 2));

        // LookUp API 문서 기준 필드
        const { phoneNumber, requestId, resultCd, isCompatible, requestDttm, finishDttm } = req.body;

        // 전화번호로 세션 찾기
        let session = null;
        let foundSessionId = null;

        console.log(`[LookUp Callback] Looking for session with phone: ${phoneNumber}`);
        console.log(`[LookUp Callback] Active sessions count: ${sessions.size}`);

        for (const [id, sess] of sessions.entries()) {
            console.log(`[LookUp Callback] Checking session ${id}: phone=${sess.phoneNumber}, status=${sess.status}`);
            if (sess.phoneNumber === phoneNumber && sess.status === 'lookup') {
                session = sess;
                foundSessionId = id;
                break;
            }
        }

        if (!session) {
            console.warn('Session not found for phone:', phoneNumber);
            console.warn('Total active sessions:', sessions.size);
            return res.status(404).json({ success: false, message: 'Session not found' });
        }

        // LookUp API 문서 기준: resultCd "000" = 성공
        if (resultCd !== '000') {
            console.log(`[${foundSessionId}] LookUp failed - resultCd: ${resultCd}`);
            session.status = 'error';
            session.error = `LookUp 실패: ${resultCd}`;
            session.updatedAt = new Date();
            sessions.set(foundSessionId, session);
            return res.json({ success: false, message: 'LookUp failed' });
        }

        if (!isCompatible) {
            // iPhone이 아님
            session.status = 'not_compatible';
            session.isCompatible = false;
            session.updatedAt = new Date();
            sessions.set(foundSessionId, session);

            console.log(`[${foundSessionId}] Not an iPhone: ${phoneNumber}`);
            return res.json({ success: true, message: 'Not compatible' });
        }

        // iPhone 확인됨 - 수신동의 메시지 발송
        console.log(`[${foundSessionId}] iPhone verified: ${phoneNumber}`);
        session.isCompatible = true;
        session.requestId = requestId;
        session.lookupRequestDttm = requestDttm;
        session.lookupFinishDttm = finishDttm;
        session.status = 'consent_requesting';
        session.updatedAt = new Date();
        sessions.set(foundSessionId, session);

        // 수신동의 메시지 발송 - API v1.0 문서 기준
        try {
            await sendConsentMessage(foundSessionId, phoneNumber);
        } catch (error) {
            console.error(`[${foundSessionId}] Failed to send consent message:`, error);
            session.status = 'error';
            session.error = '수신동의 메시지 발송 실패';
            sessions.set(foundSessionId, session);
        }

        res.json({ success: true });
    } catch (error) {
        console.error('LookUp callback error:', error);
        res.status(500).json({ success: false, message: 'Callback processing failed' });
    }
});

// 3. 수신동의 Callback 처리 - User Consent API (Callback) 문서 기준
// Callback JSON: { imsAgentId, consentRecipient, consentProcess, consentStatus, consentRequestDttm, consentStatusUpdateDttm }
// consentProcess: none | pending | timeout | completed
// consentStatus: true (동의) | false (거부)
app.post('/api/callback/consent', async (req, res) => {
    try {
        console.log('Consent Callback received:', JSON.stringify(req.body, null, 2));

        // User Consent API 문서 기준 필드
        const {
            imsAgentId,
            consentRecipient,
            consentProcess,
            consentStatus,
            consentRequestDttm,
            consentStatusUpdateDttm
        } = req.body;

        // 전화번호로 세션 찾기
        let session = null;
        let sessionId = null;

        console.log(`Looking for session with phone: ${consentRecipient}`);
        console.log(`Active sessions:`, Array.from(sessions.entries()).map(([id, sess]) => ({
            id,
            phone: sess.phoneNumber,
            status: sess.status
        })));

        for (const [id, sess] of sessions.entries()) {
            console.log(`Comparing: "${sess.phoneNumber}" === "${consentRecipient}"`);
            if (sess.phoneNumber === consentRecipient) {
                session = sess;
                sessionId = id;
                break;
            }
        }

        if (!session) {
            console.warn('Session not found for phone:', consentRecipient);
            console.warn('Total active sessions:', sessions.size);
            return res.status(404).json({ success: false, message: 'Session not found' });
        }

        // 수신동의 정보 업데이트
        session.consentProcess = consentProcess;
        session.consentStatus = consentStatus;
        session.consentRequestDttm = consentRequestDttm;
        session.consentStatusUpdateDttm = consentStatusUpdateDttm;
        session.updatedAt = new Date();

        console.log(`[${sessionId}] Consent callback - Process: ${consentProcess}, Status: ${consentStatus}`);

        // 진행 상태별 처리
        switch (consentProcess) {
            case 'pending':
                // 수신동의 메시지 발송됨, 사용자 응답 대기 중
                session.status = 'consent_pending';
                console.log(`[${sessionId}] Consent message sent, waiting for user response`);
                break;

            case 'completed':
                if (consentStatus === true) {
                    // 수신 동의 완료 - 데모 메시지 발송
                    session.status = 'consent_granted';
                    console.log(`[${sessionId}] User granted consent, sending demo message`);

                    // DB에 수신동의 번호 저장
                    await saveConsentedNumber(consentRecipient);

                    // 데모 메시지 발송
                    try {
                        await sendDemoMessage(sessionId, consentRecipient);
                    } catch (error) {
                        console.error(`[${sessionId}] Failed to send demo message:`, error);
                        session.status = 'error';
                        session.error = '데모 메시지 발송 실패';
                    }
                } else {
                    // 수신 거부
                    session.status = 'consent_declined';
                    console.log(`[${sessionId}] User declined consent`);
                }
                break;

            case 'timeout':
                // 수신동의 응답 시간 초과
                session.status = 'consent_timeout';
                console.log(`[${sessionId}] Consent request timed out`);
                break;

            case 'none':
            default:
                session.status = 'consent_none';
                break;
        }

        sessions.set(sessionId, session);
        res.json({ success: true });
    } catch (error) {
        console.error('Consent callback error:', error);
        res.status(500).json({ success: false, message: 'Callback processing failed' });
    }
});

// 4. DB 저장 함수
async function saveConsentedNumber(phoneNumber) {
    try {
        let consentedNumbers = [];

        // 기존 DB 파일 읽기
        try {
            const data = await fs.readFile(CONSENTED_NUMBERS_DB, 'utf8');
            consentedNumbers = JSON.parse(data);
        } catch (error) {
            // 파일이 없으면 빈 배열로 시작
            console.log('Creating new consented numbers DB');
        }

        // 중복 체크
        const existing = consentedNumbers.find(item => item.phoneNumber === phoneNumber);
        if (existing) {
            console.log(`Phone number ${phoneNumber} already in DB, updating timestamp`);
            existing.consentedAt = new Date().toISOString();
        } else {
            // 새로운 번호 추가
            consentedNumbers.push({
                phoneNumber,
                consentedAt: new Date().toISOString()
            });
            console.log(`Added ${phoneNumber} to consented numbers DB`);
        }

        // DB 파일 저장
        await fs.writeFile(CONSENTED_NUMBERS_DB, JSON.stringify(consentedNumbers, null, 2), 'utf8');
        console.log('Consented numbers DB saved successfully');
    } catch (error) {
        console.error('Failed to save consented number:', error);
        throw error;
    }
}

// 5. 수신동의 메시지 발송 - API v1.0 문서 기준
// POST /api/imsms/send
// Body: { sendTo, sendType, message, imsAgentId, ... }
// Response: { resultCd, resultMsg, imsId, imsReqDttm }
async function sendConsentMessage(sessionId, recipient) {
    try {
        console.log(`[${sessionId}] Sending consent request message to ${recipient}`);

        const session = sessions.get(sessionId);
        const consentCallbackUrl = `${CALLBACK_BASE_URL}/api/callback/consent`;

        // API v1.0 문서 기준 요청 본문
        const consentMessage = {
            sendTo: recipient,
            sendType: 'S', // 즉시 발송 (API v1.0에선 S만 가능)
            message: '📱 IMSMS Consent Request\n\n' +
                     'Hello, this is TEAMPLAYER.\n\n' +
                     'We would like to send you important information via iMessage.\n\n' +
                     'Please reply:\n' +
                     '• "START" to opt in\n' +
                     '• "STOP" to opt out\n\n' +
                     'You can withdraw your consent at any time.\n' +
                     'This message complies with applicable regulations.',
            imsAgentId: IMSMS_CONFIG.agentId,
            consentCallbackUrl: consentCallbackUrl // 수신동의 콜백 URL
        };

        console.log(`[${sessionId}] Consent callback URL: ${consentCallbackUrl}`);

        // Send API 호출
        const result = await callIMSMSApi('/api/imsms/send', consentMessage);

        console.log(`[${sessionId}] Consent message Send API response:`, result);

        // API v1.0 문서 기준: resultCd "000" = 성공
        if (result.resultCd === '000') {
            session.status = 'consent_requested';
            session.consentImsId = result.imsId;
            session.consentReqDttm = result.imsReqDttm;
            session.updatedAt = new Date();
            sessions.set(sessionId, session);

            console.log(`[${sessionId}] Consent message sent - imsId: ${result.imsId}`);
        } else {
            // API v1.0 문서 결과코드: 100, 110, 120, 130, 200
            throw new Error(`Consent message send failed: ${result.resultCd} - ${result.resultMsg}`);
        }

    } catch (error) {
        console.error(`[${sessionId}] Send consent message error:`, error);
        const session = sessions.get(sessionId);
        session.status = 'error';
        session.error = '수신동의 메시지 발송 실패: ' + (error.response?.data?.resultMsg || error.message);
        sessions.set(sessionId, session);
        throw error;
    }
}

// 6. 데모 메시지 발송 - API v1.0 문서 기준
// POST /api/imsms/send
// Body: { sendTo, sendType, message, imsAgentId, ... }
// Response: { resultCd, resultMsg, imsId, imsReqDttm }
async function sendDemoMessage(sessionId, recipient) {
    try {
        console.log(`[${sessionId}] Sending demo message to ${recipient}`);

        const session = sessions.get(sessionId);
        const messageCallbackUrl = `${CALLBACK_BASE_URL}/api/callback/message`;

        // API v1.0 문서 기준 요청 본문
        const demoMessage = {
            sendTo: recipient,
            sendType: 'S', // 즉시 발송 (API v1.0에선 S만 가능)
            message: '🎉 IMSMS Demo Message\n\n' +
                     'Hello! This is TEAMPLAYER.\n\n' +
                     '✨ This is a premium message sent via iMessage.\n\n' +
                     '📱 Key Features of IMSMS:\n' +
                     '• Rich media support (images, videos, files)\n' +
                     '• Two-way communication\n' +
                     '• Real-time delivery confirmation\n' +
                     '• 90% cost savings vs SMS\n\n' +
                     '💼 Enterprise bulk messaging available.\n' +
                     'Learn more at https://imsms.im\n\n' +
                     'Thank you!',
            imsAgentId: IMSMS_CONFIG.agentId,
            callbackUrl: messageCallbackUrl // 메시지 발송 콜백 URL
        };

        console.log(`[${sessionId}] Message callback URL: ${messageCallbackUrl}`);

        // Send API 호출
        const result = await callIMSMSApi('/api/imsms/send', demoMessage);

        console.log(`[${sessionId}] Demo message Send API response:`, result);

        // API v1.0 문서 기준: resultCd "000" = 성공
        if (result.resultCd === '000') {
            session.status = 'demo_sent';
            session.demoImsId = result.imsId;
            session.demoReqDttm = result.imsReqDttm;
            session.updatedAt = new Date();
            sessions.set(sessionId, session);

            console.log(`[${sessionId}] Demo message sent successfully - imsId: ${result.imsId}`);
        } else {
            // API v1.0 문서 결과코드: 100, 110, 120, 130, 200
            throw new Error(`Demo message send failed: ${result.resultCd} - ${result.resultMsg}`);
        }

    } catch (error) {
        console.error(`[${sessionId}] Send demo message error:`, error);
        const session = sessions.get(sessionId);
        session.status = 'error';
        session.error = '메시지 발송 요청 실패: ' + (error.response?.data?.resultMsg || error.message);
        sessions.set(sessionId, session);
        throw error;
    }
}

// 5. 메시지 발송 완료 Callback (Send API의 실제 발송 완료 알림)
app.post('/api/callback/message', async (req, res) => {
    try {
        console.log('Message Callback received:', JSON.stringify(req.body, null, 2));

        const { imsId, phoneNumber, messageSent, messageDelivered } = req.body;

        // imsId로 세션 찾기
        let session = null;
        let sessionId = null;

        for (const [id, sess] of sessions.entries()) {
            if (sess.imsId === imsId) {
                session = sess;
                sessionId = id;
                break;
            }
        }

        if (!session) {
            console.warn('Session not found for imsId:', imsId);
            return res.status(404).json({ success: false, message: 'Session not found' });
        }

        console.log(`[${sessionId}] Message status - Sent: ${messageSent}, Delivered: ${messageDelivered}`);

        if (messageSent) {
            session.status = 'message_sent';
            session.messageSent = true;
            session.updatedAt = new Date();
            sessions.set(sessionId, session);

            console.log(`[${sessionId}] Demo message sent successfully`);

            // 완료 상태로 전환
            setTimeout(() => {
                session.status = 'completed';
                session.completedAt = new Date();
                sessions.set(sessionId, session);
                console.log(`[${sessionId}] Demo completed`);
            }, 1000);
        }

        res.json({ success: true });
    } catch (error) {
        console.error('Message callback error:', error);
        res.status(500).json({ success: false, message: 'Callback processing failed' });
    }
});

// 7. 상태 조회 API - 세션 상태 + API v1.0의 /api/imsms/info 활용
app.get('/api/demo/status/:sessionId', async (req, res) => {
    try {
        const { sessionId } = req.params;

        if (!sessions.has(sessionId)) {
            return res.status(404).json({
                success: false,
                message: '세션을 찾을 수 없습니다'
            });
        }

        const session = sessions.get(sessionId);

        // demo_sent 상태에서 메시지 전송 상태 확인 (API v1.0 문서 기준)
        // GET /api/imsms/info?imsId=xxx
        if (session.status === 'demo_sent' && session.demoImsId) {
            try {
                const infoResult = await callIMSMSApiGet('/api/imsms/info', {
                    imsId: session.demoImsId
                });

                console.log(`[${sessionId}] Info API response:`, infoResult);

                // API v1.0 문서 기준: imsData 객체에서 messageSent, messageDelivered 확인
                if (infoResult.resultCd === '000' && infoResult.imsData) {
                    session.messageInfo = infoResult.imsData;
                    if (infoResult.imsData.messageSent) {
                        session.messageSent = true;
                    }
                    if (infoResult.imsData.messageDelivered) {
                        session.messageDelivered = true;
                    }
                    sessions.set(sessionId, session);
                }
            } catch (error) {
                console.error(`[${sessionId}] Info API check failed:`, error.message);
            }
        }

        res.json({
            success: true,
            ...session
        });
    } catch (error) {
        console.error('Status check error:', error);
        res.status(500).json({
            success: false,
            message: '상태 조회에 실패했습니다'
        });
    }
});

// 6. MO (수신 문자) Callback 처리
app.post('/api/callback/mo', async (req, res) => {
    try {
        console.log('MO Callback received:', JSON.stringify(req.body, null, 2));

        const {
            imsAgentId,
            phoneNumber,
            message,
            receivedDttm,
            imsId
        } = req.body;

        // 수신 메시지 로그 저장
        const moLog = {
            imsAgentId,
            phoneNumber,
            message,
            receivedDttm,
            imsId,
            timestamp: new Date()
        };

        console.log(`[MO] Received message from ${phoneNumber}: "${message}"`);
        console.log(`[MO] imsAgentId: ${imsAgentId}`);
        console.log(`[MO] imsId: ${imsId}`);
        console.log(`[MO] receivedDttm: ${receivedDttm}`);

        // 메시지 내용에 따른 자동 응답 처리 (선택사항)
        if (message && message.toLowerCase().includes('help')) {
            console.log(`[MO] Help request detected, could send auto-reply`);
            // 필요시 자동 응답 로직 추가
        }

        // 성공 응답
        res.json({
            success: true,
            message: 'MO received successfully'
        });

    } catch (error) {
        console.error('MO callback error:', error);
        res.status(500).json({
            success: false,
            message: 'MO callback processing failed'
        });
    }
});

// 7. 세션 정리 (1시간 후)
setInterval(() => {
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

    for (const [sessionId, session] of sessions.entries()) {
        if (session.updatedAt < oneHourAgo) {
            sessions.delete(sessionId);
            console.log(`Session ${sessionId} cleaned up`);
        }
    }
}, 10 * 60 * 1000); // 10분마다 정리

// ============================================
// API 프록시 엔드포인트 (api-test.html용)
// ============================================

// 범용 IMSMS API 프록시
app.all('/api/proxy/*', async (req, res) => {
    try {
        const targetPath = req.params[0]; // /api/proxy/ 이후의 경로
        const targetUrl = `${IMSMS_CONFIG.baseUrl}/${targetPath}`;

        // 쿼리스트링 유지
        const queryString = Object.keys(req.query).length > 0
            ? '?' + new URLSearchParams(req.query).toString()
            : '';

        console.log(`[Proxy] ${req.method} ${targetUrl}${queryString}`);

        const config = {
            method: req.method,
            url: targetUrl + queryString,
            headers: {
                'Content-Type': 'application/json',
                'X-API-KEY': req.headers['x-api-key'] || IMSMS_CONFIG.apiKey
            }
        };

        // GET이 아닌 경우 body 추가
        if (req.method !== 'GET' && req.body) {
            config.data = req.body;
        }

        const response = await axios(config);
        res.json(response.data);
    } catch (error) {
        console.error('[Proxy] Error:', error.response?.data || error.message);
        res.status(error.response?.status || 500).json(
            error.response?.data || { error: error.message }
        );
    }
});

// Health check
app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        activeSessions: sessions.size,
        timestamp: new Date()
    });
});

// 서버 시작
app.listen(PORT, () => {
    console.log(`🚀 IMSMS Demo Server running on port ${PORT}`);
    console.log(`📍 Callback URL: ${CALLBACK_BASE_URL}`);
    console.log(`🔑 Agent ID: ${IMSMS_CONFIG.agentId}`);
});

module.exports = app;
