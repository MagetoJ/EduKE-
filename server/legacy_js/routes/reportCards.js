const express = require('express');
const reportCardRouter = express.Router();
const { authorizeRole, requireFeature } = require('../middleware/auth');
const reportCardService = require('../services/reportCardService');
const { dbGet, dbAll } = require('../database');

reportCardRouter.get(
  '/student/:studentId/term/:termId',
  authorizeRole(['admin', 'teacher', 'parent', 'student', 'super_admin', 'exam_officer', 'hod']),
  async (req, res) => {
    try {
      const { studentId, termId } = req.params;
      const { schoolId, user } = req;

      if (user.role === 'student' && user.id !== studentId) {
        return res.status(403).json({ error: 'Unauthorized' });
      }

      const academicYear = await dbGet(
        `SELECT ay.id FROM academic_years ay
         JOIN terms t ON t.academic_year_id = ay.id
         WHERE t.id = ? AND ay.school_id = ?`,
        [termId, schoolId]
      );

      if (!academicYear) {
        return res.status(404).json({ error: 'Academic year not found' });
      }

      const reportCard = await reportCardService.generateReportCard(
        schoolId,
        studentId,
        termId,
        academicYear.id
      );

      res.json({
        success: true,
        data: reportCard
      });
    } catch (error) {
      console.error('Error generating report card:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }
);

reportCardRouter.get(
  '/student/:studentId/term/:termId/pdf',
  authorizeRole(['admin', 'teacher', 'parent', 'student', 'super_admin', 'exam_officer', 'hod']),
  async (req, res) => {
    try {
      const { studentId, termId } = req.params;
      const { schoolId, user } = req;

      if (user.role === 'student' && user.id !== studentId) {
        return res.status(403).json({ error: 'Unauthorized' });
      }

      const academicYear = await dbGet(
        `SELECT ay.id FROM academic_years ay
         JOIN terms t ON t.academic_year_id = ay.id
         WHERE t.id = ? AND ay.school_id = ?`,
        [termId, schoolId]
      );

      if (!academicYear) {
        return res.status(404).json({ error: 'Academic year not found' });
      }

      const reportCard = await reportCardService.generateReportCard(
        schoolId,
        studentId,
        termId,
        academicYear.id
      );

      const htmlContent = reportCardService.generatePDFTemplate(reportCard);

      try {
        const puppeteer = require('puppeteer');
        const browser = await puppeteer.launch({ headless: 'new' });
        const page = await browser.newPage();
        await page.setContent(htmlContent);

        const pdfBuffer = await page.pdf({
          format: 'A4',
          margin: {
            top: '10mm',
            right: '10mm',
            bottom: '10mm',
            left: '10mm'
          }
        });

        await browser.close();

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader(
          'Content-Disposition',
          `attachment; filename="ReportCard_${reportCard.student_info.name.replace(/\s+/g, '_')}_${termId}.pdf"`
        );

        res.send(pdfBuffer);
      } catch (puppeteerError) {
        console.warn('Puppeteer not available, returning HTML instead:', puppeteerError.message);
        res.setHeader('Content-Type', 'text/html');
        res.send(htmlContent);
      }
    } catch (error) {
      console.error('Error generating PDF report card:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }
);

reportCardRouter.post(
  '/bulk-generate',
  authorizeRole(['admin', 'super_admin', 'exam_officer']),
  async (req, res) => {
    try {
      const { schoolId } = req;
      const { grade_level, term_id, academic_year_id } = req.body;

      if (!grade_level || !term_id || !academic_year_id) {
        return res.status(400).json({
          error: 'Missing required fields: grade_level, term_id, academic_year_id'
        });
      }

      const reportCards = await reportCardService.generateBulkReportCards(
        schoolId,
        grade_level,
        term_id,
        academic_year_id
      );

      res.json({
        success: true,
        data: {
          count: reportCards.length,
          report_cards: reportCards
        }
      });
    } catch (error) {
      console.error('Error generating bulk report cards:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }
);

reportCardRouter.post(
  '/comment',
  authorizeRole(['admin', 'teacher', 'super_admin', 'exam_officer', 'hod']),
  async (req, res) => {
    try {
      const { schoolId, user } = req;
      const { student_id, term_id, comment } = req.body;

      if (!student_id || !term_id || !comment) {
        return res.status(400).json({
          error: 'Missing required fields: student_id, term_id, comment'
        });
      }

      await reportCardService.saveReportCardComment(
        schoolId,
        student_id,
        term_id,
        comment,
        'teacher',
        user.id
      );

      res.json({
        success: true,
        message: 'Comment saved successfully'
      });
    } catch (error) {
      console.error('Error saving comment:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }
);

reportCardRouter.get(
  '/grade/:gradeLevel/term/:termId',
  authorizeRole(['admin', 'super_admin', 'exam_officer', 'hod']),
  async (req, res) => {
    try {
      const { gradeLevel, termId } = req.params;
      const { schoolId } = req;

      const students = await dbAll(
        `SELECT id, first_name, last_name FROM students
         WHERE school_id = ? AND grade = ? AND status = 'active'`,
        [schoolId, gradeLevel]
      );

      const reportCards = [];

      for (const student of students) {
        const academicYear = await dbGet(
          `SELECT ay.id FROM academic_years ay
           JOIN terms t ON t.academic_year_id = ay.id
           WHERE t.id = ? AND ay.school_id = ?`,
          [termId, schoolId]
        );

        if (!academicYear) continue;

        const reportCard = await reportCardService.generateReportCard(
          schoolId,
          student.id,
          termId,
          academicYear.id
        );

        reportCards.push(reportCard);
      }

      res.json({
        success: true,
        data: {
          grade_level: gradeLevel,
          term_id: termId,
          count: reportCards.length,
          report_cards: reportCards
        }
      });
    } catch (error) {
      console.error('Error fetching grade report cards:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }
);

module.exports = reportCardRouter;
