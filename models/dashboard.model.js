const db = require("../config/db");

module.exports = {
    async getStats() {
        const [
            [users]
        ] = await db.query(`SELECT COUNT(*) AS total_users FROM users`);

        const [
            [meters]
        ] = await db.query(`
      SELECT COUNT(*) AS active_meters 
      FROM meters 
      WHERE status='active'
    `);

        const [
            [incidents]
        ] = await db.query(`
      SELECT COUNT(*) AS open_incidents 
      FROM incident_reports 
      WHERE status='open'
    `);

        const [
            [apps]
        ] = await db.query(`
      SELECT COUNT(*) AS pending_benefit_apps
      FROM benefit_applications 
      WHERE status='pending'
    `);

        const [
            [benefitTotals]
        ] = await db.query(`
      SELECT
        SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) AS approved_benefit_apps,
        SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) AS rejected_benefit_apps
      FROM benefit_applications
    `);

        const [
            [seminars]
        ] = await db.query(`
      SELECT
        COUNT(*) AS total_seminar_requests,
        SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) AS pending_seminar_requests,
        SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) AS approved_seminars
      FROM seminar_schedule_requests
    `);

        const [
            [seminarsToday]
        ] = await db.query(`
      SELECT
        COUNT(*) AS today_seminar_total,
        SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) AS today_seminar_approved
      FROM seminar_schedule_requests
      WHERE DATE(seminar_date) = CURDATE()
    `);

        const [
            [notif]
        ] = await db.query(`
      SELECT COUNT(*) AS unread_notifications
      FROM notifications 
      WHERE is_read = 0
    `);


        const [recentIncidents] = await db.query(`
      SELECT ir.id, ir.category, ir.status, ir.reported_at,
             u.full_name AS user_name
      FROM incident_reports ir
      LEFT JOIN users u ON u.id = ir.user_id
      ORDER BY ir.reported_at DESC
      LIMIT 5
    `);

        const [announcements] = await db.query(`
      SELECT a.id, a.title, a.body, a.created_at,
             u.full_name AS created_by_name
      FROM announcements a
      LEFT JOIN users u ON u.id = a.created_by
      ORDER BY a.created_at DESC
      LIMIT 5
    `);

        const [recentSeminars] = await db.query(`
      SELECT
        ssr.id,
        ssr.status,
        ssr.seminar_date,
        ssr.start_time,
        ssr.end_time,
        ssr.created_at,
        COALESCE(NULLIF(m.name, ''), u.full_name) AS member_name
      FROM seminar_schedule_requests ssr
      LEFT JOIN users u ON u.id = ssr.user_id
      LEFT JOIN members m ON m.user_id = ssr.user_id
      ORDER BY ssr.created_at DESC
      LIMIT 5
    `);

        const [recentBenefitApplications] = await db.query(`
      SELECT
        ba.id,
        ba.status,
        ba.applied_at,
        COALESCE(NULLIF(m.name, ''), u.full_name) AS applicant_name,
        b.name AS benefit_name
      FROM benefit_applications ba
      LEFT JOIN users u ON u.id = ba.user_id
      LEFT JOIN members m ON m.user_id = ba.user_id
      LEFT JOIN benefits b ON b.id = ba.benefit_id
      ORDER BY ba.applied_at DESC
      LIMIT 5
    `);

        const [benefitStatusBreakdown] = await db.query(`
      SELECT LOWER(COALESCE(status, 'unknown')) AS status, COUNT(*) AS total
      FROM benefit_applications
      GROUP BY LOWER(COALESCE(status, 'unknown'))
      ORDER BY total DESC
    `);

        const [seminarStatusBreakdown] = await db.query(`
      SELECT LOWER(COALESCE(status, 'unknown')) AS status, COUNT(*) AS total
      FROM seminar_schedule_requests
      GROUP BY LOWER(COALESCE(status, 'unknown'))
      ORDER BY total DESC
    `);

        return {
            total_users: users.total_users,
            active_meters: meters.active_meters,
            open_incidents: incidents.open_incidents,
            pending_benefit_apps: apps.pending_benefit_apps,
            approved_benefit_apps: Number(benefitTotals.approved_benefit_apps || 0),
            rejected_benefit_apps: Number(benefitTotals.rejected_benefit_apps || 0),
            total_seminar_requests: Number(seminars.total_seminar_requests || 0),
            pending_seminar_requests: Number(seminars.pending_seminar_requests || 0),
            approved_seminars: Number(seminars.approved_seminars || 0),
            today_seminar_total: Number(seminarsToday.today_seminar_total || 0),
            today_seminar_approved: Number(seminarsToday.today_seminar_approved || 0),
            unread_notifications: notif.unread_notifications,
            recent_incidents: recentIncidents,
            latest_announcements: announcements,
            recent_seminar_requests: recentSeminars,
            recent_benefit_applications: recentBenefitApplications,
            benefit_status_breakdown: benefitStatusBreakdown,
            seminar_status_breakdown: seminarStatusBreakdown
        };
    }
};