const { dbRun, dbGet, dbAll } = require('../database');

class GradebookService {
  async getStudentGrades(schoolId, studentId, courseId = null) {
    try {
      let sql = `
        SELECT 
          er.id as result_id,
          er.student_id,
          er.exam_id,
          er.score,
          er.created_at as graded_at,
          e.name as exam_name,
          e.exam_type,
          e.total_marks,
          c.id as course_id,
          c.name as course_name,
          c.subject_area
        FROM exam_results er
        JOIN exams e ON er.exam_id = e.id
        JOIN courses c ON e.course_id = c.id
        WHERE er.school_id = ? AND er.student_id = ?
      `;

      const params = [schoolId, studentId];

      if (courseId) {
        sql += ' AND c.id = ?';
        params.push(courseId);
      }

      sql += ' ORDER BY c.name, e.exam_type, er.created_at DESC';

      const results = await dbAll(sql, params);
      return results || [];
    } catch (error) {
      throw new Error(`Failed to get student grades: ${error.message}`);
    }
  }

  async getAssignmentScores(schoolId, studentId, courseId = null) {
    try {
      let sql = `
        SELECT 
          asub.id as submission_id,
          asub.student_id,
          asub.assignment_id,
          asub.score,
          asub.created_at as submitted_at,
          a.title as assignment_title,
          a.max_score,
          c.id as course_id,
          c.name as course_name
        FROM assignment_submissions asub
        JOIN assignments a ON asub.assignment_id = a.id
        JOIN courses c ON a.course_id = c.id
        WHERE asub.school_id = ? AND asub.student_id = ? AND asub.status = 'submitted'
      `;

      const params = [schoolId, studentId];

      if (courseId) {
        sql += ' AND c.id = ?';
        params.push(courseId);
      }

      sql += ' ORDER BY c.name, a.due_date DESC';

      const results = await dbAll(sql, params);
      return results || [];
    } catch (error) {
      throw new Error(`Failed to get assignment scores: ${error.message}`);
    }
  }

  async calculateWeightedGrade(schoolId, studentId, courseId, weights = {}) {
    try {
      const assignments = await this.getAssignmentScores(schoolId, studentId, courseId);
      const exams = await this.getStudentGrades(schoolId, studentId, courseId);

      const defaultWeights = {
        homework: 0.10,
        quiz: 0.20,
        midterm: 0.30,
        final_exam: 0.40,
        ...weights
      };

      const categoryScores = {
        homework: [],
        quiz: [],
        midterm: [],
        final_exam: [],
        other: []
      };

      assignments.forEach(assignment => {
        const percentage = (assignment.score / assignment.max_score) * 100;
        const category = assignment.assignment_title.toLowerCase().includes('homework') 
          ? 'homework' 
          : assignment.assignment_title.toLowerCase().includes('quiz')
          ? 'quiz'
          : 'other';
        categoryScores[category].push(percentage);
      });

      exams.forEach(exam => {
        const percentage = (exam.score / exam.total_marks) * 100;
        const category = exam.exam_type.toLowerCase().includes('midterm')
          ? 'midterm'
          : exam.exam_type.toLowerCase().includes('final')
          ? 'final_exam'
          : 'other';
        categoryScores[category].push(percentage);
      });

      const categoryAverages = {};
      Object.keys(categoryScores).forEach(category => {
        if (categoryScores[category].length > 0) {
          const sum = categoryScores[category].reduce((a, b) => a + b, 0);
          categoryAverages[category] = sum / categoryScores[category].length;
        }
      });

      let weightedGrade = 0;
      let totalWeight = 0;

      Object.keys(defaultWeights).forEach(category => {
        if (categoryAverages[category] !== undefined) {
          weightedGrade += categoryAverages[category] * defaultWeights[category];
          totalWeight += defaultWeights[category];
        }
      });

      if (totalWeight > 0) {
        weightedGrade = weightedGrade / totalWeight;
      }

      return {
        weighted_grade: Math.round(weightedGrade * 100) / 100,
        category_averages: categoryAverages,
        weights: defaultWeights,
        total_weight: totalWeight
      };
    } catch (error) {
      throw new Error(`Failed to calculate weighted grade: ${error.message}`);
    }
  }

  async getClassGradebook(schoolId, courseId) {
    try {
      const enrollments = await dbAll(
        `SELECT DISTINCT s.id as student_id, s.first_name, s.last_name
         FROM course_enrollments ce
         JOIN students s ON ce.student_id = s.id
         WHERE ce.course_id = ? AND s.school_id = ?
         ORDER BY s.first_name, s.last_name`,
        [courseId, schoolId]
      );

      const gradebook = [];

      for (const student of enrollments) {
        const grade = await this.calculateWeightedGrade(schoolId, student.student_id, courseId);
        
        const letterGrade = this.getLetterGrade(grade.weighted_grade);
        
        gradebook.push({
          student_id: student.student_id,
          student_name: `${student.first_name} ${student.last_name}`,
          numeric_grade: grade.weighted_grade,
          letter_grade: letterGrade,
          category_averages: grade.category_averages,
          weights: grade.weights
        });
      }

      return gradebook.sort((a, b) => b.numeric_grade - a.numeric_grade);
    } catch (error) {
      throw new Error(`Failed to get class gradebook: ${error.message}`);
    }
  }

