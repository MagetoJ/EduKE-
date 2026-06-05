const bcrypt = require('bcrypt');
const { transaction, query } = require('../db/connection');
const { encrypt, decrypt } = require('../utils/security');
const { logActivity } = require('./auditService');

// --- NEW HELPER FUNCTION ---
// Generates an admission number based on grade.
// Example: A Grade 10 student in 2025 -> G10-25-XXXX
const generateAdmissionNumber = (grade) => {
  const gradeCode = grade.replace(/[^0-9]/g, ''); // "Grade 10" -> "10"
  const year = new Date().getFullYear().toString().slice(-2); // 2025 -> "25"
  const random = Math.floor(1000 + Math.random() * 9000); // 4-digit random number
  return `G${gradeCode}-${year}-${random}`;
};

const SENSITIVE_FIELDS = ['phone', 'address', 'medical_conditions', 'allergies', 'emergency_contact_phone', 'national_id', 'student_id_number', 'parent_phone'];

const encryptStudentPii = (student) => {
  const encrypted = { ...student };
  SENSITIVE_FIELDS.forEach(field => {
    if (encrypted[field]) {
      encrypted[field] = encrypt(encrypted[field]);
    }
  });
  return encrypted;
};

const decryptStudentPii = (student) => {
  if (!student) return student;
  const decrypted = { ...student };
  SENSITIVE_FIELDS.forEach(field => {
    if (decrypted[field]) {
      decrypted[field] = decrypt(decrypted[field]);
    }
  });
  return decrypted;
};

const createStudent = async (client, studentData, school_id, admissionNumber, passwordHash) => {
  const { 
    first_name, last_name, email, date_of_birth, gender, 
    address, grade, enrollment_date, national_id, student_id_number,
    emergency_contact_phone, medical_conditions, allergies
  } = studentData;
  const encryptedStudent = encryptStudentPii(studentData);

  try {
    const userResult = await client.query(
      `INSERT INTO users (school_id, email, password_hash, name, role, status, must_change_password)
       VALUES ($1, $2, $3, $4, 'student', 'active', TRUE)
       RETURNING id`,
      [school_id, email, passwordHash, `${first_name} ${last_name}`]
    );
    
    if (!userResult.rows || userResult.rows.length === 0) {
      throw new Error('Failed to create user account');
    }
    
    const studentUserId = userResult.rows[0].id;

    const insertResult = await client.query(
      `INSERT INTO students (
         school_id, user_id, first_name, last_name, email, phone, 
         date_of_birth, gender, address, admission_number, grade, 
         enrollment_date, status, national_id, student_id_number,
         emergency_contact_phone, medical_conditions, allergies
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'active', $13, $14, $15, $16, $17)
       RETURNING *`,
      [
        school_id, studentUserId, first_name, last_name, email, encryptedStudent.phone, 
        date_of_birth, gender, encryptedStudent.address, admissionNumber, grade, 
        enrollment_date, encryptedStudent.national_id, encryptedStudent.student_id_number,
        encryptedStudent.emergency_contact_phone, encryptedStudent.medical_conditions, encryptedStudent.allergies
      ]
    );

    if (!insertResult.rows || insertResult.rows.length === 0) {
      throw new Error('Failed to create student record');
    }

    return decryptStudentPii(insertResult.rows[0]);
  } catch (error) {
    if (error.code === '23505' || error.message.includes('UNIQUE constraint failed')) {
      throw new Error(`Email address already exists: ${email}`);
    }
    throw error;
  }
};

