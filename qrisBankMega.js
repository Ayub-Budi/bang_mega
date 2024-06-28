const express = require("express");
const bodyParser = require("body-parser");
const qrisController = require("./qrisController");
require('dotenv').config();

const app = express();
const port = process.env.PORT || 3000;

app.use(bodyParser.json());

// Middleware untuk menetapkan req.timestampCreated
app.use((req, res, next) => {
  req.timestampCreated = new Date(); // Atur timestamp saat permintaan diterima
  next();
});

app.post("/api/signatureQris", async (req, res) => {
  try {
    const signature = await qrisController.signatureAuth(req);
    console.log("LANGKAH 1 - Menerima signatureAuth:", signature);

    const accessTokenResponse = await qrisController.accessTokenB2B(req, signature);
    const accessToken = accessTokenResponse.accessToken;
    console.log("LANGKAH 2 - Menerima accessTokenB2B:", accessToken);

    const signatureServiceResponse = await qrisController.signatureService(req, accessToken);
    console.log("LANGKAH 3 - Menerima signatureService:", signatureServiceResponse);

    const qrisPaymentResponse = await qrisController.createQrisPayment(req, signatureServiceResponse, accessToken);
    console.log("LANGKAH 4 - Menerima createQrisPayment:", qrisPaymentResponse);

    res.json({
      signatureAuth: signature,
      accessTokenResponse: accessTokenResponse,
      signatureServiceResponse: signatureServiceResponse,
      qrisPaymentResponse: qrisPaymentResponse,
    });
  } catch (error) {
    console.error("Error:", error.message);
    res.status(500).json({ error: error.message });
  }
});

app.listen(port, () => {
  console.log(`Server berjalan di http://localhost:${port}`);
});
