const { dbRun, dbGet, dbAll } = require('../database');

class PayrollService {
  async getStaffMember(schoolId, staffId) {
    try {
      const staff = await dbGet(
        `SELECT u.*, s.hire_date, s.termination_date, s.salary
         FROM users u
         LEFT JOIN staff_records s ON u.id = s.user_id
         WHERE u.id = ? AND u.school_id = ? AND u.role IN ('admin', 'teacher')`,
        [staffId, schoolId]
      );

      return staff;
    } catch (error) {
      throw new Error(`Failed to fetch staff member: ${error.message}`);
    }
  }

  async calculateMonthlyPayroll(schoolId, month, year) {
    try {
      const staff = await dbAll(
        `SELECT u.id, u.name, s.salary, s.hire_date, s.termination_date
         FROM users u
         LEFT JOIN staff_records s ON u.id = s.user_id
         WHERE u.school_id = ? AND u.role IN ('admin', 'teacher') AND u.status = 'active'`,
        [schoolId]
      );

      const payrolls = [];

      for (const member of staff) {
        if (!member.salary) continue;

        const grossSalary = parseFloat(member.salary);

        const deductions = await this.calculateDeductions(schoolId, member.id, month, year);
        const netSalary = grossSalary - deductions.total;

        const taxableIncome = Math.max(0, grossSalary - (deductions.nssf || 0));
        const tax = this.calculateIncomeTax(taxableIncome);

        payrolls.push({
          staff_id: member.id,
          staff_name: member.name,
          month: month,
          year: year,
          gross_salary: grossSalary,
          deductions: {
            leave: deductions.leave || 0,
            nssf: deductions.nssf || 0,
            nhif: deductions.nhif || 0,
            personal: deductions.personal || 0,
            other: deductions.other || 0,
            total: deductions.total
          },
          tax: tax,
          net_salary: netSalary - tax
        });
      }

      return payrolls;
    } catch (error) {
      throw new Error(`Failed to calculate payroll: ${error.message}`);
    }
  }

  async calculateDeductions(schoolId, staffId, month, year) {
    try {
      const deductions = {
        leave: 0,
        nssf: 0,
        nhif: 0,
        personal: 0,
        other: 0,
        total: 0
      };

      const staff = await this.getStaffMember(schoolId, staffId);
      if (!staff || !staff.salary) return deductions;

      const monthlyGross = parseFloat(staff.salary);

      deductions.nssf = this.calculateNSSF(monthlyGross);
      deductions.nhif = this.calculateNHIF(monthlyGross);

      const leaveDeduction = await this.getLeaveDeduction(schoolId, staffId, month, year);
      deductions.leave = leaveDeduction;

      const customDeductions = await dbAll(
        `SELECT amount, deduction_type FROM staff_deductions
         WHERE school_id = ? AND staff_id = ? AND MONTH(effective_date) = ? AND YEAR(effective_date) = ?`,
        [schoolId, staffId, month, year]
      );

      customDeductions.forEach(deduction => {
        if (deduction.deduction_type === 'personal') {
          deductions.personal += deduction.amount;
        } else {
          deductions.other += deduction.amount;
        }
      });

      deductions.total = deductions.leave + deductions.nssf + deductions.nhif + deductions.personal + deductions.other;

      return deductions;
    } catch (error) {
      console.error('Deduction calculation error:', error);
      return { leave: 0, nssf: 0, nhif: 0, personal: 0, other: 0, total: 0 };
    }
  }

  calculateNSSF(grossSalary) {
    const NSSF_RATE = 0.06;
    const MAX_NSSF_SALARY = 18000;
    const pensionableSalary = Math.min(grossSalary, MAX_NSSF_SALARY);
    return Math.round(pensionableSalary * NSSF_RATE * 100) / 100;
  }

  calculateNHIF(grossSalary) {
    let NHIF_AMOUNT = 0;

    if (grossSalary <= 5999) NHIF_AMOUNT = 150;
    else if (grossSalary <= 7999) NHIF_AMOUNT = 300;
    else if (grossSalary <= 11999) NHIF_AMOUNT = 400;
    else if (grossSalary <= 14999) NHIF_AMOUNT = 500;
    else if (grossSalary <= 19999) NHIF_AMOUNT = 600;
    else if (grossSalary <= 24999) NHIF_AMOUNT = 750;
    else if (grossSalary <= 29999) NHIF_AMOUNT = 850;
    else if (grossSalary <= 34999) NHIF_AMOUNT = 900;
    else if (grossSalary <= 39999) NHIF_AMOUNT = 950;
    else if (grossSalary <= 44999) NHIF_AMOUNT = 1000;
    else if (grossSalary <= 49999) NHIF_AMOUNT = 1100;
    else if (grossSalary <= 59999) NHIF_AMOUNT = 1200;
    else if (grossSalary <= 69999) NHIF_AMOUNT = 1300;
    else if (grossSalary <= 79999) NHIF_AMOUNT = 1400;
    else if (grossSalary <= 89999) NHIF_AMOUNT = 1500;
    else NHIF_AMOUNT = 1600;

    return NHIF_AMOUNT;
  }

