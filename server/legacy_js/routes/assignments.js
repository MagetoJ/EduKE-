const express = require('express');
const router = express.Router();
const { query } = require('../db/connection');
const { authorizeRole } = require('../middleware/auth');

// Get all assignments
router.get('/', authorizeRole(['admin', 'teacher', 'student', 'parent', 'super_admin']), async (req, res) => {
  try {
    const { user } = req;
    let sql = 'SELECT a.*, c.name as course_name, c.grade FROM assignments a JOIN courses c ON a.course_id = c.id WHERE c.school_id = $1';
    const params = [req.schoolId];

    if (user.role === 'teacher') {
      sql += ' AND c.teacher_id = $2';
      params.push(user.id);
    } else if (user.role === 'parent') {
      // For parents, get assignments for courses their children are enrolled in
      sql += ` AND c.grade IN (
        SELECT DISTINCT s.grade
        FROM students s
        JOIN parent_student_relations psr ON s.id = psr.student_id
        WHERE psr.parent_id = $2 AND s.school_id = $1 AND s.status = 'active'
      )`;
      params.push(user.id);
    }

    sql += ' ORDER BY a.due_date DESC';
    const result = await query(sql, params);
    res.json({ success: true, data: result.rows });
  } catch (err) {
    console.error('Error fetching assignments:', err);
    res.status(500).json({ success: false, error: 'Failed to fetch assignments' });
  }
});

