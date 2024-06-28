const express = require('express');
const axios = require('axios');
const moment = require('moment-timezone');
const bodyParser = require('body-parser');

const app = express();
const port = 3000;

app.use(bodyParser.json());

const BASE_URL = "https://snap.bankmega.app/api/v1.0";

// Middleware to generate and store a timestamp and its creation time for each request
app.use((req, res, next) => {
    req.timestamp = moment().tz('Asia/Jakarta').format('YYYY-MM-DDTHH:mm:ssZ');
    req.timestampCreated = moment().tz('Asia/Jakarta');
    next();
});

// Helper function to check if the timestamp is valid (not older than 15 minutes)
function isTimestampValid(req) {
    const now = moment().tz('Asia/Jakarta');
    const diffMinutes = now.diff(req.timestampCreated, 'minutes');
    return diffMinutes <= 15;
}

async function signatureAuth(req) {
    if (!isTimestampValid(req)) {
        throw new Error('Timestamp is too old');
    }

    const privateKey = 'MIIBUwIBADANBgkqhkiG9w0BAQEFAASCAT0wggE5AgEAAkEAkXpupfVhW/Dh3OrHpgrFadvwx4aej9tqPPUWkLj2VtVmpvPxjHhhOOF9FwlAPDb2WoVklnQcbmAGuHI48SOUQwIDAQABAkBG2HxFBsQEfcDIkG9svYcY/9p4mGbkgMJycBqunNyeOSxolyiHT/PlhR43V8kepbF8mqpReuWPQd6Zd1S1ypcRAiEA50qZJhSa+C4p6u0fmNbiQUNbOeBcq67TAi69X0iGUvECIQChBP/cmgkHH57CcYq2I6iyM1JkyJIVfnm/fCGTb61ycwIgX2Wma01+abTotywcpzaiVZbJjsKalnliMPlERIOuW5ECIEjMd9mHEtnTo/WJXAtpJ9YZegDy5YkuO2ElgBCmhyadAiBCQXF3rvkgsJJrqV9oO4t2o5oZVQCCC1+BZHfALIeFlg==';
    const clientKey = 'c4032e30-9b0a-4c9c-ab1c-946b99d2e135';
    const url = `${BASE_URL}/utilities/signature-auth`;
    const headers = {
        'Private_Key': privateKey,
        'X-CLIENT-KEY': clientKey,
        'X-TIMESTAMP': req.timestamp
    };

    console.log('Requesting signatureAuth with headers:', headers);

    try {
        const response = await axios.post(url, {}, { headers });
        return response.data.signature;
    } catch (error) {
        console.error('Error in signatureAuth request:', error.message);
        throw new Error('Failed to get signatureAuth');
    }
}

async function accessTokenB2B(req, signature) {
    if (!isTimestampValid(req)) {
        throw new Error('Timestamp is too old');
    }

    const clientKey = 'c4032e30-9b0a-4c9c-ab1c-946b99d2e135';
    const url = `${BASE_URL}/access-token/b2b`;
    const headers = {
        'X-TIMESTAMP': req.timestamp,
        'X-CLIENT-KEY': clientKey,
        'Content-Type': 'application/json',
        'Host': 'snap.bankmega.app',
        'X-SIGNATURE': signature
    };
    const data = {
        grantType: "client_credentials"
    };

    console.log('Requesting accessTokenB2B with headers:', headers);

    try {
        const response = await axios.post(url, data, { headers });
        return response.data;
    } catch (error) {
        console.error('Error in accessTokenB2B request:', error.message);
        throw new Error('Failed to get accessTokenB2B');
    }
}

async function signatureService(req, accessToken) {
    if (!isTimestampValid(req)) {
        throw new Error('Timestamp is too old');
    }

    const clientSecret = 'UhusIzp3WMFYB6bHeiWb7UfzLNGIPC7y';
    const url = `${BASE_URL}/utilities/signature-service`;
    const data = {
        partnerReferenceNo: "202207210000000000000461",
        amount: { value: "50000.00", currency: "IDR" },
        feeAmount: { value: "1000.00", currency: "IDR" },
        merchantId: "00000016300",
        subMerchantId: "00000016300",
        storeId: "",
        terminalId: "00000088",
        validityPeriod: "2009-07-03T12:08:56-07:00",
        additionalInfo: { paymentType: "042600" }
    };
    const headers = {
        'X-TIMESTAMP': req.timestamp,
        'X-CLIENT-SECRET': clientSecret,
        'HttpMethod': 'POST',
        'EndPoinUrl': '/v1.0/qr/qr-mpm-generate',
        'Content-Type': 'application/json',
        'AccessToken': accessToken
    };

    console.log('Requesting signatureService with headers:', headers);

    try {
        const response = await axios.post(url, data, { headers });
        return response.data;
    } catch (error) {
        console.error('Error in signatureService request:', error.message);
        throw new Error('Failed to get signatureService');
    }
}

app.post('/api/signatureQris', async (req, res) => {
    try {
        const signature = await signatureAuth(req);
        console.log('Received signatureAuth:', signature);

        const accessTokenResponse = await accessTokenB2B(req, signature);
        const accessToken = accessTokenResponse.accessToken;
        console.log('Received accessTokenB2B:', accessToken);

        const signatureServiceResponse = await signatureService(req, accessToken);
        console.log('Received signatureService:', signatureServiceResponse);

        res.json({
            signatureAuth: signature,
            accessTokenResponse: accessTokenResponse,
            signatureServiceResponse: signatureServiceResponse
        });
    } catch (error) {
        console.error('Error:', error.message);
        res.status(500).json({ error: error.message });
    }
});

app.listen(port, () => {
    console.log(`Server berjalan di http://localhost:${port}`);
});
