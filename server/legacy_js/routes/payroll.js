const express = require('express');
const payrollRouter = express.Router();
const { authorizeRole, requireFeature } = require('../middleware/auth');
const payrollService = require('../services/payrollService');
const { dbGet, dbAll, dbRun } = require('../database');

payrollRouter.post(
  '/calculate',
  authorizeRole(['admin', 'super_admin', 'hr_manager']),
  requireFeature('finance'),
  async (req, res) => {
    try {
      const { schoolId } = req;
      const { month, year } = req.body;

      if (!month || !year) {
        return res.status(400).json({
          error: 'Missing required fields: month, year'
        });
      }

      if (month < 1 || month > 12) {
        return res.status(400).json({ error: 'Month must be between 1 and 12' });
      }

      const payrolls = await payrollService.calculateMonthlyPayroll(schoolId, month, year);

      res.json({
        success: true,
        data: {
          month: month,
          year: year,
          payroll_count: payrolls.length,
          payrolls: payrolls
        }
      });
    } catch (error) {
      console.error('Error calculating payroll:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }
);

payrollRouter.post(
  '/save',
  authorizeRole(['admin', 'super_admin', 'hr_manager']),
  requireFeature('finance'),
  async (req, res) => {
    try {
      const { schoolId } = req;
      const { staff_id, month, year, gross_salary, deductions, tax, net_salary } = req.body;

      if (!staff_id || !month || !year) {
        return res.status(400).json({
          error: 'Missing required fields: staff_id, month, year'
        });
      }

      const payrollId = await payrollService.savePayrollRecord(schoolId, staff_id, {
        month,
        year,
        gross_salary,
        deductions,
        tax,
        net_salary
      });

      res.json({
        success: true,
        message: 'Payroll record saved successfully',
        data: { payroll_id: payrollId }
      });
    } catch (error) {
      console.error('Error saving payroll:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }
);

payrollRouter.get(
  '/:staffId/:month/:year',
  authorizeRole(['admin', 'teacher', 'super_admin', 'hr_manager']),
  async (req, res) => {
    try {
      const { staffId, month, year } = req.params;
      const { schoolId, user } = req;

      if (user.role === 'teacher' && user.id !== parseInt(staffId)) {
        return res.status(403).json({ error: 'Unauthorized' });
      }

      const payroll = await payrollService.getPayroll(schoolId, staffId, month, year);

      if (!payroll) {
        return res.status(404).json({ error: 'Payroll not found' });
      }

      res.json({
        success: true,
        data: payroll
      });
    } catch (error) {
      console.error('Error fetching payroll:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }
);

payrollRouter.get(
  '/:staffId/:month/:year/payslip',
  authorizeRole(['admin', 'teacher', 'super_admin', 'hr_manager']),
  async (req, res) => {
    try {
      const { staffId, month, year } = req.params;
      const { schoolId, user } = req;

      if (user.role === 'teacher' && user.id !== parseInt(staffId)) {
        return res.status(403).json({ error: 'Unauthorized' });
      }

      const staff = await payrollService.getStaffMember(schoolId, staffId);
      if (!staff) {
        return res.status(404).json({ error: 'Staff member not found' });
      }

      const payroll = await payrollService.getPayroll(schoolId, staffId, month, year);
      if (!payroll) {
        return res.status(404).json({ error: 'Payroll not found' });
      }

      const htmlContent = payrollService.generatePayslipHTML(staff, payroll);

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
          `attachment; filename="Payslip_${staff.name.replace(/\s+/g, '_')}_${month}-${year}.pdf"`
        );

        res.send(pdfBuffer);
      } catch (puppeteerError) {
        console.warn('Puppeteer not available, returning HTML instead');
        res.setHeader('Content-Type', 'text/html');
        res.send(htmlContent);
      }
    } catch (error) {
      console.error('Error generating payslip:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }
);

payrollRouter.get(
  '/:staffId/ytd/:month/:year',
  authorizeRole(['admin', 'teacher', 'super_admin', 'hr_manager']),
  async (req, res) => {
    try {
      const { staffId, month, year } = req.params;
      const { schoolId, user } = req;

      if (user.role === 'teacher' && user.id !== parseInt(staffId)) {
        return res.status(403).json({ error: 'Unauthorized' });
      }

      const ytdEarnings = await payrollService.getYearToDateEarnings(
        schoolId,
        staffId,
        month,
        year
      );

      res.json({
        success: true,
        data: ytdEarnings
      });
    } catch (error) {
      console.error('Error calculating YTD earnings:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }
);

payrollRouter.get(
  '/:staffId/history',
  authorizeRole(['admin', 'teacher', 'super_admin', 'hr_manager']),
  async (req, res) => {
    try {
      const { staffId } = req.params;
      const { schoolId, user } = req;
      const { months } = req.query;

      if (user.role === 'teacher' && user.id !== parseInt(staffId)) {
        return res.status(403).json({ error: 'Unauthorized' });
      }

      const history = await payrollService.getSalaryHistory(
        schoolId,
        staffId,
        months ? parseInt(months) : 12
      );

      res.json({
        success: true,
        data: {
          staff_id: staffId,
          months_count: history.length,
          payroll_history: history
        }
      });
    } catch (error) {
      console.error('Error fetching salary history:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }
);

payrollRouter.post(
  '/deduction/add',
  authorizeRole(['admin', 'super_admin', 'hr_manager']),
  requireFeature('finance'),
  async (req, res) => {
    try {
      const { schoolId } = req;
      const { staff_id, amount, deduction_type, description, effective_date } = req.body;

      if (!staff_id || !amount || !deduction_type || !effective_date) {
        return res.status(400).json({
          error: 'Missing required fields: staff_id, amount, deduction_type, effective_date'
        });
      }

      if (!['personal', 'other'].includes(deduction_type)) {
        return res.status(400).json({
          error: 'Invalid deduction type. Must be "personal" or "other"'
        });
      }

      const result = await dbRun(
        `INSERT INTO staff_deductions (school_id, staff_id, amount, deduction_type, description, effective_date, created_at)
         VALUES (?, ?, ?, ?, ?, ?, NOW())`,
        [schoolId, staff_id, amount, deduction_type, description || '', effective_date]
      );

      res.json({
        success: true,
        message: 'Deduction added successfully',
        data: { deduction_id: result.lastID }
      });
    } catch (error) {
      console.error('Error adding deduction:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }
);

payrollRouter.get(
  '/summary/:month/:year',
  authorizeRole(['admin', 'super_admin', 'hr_manager']),
  requireFeature('finance'),
  async (req, res) => {
    try {
      const { month, year } = req.params;
      const { schoolId } = req;

      const payrolls = await dbAll(
        `SELECT 
           COUNT(DISTINCT staff_id) as total_staff,
           SUM(gross_salary) as total_gross,
           SUM(deductions) as total_deductions_json,
           SUM(tax) as total_tax,
           SUM(net_salary) as total_net
         FROM payroll
         WHERE school_id = ? AND month = ? AND year = ?`,
        [schoolId, month, year]
      );

      const summary = payrolls[0] || {
        total_staff: 0,
        total_gross: 0,
        total_tax: 0,
        total_net: 0
      };

      res.json({
        success: true,
        data: {
          month: month,
          year: year,
          summary: summary
        }
      });
    } catch (error) {
      console.error('Error fetching payroll summary:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }
);

module.exports = payrollRouter;