  getLetterGrade(percentage) {
    if (percentage >= 90) return 'A';
    if (percentage >= 80) return 'B';
    if (percentage >= 70) return 'C';
    if (percentage >= 60) return 'D';
    if (percentage >= 50) return 'E';
    return 'F';
  }

  getGradePoints(letterGrade) {
    const points = {
      'A': 4.0,
      'A-': 3.7,
      'B+': 3.3,
      'B': 3.0,
      'B-': 2.7,
      'C+': 2.3,
      'C': 2.0,
      'C-': 1.7,
      'D+': 1.3,
      'D': 1.0,
      'F': 0.0
    };
    return points[letterGrade] || 0;
  }

  async getStudentCoursePerformance(schoolId, studentId) {
    try {
      const courses = await dbAll(
        `SELECT DISTINCT c.id, c.name FROM course_enrollments ce
         JOIN courses c ON ce.course_id = c.id
         WHERE ce.school_id = ? AND ce.student_id = ?`,
        [schoolId, studentId]
      );

      const performance = [];

      for (const course of courses) {
        const grades = await this.calculateWeightedGrade(schoolId, studentId, course.id);
        
        performance.push({
          course_id: course.id,
          course_name: course.name,
          weighted_grade: grades.weighted_grade,
          letter_grade: this.getLetterGrade(grades.weighted_grade),
          category_breakdown: grades.category_averages
        });
      }

      const gpa = this.calculateGPA(performance);

      return {
        courses: performance,
        gpa: gpa,
        standing: this.getAcademicStanding(gpa)
      };
    } catch (error) {
      throw new Error(`Failed to get student performance: ${error.message}`);
    }
  }

  calculateGPA(coursePerformance) {
    if (coursePerformance.length === 0) return 0;
    
    const totalPoints = coursePerformance.reduce((sum, course) => {
      return sum + this.getGradePoints(course.letter_grade);
    }, 0);

    return Math.round((totalPoints / coursePerformance.length) * 100) / 100;
  }

  getAcademicStanding(gpa) {
    if (gpa >= 3.5) return 'Excellent';
    if (gpa >= 3.0) return 'Good';
    if (gpa >= 2.0) return 'Satisfactory';
    if (gpa > 0) return 'Needs Improvement';
    return 'Failing';
  }

  async updateGrade(schoolId, resultId, newScore) {
    try {
      await dbRun(
        `UPDATE exam_results 
         SET score = ? 
         WHERE id = ? AND school_id = ?`,
        [newScore, resultId, schoolId]
      );

      return true;
    } catch (error) {
      throw new Error(`Failed to update grade: ${error.message}`);
    }
  }

  async recordExamScore(schoolId, examId, studentId, score) {
    try {
      const existing = await dbGet(
        `SELECT id FROM exam_results 
         WHERE exam_id = ? AND student_id = ? AND school_id = ?`,
        [examId, studentId, schoolId]
      );

      if (existing) {
        await dbRun(
          `UPDATE exam_results SET score = ?, updated_at = NOW()
           WHERE id = ?`,
          [score, existing.id]
        );
        return existing.id;
      } else {
        const result = await dbRun(
          `INSERT INTO exam_results (exam_id, student_id, school_id, score, created_at)
           VALUES (?, ?, ?, ?, NOW())`,
          [examId, studentId, schoolId, score]
        );
        return result.lastID;
      }
    } catch (error) {
      throw new Error(`Failed to record exam score: ${error.message}`);
    }
  }

  async getTermGrades(schoolId, studentId, termId) {
    try {
      const termCourses = await dbAll(
        `SELECT DISTINCT c.id, c.name
         FROM courses c
         JOIN exams e ON c.id = e.course_id
         JOIN terms t ON e.term_id = t.id
         WHERE t.id = ? AND c.school_id = ?`,
        [termId, schoolId]
      );

      const termGrades = [];

      for (const course of termCourses) {
        const grades = await this.calculateWeightedGrade(schoolId, studentId, course.id);
        termGrades.push({
          course_id: course.id,
          course_name: course.name,
          grade: grades.weighted_grade,
          letter_grade: this.getLetterGrade(grades.weighted_grade)
        });
      }

      return termGrades;
    } catch (error) {
      throw new Error(`Failed to get term grades: ${error.message}`);
    }
  }
}

module.exports = new GradebookService();
