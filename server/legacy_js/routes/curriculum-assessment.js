const express = require('express');
const router = express.Router();
const { query } = require('../db/connection');

const requireAuth = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
};

const requireRole = (roles) => (req, res, next) => {
  if (!req.user || !roles.includes(req.user.role)) {
    return res.status(403).json({ error: 'Forbidden' });
  }
  next();
};

// ============================================
// GRADING SCHEMES
// ============================================

// GET grading schemes for curriculum
router.get('/grading-schemes', requireAuth, async (req, res) => {
  try {
    const { curriculum } = req.query;
    
    let sql = 'SELECT * FROM grading_schemes WHERE school_id = $1';
    let params = [req.user.school_id];
    
    if (curriculum) {
      sql += ' AND curriculum = $2';
      params.push(curriculum);
    }
    
    sql += ' ORDER BY min_score';
    const result = await query(sql, params);
    res.json({ data: result.rows });
  } catch (error) {
    console.error('Error fetching grading schemes:', error);
    res.status(500).json({ error: 'Failed to fetch grading schemes' });
  }
});

// ============================================
// 8-4-4 SYSTEM ASSESSMENTS
// ============================================

// GET 8-4-4 assessments for student
router.get('/844/student/:studentId', requireAuth, async (req, res) => {
  try {
    const result = await query(
      `SELECT * FROM assessment_844_system 
       WHERE student_id = $1 AND school_id = $2
       ORDER BY term_id, subject`,
      [req.params.studentId, req.user.school_id]
    );
    res.json({ data: result.rows });
  } catch (error) {
    console.error('Error fetching 8-4-4 assessments:', error);
    res.status(500).json({ error: 'Failed to fetch assessments' });
  }
});

// CREATE 8-4-4 assessment
router.post('/844', requireAuth, requireRole(['admin', 'teacher', 'super_admin', 'exam_officer', 'hod']), async (req, res) => {
  try {
    const { student_id, academic_year_id, term_id, form, stream, subject, marks_obtained, max_marks, grade_letter, points, is_compulsory } = req.body;
    
    if (!student_id || !subject || marks_obtained === undefined) {
      return res.status(400).json({ error: 'Student, subject, and marks are required' });
    }

    const result = await query(
      `INSERT INTO assessment_844_system 
       (school_id, student_id, academic_year_id, term_id, form, stream, subject, marks_obtained, max_marks, grade_letter, points, is_compulsory)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       RETURNING *`,
      [req.user.school_id, student_id, academic_year_id, term_id, form, stream, subject, marks_obtained, max_marks || 100, grade_letter, points, is_compulsory ?? true]
    );
    
    res.status(201).json({ data: result.rows[0], message: 'Assessment recorded successfully' });
  } catch (error) {
    console.error('Error creating 8-4-4 assessment:', error);
    res.status(500).json({ error: 'Failed to create assessment' });
  }
});

// ============================================
// BRITISH CURRICULUM ASSESSMENTS
// ============================================

// GET British curriculum assessments
router.get('/british/student/:studentId', requireAuth, async (req, res) => {
  try {
    const result = await query(
      `SELECT * FROM assessment_british_curriculum
       WHERE student_id = $1 AND school_id = $2
       ORDER BY key_stage, subject`,
      [req.params.studentId, req.user.school_id]
    );
    res.json({ data: result.rows });
  } catch (error) {
    console.error('Error fetching British assessments:', error);
    res.status(500).json({ error: 'Failed to fetch assessments' });
  }
});

// CREATE British curriculum assessment
router.post('/british', requireAuth, requireRole(['admin', 'teacher', 'super_admin', 'exam_officer', 'hod']), async (req, res) => {
  try {
    const { student_id, academic_year_id, term_id, key_stage, subject, attainment_grade, effort_grade, predicted_grade, mock_result, checkpoint_score } = req.body;
    
    if (!student_id || !subject) {
      return res.status(400).json({ error: 'Student and subject are required' });
    }

    const result = await query(
      `INSERT INTO assessment_british_curriculum
       (school_id, student_id, academic_year_id, term_id, key_stage, subject, attainment_grade, effort_grade, predicted_grade, mock_result, checkpoint_score)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING *`,
      [req.user.school_id, student_id, academic_year_id, term_id, key_stage, subject, attainment_grade, effort_grade, predicted_grade, mock_result, checkpoint_score]
    );
    
    res.status(201).json({ data: result.rows[0], message: 'Assessment recorded successfully' });
  } catch (error) {
    console.error('Error creating British assessment:', error);
    res.status(500).json({ error: 'Failed to create assessment' });
  }
});

