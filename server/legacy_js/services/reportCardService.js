const { dbGet, dbAll } = require('../database');
const gradebookService = require('./gradebookService');

class ReportCardService {
  async generateReportCard(schoolId, studentId, termId, academicYearId) {
    try {
      const student = await dbGet(
        `SELECT s.*, u.email as parent_email 
         FROM students s 
         LEFT JOIN users u ON s.parent_id = u.id
         WHERE s.id = ? AND s.school_id = ?`,
        [studentId, schoolId]
      );

      if (!student) {
        throw new Error('Student not found');
      }

      const term = await dbGet(
        'SELECT * FROM terms WHERE id = ? AND school_id = ?',
        [termId, schoolId]
      );

      if (!term) {
        throw new Error('Term not found');
      }

      const academicYear = await dbGet(
        'SELECT * FROM academic_years WHERE id = ? AND school_id = ?',
        [academicYearId, schoolId]
      );

      if (!academicYear) {
        throw new Error('Academic year not found');
      }

      const school = await dbGet(
        'SELECT * FROM schools WHERE id = ?',
        [schoolId]
      );

      const termGrades = await gradebookService.getTermGrades(schoolId, studentId, termId);

      const attendance = await this.getStudentTermAttendance(schoolId, studentId, termId);

      const disciplineRecords = await dbAll(
        `SELECT * FROM discipline_records 
         WHERE school_id = ? AND student_id = ? AND term_id = ?
         ORDER BY incident_date DESC`,
        [schoolId, studentId, termId]
      );

      const commentsByTeacher = await dbAll(
        `SELECT c.comment, c.teacher_id, u.name as teacher_name
         FROM report_comments c
         JOIN users u ON c.teacher_id = u.id
         WHERE c.school_id = ? AND c.student_id = ? AND c.term_id = ?`,
        [schoolId, studentId, termId]
      );

      const overallAverage = termGrades.length > 0
        ? Math.round(termGrades.reduce((sum, g) => sum + g.grade, 0) / termGrades.length * 100) / 100
        : 0;

      const position = await this.getStudentClassPosition(schoolId, studentId, termId);

      const adminComments = await this.getAdminComments(schoolId, studentId, termId);

      return {
        school_info: {
          name: school.name,
          address: school.address,
          phone: school.phone,
          email: school.email
        },
        student_info: {
          id: student.id,
          name: `${student.first_name} ${student.last_name}`,
          admission_number: student.student_id_number,
          grade: student.grade,
          class: student.class_section,
          date_of_birth: student.date_of_birth,
          enrollment_date: student.enrollment_date
        },
        academic_info: {
          academic_year: academicYear.name,
          term: term.name,
          term_dates: {
            start: term.start_date,
            end: term.end_date
          }
        },
        performance: {
          courses: termGrades,
          overall_average: overallAverage,
          position: position,
          standing: gradebookService.getAcademicStanding(overallAverage / 25)
        },
        attendance: attendance,
        discipline: {
          incidents: disciplineRecords || [],
          summary: `${disciplineRecords?.length || 0} incident(s) recorded`
        },
        comments: {
          by_teacher: commentsByTeacher || [],
          admin_comments: adminComments || {}
        },
        generated_date: new Date().toISOString()
      };
    } catch (error) {
      throw new Error(`Failed to generate report card: ${error.message}`);
    }
  }

  async getStudentTermAttendance(schoolId, studentId, termId) {
    try {
      const attendance = await dbAll(
        `SELECT 
           DATE(attendance_date) as date,
           status,
           COUNT(*) as count
         FROM attendance
         WHERE school_id = ? AND student_id = ? AND term_id = ?
         GROUP BY DATE(attendance_date), status
         ORDER BY DATE(attendance_date) DESC`,
        [schoolId, studentId, termId]
      );

      const totalDays = await dbGet(
        `SELECT COUNT(DISTINCT DATE(attendance_date)) as total
         FROM attendance
         WHERE school_id = ? AND student_id = ? AND term_id = ?`,
        [schoolId, studentId, termId]
      );

      const presentCount = attendance.filter(a => a.status === 'present').length;
      const absentCount = attendance.filter(a => a.status === 'absent').length;
      const lateCount = attendance.filter(a => a.status === 'late').length;

      const attendancePercentage = totalDays.total > 0
        ? Math.round((presentCount / totalDays.total) * 100)
        : 0;

      return {
        present: presentCount,
        absent: absentCount,
        late: lateCount,
        total_school_days: totalDays.total,
        attendance_percentage: attendancePercentage,
        records: attendance
      };
    } catch (error) {
      throw new Error(`Failed to get attendance: ${error.message}`);
    }
  }

