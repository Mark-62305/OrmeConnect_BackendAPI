const db = require("../config/db");

module.exports = {
  async getStats() {
    const [[users]] = await db.query(`SELECT COUNT(*) AS total_users FROM users`);

    const [[meters]] = await db.query(`
      SELECT COUNT(*) AS active_meters 
      FROM meters 
      WHERE status='active'
    `);

    const [[incidents]] = await db.query(`
      SELECT COUNT(*) AS open_incidents 
      FROM incident_reports 
      WHERE status='open'
    `);

    const [[apps]] = await db.query(`
      SELECT COUNT(*) AS pending_benefit_apps
      FROM benefit_applications 
      WHERE status='pending'
    `);

    const [[notif]] = await db.query(`
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

    return {
      total_users: users.total_users,
      active_meters: meters.active_meters,
      open_incidents: incidents.open_incidents,
      pending_benefit_apps: apps.pending_benefit_apps,
      unread_notifications: notif.unread_notifications,
      recent_incidents: recentIncidents,
      latest_announcements: announcements
    };
  }
};