  calculateIncomeTax(taxableIncome) {
    const TAX_RELIEF = 2400;
    let tax = 0;

    if (taxableIncome <= 11116) {
      tax = taxableIncome * 0.01;
    } else if (taxableIncome <= 21884) {
      tax = (11116 * 0.01) + ((taxableIncome - 11116) * 0.15);
    } else if (taxableIncome <= 32632) {
      tax = (11116 * 0.01) + (10768 * 0.15) + ((taxableIncome - 21884) * 0.20);
    } else {
      tax = (11116 * 0.01) + (10768 * 0.15) + (10748 * 0.20) + ((taxableIncome - 32632) * 0.25);
    }

    return Math.max(0, tax - TAX_RELIEF);
  }

  async getLeaveDeduction(schoolId, staffId, month, year) {
    try {
      const leaves = await dbAll(
        `SELECT duration, leave_type FROM staff_leave_applications
         WHERE school_id = ? AND staff_id = ? AND status = 'approved'
         AND MONTH(start_date) = ? AND YEAR(start_date) = ?`,
        [schoolId, staffId, month, year]
      );

      const staff = await this.getStaffMember(schoolId, staffId);
      if (!staff || !staff.salary) return 0;

      const dailySalary = parseFloat(staff.salary) / 26;
      let totalLeaveDays = 0;

      leaves.forEach(leave => {
        const isUnpaidLeave = ['compassionate', 'unpaid'].includes(leave.leave_type);
        if (isUnpaidLeave) {
          totalLeaveDays += leave.duration;
        }
      });

      return Math.round(totalLeaveDays * dailySalary * 100) / 100;
    } catch (error) {
      console.error('Leave deduction error:', error);
      return 0;
    }
  }

