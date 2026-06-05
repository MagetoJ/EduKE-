const express = require('express');
const paymentRouter = express.Router();
const { dbRun, dbGet, dbAll } = require('../database');
const { authorizeRole, requireFeature } = require('../middleware/auth');
const { getPaymentProcessor } = require('../services/paymentService');

paymentRouter.get(
  '/fees/student/:studentId',
  authorizeRole(['admin', 'parent', 'student', 'super_admin', 'registrar']),
  requireFeature('finance'),
  async (req, res) => {
    try {
      const { studentId } = req.params;
      const { schoolId } = req;

      const fees = await dbAll(
        `SELECT sf.*, fs.fee_type, fs.description
         FROM student_fees sf
         JOIN fee_structures fs ON sf.fee_structure_id = fs.id
         WHERE sf.student_id = ? AND sf.school_id = ?
         ORDER BY sf.due_date DESC`,
        [studentId, schoolId]
      );

      const payments = await dbAll(
        `SELECT fp.* FROM fee_payments fp
         JOIN student_fees sf ON fp.student_fee_id = sf.id
         WHERE sf.student_id = ? AND sf.school_id = ?
         ORDER BY fp.payment_date DESC`,
        [studentId, schoolId]
      );

      res.json({
        success: true,
        data: {
          fees: fees || [],
          payments: payments || [],
          summary: {
            total_due: fees?.reduce((sum, f) => sum + parseFloat(f.amount_due || 0), 0) || 0,
            total_paid: fees?.reduce((sum, f) => sum + parseFloat(f.amount_paid || 0), 0) || 0,
            outstanding: fees?.reduce((sum, f) => sum + (parseFloat(f.amount_due || 0) - parseFloat(f.amount_paid || 0)), 0) || 0
          }
        }
      });
    } catch (error) {
      console.error('Error fetching student fees:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }
);

paymentRouter.get(
  '/summary',
  authorizeRole(['admin', 'super_admin', 'registrar']),
  requireFeature('finance'),
  async (req, res) => {
    try {
      const { schoolId } = req;

      const summary = await dbGet(
        `SELECT 
           COUNT(DISTINCT sf.student_id) as total_students,
           SUM(CASE WHEN sf.payment_status = 'paid' THEN sf.amount_due ELSE 0 END) as collected,
           SUM(CASE WHEN sf.payment_status IN ('pending', 'overdue') THEN sf.amount_due ELSE 0 END) as outstanding,
           SUM(sf.amount_due) as total_invoiced,
           COUNT(CASE WHEN sf.payment_status = 'overdue' THEN 1 END) as overdue_count
         FROM student_fees sf
         WHERE sf.school_id = ?`,
        [schoolId]
      );

      const byStatus = await dbAll(
        `SELECT 
           payment_status, 
           COUNT(*) as count,
           SUM(amount_due) as total_amount
         FROM student_fees
         WHERE school_id = ?
         GROUP BY payment_status`,
        [schoolId]
      );

      res.json({
        success: true,
        data: {
          summary: summary || {},
          by_status: byStatus || []
        }
      });
    } catch (error) {
      console.error('Error fetching payment summary:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }
);

paymentRouter.post(
  '/initiate',
  authorizeRole(['admin', 'student', 'parent', 'super_admin', 'registrar']),
  requireFeature('finance'),
  async (req, res) => {
    try {
      const { schoolId, user } = req;
      const { student_fee_id, provider } = req.body;

      const fee = await dbGet(
        `SELECT sf.*, s.id as student_id, u.phone
         FROM student_fees sf
         JOIN students s ON sf.student_id = s.id
         LEFT JOIN users u ON s.parent_id = u.id
         WHERE sf.id = ? AND sf.school_id = ?`,
        [student_fee_id, schoolId]
      );

      if (!fee) {
        return res.status(404).json({ error: 'Fee not found' });
      }

      if (fee.payment_status === 'paid') {
        return res.status(400).json({ error: 'Fee already paid' });
      }

      const remainingAmount = parseFloat(fee.amount_due) - parseFloat(fee.amount_paid || 0);

      let paymentData;

      if (provider === 'mpesa') {
        const processor = getPaymentProcessor('mpesa', {
          consumerKey: process.env.MPESA_CONSUMER_KEY,
          consumerSecret: process.env.MPESA_CONSUMER_SECRET,
          businessShortCode: process.env.MPESA_SHORTCODE,
          passkey: process.env.MPESA_PASSKEY
        });

        const phone = user.phone || u?.phone;
        if (!phone) {
          return res.status(400).json({ error: 'Phone number required for M-Pesa' });
        }

        paymentData = await processor.initiateSTKPush(
          phone,
          remainingAmount,
          `FEE-${fee.id}`,
          `School fee payment`
        );

        await dbRun(
          `INSERT INTO payment_transactions (school_id, student_fee_id, provider, transaction_id, status, amount, created_at)
           VALUES (?, ?, ?, ?, ?, ?, NOW())`,
          [schoolId, student_fee_id, 'mpesa', paymentData.checkout_request_id, 'initiated', remainingAmount]
        );
      } else if (provider === 'stripe') {
        const processor = getPaymentProcessor('stripe', {
          apiKey: process.env.STRIPE_SECRET_KEY
        });

        paymentData = await processor.processPayment(
          schoolId,
          fee.student_id,
          remainingAmount,
          `School fee for student ${fee.student_id}`
        );

        await dbRun(
          `INSERT INTO payment_transactions (school_id, student_fee_id, provider, transaction_id, status, amount, created_at)
           VALUES (?, ?, ?, ?, ?, ?, NOW())`,
          [schoolId, student_fee_id, 'stripe', paymentData.transaction_id, paymentData.status, remainingAmount]
        );
      } else {
        return res.status(400).json({ error: 'Invalid payment provider' });
      }

      res.json({
        success: true,
        data: paymentData
      });
    } catch (error) {
      console.error('Error initiating payment:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }
);

paymentRouter.post(
  '/record-manual',
  authorizeRole(['admin', 'super_admin', 'registrar']),
  requireFeature('finance'),
  async (req, res) => {
    try {
      const { schoolId } = req;
      const { student_fee_id, amount, method, reference } = req.body;

      if (!student_fee_id || !amount || !method) {
        return res.status(400).json({
          error: 'Missing required fields: student_fee_id, amount, method'
        });
      }

      const fee = await dbGet(
        'SELECT * FROM student_fees WHERE id = ? AND school_id = ?',
        [student_fee_id, schoolId]
      );

      if (!fee) {
        return res.status(404).json({ error: 'Fee not found' });
      }

      const processor = getPaymentProcessor('manual', {});
      const result = await processor.recordManualPayment(
        schoolId,
        student_fee_id,
        amount,
        method,
        reference || `MANUAL-${Date.now()}`
      );

      await dbRun(
        `INSERT INTO activity_logs (school_id, user_id, action, entity_type, entity_id, description, created_at)
         VALUES (?, ?, ?, ?, ?, ?, NOW())`,
        [schoolId, req.user?.id || null, 'payment_recorded', 'fee_payment', result.payment_id, `Manual payment of ${amount} recorded`]
      );

      res.json({
        success: true,
        message: 'Payment recorded successfully',
        data: result
      });
    } catch (error) {
      console.error('Error recording manual payment:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }
);

paymentRouter.post(
  '/mpesa-callback',
  async (req, res) => {
    try {
      const callbackData = req.body.Body.stkCallback;
      const { CheckoutRequestID, ResultCode, ResultDesc, CallbackMetadata } = callbackData;

      const transaction = await dbGet(
        'SELECT * FROM payment_transactions WHERE transaction_id = ?',
        [CheckoutRequestID]
      );

      if (!transaction) {
        return res.json({ ResultCode: 1, ResultDesc: 'Transaction not found' });
      }

      if (ResultCode === 0) {
        const amount = CallbackMetadata?.Item?.find(i => i.Name === 'Amount')?.Value || transaction.amount;

        await dbRun(
          `INSERT INTO fee_payments (student_fee_id, amount, payment_method, payment_date, reference_number, status)
           VALUES (?, ?, ?, NOW(), ?, 'completed')`,
          [transaction.student_fee_id, amount, 'mpesa', CheckoutRequestID]
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
          [amount, amount, amount, transaction.student_fee_id]
        );

        await dbRun(
          `UPDATE payment_transactions SET status = 'completed' WHERE id = ?`,
          [transaction.id]
        );
      } else {
        await dbRun(
          `UPDATE payment_transactions SET status = 'failed' WHERE id = ?`,
          [transaction.id]
        );
      }

      res.json({ ResultCode: 0, ResultDesc: 'Callback received' });
    } catch (error) {
      console.error('Error processing M-Pesa callback:', error);
      res.json({ ResultCode: 1, ResultDesc: 'Error processing callback' });
    }
  }
);

paymentRouter.get(
  '/transactions/:studentFeeId',
  authorizeRole(['admin', 'parent', 'super_admin', 'registrar']),
  requireFeature('finance'),
  async (req, res) => {
    try {
      const { studentFeeId } = req.params;
      const { schoolId } = req;

      const transactions = await dbAll(
        `SELECT * FROM fee_payments WHERE student_fee_id = ? AND school_id = ?
         ORDER BY payment_date DESC`,
        [studentFeeId, schoolId]
      );

      res.json({
        success: true,
        data: transactions || []
      });
    } catch (error) {
      console.error('Error fetching transactions:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }
);

module.exports = paymentRouter;