// ============================================
// AMERICAN CURRICULUM ASSESSMENTS
// ============================================

// GET American curriculum assessments
router.get('/american/student/:studentId', requireAuth, async (req, res) => {
  try {
    const result = await query(
      `SELECT * FROM assessment_american_curriculum
       WHERE student_id = $1 AND school_id = $2
       ORDER BY grade_level, subject`,
      [req.params.studentId, req.user.school_id]
    );
    res.json({ data: result.rows });
  } catch (error) {
    console.error('Error fetching American assessments:', error);
    res.status(500).json({ error: 'Failed to fetch assessments' });
  }
});

// CREATE American curriculum assessment
router.post('/american', requireAuth, requireRole(['admin', 'teacher', 'super_admin', 'exam_officer', 'hod']), async (req, res) => {
  try {
    const { student_id, academic_year_id, course_id, grade_level, subject, letter_grade, gpa_points, credits_earned, map_rit_score, map_percentile } = req.body;
    
    if (!student_id || !subject) {
      return res.status(400).json({ error: 'Student and subject are required' });
    }

    const result = await query(
      `INSERT INTO assessment_american_curriculum
       (school_id, student_id, academic_year_id, course_id, grade_level, subject, letter_grade, gpa_points, credits_earned, map_rit_score, map_percentile)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING *`,
      [req.user.school_id, student_id, academic_year_id, course_id, grade_level, subject, letter_grade, gpa_points, credits_earned, map_rit_score, map_percentile]
    );
    
    res.status(201).json({ data: result.rows[0], message: 'Assessment recorded successfully' });
  } catch (error) {
    console.error('Error creating American assessment:', error);
    res.status(500).json({ error: 'Failed to create assessment' });
  }
});

// ============================================
// IB ASSESSMENTS
// ============================================

// GET IB assessments
router.get('/ib/student/:studentId', requireAuth, async (req, res) => {
  try {
    const result = await query(
      `SELECT * FROM assessment_ib
       WHERE student_id = $1 AND school_id = $2
       ORDER BY subject`,
      [req.params.studentId, req.user.school_id]
    );
    res.json({ data: result.rows });
  } catch (error) {
    console.error('Error fetching IB assessments:', error);
    res.status(500).json({ error: 'Failed to fetch assessments' });
  }
});

// CREATE IB assessment
router.post('/ib', requireAuth, requireRole(['admin', 'teacher', 'super_admin', 'exam_officer', 'hod']), async (req, res) => {
  try {
    const { student_id, academic_year_id, subject, programme, criterion_a, criterion_b, criterion_c, criterion_d, internal_assessment_score, external_assessment_score } = req.body;
    
    if (!student_id || !subject || criterion_a === undefined) {
      return res.status(400).json({ error: 'Student, subject, and criterion scores are required' });
    }

    const total_criteria_score = criterion_a + criterion_b + criterion_c + criterion_d;
    const final_grade = Math.ceil(total_criteria_score / 4.5);

    const result = await query(
      `INSERT INTO assessment_ib
       (school_id, student_id, academic_year_id, subject, programme, criterion_a, criterion_b, criterion_c, criterion_d, total_criteria_score, final_grade, internal_assessment_score, external_assessment_score)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
       RETURNING *`,
      [req.user.school_id, student_id, academic_year_id, subject, programme || 'DP', criterion_a, criterion_b, criterion_c, criterion_d, total_criteria_score, final_grade, internal_assessment_score, external_assessment_score]
    );
    
    res.status(201).json({ data: result.rows[0], message: 'IB assessment recorded successfully' });
  } catch (error) {
    console.error('Error creating IB assessment:', error);
    res.status(500).json({ error: 'Failed to create assessment' });
  }
});

// ============================================
// IB CAS PORTFOLIO
// ============================================

// GET CAS activities for student
router.get('/ib-cas/student/:studentId', requireAuth, async (req, res) => {
  try {
    const result = await query(
      `SELECT c.*, u.name as supervisor_name
       FROM ib_cas_portfolio c
       LEFT JOIN users u ON c.supervisor_id = u.id
       WHERE c.student_id = $1 AND c.school_id = $2
       ORDER BY c.activity_type, c.created_at DESC`,
      [req.params.studentId, req.user.school_id]
    );
    res.json({ data: result.rows });
  } catch (error) {
    console.error('Error fetching CAS activities:', error);
    res.status(500).json({ error: 'Failed to fetch CAS activities' });
  }
});

