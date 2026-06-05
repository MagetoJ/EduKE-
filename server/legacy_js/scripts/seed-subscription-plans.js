const { query } = require('../db/connection');

const seedSubscriptionPlans = async () => {
  try {
    console.log('Checking for existing trial plan...');
    
    const existing = (await query(
      'SELECT id FROM subscription_plans WHERE slug = $1',
      ['trial']
    )).rows[0];

    if (existing) {
      console.log('Trial plan already exists. Skipping seed.');
      return;
    }

    console.log('Seeding subscription plans...');

    const plans = [
      {
        name: 'Trial Plan',
        slug: 'trial',
        description: 'Free 14-day trial with limited features',
        price_monthly: 0.00,
        price_annual: 0.00,
        student_limit: 50,
        staff_limit: 10,
        trial_duration_days: 14,
        include_parent_portal: false,
        include_student_portal: false,
        include_messaging: false,
        include_finance: false,
        include_advanced_reports: false,
        include_leave_management: false,
        include_ai_analytics: false,
        is_trial: true,
        is_active: true
      },
      {
        name: 'Basic Plan',
        slug: 'basic',
        description: 'Perfect for small schools',
        price_monthly: 49.99,
        price_annual: 499.99,
        student_limit: 100,
        staff_limit: 20,
        trial_duration_days: 0,
        include_parent_portal: true,
        include_student_portal: true,
        include_messaging: true,
        include_finance: true,
        include_advanced_reports: false,
        include_leave_management: false,
        include_ai_analytics: false,
        is_trial: false,
        is_active: true
      },
      {
        name: 'Professional Plan',
        slug: 'pro',
        description: 'Advanced features for growing schools',
        price_monthly: 99.99,
        price_annual: 999.99,
        student_limit: 500,
        staff_limit: 50,
        trial_duration_days: 0,
        include_parent_portal: true,
        include_student_portal: true,
        include_messaging: true,
        include_finance: true,
        include_advanced_reports: true,
        include_leave_management: true,
        include_ai_analytics: false,
        is_trial: false,
        is_active: true
      },
      {
        name: 'Enterprise Plan',
        slug: 'enterprise',
        description: 'Unlimited features for large institutions',
        price_monthly: 199.99,
        price_annual: 1999.99,
        student_limit: null,
        staff_limit: null,
        trial_duration_days: 0,
        include_parent_portal: true,
        include_student_portal: true,
        include_messaging: true,
        include_finance: true,
        include_advanced_reports: true,
        include_leave_management: true,
        include_ai_analytics: true,
        is_trial: false,
        is_active: true
      }
    ];

    for (const plan of plans) {
      await query(
        `INSERT INTO subscription_plans 
        (name, slug, description, price_monthly, price_annual, student_limit, staff_limit, 
         trial_duration_days, include_parent_portal, include_student_portal, include_messaging, 
         include_finance, include_advanced_reports, include_leave_management, include_ai_analytics, 
         is_trial, is_active)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
        ON CONFLICT (slug) DO NOTHING`,
        [
          plan.name,
          plan.slug,
          plan.description,
          plan.price_monthly,
          plan.price_annual,
          plan.student_limit,
          plan.staff_limit,
          plan.trial_duration_days,
          plan.include_parent_portal,
          plan.include_student_portal,
          plan.include_messaging,
          plan.include_finance,
          plan.include_advanced_reports,
          plan.include_leave_management,
          plan.include_ai_analytics,
          plan.is_trial,
          plan.is_active
        ]
      );
      console.log(`✓ Inserted/verified plan: ${plan.slug}`);
    }

    console.log('✓ Subscription plans seeded successfully!');
  } catch (error) {
    console.error('Error seeding subscription plans:', error);
    throw error;
  }
};

if (require.main === module) {
  seedSubscriptionPlans()
    .then(() => {
      console.log('Done!');
      process.exit(0);
    })
    .catch(err => {
      console.error(err);
      process.exit(1);
    });
}

module.exports = { seedSubscriptionPlans };