  async getStudentClassPosition(schoolId, studentId, termId) {
    try {
      const allTermGrades = await dbAll(
        `SELECT s.id, AVG(CAST(er.score AS FLOAT) / CAST(e.total_marks AS FLOAT)) as avg_grade
         FROM students s
         JOIN exam_results er ON s.id = er.student_id
         JOIN exams e ON er.exam_id = e.id
         JOIN terms t ON e.term_id = t.id
         WHERE s.school_id = ? AND t.id = ?
         GROUP BY s.id
         ORDER BY avg_grade DESC`,
        [schoolId, termId]
      );

      const position = allTermGrades.findIndex(s => s.id === studentId) + 1;
      const totalStudents = allTermGrades.length;

      return {
        position: position,
        out_of: totalStudents
      };
    } catch (error) {
      console.error('Failed to get class position:', error);
      return { position: 0, out_of: 0 };
    }
  }

  async getAdminComments(schoolId, studentId, termId) {
    try {
      const comments = await dbGet(
        `SELECT 
           headmaster_comment,
           overall_conduct,
           next_term_focus,
           promoted
         FROM report_card_admin_comments
         WHERE school_id = ? AND student_id = ? AND term_id = ?`,
        [schoolId, studentId, termId]
      );

      return comments || {};
    } catch (error) {
      console.error('Failed to get admin comments:', error);
      return {};
    }
  }

  async generateBulkReportCards(schoolId, gradeLevel, termId, academicYearId) {
    try {
      const students = await dbAll(
        `SELECT id FROM students 
         WHERE school_id = ? AND grade = ? AND status = 'active'`,
        [schoolId, gradeLevel]
      );

      const reportCards = [];

      for (const student of students) {
        const reportCard = await this.generateReportCard(
          schoolId,
          student.id,
          termId,
          academicYearId
        );
        reportCards.push(reportCard);
      }

      return reportCards;
    } catch (error) {
      throw new Error(`Failed to generate bulk report cards: ${error.message}`);
    }
  }

  async saveReportCardComment(schoolId, studentId, termId, comment, commentType = 'teacher', userId = null) {
    try {
      const { dbRun } = require('../database');

      if (commentType === 'teacher') {
        const existing = await dbGet(
          `SELECT id FROM report_comments 
           WHERE school_id = ? AND student_id = ? AND term_id = ? AND teacher_id = ?`,
          [schoolId, studentId, termId, userId]
        );

        if (existing) {
          await dbRun(
            `UPDATE report_comments SET comment = ? WHERE id = ?`,
            [comment, existing.id]
          );
        } else {
          await dbRun(
            `INSERT INTO report_comments (school_id, student_id, term_id, teacher_id, comment, created_at)
             VALUES (?, ?, ?, ?, ?, NOW())`,
            [schoolId, studentId, termId, userId, comment]
          );
        }
      }

      return true;
    } catch (error) {
      throw new Error(`Failed to save comment: ${error.message}`);
    }
  }

