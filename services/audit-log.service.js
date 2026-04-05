const db = require("../config/db");

let ensured = false;

async function ensureAuditLogTable() {
    if (ensured) return;

    await db.query(`
    CREATE TABLE IF NOT EXISTS audit_logs (
      id BIGINT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NULL,
      target_user_id INT NULL,
      action_type VARCHAR(50) NOT NULL,
      action VARCHAR(160) NOT NULL,
      entity_type VARCHAR(80) NULL,
      entity_id VARCHAR(80) NULL,
      details TEXT NULL,
      ip_address VARCHAR(64) NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_audit_logs_created_at (created_at),
      INDEX idx_audit_logs_user_id (user_id),
      INDEX idx_audit_logs_action_type (action_type)
    )
  `);

    ensured = true;
}

function getRequestIp(req) {
    const forwarded = req && req.headers && req.headers["x-forwarded-for"];
    if (typeof forwarded === "string" && forwarded.trim()) {
        return forwarded.split(",")[0].trim();
    }
    return (req && (req.ip || (req.socket && req.socket.remoteAddress))) || null;
}

async function logAuditEvent({
    req,
    userId = null,
    targetUserId = null,
    actionType,
    action,
    entityType = null,
    entityId = null,
    details = null,
}) {
    if (!actionType || !action) return;

    try {
        await ensureAuditLogTable();

        const actorId = Number(userId || (req && req.user && req.user.id) || 0) || null;
        const targetId = Number(targetUserId || 0) || null;
        const safeDetails =
            details == null ?
            null :
            typeof details === "string" ?
            details :
            JSON.stringify(details);

        await db.query(
            `INSERT INTO audit_logs
       (user_id, target_user_id, action_type, action, entity_type, entity_id, details, ip_address)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`, [
                actorId,
                targetId,
                String(actionType).slice(0, 50),
                String(action).slice(0, 160),
                entityType ? String(entityType).slice(0, 80) : null,
                entityId != null ? String(entityId).slice(0, 80) : null,
                safeDetails,
                getRequestIp(req),
            ]
        );
    } catch (err) {
        console.warn("audit log failed:", err && err.message ? err.message : err);
    }
}

async function listAuditLogs({
    userId,
    actionType,
    dateFrom,
    dateTo,
    search,
    limit = 100,
    offset = 0,
}) {
    await ensureAuditLogTable();

    const where = [];
    const params = [];

    if (userId) {
        where.push("al.user_id = ?");
        params.push(Number(userId));
    }

    if (actionType) {
        where.push("al.action_type = ?");
        params.push(String(actionType));
    }

    if (dateFrom) {
        where.push("DATE(al.created_at) >= DATE(?)");
        params.push(String(dateFrom));
    }

    if (dateTo) {
        where.push("DATE(al.created_at) <= DATE(?)");
        params.push(String(dateTo));
    }

    if (search) {
        where.push("(al.action LIKE ? OR al.details LIKE ? OR al.entity_type LIKE ?)");
        const needle = `%${String(search)}%`;
        params.push(needle, needle, needle);
    }

    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

    const [rows] = await db.query(
        `SELECT
       al.*,
       actor.full_name AS actor_name,
       actor.email AS actor_email,
       target.full_name AS target_user_name,
       target.email AS target_user_email
     FROM audit_logs al
     LEFT JOIN users actor ON actor.id = al.user_id
     LEFT JOIN users target ON target.id = al.target_user_id
     ${whereSql}
     ORDER BY al.created_at DESC, al.id DESC
     LIMIT ? OFFSET ?`, [...params, Number(limit), Number(offset)]
    );

    const [
        [countRow]
    ] = await db.query(
        `SELECT COUNT(*) AS total
     FROM audit_logs al
     ${whereSql}`,
        params
    );

    return {
        items: rows,
        total: Number(countRow && countRow.total ? countRow.total : 0),
    };
}

module.exports = {
    ensureAuditLogTable,
    logAuditEvent,
    listAuditLogs,
};