// Get assignment by ID
router.get('/:id', authorizeRole(['admin', 'teacher', 'student']), async (req, res) => {
  try {
    const { id } = req.params;

    const result = await query(
      'SELECT a.*, c.name as course_name FROM assignments a JOIN courses c ON a.course_id = c.id WHERE a.id = $1 AND c.school_id = $2',
      [id, req.schoolId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Assignment not found' });
    }
    
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error('Error fetching assignment:', err);
    res.status(500).json({ success: false, error: 'Failed to fetch assignment' });
  }
});

// Create assignment
router.post('/', authorizeRole(['admin', 'teacher']), async (req, res) => {
  try {
    const { schoolId, user } = req;
    const { course_id, title, description, due_date, total_marks } = req.body;

    // For teachers, validate they own the course
    if (user.role === 'teacher') {
      const courseCheck = await query(
        'SELECT id FROM courses WHERE id = $1 AND teacher_id = $2 AND school_id = $3',
        [course_id, user.id, schoolId]
      );

      if (courseCheck.rows.length === 0) {
        return res.status(403).json({ success: false, error: 'You can only create assignments for courses you teach' });
      }
    }

    const result = await query(
      'INSERT INTO assignments (school_id, course_id, teacher_id, title, description, due_date, total_marks) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *',
      [schoolId, course_id, user.id, title, description, due_date, total_marks]
    );

    res.status(201).json({ success: true, data: result.rows[0], message: 'Assignment created successfully' });
  } catch (err) {
    console.error('Error creating assignment:', err);
    res.status(500).json({ success: false, error: 'Failed to create assignment' });
  }
});

// Update assignment
router.put('/:id', authorizeRole(['admin', 'teacher']), async (req, res) => {
  try {
    const { user } = req;
    const { id } = req.params;
    const { title, description, due_date, total_marks } = req.body;

    // For teachers, validate they own the course this assignment belongs to
    if (user.role === 'teacher') {
      const ownershipCheck = await query(
        'SELECT a.id FROM assignments a JOIN courses c ON a.course_id = c.id WHERE a.id = $1 AND c.teacher_id = $2 AND c.school_id = $3',
        [id, user.id, req.schoolId]
      );

      if (ownershipCheck.rows.length === 0) {
        return res.status(403).json({ success: false, error: 'You can only update assignments for courses you teach' });
      }
    }

    const result = await query(
      `UPDATE assignments SET title = $1, description = $2, due_date = $3, total_marks = $4
       WHERE id = $5 RETURNING *`,
      [title, description, due_date, total_marks, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Assignment not found' });
    }

    res.json({ success: true, data: result.rows[0], message: 'Assignment updated successfully' });
  } catch (err) {
    console.error('Error updating assignment:', err);
    res.status(500).json({ success: false, error: 'Failed to update assignment' });
  }
});

// Delete assignment
router.delete('/:id', authorizeRole(['admin', 'teacher']), async (req, res) => {
  try {
    const { user } = req;
    const { id } = req.params;

    // For teachers, validate they own the course this assignment belongs to
    if (user.role === 'teacher') {
      const ownershipCheck = await query(
        'SELECT a.id FROM assignments a JOIN courses c ON a.course_id = c.id WHERE a.id = $1 AND c.teacher_id = $2 AND c.school_id = $3',
        [id, user.id, req.schoolId]
      );

      if (ownershipCheck.rows.length === 0) {
        return res.status(403).json({ success: false, error: 'You can only delete assignments for courses you teach' });
      }
    }

    await query('DELETE FROM assignments WHERE id = $1', [id]);
    res.json({ success: true, message: 'Assignment deleted successfully' });
  } catch (err) {
    console.error('Error deleting assignment:', err);
    res.status(500).json({ success: false, error: 'Failed to delete assignment' });
  }
});

// Get submissions for an assignment
router.get('/:id/submissions', authorizeRole(['admin', 'teacher']), async (req, res) => {
  try {
    const { id } = req.params;

    const result = await query(
      `SELECT asub.id, asub.assignment_id, asub.student_id, asub.submission_text, asub.attachment_url,
              asub.submitted_at, asub.grade as score, asub.feedback, asub.status,
              s.first_name, s.last_name, s.admission_number
       FROM assignment_submissions asub
       JOIN students s ON asub.student_id = s.id
       JOIN assignments a ON asub.assignment_id = a.id
       WHERE asub.assignment_id = $1 AND a.school_id = $2
       ORDER BY asub.submitted_at DESC`,
      [id, req.schoolId]
    );

    res.json({ success: true, data: result.rows });
  } catch (err) {
    console.error('Error fetching submissions:', err);
    res.status(500).json({ success: false, error: 'Failed to fetch submissions' });
  }
});

// Submit assignment (student)
router.post('/:id/submit', authorizeRole(['student']), async (req, res) => {
  try {
    const { user } = req;
    const { id } = req.params;
    const { content, attachment_url } = req.body;
    
    // Get student ID
    const studentResult = await query('SELECT id FROM students WHERE school_id = $1 AND email = $2', [req.schoolId, user.email]);
    
    if (studentResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Student not found' });
    }
    
    const studentId = studentResult.rows[0].id;
    
    const result = await query(
      `INSERT INTO assignment_submissions (assignment_id, student_id, content, attachment_url, status, submitted_at)
       VALUES ($1, $2, $3, $4, 'submitted', NOW())
       ON CONFLICT (assignment_id, student_id) 
       DO UPDATE SET content = $3, attachment_url = $4, status = 'submitted', submitted_at = NOW()
       RETURNING *`,
      [id, studentId, content, attachment_url]
    );
    
    res.status(201).json({ success: true, data: result.rows[0], message: 'Assignment submitted successfully' });
  } catch (err) {
    console.error('Error submitting assignment:', err);
    res.status(500).json({ success: false, error: 'Failed to submit assignment' });
  }
});

// Grade submission
router.post('/submissions/:submissionId/grade', authorizeRole(['admin', 'teacher']), async (req, res) => {
  try {
    const { user } = req;
    const { submissionId } = req.params;
    const { grade, feedback } = req.body;

    // For teachers, validate they own the course this submission belongs to
    if (user.role === 'teacher') {
      const ownershipCheck = await query(
        `SELECT asub.id FROM assignment_submissions asub
         JOIN assignments a ON asub.assignment_id = a.id
         JOIN courses c ON a.course_id = c.id
         WHERE asub.id = $1 AND c.teacher_id = $2 AND c.school_id = $3`,
        [submissionId, user.id, req.schoolId]
      );

      if (ownershipCheck.rows.length === 0) {
        return res.status(403).json({ success: false, error: 'You can only grade submissions for courses you teach' });
      }
    }

    const result = await query(
      `UPDATE assignment_submissions SET grade = $1, feedback = $2, status = 'graded', graded_by = $3, graded_at = NOW(), updated_at = NOW()
       WHERE id = $4 RETURNING *`,
      [grade, feedback, user.id, submissionId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Submission not found' });
    }

    res.json({ success: true, data: result.rows[0], message: 'Submission graded successfully' });
  } catch (err) {
    console.error('Error grading submission:', err);
    res.status(500).json({ success: false, error: 'Failed to grade submission' });
  }
});

// Download assignment responses
router.get('/:id/download', authorizeRole(['admin', 'teacher']), async (req, res) => {
  try {
    const { user } = req;
    const { id } = req.params;

    // For teachers, validate they own the course this assignment belongs to
    if (user.role === 'teacher') {
      const ownershipCheck = await query(
        'SELECT a.id FROM assignments a JOIN courses c ON a.course_id = c.id WHERE a.id = $1 AND c.teacher_id = $2 AND c.school_id = $3',
        [id, user.id, req.schoolId]
      );

      if (ownershipCheck.rows.length === 0) {
        return res.status(403).json({ success: false, error: 'You can only download responses for courses you teach' });
      }
    }

    // Get assignment details
    const assignmentResult = await query('SELECT title FROM assignments WHERE id = $1 AND school_id = $2', [id, req.schoolId]);
    if (assignmentResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Assignment not found' });
    }

    // Get all submissions
    const submissionsResult = await query(
      `SELECT s.first_name, s.last_name, s.admission_number, asub.submission_text, asub.attachment_url,
              asub.grade, asub.feedback, asub.status, asub.submitted_at
       FROM assignment_submissions asub
       JOIN students s ON asub.student_id = s.id
       WHERE asub.assignment_id = $1
       ORDER BY asub.submitted_at DESC`,
      [id]
    );

    // Generate CSV content
    const csvHeader = 'Student Name,Admission Number,Submission,Attachment URL,Grade,Feedback,Status,Submitted At\n';
    const csvRows = submissionsResult.rows.map(sub => {
      const studentName = `"${sub.first_name} ${sub.last_name}"`;
      const admissionNumber = `"${sub.admission_number || ''}"`;
      const submission = `"${(sub.submission_text || '').replace(/"/g, '""')}"`;
      const attachmentUrl = `"${sub.attachment_url || ''}"`;
      const grade = `"${sub.grade || ''}"`;
      const feedback = `"${(sub.feedback || '').replace(/"/g, '""')}"`;
      const status = `"${sub.status}"`;
      const submittedAt = `"${new Date(sub.submitted_at).toLocaleString()}"`;

      return `${studentName},${admissionNumber},${submission},${attachmentUrl},${grade},${feedback},${status},${submittedAt}`;
    });

    const csvContent = csvHeader + csvRows.join('\n');

    // Set headers for file download
    const filename = `assignment_${id}_responses_${new Date().toISOString().split('T')[0]}.csv`;
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    res.send(csvContent);
  } catch (err) {
    console.error('Error downloading responses:', err);
    res.status(500).json({ success: false, error: 'Failed to download responses' });
  }
});

module.exports = router;
