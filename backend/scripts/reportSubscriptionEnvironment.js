require("dotenv").config();

const pool = require("../config/database");

const reportSubscriptionEnvironment = async () => {
  const result = await pool.query(`
    SELECT current_setting('TimeZone') AS timezone,
           array_agg(DISTINCT role ORDER BY role) FILTER (WHERE role IS NOT NULL) AS roles,
           array_agg(DISTINCT designation ORDER BY designation) FILTER (WHERE designation IS NOT NULL) AS designations,
           array_agg(DISTINCT department ORDER BY department) FILTER (WHERE department IS NOT NULL) AS departments
    FROM team_members
  `);
  const columns = await pool.query(`
    SELECT table_name, column_name
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND (table_name = 'plans' AND column_name = 'gst_rate'
        OR table_name = 'customers' AND column_name = 'expired_at')
    ORDER BY table_name, column_name
  `);
  const databaseUrl = new URL(process.env.DATABASE_URL);
  console.log(JSON.stringify({
    ...result.rows[0],
    databaseHost: databaseUrl.host,
    databaseName: databaseUrl.pathname.replace(/^\//, ''),
    subscriptionColumns: columns.rows,
  }));
};

reportSubscriptionEnvironment()
  .catch((error) => {
    console.error("Subscription environment report failed:", error.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
