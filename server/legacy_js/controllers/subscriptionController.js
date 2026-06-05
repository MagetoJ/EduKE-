const { query } = require('../db/connection');

/**
 * Get subscription plans
 */
const getSubscriptionPlans = async (req, res) => {
  try {
    const result = await query('SELECT * FROM subscription_plans ORDER BY id ASC');
    res.json({ plans: result.rows });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to fetch subscription plans' });
  }
};

/**
 * Update school subscription
 */
const updateSchoolSubscription = async (req, res) => {
  try {
    const { id: schoolId } = req.params;
    const { planSlug, status } = req.body;

    if (!planSlug) {
      return res.status(400).json({ success: false, error: 'Plan slug is required' });
    }

    // Get plan by slug
    const planResult = await query('SELECT id, name, slug FROM subscription_plans WHERE slug = $1', [planSlug]);
    if (planResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Plan not found' });
    }

    const plan = planResult.rows[0];

    // Check if subscription exists
    const existing = await query('SELECT id FROM subscriptions WHERE school_id = $1', [schoolId]);

    if (existing.rows.length > 0) {
      // Update existing subscription
      const result = await query(
        `UPDATE subscriptions
         SET plan_id = $1, status = $2, updated_at = NOW()
         WHERE school_id = $3
         RETURNING *`,
        [plan.id, status || 'active', schoolId]
      );
      res.json({
        success: true,
        data: result.rows[0],
        planName: plan.name,
        planSlug: plan.slug,
        status: status || 'active'
      });
    } else {
      // Create new subscription
      const result = await query(
        `INSERT INTO subscriptions (school_id, plan_id, status, start_date)
         VALUES ($1, $2, $3, NOW())
         RETURNING *`,
        [schoolId, plan.id, status || 'active']
      );
      res.status(201).json({
        success: true,
        data: result.rows[0],
        planName: plan.name,
        planSlug: plan.slug,
        status: status || 'active'
      });
    }
  } catch (err) {
    console.error('Error updating subscription:', err);
    res.status(500).json({ success: false, error: 'Failed to update subscription' });
  }
};

/**
 * Get subscription status report
 */
const getSubscriptionStatusReport = async (req, res) => {
  try {
    const result = await query(
      `SELECT
        sp.name as plan,
        sub.status,
        COUNT(DISTINCT sub.school_id) as subscribers,
        COALESCE(SUM(CAST(sf.amount_paid AS NUMERIC)), 0) as revenue
      FROM subscriptions sub
      LEFT JOIN subscription_plans sp ON sub.plan_id = sp.id
      LEFT JOIN schools s ON sub.school_id = s.id
      LEFT JOIN students st ON s.id = st.school_id
      LEFT JOIN student_fees sf ON st.id = sf.student_id
      WHERE sp.name IS NOT NULL
      GROUP BY sp.name, sub.status
      ORDER BY sp.name, sub.status`
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching subscription report:', err);
    res.status(500).json({ success: false, error: 'Failed to fetch subscription report' });
  }
};

/**
 * Get school analytics report
 */
const getSchoolAnalyticsReport = async (req, res) => {
  try {
    const result = await query(
      `SELECT
        s.name as school_name,
        s.status as school_status,
        sp.name as plan_name,
        sub.status as subscription_status,
        COUNT(DISTINCT st.id) as student_count,
        COUNT(DISTINCT u.id) as staff_count,
        COALESCE(SUM(CAST(sf.amount_paid AS NUMERIC)), 0) as revenue
      FROM schools s
      LEFT JOIN subscriptions sub ON s.id = sub.school_id
      LEFT JOIN subscription_plans sp ON sub.plan_id = sp.id
      LEFT JOIN students st ON s.id = st.school_id
      LEFT JOIN users u ON s.id = u.school_id AND u.role IN ('teacher', 'admin')
      LEFT JOIN student_fees sf ON st.id = sf.student_id
      GROUP BY s.id, s.name, s.status, sp.name, sub.status
      ORDER BY s.name`
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching school analytics:', err);
    res.status(500).json({ success: false, error: 'Failed to fetch school analytics' });
  }
};

module.exports = {
  getSubscriptionPlans,
  updateSchoolSubscription,
  getSubscriptionStatusReport,
  getSchoolAnalyticsReport
};