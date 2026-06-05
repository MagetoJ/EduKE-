const express = require('express');
const gradebookRouter = express.Router();
const { authorizeRole, requireFeature } = require('../middleware/auth');
const gradebookService = require('../services/gradebookService');
const { dbGet, dbAll } = require('../database');

gradebookRouter.get(
  '/student/:studentId',
  authorizeRole(['admin', 'teacher', 'parent', 'student', 'super_admin', 'exam_officer', 'hod']),
  async (req, res) => {
    try {
      const { studentId } = req.params;
      const { schoolId, user } = req;

      if (user.role === 'student' && user.id !== studentId) {
        return res.status(403).json({ error: 'Unauthorized' });
      }

      const performance = await gradebookService.getStudentCoursePerformance(schoolId, studentId);

      res.json({
        success: true,
        data: performance
      });
    } catch (error) {
      console.error('Error fetching student gradebook:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }
);

gradebookRouter.get(
  '/course/:courseId',
  authorizeRole(['admin', 'teacher', 'super_admin', 'exam_officer', 'hod']),
  async (req, res) => {
    try {
      const { courseId } = req.params;
      const { schoolId } = req;

      const course = await dbGet(
        'SELECT * FROM courses WHERE id = ? AND school_id = ?',
        [courseId, schoolId]
      );

      if (!course) {
        return res.status(404).json({ error: 'Course not found' });
      }

      const gradebook = await gradebookService.getClassGradebook(schoolId, courseId);

      const classStats = {
        total_students: gradebook.length,
        average_grade: gradebook.length > 0 
          ? Math.round(gradebook.reduce((sum, s) => sum + s.numeric_grade, 0) / gradebook.length * 100) / 100
          : 0,
        highest_grade: gradebook.length > 0 ? gradebook[0].numeric_grade : 0,
        lowest_grade: gradebook.length > 0 ? gradebook[gradebook.length - 1].numeric_grade : 0
      };

      res.json({
        success: true,
        data: {
          course: course,
          gradebook: gradebook,
          stats: classStats
        }
      });
    } catch (error) {
      console.error('Error fetching course gradebook:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }
);

gradebookRouter.get(
  '/student/:studentId/course/:courseId',
  authorizeRole(['admin', 'teacher', 'parent', 'student', 'super_admin', 'exam_officer', 'hod']),
  async (req, res) => {
    try {
      const { studentId, courseId } = req.params;
      const { schoolId, user } = req;

      if (user.role === 'student' && user.id !== studentId) {
        return res.status(403).json({ error: 'Unauthorized' });
      }

      const grades = await gradebookService.getStudentGrades(schoolId, studentId, courseId);
      const assignments = await gradebookService.getAssignmentScores(schoolId, studentId, courseId);
      const weighted = await gradebookService.calculateWeightedGrade(schoolId, studentId, courseId);

      res.json({
        success: true,
        data: {
          exam_grades: grades,
          assignment_scores: assignments,
          weighted_grade: weighted.weighted_grade,
          letter_grade: gradebookService.getLetterGrade(weighted.weighted_grade),
          category_breakdown: weighted.category_averages
        }
      });
    } catch (error) {
      console.error('Error fetching course grades:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }
);

gradebookRouter.post(
  '/record-score',
  authorizeRole(['admin', 'teacher', 'super_admin', 'exam_officer', 'hod']),
  async (req, res) => {
    try {
      const { schoolId } = req;
      const { exam_id, student_id, score } = req.body;

      if (!exam_id || !student_id || score === undefined) {
        return res.status(400).json({
          error: 'Missing required fields: exam_id, student_id, score'
        });
      }

      const exam = await dbGet(
        'SELECT * FROM exams WHERE id = ? AND school_id = ?',
        [exam_id, schoolId]
      );

      if (!exam) {
        return res.status(404).json({ error: 'Exam not found' });
      }

      if (score < 0 || score > exam.total_marks) {
        return res.status(400).json({
          error: `Score must be between 0 and ${exam.total_marks}`
        });
      }

      const resultId = await gradebookService.recordExamScore(schoolId, exam_id, student_id, score);

      res.json({
        success: true,
        message: 'Score recorded successfully',
        data: { result_id: resultId }
      });
    } catch (error) {
      console.error('Error recording score:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }
);

gradebookRouter.get(
  '/term/:termId/student/:studentId',
  authorizeRole(['admin', 'teacher', 'parent', 'student', 'super_admin', 'exam_officer', 'hod']),
  async (req, res) => {
    try {
      const { termId, studentId } = req.params;
      const { schoolId, user } = req;

      if (user.role === 'student' && user.id !== studentId) {
        return res.status(403).json({ error: 'Unauthorized' });
      }

      const termGrades = await gradebookService.getTermGrades(schoolId, studentId, termId);

      if (termGrades.length === 0) {
        return res.json({
          success: true,
          data: { term_grades: [], message: 'No grades found for this term' }
        });
      }

      const termAverage = Math.round(
        termGrades.reduce((sum, g) => sum + g.grade, 0) / termGrades.length * 100
      ) / 100;

      res.json({
        success: true,
        data: {
          term_grades: termGrades,
          term_average: termAverage,
          term_standing: gradebookService.getAcademicStanding(termAverage / 25)
        }
      });
    } catch (error) {
      console.error('Error fetching term grades:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }
);

gradebookRouter.put(
  '/score/:resultId',
  authorizeRole(['admin', 'teacher', 'super_admin', 'exam_officer', 'hod']),
  async (req, res) => {
    try {
      const { resultId } = req.params;
      const { schoolId } = req;
      const { score } = req.body;

      if (score === undefined) {
        return res.status(400).json({ error: 'Score is required' });
      }

      await gradebookService.updateGrade(schoolId, resultId, score);

      res.json({
        success: true,
        message: 'Grade updated successfully'
      });
    } catch (error) {
      console.error('Error updating grade:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }
);

module.exports = gradebookRouter;
