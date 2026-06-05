const { dbRun, dbGet, dbAll } = require('../database');

class AttendanceService {
  async recordDailyAttendance(schoolId, courseId, attendanceDate, attendanceRecords, recordedBy = null) {
    try {
      const course = await dbGet(
        'SELECT * FROM courses WHERE id = ? AND school_id = ?',
        [courseId, schoolId]
      );

      if (!course) {
        throw new Error('Course not found');
      }

      const results = [];

      for (const record of attendanceRecords) {
        const { student_id, status, check_in_time = null, check_out_time = null, remarks = null } = record;

        if (!['present', 'absent', 'late', 'excused'].includes(status)) {
          throw new Error(`Invalid attendance status: ${status}`);
        }

        const existing = await dbGet(
          `SELECT id FROM attendance 
           WHERE school_id = ? AND student_id = ? AND course_id = ? AND date = ?`,
          [schoolId, student_id, courseId, attendanceDate]
        );

        if (existing) {
          await dbRun(
            `UPDATE attendance 
             SET status = ?, check_in_time = ?, check_out_time = ?, remarks = ?, recorded_by = ?, recorded_at = NOW()
             WHERE id = ?`,
            [status, check_in_time, check_out_time, remarks, recordedBy, existing.id]
          );
          results.push({ student_id, status, action: 'updated' });
        } else {
          const result = await dbRun(
            `INSERT INTO attendance (school_id, student_id, course_id, date, status, check_in_time, check_out_time, remarks, recorded_by, recorded_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
            [schoolId, student_id, courseId, attendanceDate, status, check_in_time, check_out_time, remarks, recordedBy]
          );
          results.push({ student_id, status, action: 'created', id: result.lastID });
        }
      }

      return {
        date: attendanceDate,
        course_id: courseId,
        records_processed: results.length,
        results: results
      };
    } catch (error) {
      throw new Error(`Failed to record attendance: ${error.message}`);
    }
  }

  async getClassAttendance(schoolId, courseId, startDate, endDate = null) {
    try {
      const params = [schoolId, courseId, startDate];
      let sql = `
        SELECT 
          a.id,
          a.student_id,
          s.first_name,
          s.last_name,
          a.date,
          a.status,
          a.recorded_at
        FROM attendance a
        JOIN students s ON a.student_id = s.id
        WHERE a.school_id = ? AND a.course_id = ? AND a.date >= ?
      `;

      if (endDate) {
        sql += ` AND a.date <= ?`;
        params.push(endDate);
      }

      sql += ` ORDER BY a.date DESC, s.first_name, s.last_name`;

      const attendance = await dbAll(sql, params);

      const grouped = this.groupAttendanceByDate(attendance);

      return {
        course_id: courseId,
        date_range: { start: startDate, end: endDate || startDate },
        records_count: attendance.length,
        attendance_by_date: grouped
      };
    } catch (error) {
      throw new Error(`Failed to fetch class attendance: ${error.message}`);
    }
  }

  async getStudentAttendance(schoolId, studentId, startDate = null, endDate = null) {
    try {
      const params = [schoolId, studentId];
      let sql = `
        SELECT 
          a.id,
          a.course_id,
          c.name as course_name,
          a.date,
          a.status,
          a.recorded_at
        FROM attendance a
        JOIN courses c ON a.course_id = c.id
        WHERE a.school_id = ? AND a.student_id = ?
      `;

      if (startDate) {
        sql += ` AND a.date >= ?`;
        params.push(startDate);
      }

      if (endDate) {
        sql += ` AND a.date <= ?`;
        params.push(endDate);
      }

      sql += ` ORDER BY a.date DESC`;

      const attendance = await dbAll(sql, params);

      const stats = this.calculateAttendanceStats(attendance);

      return {
        student_id: studentId,
        date_range: { start: startDate, end: endDate },
        attendance_records: attendance,
        statistics: stats
      };
    } catch (error) {
      throw new Error(`Failed to fetch student attendance: ${error.message}`);
    }
  }

  calculateAttendanceStats(attendanceRecords) {
    const stats = {
      total_days: attendanceRecords.length,
      present: 0,
      absent: 0,
      late: 0,
      excused: 0,
      attendance_rate: 0
    };

    attendanceRecords.forEach(record => {
      if (record.status === 'present') stats.present++;
      else if (record.status === 'absent') stats.absent++;
      else if (record.status === 'late') stats.late++;
      else if (record.status === 'excused') stats.excused++;
    });

    if (stats.total_days > 0) {
      stats.attendance_rate = Math.round(
        ((stats.present + stats.excused) / stats.total_days) * 100
      );
    }

    return stats;
  }

  groupAttendanceByDate(attendanceRecords) {
    const grouped = {};

    attendanceRecords.forEach(record => {
      const date = record.date;

      if (!grouped[date]) {
        grouped[date] = {
          date: date,
          students: []
        };
      }

      grouped[date].students.push({
        student_id: record.student_id,
        student_name: `${record.first_name} ${record.last_name}`,
        status: record.status
      });
    });

    return grouped;
  }

  async getTermAttendanceSummary(schoolId, studentId, termId) {
    try {
      const attendance = await dbAll(
        `SELECT 
           a.status,
           COUNT(*) as count
         FROM attendance a
         JOIN courses c ON a.course_id = c.id
         JOIN exams e ON c.id = e.course_id
         WHERE a.school_id = ? AND a.student_id = ? AND e.term_id = ?
         GROUP BY a.status`,
        [schoolId, studentId, termId]
      );

      const stats = {
        present: 0,
        absent: 0,
        late: 0,
        excused: 0,
        total: 0
      };

      let total = 0;
      attendance.forEach(record => {
        stats[record.status] = record.count;
        total += record.count;
      });

      stats.total = total;

      if (total > 0) {
        stats.attendance_rate = Math.round(
          ((stats.present + stats.excused) / total) * 100
        );
      }

      return stats;
    } catch (error) {
      console.error('Term attendance error:', error);
      return { present: 0, absent: 0, late: 0, excused: 0, total: 0, attendance_rate: 0 };
    }
  }
}

module.exports = new AttendanceService();
