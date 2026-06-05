const { dbRun, dbGet, dbAll } = require('../database');

class PaymentProcessor {
  async processPayment(feePaymentId, paymentData) {
    throw new Error('processPayment must be implemented');
  }

  async verifyPayment(transactionId) {
    throw new Error('verifyPayment must be implemented');
  }

  async refundPayment(transactionId, amount) {
    throw new Error('refundPayment must be implemented');
  }
}

class StripeProcessor extends PaymentProcessor {
  constructor(apiKey) {
    super();
    try {
      const stripe = require('stripe');
      this.stripe = stripe(apiKey);
    } catch (error) {
      console.warn('Stripe not installed. Payment processing disabled.');
      this.stripe = null;
    }
  }

  async processPayment(schoolId, studentId, amount, description) {
    if (!this.stripe) {
      throw new Error('Stripe not configured');
    }

    try {
      const paymentIntent = await this.stripe.paymentIntents.create({
        amount: Math.round(amount * 100),
        currency: 'usd',
        description: description,
        metadata: {
          school_id: schoolId,
          student_id: studentId
        }
      });

      return {
        provider: 'stripe',
        transaction_id: paymentIntent.id,
        status: paymentIntent.status,
        client_secret: paymentIntent.client_secret,
        amount: amount
      };
    } catch (error) {
      throw new Error(`Stripe payment failed: ${error.message}`);
    }
  }

  async verifyPayment(transactionId) {
    if (!this.stripe) {
      throw new Error('Stripe not configured');
    }

    try {
      const paymentIntent = await this.stripe.paymentIntents.retrieve(transactionId);
      return {
        provider: 'stripe',
        transaction_id: paymentIntent.id,
        status: paymentIntent.status,
        amount: paymentIntent.amount / 100,
        currency: paymentIntent.currency,
        succeeded: paymentIntent.status === 'succeeded'
      };
    } catch (error) {
      throw new Error(`Stripe verification failed: ${error.message}`);
    }
  }

  async refundPayment(transactionId, amount) {
    if (!this.stripe) {
      throw new Error('Stripe not configured');
    }

    try {
      const refund = await this.stripe.refunds.create({
        payment_intent: transactionId,
        amount: amount ? Math.round(amount * 100) : undefined
      });

      return {
        provider: 'stripe',
        refund_id: refund.id,
        status: refund.status,
        amount: refund.amount / 100
      };
    } catch (error) {
      throw new Error(`Stripe refund failed: ${error.message}`);
    }
  }
}

class MPesaProcessor extends PaymentProcessor {
  constructor(consumerKey, consumerSecret, businessShortCode, passkey) {
    super();
    this.consumerKey = consumerKey;
    this.consumerSecret = consumerSecret;
    this.businessShortCode = businessShortCode;
    this.passkey = passkey;
    this.baseUrl = 'https://api.safaricom.co.ke';
    this.accessToken = null;
    this.tokenExpiry = null;
  }

  async getAccessToken() {
    if (this.accessToken && this.tokenExpiry > Date.now()) {
      return this.accessToken;
    }

    try {
      const https = require('https');
      const auth = Buffer.from(`${this.consumerKey}:${this.consumerSecret}`).toString('base64');

      const response = await new Promise((resolve, reject) => {
        const options = {
          hostname: 'api.safaricom.co.ke',
          port: 443,
          path: '/oauth/v1/generate?grant_type=client_credentials',
          method: 'GET',
          headers: {
            'Authorization': `Basic ${auth}`
          }
        };

        const req = https.request(options, (res) => {
          let data = '';
          res.on('data', chunk => data += chunk);
          res.on('end', () => {
            try {
              const parsed = JSON.parse(data);
              resolve(parsed);
            } catch (e) {
              reject(e);
            }
          });
        });

        req.on('error', reject);
        req.end();
      });

      this.accessToken = response.access_token;
      this.tokenExpiry = Date.now() + (response.expires_in * 1000);
      return this.accessToken;
    } catch (error) {
      throw new Error(`M-Pesa token generation failed: ${error.message}`);
    }
  }

