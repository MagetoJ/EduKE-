const express = require('express');
const router = express.Router();
const { authorizeRole } = require('../middleware/auth');
const { query, transaction } = require('../db/connection');
const ExcelJS = require('exceljs');

// ===================
// CBC ASSESSMENTS
// ===================

router.get('/cbc/strands', authorizeRole(['admin', 'teacher']), async (req, res) => {
  try {
    const result = await query(
      `SELECT * FROM cbc_strands WHERE school_id = $1 ORDER BY name`,
      [req.schoolId]
    );
    res.json({ success: true, data: result.rows });
  } catch (err) {
    console.error('Error fetching strands:', err);
    res.status(500).json({ success: false, error: 'Failed to fetch strands' });
  }
});

router.post('/cbc/strands', authorizeRole(['admin']), async (req, res) => {
  try {
    const { name, code, description, grade_level } = req.body;

    if (!name || !code) {
      return res.status(400).json({ success: false, error: 'Name and code are required' });
    }

    const result = await query(
      `INSERT INTO cbc_strands (school_id, name, code, description, grade_level)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [req.schoolId, name, code, description, grade_level]
    );

    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ success: false, error: 'Strand code already exists' });
    }
    console.error('Error creating strand:', err);
    res.status(500).json({ success: false, error: 'Failed to create strand' });
  }
});

router.put('/cbc/strands/:id', authorizeRole(['admin']), async (req, res) => {
  try {
    const { name, code, description, grade_level } = req.body;

    const result = await query(
      `UPDATE cbc_strands 
       SET name = COALESCE($1, name), 
           code = COALESCE($2, code), 
           description = COALESCE($3, description),
           grade_level = COALESCE($4, grade_level)
       WHERE id = $5 AND school_id = $6
       RETURNING *`,
      [name, code, description, grade_level, req.params.id, req.schoolId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Strand not found' });
    }

    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ success: false, error: 'Strand code already exists' });
    }
    console.error('Error updating strand:', err);
    res.status(500).json({ success: false, error: 'Failed to update strand' });
  }
});

router.delete('/cbc/strands/:id', authorizeRole(['admin']), async (req, res) => {
  try {
    const result = await query(
      `DELETE FROM cbc_strands 
       WHERE id = $1 AND school_id = $2
       RETURNING id`,
      [req.params.id, req.schoolId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Strand not found' });
    }

    res.json({ success: true, message: 'Strand deleted successfully' });
  } catch (err) {
    console.error('Error deleting strand:', err);
    res.status(500).json({ success: false, error: 'Failed to delete strand' });
  }
});

router.post('/cbc/assessments', authorizeRole(['teacher']), async (req, res) => {
  try {
    const { student_id, strand_id, assessment_type, grade, comments } = req.body;

    if (!grade || grade < 1 || grade > 4) {
      return res.status(400).json({ success: false, error: 'Grade must be 1-4 (BE, AE, ME, EE)' });
    }

    const result = await query(
      `INSERT INTO cbc_assessments (school_id, student_id, strand_id, assessment_type, grade, comments, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [req.schoolId, student_id, strand_id, assessment_type, grade, comments, req.user.id]
    );

    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error('Error creating assessment:', err);
    res.status(500).json({ success: false, error: 'Failed to create assessment' });
  }
});

router.get('/cbc/assessments/:student_id', authorizeRole(['teacher', 'admin', 'parent']), async (req, res) => {
  try {
    const result = await query(
      `SELECT ca.*, cs.name as strand_name, cs.code as strand_code, st.first_name, st.last_name
       FROM cbc_assessments ca
       JOIN cbc_strands cs ON ca.strand_id = cs.id
       JOIN students st ON ca.student_id = st.id
       WHERE ca.school_id = $1 AND ca.student_id = $2
       ORDER BY ca.created_at DESC`,
      [req.schoolId, req.params.student_id]
    );

    res.json({ success: true, data: result.rows });
  } catch (err) {
    console.error('Error fetching assessments:', err);
    res.status(500).json({ success: false, error: 'Failed to fetch assessments' });
  }
});

router.get('/cbc/portfolio/:student_id', authorizeRole(['teacher', 'admin']), async (req, res) => {
  try {
    const result = await query(
      `SELECT * FROM cbc_learner_portfolios 
       WHERE school_id = $1 AND student_id = $2`,
      [req.schoolId, req.params.student_id]
    );

    res.json({ success: true, data: result.rows });
  } catch (err) {
    console.error('Error fetching portfolio:', err);
    res.status(500).json({ success: false, error: 'Failed to fetch portfolio' });
  }
});

router.post('/cbc/portfolio', authorizeRole(['teacher', 'admin']), async (req, res) => {
  try {
    const { student_id, artifact_type, artifact_title, artifact_url, comments } = req.body;

    if (!student_id || !artifact_type || !artifact_title) {
      return res.status(400).json({ success: false, error: 'Student ID, artifact type, and title are required' });
    }

    const result = await query(
      `INSERT INTO cbc_learner_portfolios (school_id, student_id, artifact_type, artifact_title, artifact_url, comments, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [req.schoolId, student_id, artifact_type, artifact_title, artifact_url, comments, req.user.id]
    );

    res.status(201).json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error('Error creating portfolio artifact:', err);
    res.status(500).json({ success: false, error: 'Failed to create portfolio artifact' });
  }
});

router.delete('/cbc/portfolio/:id', authorizeRole(['teacher', 'admin']), async (req, res) => {
  try {
    const result = await query(
      `DELETE FROM cbc_learner_portfolios 
       WHERE id = $1 AND school_id = $2
       RETURNING id`,
      [req.params.id, req.schoolId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Portfolio artifact not found' });
    }

    res.json({ success: true, message: 'Portfolio artifact deleted successfully' });
  } catch (err) {
    console.error('Error deleting portfolio artifact:', err);
    res.status(500).json({ success: false, error: 'Failed to delete portfolio artifact' });
  }
});

// ===================
// NEMIS & KNEC
// ===================

router.post('/nemis/register-student', authorizeRole(['admin']), async (req, res) => {
  try {
    const { student_id, upi, birth_certificate_no } = req.body;

    const result = await query(
      `INSERT INTO nemis_student_registration (school_id, student_id, upi, birth_certificate_no, registration_status)
       VALUES ($1, $2, $3, $4, 'registered')
       ON CONFLICT (school_id, student_id) DO UPDATE
       SET upi = $3, birth_certificate_no = $4, updated_at = NOW()
       RETURNING *`,
      [req.schoolId, student_id, upi, birth_certificate_no]
    );

    res.json({ success: true, data: result.rows[0], message: 'Student registered with NEMIS' });
  } catch (err) {
    console.error('Error registering with NEMIS:', err);
    res.status(500).json({ success: false, error: 'Failed to register with NEMIS' });
  }
});

router.post('/knec/register-candidate', authorizeRole(['admin']), async (req, res) => {
  try {
    const { student_id, exam_type, subjects } = req.body;

    const result = await query(
      `INSERT INTO knec_candidate_registration (school_id, student_id, exam_type, subjects, status)
       VALUES ($1, $2, $3, $4, 'pending')
       RETURNING *`,
      [req.schoolId, student_id, exam_type, JSON.stringify(subjects)]
    );

    res.json({ success: true, data: result.rows[0], message: 'Candidate registered with KNEC' });
  } catch (err) {
    console.error('Error registering with KNEC:', err);
    res.status(500).json({ success: false, error: 'Failed to register with KNEC' });
  }
});

router.get('/knec/registrations', authorizeRole(['admin']), async (req, res) => {
  try {
    const result = await query(
      `SELECT kr.*, st.first_name, st.last_name, st.student_id_number
       FROM knec_candidate_registration kr
       JOIN students st ON kr.student_id = st.id
       WHERE kr.school_id = $1
       ORDER BY st.first_name, st.last_name`,
      [req.schoolId]
    );

    res.json({ success: true, data: result.rows });
  } catch (err) {
    console.error('Error fetching KNEC registrations:', err);
    res.status(500).json({ success: false, error: 'Failed to fetch registrations' });
  }
});

router.delete('/knec/registrations/:id', authorizeRole(['admin']), async (req, res) => {
  try {
    const result = await query(
      `DELETE FROM knec_candidate_registration 
       WHERE id = $1 AND school_id = $2
       RETURNING id`,
      [req.params.id, req.schoolId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Registration not found' });
    }

    res.json({ success: true, message: 'Registration deleted successfully' });
  } catch (err) {
    console.error('Error deleting registration:', err);
    res.status(500).json({ success: false, error: 'Failed to delete registration' });
  }
});

router.get('/nemis/registrations', authorizeRole(['super_admin', 'admin']), async (req, res) => {
  try {
    const result = await query(
      `SELECT sr.*, st.first_name, st.last_name, st.gender, st.date_of_birth, st.student_id_number
       FROM nemis_student_registration sr
       JOIN students st ON sr.student_id = st.id
       WHERE sr.school_id = $1
       ORDER BY st.first_name, st.last_name`,
      [req.schoolId]
    );

    res.json({ success: true, data: result.rows });
  } catch (err) {
    console.error('Error fetching NEMIS registrations:', err);
    res.status(500).json({ success: false, error: 'Failed to fetch NEMIS registrations' });
  }
});

router.get('/nemis/export', authorizeRole(['super_admin', 'admin']), async (req, res) => {
  try {
    const result = await query(
      `SELECT sr.*, st.first_name, st.last_name, st.gender, st.date_of_birth, st.student_id_number
       FROM nemis_student_registration sr
       JOIN students st ON sr.student_id = st.id
       WHERE sr.school_id = $1
       ORDER BY st.first_name, st.last_name`,
      [req.schoolId]
    );

    if (result.rows.length === 0) {
      return res.status(400).json({ success: false, error: 'No NEMIS registrations found' });
    }

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('NEMIS Registration');

    worksheet.columns = [
      { header: 'Student ID', key: 'student_id_number', width: 15 },
      { header: 'First Name', key: 'first_name', width: 20 },
      { header: 'Last Name', key: 'last_name', width: 20 },
      { header: 'Gender', key: 'gender', width: 10 },
      { header: 'Date of Birth', key: 'date_of_birth', width: 15 },
      { header: 'UPI', key: 'upi', width: 20 },
      { header: 'Birth Certificate', key: 'birth_certificate_no', width: 20 },
      { header: 'Registration Status', key: 'registration_status', width: 15 }
    ];

    worksheet.addRows(result.rows);

    worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    worksheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF366092' } };

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=nemis-export.xlsx');

    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error('Error exporting NEMIS data:', err);
    res.status(500).json({ success: false, error: 'Failed to export NEMIS data' });
  }
});

// ===================
// M-PESA INTEGRATION
// ===================

router.post('/mpesa/transaction', authorizeRole(['admin']), async (req, res) => {
  try {
    const { student_id, amount, mpesa_code, phone_number, transaction_type } = req.body;

    const result = await query(
      `INSERT INTO mpesa_transactions (school_id, student_id, amount, mpesa_code, phone_number, transaction_type, status)
       VALUES ($1, $2, $3, $4, $5, $6, 'pending')
       RETURNING *`,
      [req.schoolId, student_id, amount, mpesa_code, phone_number, transaction_type]
    );

    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error('Error recording M-Pesa transaction:', err);
    res.status(500).json({ success: false, error: 'Failed to record transaction' });
  }
});

router.post('/mpesa/stk-push', authorizeRole(['admin', 'staff']), async (req, res) => {
  try {
    const { student_id, phone_number, amount } = req.body;

    if (!student_id || !phone_number || !amount) {
      return res.status(400).json({ success: false, error: 'Missing required fields' });
    }

    const cleanPhone = phone_number.replace(/\D/g, '');
    const formattedPhone = cleanPhone.startsWith('254') ? cleanPhone : '254' + cleanPhone.slice(-9);

    const accessToken = process.env.MPESA_ACCESS_TOKEN;
    const businessShortCode = process.env.MPESA_SHORTCODE;
    const passkey = process.env.MPESA_PASSKEY;

    if (!accessToken || !businessShortCode || !passkey) {
      return res.status(500).json({ success: false, error: 'M-Pesa credentials not configured' });
    }

    const timestamp = new Date().toISOString().replace(/[^0-9]/g, '').slice(0, 14);
    const password = Buffer.from(businessShortCode + passkey + timestamp).toString('base64');

    const callbackUrl = `${process.env.BASE_URL || 'http://localhost:3000'}/api/kenya-features/mpesa/webhook`;

    const payload = {
      BusinessShortCode: businessShortCode,
      Password: password,
      Timestamp: timestamp,
      TransactionType: 'CustomerPayBillOnline',
      Amount: Math.ceil(amount),
      PartyA: formattedPhone,
      PartyB: businessShortCode,
      PhoneNumber: formattedPhone,
      CallBackURL: callbackUrl,
      AccountReference: `FEES-${student_id}`,
      TransactionDesc: 'School fees payment'
    };

    const response = await fetch('https://api.safaricom.co.ke/mpesa/stkpush/v1/processrequest', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();

    if (data.ResponseCode === '0') {
      const checkoutRequestId = data.CheckoutRequestID;

      await query(
        `INSERT INTO mpesa_transactions (school_id, student_id, amount, phone_number, transaction_type, status)
         VALUES ($1, $2, $3, $4, 'stk_push', 'pending')`,
        [req.schoolId, student_id, amount, phone_number]
      );

      res.json({
        success: true,
        data: {
          checkoutRequestId,
          responseCode: data.ResponseCode,
          responseDescription: data.ResponseDescription
        }
      });
    } else {
      res.status(400).json({
        success: false,
        error: data.errorMessage || 'STK Push request failed'
      });
    }
  } catch (err) {
    console.error('Error initiating STK Push:', err);
    res.status(500).json({ success: false, error: 'Failed to initiate payment' });
  }
});

router.post('/mpesa/webhook', async (req, res) => {
  try {
    const { Body } = req.body;
    const result = Body.stkCallback.ResultCode;

    if (result === 0) {
      const metadata = Body.stkCallback.CallbackMetadata.ItemList;
      const amount = metadata[0].Value;
      const mpesa_code = metadata[1].Value;
      const phone = metadata[2].Value;

      const transaction = await query(
        `UPDATE mpesa_transactions 
         SET status = 'completed', verified_at = NOW()
         WHERE mpesa_code = $1
         RETURNING *`,
        [mpesa_code]
      );

      if (transaction.rows.length > 0) {
        const t = transaction.rows[0];
        await query(
          `UPDATE student_fees SET amount_paid = amount_paid + $1 WHERE student_id = $2`,
          [amount, t.student_id]
        );
      }
    }

    res.json({ success: true });
  } catch (err) {
    console.error('Error processing M-Pesa webhook:', err);
    res.status(500).json({ success: false });
  }
});

router.get('/mpesa/transactions', authorizeRole(['admin']), async (req, res) => {
  try {
    const result = await query(
      `SELECT mt.*, st.first_name, st.last_name, st.student_id_number
       FROM mpesa_transactions mt
       JOIN students st ON mt.student_id = st.id
       WHERE mt.school_id = $1
       ORDER BY mt.created_at DESC`,
      [req.schoolId]
    );

    res.json({ success: true, data: result.rows });
  } catch (err) {
    console.error('Error fetching M-Pesa transactions:', err);
    res.status(500).json({ success: false, error: 'Failed to fetch transactions' });
  }
});

// ===================
// BOARDING MANAGEMENT
// ===================

router.post('/boarding/assign-dormitory', authorizeRole(['admin']), async (req, res) => {
  try {
    const { student_id, dormitory_id, bed_number } = req.body;

    const result = await query(
      `INSERT INTO boarding_assignments (school_id, student_id, dormitory_id, bed_number, assignment_status)
       VALUES ($1, $2, $3, $4, 'active')
       ON CONFLICT (school_id, student_id) DO UPDATE
       SET dormitory_id = $3, bed_number = $4, assignment_status = 'active', updated_at = NOW()
       RETURNING *`,
      [req.schoolId, student_id, dormitory_id, bed_number]
    );

    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error('Error assigning dormitory:', err);
    res.status(500).json({ success: false, error: 'Failed to assign dormitory' });
  }
});

router.post('/boarding/exeat-request', authorizeRole(['student']), async (req, res) => {
  try {
    const { student_id, start_date, end_date, reason } = req.body;

    const result = await query(
      `INSERT INTO boarding_exeat_requests (school_id, student_id, start_date, end_date, reason, status)
       VALUES ($1, $2, $3, $4, $5, 'pending')
       RETURNING *`,
      [req.schoolId, student_id, start_date, end_date, reason]
    );

    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error('Error creating exeat request:', err);
    res.status(500).json({ success: false, error: 'Failed to create exeat request' });
  }
});

router.put('/boarding/exeat-request/:id', authorizeRole(['admin']), async (req, res) => {
  try {
    const { status, approval_notes } = req.body;

    const result = await query(
      `UPDATE boarding_exeat_requests 
       SET status = $1, approval_notes = $2, approved_at = NOW()
       WHERE id = $3 AND school_id = $4
       RETURNING *`,
      [status, approval_notes, req.params.id, req.schoolId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Exeat request not found' });
    }

    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error('Error updating exeat request:', err);
    res.status(500).json({ success: false, error: 'Failed to update exeat request' });
  }
});

// ===================
// STORES & INVENTORY
// ===================

router.post('/inventory/kitchen-log', authorizeRole(['admin']), async (req, res) => {
  try {
    const { item_name, quantity, unit, usage_date } = req.body;

    const result = await query(
      `INSERT INTO kitchen_inventory_logs (school_id, item_name, quantity, unit, usage_date)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [req.schoolId, item_name, quantity, unit, usage_date]
    );

    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error('Error logging inventory:', err);
    res.status(500).json({ success: false, error: 'Failed to log inventory' });
  }
});

router.post('/inventory/textbook-issuance', authorizeRole(['librarian', 'admin']), async (req, res) => {
  try {
    const { student_id, book_id, quantity, issue_date } = req.body;

    const result = await query(
      `INSERT INTO textbook_issuance_logs (school_id, student_id, book_id, quantity, issue_date, status)
       VALUES ($1, $2, $3, $4, $5, 'issued')
       RETURNING *`,
      [req.schoolId, student_id, book_id, quantity, issue_date]
    );

    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error('Error issuing textbook:', err);
    res.status(500).json({ success: false, error: 'Failed to issue textbook' });
  }
});

// ===================
// TRANSPORT MANAGEMENT
// ===================

router.post('/transport/route-assignment', authorizeRole(['admin']), async (req, res) => {
  try {
    const { student_id, route_id, pickup_point } = req.body;

    const result = await query(
      `INSERT INTO transport_assignments (school_id, student_id, route_id, pickup_point, status)
       VALUES ($1, $2, $3, $4, 'active')
       ON CONFLICT (school_id, student_id) DO UPDATE
       SET route_id = $3, pickup_point = $4, updated_at = NOW()
       RETURNING *`,
      [req.schoolId, student_id, route_id, pickup_point]
    );

    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error('Error assigning route:', err);
    res.status(500).json({ success: false, error: 'Failed to assign route' });
  }
});

router.post('/transport/attendance', authorizeRole(['teacher', 'admin']), async (req, res) => {
  try {
    const { student_id, route_id, attendance_date, status } = req.body;

    const result = await query(
      `INSERT INTO transport_attendance (school_id, student_id, route_id, attendance_date, status)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [req.schoolId, student_id, route_id, attendance_date, status]
    );

    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error('Error recording transport attendance:', err);
    res.status(500).json({ success: false, error: 'Failed to record attendance' });
  }
});

// ===================
// SMS COMMUNICATION
// ===================

router.post('/sms/send-campaign', authorizeRole(['admin']), async (req, res) => {
  try {
    const { recipient_group, message, gateway } = req.body;

    const result = await query(
      `INSERT INTO sms_campaigns (school_id, recipient_group, message, gateway, status)
       VALUES ($1, $2, $3, $4, 'pending')
       RETURNING *`,
      [req.schoolId, recipient_group, message, gateway]
    );

    res.json({ success: true, data: result.rows[0], message: 'SMS campaign created' });
  } catch (err) {
    console.error('Error creating SMS campaign:', err);
    res.status(500).json({ success: false, error: 'Failed to create campaign' });
  }
});

router.get('/sms/campaigns', authorizeRole(['admin']), async (req, res) => {
  try {
    const result = await query(
      `SELECT * FROM sms_campaigns WHERE school_id = $1 ORDER BY created_at DESC`,
      [req.schoolId]
    );

    res.json({ success: true, data: result.rows });
  } catch (err) {
    console.error('Error fetching SMS campaigns:', err);
    res.status(500).json({ success: false, error: 'Failed to fetch campaigns' });
  }
});

module.exports = router;
