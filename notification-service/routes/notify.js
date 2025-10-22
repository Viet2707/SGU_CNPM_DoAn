const express = require('express');
const router = express.Router();
const { sendEmail } = require('../services/email');
const { sendSMS } = require('../services/sms');

// Email endpoint
router.post('/email', async (req, res) => {
  const { to, subject, text } = req.body;
  try {
    await sendEmail({ to, subject, text });
    res.send({ message: 'Email sent' });
  } catch (err) {
    console.error(err.message);
    res.status(500).send({ message: 'Email failed' });
  }
});

// SMS endpoint
router.post('/sms', async (req, res) => {
  const { to, message } = req.body;
  try {
    await sendSMS({ to, message });
    res.send({ message: 'SMS sent' });
  } catch (err) {
    console.error(err.message);
    res.status(500).send({ message: 'SMS failed' });
  }
});

module.exports = router;