  generatePDFTemplate(reportCardData) {
    const HTMLContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Report Card - ${reportCardData.student_info.name}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; }
    .container { max-width: 850px; margin: 0 auto; padding: 20px; }
    .header { 
      text-align: center; 
      margin-bottom: 30px; 
      border-bottom: 3px solid #333; 
      padding-bottom: 15px; 
    }
    .school-name { font-size: 24px; font-weight: bold; }
    .school-info { font-size: 12px; color: #666; margin-top: 5px; }
    .student-section { margin-bottom: 20px; }
    .section-title { 
      background-color: #34495e; 
      color: white; 
      padding: 10px; 
      font-weight: bold; 
      margin-top: 20px;
    }
    .student-info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 20px; }
    .info-item { font-size: 13px; }
    .info-label { font-weight: bold; color: #333; }
    .info-value { color: #555; margin-top: 3px; }
    .grades-table { 
      width: 100%; 
      border-collapse: collapse; 
      margin-top: 15px; 
      font-size: 13px;
    }
    .grades-table th { 
      background-color: #95a5a6; 
      color: white; 
      padding: 10px; 
      text-align: left; 
      font-weight: bold;
    }
    .grades-table td { 
      padding: 10px; 
      border-bottom: 1px solid #ddd; 
    }
    .grades-table tr:nth-child(even) { 
      background-color: #f9f9f9; 
    }
    .attendance-grid { 
      display: grid; 
      grid-template-columns: repeat(4, 1fr); 
      gap: 15px; 
      margin-top: 15px;
    }
    .attendance-box { 
      padding: 15px; 
      background-color: #ecf0f1; 
      border-radius: 5px; 
      text-align: center;
    }
    .attendance-number { 
      font-size: 24px; 
      font-weight: bold; 
      color: #2980b9; 
    }
    .attendance-label { 
      font-size: 11px; 
      color: #555; 
      margin-top: 5px;
    }
    .position-box { 
      background-color: #e8f8f5; 
      padding: 15px; 
      border-left: 4px solid #16a085; 
      margin-top: 15px;
    }
    .comment-box { 
      background-color: #fef5e7; 
      padding: 15px; 
      border-left: 4px solid #f39c12; 
      margin-top: 15px; 
      font-size: 13px;
    }
    .comment-author { 
      font-weight: bold; 
      color: #333; 
      margin-top: 8px;
    }
    .footer { 
      margin-top: 40px; 
      border-top: 1px solid #999; 
      padding-top: 15px; 
      font-size: 11px; 
      text-align: center; 
      color: #666;
    }
    .grade-good { color: #27ae60; font-weight: bold; }
    .grade-fair { color: #f39c12; font-weight: bold; }
    .grade-poor { color: #e74c3c; font-weight: bold; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="school-name">${reportCardData.school_info.name}</div>
      <div class="school-info">
        ${reportCardData.school_info.address || ''}<br>
        Phone: ${reportCardData.school_info.phone || ''} | Email: ${reportCardData.school_info.email || ''}
      </div>
    </div>

    <div class="section-title">STUDENT INFORMATION</div>
    <div class="student-info-grid">
      <div class="info-item">
        <div class="info-label">Student Name:</div>
        <div class="info-value">${reportCardData.student_info.name}</div>
      </div>
      <div class="info-item">
        <div class="info-label">Admission No:</div>
        <div class="info-value">${reportCardData.student_info.admission_number}</div>
      </div>
      <div class="info-item">
        <div class="info-label">Grade:</div>
        <div class="info-value">${reportCardData.student_info.grade}</div>
      </div>
      <div class="info-item">
        <div class="info-label">Class:</div>
        <div class="info-value">${reportCardData.student_info.class || 'N/A'}</div>
      </div>
      <div class="info-item">
        <div class="info-label">Academic Year:</div>
        <div class="info-value">${reportCardData.academic_info.academic_year}</div>
      </div>
      <div class="info-item">
        <div class="info-label">Term:</div>
        <div class="info-value">${reportCardData.academic_info.term}</div>
      </div>
    </div>

    <div class="section-title">ACADEMIC PERFORMANCE</div>
    <table class="grades-table">
      <thead>
        <tr>
          <th>Subject/Course</th>
          <th>Grade</th>
          <th>Remarks</th>
        </tr>
      </thead>
      <tbody>
        ${reportCardData.performance.courses.map(course => {
          let gradeClass = 'grade-good';
          if (course.grade < 60) gradeClass = 'grade-poor';
          else if (course.grade < 75) gradeClass = 'grade-fair';
          
          return `
          <tr>
            <td>${course.course_name}</td>
            <td class="${gradeClass}">${course.letter_grade} (${course.grade})</td>
            <td>${course.grade >= 75 ? 'Excellent' : course.grade >= 60 ? 'Satisfactory' : 'Needs Improvement'}</td>
          </tr>
          `;
        }).join('')}
        <tr style="background-color: #ecf0f1; font-weight: bold;">
          <td>OVERALL AVERAGE</td>
          <td>${reportCardData.performance.overall_average}</td>
          <td>${reportCardData.performance.standing}</td>
        </tr>
      </tbody>
    </table>

    <div class="position-box">
      <strong>Class Position: </strong> ${reportCardData.performance.position.position} out of ${reportCardData.performance.position.out_of}
    </div>

    <div class="section-title">ATTENDANCE RECORD</div>
    <div class="attendance-grid">
      <div class="attendance-box">
        <div class="attendance-number">${reportCardData.attendance.present}</div>
        <div class="attendance-label">Days Present</div>
      </div>
      <div class="attendance-box">
        <div class="attendance-number">${reportCardData.attendance.absent}</div>
        <div class="attendance-label">Days Absent</div>
      </div>
      <div class="attendance-box">
        <div class="attendance-number">${reportCardData.attendance.late}</div>
        <div class="attendance-label">Times Late</div>
      </div>
      <div class="attendance-box">
        <div class="attendance-number">${reportCardData.attendance.attendance_percentage}%</div>
        <div class="attendance-label">Attendance Rate</div>
      </div>
    </div>

    ${reportCardData.comments.by_teacher && reportCardData.comments.by_teacher.length > 0 ? `
    <div class="section-title">TEACHER COMMENTS</div>
    ${reportCardData.comments.by_teacher.map(comment => `
      <div class="comment-box">
        ${comment.comment}
        <div class="comment-author">- ${comment.teacher_name}</div>
      </div>
    `).join('')}
    ` : ''}

    <div class="footer">
      Report Generated on: ${new Date(reportCardData.generated_date).toLocaleDateString()}
    </div>
  </div>
</body>
</html>
    `;

    return HTMLContent;
  }
}

module.exports = new ReportCardService();