  async initiateSTKPush(phoneNumber, amount, accountReference, description) {
    try {
      const token = await this.getAccessToken();
      const timestamp = new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14);
      const password = Buffer.from(
        this.businessShortCode + this.passkey + timestamp
      ).toString('base64');

      const https = require('https');
      const payload = {
        BusinessShortCode: this.businessShortCode,
        Password: password,
        Timestamp: timestamp,
        TransactionType: 'CustomerPayBillOnline',
        Amount: Math.round(amount),
        PartyA: phoneNumber,
        PartyB: this.businessShortCode,
        PhoneNumber: phoneNumber,
        CallBackURL: `${process.env.APP_URL || 'http://localhost:3001'}/api/payments/mpesa-callback`,
        AccountReference: accountReference,
        TransactionDesc: description
      };

      const response = await new Promise((resolve, reject) => {
        const options = {
          hostname: 'api.safaricom.co.ke',
          port: 443,
          path: '/mpesa/stkpush/v1/processrequest',
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        };

        const req = https.request(options, (res) => {
          let data = '';
          res.on('data', chunk => data += chunk);
          res.on('end', () => {
            try {
              const parsed = JSON.parse(data);
              resolve(parsed);
            } catch (e) {
              reject(e);
            }
          });
        });

        req.on('error', reject);
        req.write(JSON.stringify(payload));
        req.end();
      });

      return {
        provider: 'mpesa',
        merchant_request_id: response.MerchantRequestID,
        checkout_request_id: response.CheckoutRequestID,
        response_code: response.ResponseCode,
        response_description: response.ResponseDescription,
        amount: amount
      };
    } catch (error) {
      throw new Error(`M-Pesa STK push failed: ${error.message}`);
    }
  }

  async queryTransaction(checkoutRequestId) {
    try {
      const token = await this.getAccessToken();
      const timestamp = new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14);
      const password = Buffer.from(
        this.businessShortCode + this.passkey + timestamp
      ).toString('base64');

      const https = require('https');
      const payload = {
        BusinessShortCode: this.businessShortCode,
        Password: password,
        Timestamp: timestamp,
        CheckoutRequestID: checkoutRequestId
      };

      const response = await new Promise((resolve, reject) => {
        const options = {
          hostname: 'api.safaricom.co.ke',
          port: 443,
          path: '/mpesa/stkpushquery/v1/query',
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        };

        const req = https.request(options, (res) => {
          let data = '';
          res.on('data', chunk => data += chunk);
          res.on('end', () => {
            try {
              const parsed = JSON.parse(data);
              resolve(parsed);
            } catch (e) {
              reject(e);
            }
          });
        });

        req.on('error', reject);
        req.write(JSON.stringify(payload));
        req.end();
      });

      return {
        provider: 'mpesa',
        checkout_request_id: checkoutRequestId,
        result_code: response.ResultCode,
        result_description: response.ResultDesc,
        merchant_request_id: response.MerchantRequestID,
        response_code: response.ResponseCode,
        response_description: response.ResponseDescription
      };
    } catch (error) {
      throw new Error(`M-Pesa query failed: ${error.message}`);
    }
  }
}

class ManualPaymentProcessor extends PaymentProcessor {
  async recordManualPayment(schoolId, studentFeeId, amount, method, reference) {
    try {
      const result = await dbRun(
        `INSERT INTO fee_payments (student_fee_id, amount, payment_method, payment_date, reference_number, school_id, status)
         VALUES (?, ?, ?, NOW(), ?, ?, 'completed')
         RETURNING *`,
        [studentFeeId, amount, method, reference, schoolId]
      );

      await dbRun(
        `UPDATE student_fees 
         SET amount_paid = amount_paid + ?,
             payment_status = CASE 
               WHEN amount_paid + ? >= amount_due THEN 'paid'
               WHEN amount_paid + ? > 0 THEN 'partial'
               ELSE payment_status
             END
         WHERE id = ?`,
        [amount, amount, amount, studentFeeId]
      );

      return {
        provider: 'manual',
        payment_id: result.lastID,
        transaction_id: reference,
        status: 'completed',
        amount: amount,
        method: method
      };
    } catch (error) {
      throw new Error(`Manual payment recording failed: ${error.message}`);
    }
  }
}

function getPaymentProcessor(provider, config) {
  switch (provider.toLowerCase()) {
    case 'stripe':
      return new StripeProcessor(config.apiKey);
    case 'mpesa':
      return new MPesaProcessor(
        config.consumerKey,
        config.consumerSecret,
        config.businessShortCode,
        config.passkey
      );
    case 'manual':
      return new ManualPaymentProcessor();
    default:
      throw new Error(`Unknown payment provider: ${provider}`);
  }
}

module.exports = {
  PaymentProcessor,
  StripeProcessor,
  MPesaProcessor,
  ManualPaymentProcessor,
  getPaymentProcessor
};
