const express = require('express');
const router = express.Router();
const { query } = require('../db/connection');
const { authorizeRole } = require('../middleware/auth');

// Get all messages for a school
router.get('/', authorizeRole(['admin', 'teacher', 'student', 'parent']), async (req, res) => {
  try {
    const { schoolId } = req;
    const { recipient_type, message_type, priority, limit = 50, offset = 0 } = req.query;

    let sql = `
      SELECT
        m.*,
        u.name as sender_name,
        u.role as sender_role
      FROM messages m
      LEFT JOIN users u ON m.sender_id = u.id
      WHERE m.school_id = $1
    `;

    const params = [schoolId];
    let paramIndex = 2;

    if (recipient_type) {
      sql += ` AND m.recipient_type = $${paramIndex}`;
      params.push(recipient_type);
      paramIndex++;
    }

    if (message_type) {
      sql += ` AND m.message_type = $${paramIndex}`;
      params.push(message_type);
      paramIndex++;
    }

    if (priority) {
      sql += ` AND m.priority = $${paramIndex}`;
      params.push(priority);
      paramIndex++;
    }

    sql += ` ORDER BY m.sent_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(parseInt(limit), parseInt(offset));

    const result = await query(sql, params);
    res.json({ success: true, data: result.rows });
  } catch (err) {
    console.error('Error fetching messages:', err);
    res.status(500).json({ success: false, error: 'Failed to fetch messages' });
  }
});

// Get messages for current user
router.get('/my', authorizeRole(['admin', 'teacher', 'student', 'parent']), async (req, res) => {
  try {
    const { schoolId } = req;
    const userId = req.user.id;
    const userRole = req.user.role;
    const { limit = 50, offset = 0 } = req.query;

    // Get messages where user is a recipient or where message is sent to their role/group
    const result = await query(
      `
      SELECT DISTINCT
        m.*,
        u.name as sender_name,
        u.role as sender_role
      FROM messages m
      LEFT JOIN users u ON m.sender_id = u.id
      LEFT JOIN message_recipients mr ON m.id = mr.message_id
      WHERE m.school_id = $1
        AND (
          mr.user_id = $2
          OR m.recipient_type = 'all'
          OR (m.recipient_type = 'students' AND $3 = 'student')
          OR (m.recipient_type = 'parents' AND $3 = 'parent')
          OR (m.recipient_type = 'teachers' AND $3 = 'teacher')
          OR (m.recipient_type = 'staff' AND $3 IN ('admin', 'teacher'))
        )
      ORDER BY m.sent_at DESC
      LIMIT $4 OFFSET $5
      `,
      [schoolId, userId, userRole, parseInt(limit), parseInt(offset)]
    );

    res.json({ success: true, data: result.rows });
  } catch (err) {
    console.error('Error fetching user messages:', err);
    res.status(500).json({ success: false, error: 'Failed to fetch messages' });
  }
});

// Get message by ID
router.get('/:id', authorizeRole(['admin', 'teacher', 'student', 'parent']), async (req, res) => {
  try {
    const { schoolId } = req;
    const { id } = req.params;

    const result = await query(
      `
      SELECT
        m.*,
        u.name as sender_name,
        u.role as sender_role
      FROM messages m
      LEFT JOIN users u ON m.sender_id = u.id
      WHERE m.id = $1 AND m.school_id = $2
      `,
      [id, schoolId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Message not found' });
    }

    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error('Error fetching message:', err);
    res.status(500).json({ success: false, error: 'Failed to fetch message' });
  }
});

// Create new message
router.post('/', authorizeRole(['admin', 'teacher']), async (req, res) => {
  try {
    const { schoolId } = req;
    const senderId = req.user.id;
    const {
      recipient_type,
      recipient_id,
      recipient_grade,
      subject,
      body,
      message_type = 'message',
      priority = 'normal',
      send_email = false,
      send_sms = false
    } = req.body;

    // Start transaction
    await query('BEGIN');

    // Insert message
    const messageResult = await query(
      `INSERT INTO messages
       (school_id, sender_id, recipient_type, recipient_id, recipient_grade, subject, body, message_type, priority, send_email, send_sms)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING *`,
      [schoolId, senderId, recipient_type, recipient_id, recipient_grade, subject, body, message_type, priority, send_email, send_sms]
    );

    const message = messageResult.rows[0];

    // Handle recipients based on type
    if (recipient_type === 'individual' && recipient_id) {
      await query(
        'INSERT INTO message_recipients (message_id, user_id) VALUES ($1, $2)',
        [message.id, recipient_id]
      );
    } else if (recipient_type === 'grade' && recipient_grade) {
      // Get all students in the specified grade
      const studentsResult = await query(
        'SELECT user_id FROM students WHERE school_id = $1 AND grade = $2',
        [schoolId, recipient_grade]
      );

      for (const student of studentsResult.rows) {
        await query(
          'INSERT INTO message_recipients (message_id, user_id) VALUES ($1, $2)',
          [message.id, student.user_id]
        );
      }
    } else if (recipient_type === 'students') {
      // Get all students
      const studentsResult = await query(
        'SELECT user_id FROM students WHERE school_id = $1',
        [schoolId]
      );

      for (const student of studentsResult.rows) {
        await query(
          'INSERT INTO message_recipients (message_id, user_id) VALUES ($1, $2)',
          [message.id, student.user_id]
        );
      }
    } else if (recipient_type === 'parents') {
      // Get all parents (users with parent role)
      const parentsResult = await query(
        "SELECT id FROM users WHERE school_id = $1 AND role = 'parent'",
        [schoolId]
      );

      for (const parent of parentsResult.rows) {
        await query(
          'INSERT INTO message_recipients (message_id, user_id) VALUES ($1, $2)',
          [message.id, parent.id]
        );
      }
    } else if (recipient_type === 'teachers') {
      // Get all teachers
      const teachersResult = await query(
        "SELECT id FROM users WHERE school_id = $1 AND role = 'teacher'",
        [schoolId]
      );

      for (const teacher of teachersResult.rows) {
        await query(
          'INSERT INTO message_recipients (message_id, user_id) VALUES ($1, $2)',
          [message.id, teacher.id]
        );
      }
    } else if (recipient_type === 'staff') {
      // Get all staff (admin and teacher)
      const staffResult = await query(
        "SELECT id FROM users WHERE school_id = $1 AND role IN ('admin', 'teacher')",
        [schoolId]
      );

      for (const staff of staffResult.rows) {
        await query(
          'INSERT INTO message_recipients (message_id, user_id) VALUES ($1, $2)',
          [message.id, staff.id]
        );
      }
    }
    // For 'all', we don't need to insert specific recipients as the message is visible to all

    await query('COMMIT');

    res.status(201).json({ success: true, data: message });
  } catch (err) {
    await query('ROLLBACK');
    console.error('Error creating message:', err);
    res.status(500).json({ success: false, error: 'Failed to create message' });
  }
});

// Update message
router.put('/:id', authorizeRole(['admin']), async (req, res) => {
  try {
    const { schoolId } = req;
    const { id } = req.params;
    const {
      subject,
      body,
      message_type,
      priority,
      send_email,
      send_sms
    } = req.body;

    const result = await query(
      `UPDATE messages
       SET subject = $1, body = $2, message_type = $3, priority = $4, send_email = $5, send_sms = $6
       WHERE id = $7 AND school_id = $8
       RETURNING *`,
      [subject, body, message_type, priority, send_email, send_sms, id, schoolId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Message not found' });
    }

    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error('Error updating message:', err);
    res.status(500).json({ success: false, error: 'Failed to update message' });
  }
});

// Delete message
router.delete('/:id', authorizeRole(['admin']), async (req, res) => {
  try {
    const { schoolId } = req;
    const { id } = req.params;

    const result = await query(
      'DELETE FROM messages WHERE id = $1 AND school_id = $2 RETURNING *',
      [id, schoolId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Message not found' });
    }

    res.json({ success: true, message: 'Message deleted successfully' });
  } catch (err) {
    console.error('Error deleting message:', err);
    res.status(500).json({ success: false, error: 'Failed to delete message' });
  }
});

// Get message recipients
router.get('/:id/recipients', authorizeRole(['admin', 'teacher']), async (req, res) => {
  try {
    const { schoolId } = req;
    const { id } = req.params;

    const result = await query(
      `
      SELECT
        mr.*,
        u.name as recipient_name,
        u.email as recipient_email,
        u.role as recipient_role
      FROM message_recipients mr
      LEFT JOIN users u ON mr.user_id = u.id
      WHERE mr.message_id = $1
      `,
      [id]
    );

    res.json({ success: true, data: result.rows });
  } catch (err) {
    console.error('Error fetching message recipients:', err);
    res.status(500).json({ success: false, error: 'Failed to fetch message recipients' });
  }
});

module.exports = router;