// CREATE CAS activity
router.post('/ib-cas', requireAuth, async (req, res) => {
  try {
    const { student_id, activity_title, activity_type, start_date, end_date, hours_logged, description, evidence_url, reflection } = req.body;
    
    if (!student_id || !activity_title || !activity_type) {
      return res.status(400).json({ error: 'Title, type, and student are required' });
    }

    const result = await query(
      `INSERT INTO ib_cas_portfolio
       (school_id, student_id, activity_title, activity_type, start_date, end_date, hours_logged, description, evidence_url, reflection)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [req.user.school_id, student_id, activity_title, activity_type, start_date, end_date, hours_logged, description, evidence_url, reflection]
    );
    
    res.status(201).json({ data: result.rows[0], message: 'CAS activity logged successfully' });
  } catch (error) {
    console.error('Error creating CAS activity:', error);
    res.status(500).json({ error: 'Failed to create CAS activity' });
  }
});

// ============================================
// MERIT LISTS
// ============================================

// GET merit lists
router.get('/merit-lists', requireAuth, async (req, res) => {
  try {
    const { academic_year_id, term_id, grade_level } = req.query;
    const query = getApi();
    
    let sql = `SELECT ml.*, s.first_name, s.last_name, s.admission_number
               FROM merit_lists ml
               JOIN students s ON ml.student_id = s.id
               WHERE ml.school_id = $1`;
    let params = [req.user.school_id];
    
    if (academic_year_id) {
      sql += ' AND ml.academic_year_id = $' + (params.length + 1);
      params.push(academic_year_id);
    }
    if (term_id) {
      sql += ' AND ml.term_id = $' + (params.length + 1);
      params.push(term_id);
    }
    if (grade_level) {
      sql += ' AND ml.grade_level = $' + (params.length + 1);
      params.push(grade_level);
    }
    
    sql += ' ORDER BY ml.position';
    const result = await query(sql, params);
    res.json({ data: result.rows });
  } catch (error) {
    console.error('Error fetching merit lists:', error);
    res.status(500).json({ error: 'Failed to fetch merit lists' });
  }
});

// GENERATE merit lists
router.post('/merit-lists/generate', requireAuth, requireRole(['admin', 'super_admin', 'exam_officer', 'hod']), async (req, res) => {
  try {
    const { academic_year_id, term_id, grade_level } = req.body;
    
    if (!academic_year_id || !grade_level) {
      return res.status(400).json({ error: 'Academic year and grade level are required' });
    }

    const query = getApi();
    
    const sql = `
      WITH ranked_students AS (
        SELECT 
          $1 as school_id,
          $2 as academic_year_id,
          $3 as term_id,
          $4 as grade_level,
          '' as stream,
          s.id as student_id,
          AVG(p.grade) as mean_score,
          ROW_NUMBER() OVER (ORDER BY AVG(p.grade) DESC) as position,
          COUNT(DISTINCT s.id) OVER () as total_count
        FROM students s
        LEFT JOIN performance p ON s.id = p.student_id 
          AND p.academic_year_id = $2
          AND p.term_id = $3
        WHERE s.school_id = $1 AND s.grade = $4
        GROUP BY s.id
      )
      INSERT INTO merit_lists (school_id, academic_year_id, term_id, grade_level, stream, student_id, position, mean_score, total_students_in_class)
      SELECT school_id, academic_year_id, term_id, grade_level, stream, student_id, position, mean_score, total_count
      FROM ranked_students
      ON CONFLICT (academic_year_id, term_id, grade_level, stream, student_id) DO UPDATE
      SET position = EXCLUDED.position, mean_score = EXCLUDED.mean_score
      RETURNING *
    `;

    const result = await query(sql, [req.user.school_id, academic_year_id, term_id, grade_level]);
    
    res.status(201).json({ 
      data: result.rows, 
      message: `Merit list generated with ${result.rows.length} students` 
    });
  } catch (error) {
    console.error('Error generating merit lists:', error);
    res.status(500).json({ error: 'Failed to generate merit lists' });
  }
});

module.exports = router;
