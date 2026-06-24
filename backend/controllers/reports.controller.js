const db = require("../config/db");

function pad2(n) {
    return String(n).padStart(2, "0");
}

function formatBucket(date, period) {
    const y = date.getFullYear();
    const m = pad2(date.getMonth() + 1);
    const d = pad2(date.getDate());
    if (period === "daily") return `${y}-${m}-${d}`;
    if (period === "weekly") {
        const weekStart = new Date(date);
        weekStart.setHours(0, 0, 0, 0);
        const weekday = (weekStart.getDay() + 6) % 7;
        weekStart.setDate(weekStart.getDate() - weekday);
        return `${weekStart.getFullYear()}-${pad2(weekStart.getMonth() + 1)}-${pad2(weekStart.getDate())}`;
    }
    if (period === "monthly") return `${y}-${m}`;
    return String(y);
}

function shiftPeriod(date, period, step) {
    const d = new Date(date);
    if (period === "daily") d.setDate(d.getDate() + step);
    else if (period === "weekly") d.setDate(d.getDate() + step * 7);
    else if (period === "monthly") d.setMonth(d.getMonth() + step);
    else d.setFullYear(d.getFullYear() + step);
    return d;
}

function getPeriodConfig(period) {
    if (period === "daily") {
        return { period, points: 14, bucketExpr: "DATE(%COL%)" };
    }
    if (period === "weekly") {
        return {
            period: "weekly",
            points: 12,
            bucketExpr: "DATE_FORMAT(DATE_SUB(DATE(%COL%), INTERVAL WEEKDAY(%COL%) DAY), '%Y-%m-%d')",
        };
    }
    if (period === "yearly") {
        return { period: "yearly", points: 6, bucketExpr: "DATE_FORMAT(%COL%, '%Y')" };
    }
    return { period: "monthly", points: 12, bucketExpr: "DATE_FORMAT(%COL%, '%Y-%m')" };
}

function makeLabels(period, points) {
    const now = new Date();
    const start = shiftPeriod(now, period, -(points - 1));
    const labels = [];
    for (let i = 0; i < points; i += 1) {
        labels.push(formatBucket(shiftPeriod(start, period, i), period));
    }
    return labels;
}

async function getSeries({ table, dateColumn, labels, config }) {
    const bound = labels[0];
    const bucketExpr = config.bucketExpr.split("%COL%").join(dateColumn);
    const sql = `
    SELECT ${bucketExpr} AS bucket, COUNT(*) AS total
    FROM ${table}
    WHERE ${dateColumn} IS NOT NULL
      AND ${bucketExpr} >= ?
    GROUP BY bucket
    ORDER BY bucket
  `;

    const [rows] = await db.query(sql, [bound]);
    const map = new Map(rows.map((r) => [String(r.bucket), Number(r.total)]));
    return labels.map((label) => map.get(label) || 0);
}

async function getStatusBreakdown(table) {
    const [rows] = await db.query(
        `SELECT LOWER(COALESCE(status, 'unknown')) AS status, COUNT(*) AS total
     FROM ${table}
     GROUP BY LOWER(COALESCE(status, 'unknown'))
     ORDER BY total DESC`
    );
    return rows;
}

async function getOverview(req, res) {
    try {
        const requested = String(req.query.period || "monthly").toLowerCase();
        const config = getPeriodConfig(requested);
        const labels = makeLabels(config.period, config.points);

        const [
            [summary]
        ] = await db.query(`
      SELECT
        (SELECT COUNT(*) FROM users) AS total_users,
        (SELECT COUNT(DISTINCT m.user_id) FROM members m) AS total_members,
        (SELECT COUNT(*) FROM meters) AS total_meters,
        (SELECT COUNT(*) FROM meters WHERE status='active') AS active_meters,
        (SELECT COUNT(*) FROM incident_reports) AS total_incidents,
        (SELECT COUNT(*) FROM incident_reports WHERE status='open') AS open_incidents,
        (SELECT COUNT(*) FROM benefit_applications) AS total_benefit_apps,
        (SELECT COUNT(*) FROM benefit_applications WHERE status='pending') AS pending_benefits,
        (SELECT COUNT(DISTINCT benefit_id) FROM benefit_applications WHERE status='approved') AS active_benefits,
        (SELECT COUNT(*) FROM announcements) AS total_announcements
    `);

        const [users, meters, incidents, announcements] = await Promise.all([
            getSeries({ table: "users", dateColumn: "created_at", labels, config }),
            getSeries({ table: "meters", dateColumn: "installed_at", labels, config }),
            getSeries({ table: "incident_reports", dateColumn: "reported_at", labels, config }),
            getSeries({ table: "announcements", dateColumn: "created_at", labels, config }),
        ]);

        // Benefit Distribution (pie chart data)
        const [benefitDistribution] = await db.query(`
            SELECT b.id, b.name, COUNT(ba.id) AS count
            FROM benefits b
            LEFT JOIN benefit_applications ba ON b.id = ba.benefit_id AND ba.status = 'approved'
            GROUP BY b.id, b.name
            ORDER BY count DESC
        `);



        // Incident Trends (bar chart data - status count per period)
        const [incidentTrends] = await db.query(`
            SELECT 
                DATE_FORMAT(reported_at, '%Y-%m') AS period,
                status,
                COUNT(*) AS count
            FROM incident_reports
            WHERE reported_at IS NOT NULL
            GROUP BY period, status
            ORDER BY period, status
        `);

        const [incidentStatus, meterStatus, benefitStatus, seminarStatus] = await Promise.all([
            getStatusBreakdown("incident_reports"),
            getStatusBreakdown("meters"),
            getStatusBreakdown("benefit_applications"),
            getStatusBreakdown("seminar_schedule_requests"),
        ]);

        const [recentActivities] = await db.query(`
      SELECT *
      FROM (
        SELECT 'Incident' AS source, CONCAT('Incident #', id, ' - ', COALESCE(category, 'General')) AS title, reported_at AS happened_at
        FROM incident_reports
        WHERE reported_at IS NOT NULL

        UNION ALL

        SELECT 'Announcement' AS source, COALESCE(title, 'Announcement') AS title, created_at AS happened_at
        FROM announcements
        WHERE created_at IS NOT NULL

        UNION ALL

        SELECT 'Meter' AS source, CONCAT('Meter ', COALESCE(meter_number, '#N/A'), ' installed') AS title, installed_at AS happened_at
        FROM meters
        WHERE installed_at IS NOT NULL

        UNION ALL

        SELECT 'User' AS source, CONCAT('New user ', COALESCE(full_name, CONCAT('#', id))) AS title, created_at AS happened_at
        FROM users
        WHERE created_at IS NOT NULL
      ) logs
      ORDER BY happened_at DESC
      LIMIT 12
    `);

        res.json({
            period: config.period,
            labels,
            summary,
            trends: {
                users,
                meters,
                incidents,
                announcements,
            },
            statusBreakdown: {
                incidents: incidentStatus,
                meters: meterStatus,
                benefitApplications: benefitStatus,
                seminarSchedule: seminarStatus,
            },
            benefitDistribution,
            incidentTrends,
            recentActivities,
            generatedAt: new Date().toISOString(),
        });
    } catch (err) {
        console.error("reports.getOverview error:", err);
        res.status(500).json({ message: err.sqlMessage || err.message || "Failed to load reports" });
    }
}

module.exports = {
    getOverview,
};