  async savePayrollRecord(schoolId, staffId, payrollData) {
    try {
      const result = await dbRun(
        `INSERT INTO payroll (school_id, staff_id, month, year, gross_salary, deductions, tax, net_salary, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
        [
          schoolId,
          staffId,
          payrollData.month,
          payrollData.year,
          payrollData.gross_salary,
          JSON.stringify(payrollData.deductions),
          payrollData.tax,
          payrollData.net_salary
        ]
      );

      return result.lastID;
    } catch (error) {
      throw new Error(`Failed to save payroll record: ${error.message}`);
    }
  }

  async getPayroll(schoolId, staffId, month, year) {
    try {
      const payroll = await dbGet(
        `SELECT * FROM payroll
         WHERE school_id = ? AND staff_id = ? AND month = ? AND year = ?`,
        [schoolId, staffId, month, year]
      );

      if (!payroll) return null;

      return {
        ...payroll,
        deductions: typeof payroll.deductions === 'string' 
          ? JSON.parse(payroll.deductions) 
          : payroll.deductions
      };
    } catch (error) {
      throw new Error(`Failed to fetch payroll: ${error.message}`);
    }
  }

  async getYearToDateEarnings(schoolId, staffId, month, year) {
    try {
      const earnings = await dbAll(
        `SELECT month, gross_salary, deductions, tax, net_salary FROM payroll
         WHERE school_id = ? AND staff_id = ? AND year = ? AND month <= ?
         ORDER BY month ASC`,
        [schoolId, staffId, year, month]
      );

      let ytdGross = 0;
      let ytdDeductions = 0;
      let ytdTax = 0;
      let ytdNet = 0;

      earnings.forEach(record => {
        ytdGross += parseFloat(record.gross_salary);
        ytdTax += parseFloat(record.tax);
        ytdNet += parseFloat(record.net_salary);

        const deductions = typeof record.deductions === 'string'
          ? JSON.parse(record.deductions)
          : record.deductions;
        ytdDeductions += deductions.total || 0;
      });

      return {
        ytd_gross: Math.round(ytdGross * 100) / 100,
        ytd_deductions: Math.round(ytdDeductions * 100) / 100,
        ytd_tax: Math.round(ytdTax * 100) / 100,
        ytd_net: Math.round(ytdNet * 100) / 100,
        records_count: earnings.length
      };
    } catch (error) {
      throw new Error(`Failed to calculate YTD earnings: ${error.message}`);
    }
  }

  async getSalaryHistory(schoolId, staffId, months = 12) {
    try {
      const today = new Date();
      const payrolls = [];

      for (let i = months - 1; i >= 0; i--) {
        const date = new Date(today.getFullYear(), today.getMonth() - i, 1);
        const month = date.getMonth() + 1;
        const year = date.getFullYear();

        const payroll = await this.getPayroll(schoolId, staffId, month, year);
        if (payroll) {
          payrolls.push(payroll);
        }
      }

      return payrolls;
    } catch (error) {
      throw new Error(`Failed to fetch salary history: ${error.message}`);
    }
  }

  generatePayslipHTML(staff, payrollData) {
    const deductions = payrollData.deductions;

    return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Payslip - ${staff.name}</title>
  <style>
    * { margin: 0; padding: 0; }
    body { font-family: Arial, sans-serif; line-height: 1.6; }
    .container { width: 800px; margin: 0 auto; padding: 20px; }
    .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #333; padding-bottom: 15px; }
    .title { font-size: 24px; font-weight: bold; }
    .subtitle { font-size: 12px; color: #666; }
    .section { margin-bottom: 20px; }
    .section-title { background: #34495e; color: white; padding: 10px; font-weight: bold; }
    .row { display: flex; margin: 8px 0; padding: 5px 10px; }
    .col { flex: 1; }
    .col-right { text-align: right; flex: 0.5; }
    .amount { font-weight: bold; }
    table { width: 100%; border-collapse: collapse; margin: 10px 0; }
    th { background: #95a5a6; color: white; padding: 10px; text-align: left; }
    td { padding: 8px 10px; border-bottom: 1px solid #ddd; }
    tr:nth-child(even) { background: #f9f9f9; }
    .total-row { background: #ecf0f1; font-weight: bold; }
    .footer { margin-top: 30px; text-align: center; font-size: 11px; color: #666; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="title">PAYSLIP</div>
      <div class="subtitle">Month: ${payrollData.month}/${payrollData.year}</div>
    </div>

    <div class="section">
      <div class="section-title">EMPLOYEE INFORMATION</div>
      <div class="row">
        <div class="col"><strong>Name:</strong> ${staff.name}</div>
        <div class="col"><strong>ID:</strong> ${staff.employee_id || staff.id}</div>
      </div>
      <div class="row">
        <div class="col"><strong>Department:</strong> ${staff.department || 'N/A'}</div>
        <div class="col"><strong>Designation:</strong> ${staff.role}</div>
      </div>
    </div>

    <div class="section">
      <table>
        <thead>
          <tr>
            <th>EARNINGS</th>
            <th style="text-align: right;">AMOUNT (KES)</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Basic Salary</td>
            <td style="text-align: right;">${payrollData.gross_salary.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
          </tr>
          <tr class="total-row">
            <td>Gross Salary</td>
            <td style="text-align: right;">${payrollData.gross_salary.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="section">
      <table>
        <thead>
          <tr>
            <th>DEDUCTIONS</th>
            <th style="text-align: right;">AMOUNT (KES)</th>
          </tr>
        </thead>
        <tbody>
          ${deductions.leave > 0 ? `<tr><td>Leave Deduction</td><td style="text-align: right;">${deductions.leave.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td></tr>` : ''}
          ${deductions.nssf > 0 ? `<tr><td>NSSF Contribution</td><td style="text-align: right;">${deductions.nssf.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td></tr>` : ''}
          ${deductions.nhif > 0 ? `<tr><td>NHIF Deduction</td><td style="text-align: right;">${deductions.nhif.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td></tr>` : ''}
          ${deductions.personal > 0 ? `<tr><td>Personal Deduction</td><td style="text-align: right;">${deductions.personal.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td></tr>` : ''}
          ${deductions.other > 0 ? `<tr><td>Other Deductions</td><td style="text-align: right;">${deductions.other.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td></tr>` : ''}
          <tr><td>Income Tax</td><td style="text-align: right;">${payrollData.tax.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td></tr>
          <tr class="total-row">
            <td>Total Deductions</td>
            <td style="text-align: right;">${(deductions.total + payrollData.tax).toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <div class="section">
      <div class="row" style="font-size: 16px; font-weight: bold; background: #2ecc71; color: white; padding: 15px 10px; margin: 10px 0;">
        <div class="col">NET SALARY (Take Home Pay)</div>
        <div class="col-right" style="font-size: 18px;">${payrollData.net_salary.toLocaleString('en-US', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</div>
      </div>
    </div>

    <div class="footer">
      <p>This is a computer-generated payslip. No signature is required.</p>
      <p>Generated on: ${new Date().toLocaleDateString()}</p>
    </div>
  </div>
</body>
</html>
    `;
  }
}

module.exports = new PayrollService();
