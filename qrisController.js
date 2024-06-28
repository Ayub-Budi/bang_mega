const axios = require("axios");
const moment = require("moment-timezone");
require('dotenv').config();

// Fungsi bantuan untuk memeriksa apakah timestamp valid (tidak lebih dari 15 menit yang lalu)
function isTimestampValid(req) {
  const now = moment().tz("Asia/Jakarta");
  const diffMinutes = now.diff(req.timestampCreated, "minutes");
  return diffMinutes <= 15;
}

async function signatureAuth(req) {
  if (!req.timestampCreated || !isTimestampValid(req)) {
    throw new Error("Timestamp tidak valid atau tidak tersedia");
  }

  const privateKey = process.env.PRIVATE_KEY;
  const clientKey = process.env.CLIENT_KEY;
  const url = `${process.env.BASE_URL}/api/v1.0/utilities/signature-auth`;

  const headers = {
    Private_Key: privateKey,
    "X-CLIENT-KEY": clientKey,
    "X-TIMESTAMP": moment(req.timestampCreated).format(), // Ubah sesuai format yang dibutuhkan oleh server
  };

  console.log("Mengirim permintaan signatureAuth dengan headers:", headers);

  try {
    const response = await axios.post(url, {}, { headers });
    return response.data.signature;
  } catch (error) {
    console.error("Error dalam permintaan signatureAuth:", error.message);
    throw new Error("Gagal mendapatkan signatureAuth");
  }
}

async function accessTokenB2B(req, signature) {
  if (!req.timestampCreated || !isTimestampValid(req)) {
    throw new Error("Timestamp tidak valid atau tidak tersedia");
  }

  const clientKey = process.env.CLIENT_KEY;
  const url = `${process.env.BASE_URL}/api/v1.0/access-token/b2b`;
  const headers = {
    "X-TIMESTAMP": moment(req.timestampCreated).format(), // Ubah sesuai format yang dibutuhkan oleh server
    "X-CLIENT-KEY": clientKey,
    "Content-Type": "application/json",
    Host: "snap.bankmega.app",
    "X-SIGNATURE": signature,
  };
  const data = {
    grantType: "client_credentials",
  };

  console.log("Mengirim permintaan accessTokenB2B dengan headers:", headers);

  try {
    const response = await axios.post(url, data, { headers });
    return response.data;
  } catch (error) {
    console.error("Error dalam permintaan accessTokenB2B:", error.message);
    throw new Error("Gagal mendapatkan accessTokenB2B");
  }
}

async function signatureService(req, accessToken) {
  if (!req.timestampCreated || !isTimestampValid(req)) {
    throw new Error("Timestamp tidak valid atau tidak tersedia");
  }

  const clientSecret = process.env.CLIENT_SECRET;
  const url = `${process.env.BASE_URL}/api/v1.0/utilities/signature-service`;
  const data = {
    partnerReferenceNo: req.body.idtransaksi,
    amount: { value: req.body.amount, currency: "IDR" },
    feeAmount: { value: "0", currency: "IDR" },
    merchantId: "00000016300",
    subMerchantId: "00000016300",
    storeId: req.body.storecode,
    terminalId: req.body.terminalId,
    validityPeriod: "2009-07-03T12:08:56-07:00",
    additionalInfo: { paymentType: req.body.paymentmedia },
  };
  const headers = {
    "X-TIMESTAMP": moment(req.timestampCreated).format(), // Ubah sesuai format yang dibutuhkan oleh server
    "X-CLIENT-SECRET": clientSecret,
    HttpMethod: "POST",
    EndPoinUrl: "/v1.0/qr/qr-mpm-generate",
    "Content-Type": "application/json",
    AccessToken: accessToken,
  };

  console.log("Mengirim permintaan signatureService dengan headers:", headers);

  try {
    const response = await axios.post(url, data, { headers });
    return response.data;
  } catch (error) {
    console.error("Error dalam permintaan signatureService:", error.message);
    throw new Error("Gagal mendapatkan signatureService");
  }
}

async function createQrisPayment(req, signatureServiceResponse, accessToken) {
  try {
    if (!req || !signatureServiceResponse || !accessToken) {
      throw new Error("Parameter input tidak valid");
    }

    if (!req.timestampCreated || !isTimestampValid(req)) {
      throw new Error("Timestamp tidak valid atau tidak tersedia");
    }

    const data = JSON.stringify({
      partnerReferenceNo: req.body.idtransaksi,
      amount: {
        value: req.body.amount,
        currency: "IDR",
      },
      feeAmount: {
        value: "0",
        currency: "IDR",
      },
      merchantId: "00000016300",
      subMerchantId: "00000016300",
      storeId: req.body.storecode,
      terminalId: req.body.terminalId,
      validityPeriod: "2009-07-03T12:08:56-07:00",
      additionalInfo: {
        paymentType: req.body.paymentmedia,
      },
    });

    const config = {
      method: "post",
      url: `${process.env.BASE_URL}/v1.0/qr/qr-mpm-generate`,
      headers: {
        "X-TIMESTAMP": moment(req.timestampCreated).format(), // Ubah sesuai format yang dibutuhkan oleh server
        "X-SIGNATURE": signatureServiceResponse.signature,
        "X-PARTNER-ID": process.env.PARTNER_ID,
        "X-EXTERNAL-ID": Math.floor(new Date() / 1000),
        "CHANNEL-ID": "95221",
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      data: data,
    };

    console.log("Mengirim permintaan createQrisPayment dengan headers:", config.headers);

    const response = await axios.request(config);
    console.log("Respon dari createQrisPayment:", response.data);
    return response.data;
  } catch (error) {
    console.error("Error dalam permintaan createQrisPayment:", error.message);
    throw new Error(`Gagal membuat pembayaran QRIS: ${error.message}`);
  }
}

module.exports = {
  signatureAuth,
  accessTokenB2B,
  signatureService,
  createQrisPayment,
};