const createOrLinkParent = async (client, parentData, studentId, school_id, passwordHash) => {
  const { parent_email, parent_name, parent_phone, relationship } = parentData;

  const validRelationTypes = ['father', 'mother', 'guardian', 'other'];
  const relationType = relationship && validRelationTypes.includes(relationship.toLowerCase()) 
    ? relationship.toLowerCase() 
    : 'guardian';

  try {
    const existingParent = await client.query(
      'SELECT * FROM users WHERE email = $1',
      [parent_email]
    );

    let parentUserId;

    if (existingParent.rows && existingParent.rows.length > 0) {
      parentUserId = existingParent.rows[0].id;

      await client.query(
        'UPDATE users SET password_hash = $1, must_change_password = TRUE WHERE id = $2',
        [passwordHash, parentUserId]
      );
    } else {
      const parentUserResult = await client.query(
        `INSERT INTO users (school_id, email, password_hash, name, phone, role, status, must_change_password)
         VALUES ($1, $2, $3, $4, $5, 'parent', 'active', TRUE)
         RETURNING id`,
        [school_id, parent_email, passwordHash, parent_name, encrypt(parent_phone)]
      );
      
      if (!parentUserResult.rows || parentUserResult.rows.length === 0) {
        throw new Error('Failed to create parent user account');
      }
      
      parentUserId = parentUserResult.rows[0].id;
    }

    await client.query(
      'UPDATE students SET parent_id = $1 WHERE id = $2',
      [parentUserId, studentId]
    );

    // Using COALESCE/ON CONFLICT logic that works in PG, and we'll check for SQLite
    try {
      await client.query(
        `INSERT INTO parent_student_relations (parent_id, student_id, relation_type, is_primary_contact, is_financial_responsible)
         VALUES ($1, $2, $3, TRUE, TRUE)
         ON CONFLICT (parent_id, student_id) DO NOTHING`,
        [parentUserId, studentId, relationType]
      );
    } catch (err) {
      // Fallback for SQLite which uses INSERT OR IGNORE
      if (err.message.includes('syntax error') || err.message.includes('near "ON"')) {
        await client.query(
          `INSERT OR IGNORE INTO parent_student_relations (parent_id, student_id, relation_type, is_primary_contact, is_financial_responsible)
           VALUES ($1, $2, $3, TRUE, TRUE)`,
          [parentUserId, studentId, relationType]
        );
      } else {
        throw err;
      }
    }

    return parentUserId;
  } catch (error) {
    if (error.code === '23505' || error.message.includes('UNIQUE constraint failed')) {
      throw new Error(`Parent email already exists: ${parent_email}`);
    }
    if (error.message.includes('CHECK constraint')) {
      throw new Error(`Invalid parent relationship type. Must be one of: father, mother, guardian, other`);
    }
    throw error;
  }
};


const createStudentAndParent = async (studentData, school_id, userContext = {}) => {
  if (!studentData.first_name || !studentData.last_name || !studentData.email || !studentData.grade) {
    throw new Error('Missing required fields: first_name, last_name, email, grade');
  }

  if (!studentData.parent_email || !studentData.parent_name) {
    throw new Error('Missing required parent fields: parent_email, parent_name');
  }

  const result = await transaction(async (client) => {
    const admissionNumber = generateAdmissionNumber(studentData.grade);
    const passwordHash = await bcrypt.hash(admissionNumber, 10);

    const student = await createStudent(client, studentData, school_id, admissionNumber, passwordHash);

    const parentUserId = await createOrLinkParent(client, studentData, student.id, school_id, passwordHash);

    return {
      ...student,
      admission_number: admissionNumber,
      parent_id: parentUserId
    };
  });

  // Log the activity
  await logActivity({
    schoolId: school_id,
    userId: userContext.userId,
    action: 'create_student',
    entityType: 'student',
    entityId: result.id,
    description: `Created student ${result.first_name} ${result.last_name} with admission number ${result.admission_number}`,
    ipAddress: userContext.ip,
    userAgent: userContext.userAgent
  });

  return result;
};

// Get all students for a school
const getStudents = async (schoolId, filters = {}) => {
  let sql = `
    SELECT
      s.*,
      u.email as parent_email,
      u.name as parent_name,
      u.phone as parent_phone
    FROM students s
    LEFT JOIN users u ON s.parent_id = u.id
    WHERE s.school_id = $1
  `;

  const params = [schoolId];
  let paramIndex = 2;

  if (filters.grade) {
    sql += ` AND s.grade = $${paramIndex}`;
    params.push(filters.grade);
    paramIndex++;
  }

  if (filters.status) {
    sql += ` AND s.status = $${paramIndex}`;
    params.push(filters.status);
    paramIndex++;
  }

  if (filters.search) {
    sql += ` AND (s.first_name ILIKE $${paramIndex} OR s.last_name ILIKE $${paramIndex} OR s.admission_number ILIKE $${paramIndex})`;
    params.push(`%${filters.search}%`);
    paramIndex++;
  }

  sql += ` ORDER BY s.first_name, s.last_name`;

  const result = await query(sql, params);
  return result.rows.map(decryptStudentPii);
};

// Add this new function
const getStudentsBySchool = async (school_id) => {
  const result = await query(
    `
    SELECT
      s.*,
      u.email as parent_email,
      u.name as parent_name,
      u.phone as parent_phone
    FROM students s
    LEFT JOIN users u ON s.parent_id = u.id
    WHERE s.school_id = $1
    ORDER BY s.first_name, s.last_name
  `,
    [school_id]
  );
  return result.rows.map(decryptStudentPii);
};

// Get student by ID
const getStudentById = async (id, schoolId) => {
  const result = await query(
    `
    SELECT
      s.*,
      u.email as parent_email,
      u.name as parent_name,
      u.phone as parent_phone
    FROM students s
    LEFT JOIN users u ON s.parent_id = u.id
    WHERE s.id = $1 AND s.school_id = $2
  `,
    [id, schoolId]
  );
  return decryptStudentPii(result.rows[0]);
};

// Update student
const updateStudent = async (id, schoolId, updateData, userContext = {}) => {
  const fields = [];
  const values = [];
  let paramIndex = 1;

  const encryptedData = encryptStudentPii(updateData);

  Object.keys(encryptedData).forEach(key => {
    if (encryptedData[key] !== undefined) {
      fields.push(`${key} = $${paramIndex}`);
      values.push(encryptedData[key]);
      paramIndex++;
    }
  });

  if (fields.length === 0) {
    throw new Error('No fields to update');
  }

  values.push(id, schoolId);

  const result = await query(
    `UPDATE students SET ${fields.join(', ')} WHERE id = $${paramIndex} AND school_id = $${paramIndex + 1} RETURNING *`,
    values
  );

  if (result.rows.length === 0) return null;

  const student = decryptStudentPii(result.rows[0]);

  // Log the activity
  await logActivity({
    schoolId,
    userId: userContext.userId,
    action: 'update_student',
    entityType: 'student',
    entityId: id,
    description: `Updated student ${student.first_name} ${student.last_name}`,
    metadata: { fields_updated: Object.keys(updateData) },
    ipAddress: userContext.ip,
    userAgent: userContext.userAgent
  });

  return student;
};

// Delete student (soft delete)
const deleteStudent = async (id, schoolId, userContext = {}) => {
  const result = await query(
    'UPDATE students SET status = $1 WHERE id = $2 AND school_id = $3 RETURNING *',
    ['inactive', id, schoolId]
  );

  if (result.rows.length === 0) return null;

  const student = decryptStudentPii(result.rows[0]);

  // Log the activity
  await logActivity({
    schoolId,
    userId: userContext.userId,
    action: 'delete_student',
    entityType: 'student',
    entityId: id,
    description: `Soft-deleted student ${student.first_name} ${student.last_name}`,
    ipAddress: userContext.ip,
    userAgent: userContext.userAgent
  });

  return student;
};

// Get student performance
const getStudentPerformance = async (id, schoolId) => {
  // This would typically involve joining with exams, assignments, etc.
  // For now, return basic structure
  const result = await query(
    `
    SELECT
      s.id,
      s.first_name,
      s.last_name,
      s.grade,
      s.admission_number
    FROM students s
    WHERE s.id = $1 AND s.school_id = $2
  `,
    [id, schoolId]
  );

  if (result.rows.length === 0) {
    return null;
  }

  return {
    student: result.rows[0],
    performance: {
      // Placeholder for performance data
      averageGrade: null,
      totalAssignments: 0,
      completedAssignments: 0
    }
  };
};

// Get student attendance
const getStudentAttendance = async (id, schoolId, filters = {}) => {
  let sql = `
    SELECT
      a.*,
      c.name as course_name
    FROM attendance a
    LEFT JOIN courses c ON a.course_id = c.id
    WHERE a.student_id = $1 AND a.school_id = $2
  `;

  const params = [id, schoolId];
  let paramIndex = 3;

  if (filters.startDate) {
    sql += ` AND a.date >= $${paramIndex}`;
    params.push(filters.startDate);
    paramIndex++;
  }

  if (filters.endDate) {
    sql += ` AND a.date <= $${paramIndex}`;
    params.push(filters.endDate);
    paramIndex++;
  }

  sql += ' ORDER BY a.date DESC';

  const result = await query(sql, params);
  return result.rows;
};

module.exports = {
  createStudentAndParent,
  getStudents,
  getStudentsBySchool,
  getStudentById,
  updateStudent,
  deleteStudent,
  getStudentPerformance,
  getStudentAttendance
};