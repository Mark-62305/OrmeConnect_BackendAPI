const db = require("../config/db");

const ALLOWED_STATUS = new Set(["pending", "approved", "rejected"]);

function normalizeStatus(value) {
    return String(value || "").trim().toLowerCase();
}

async function getAllScheduleRequests(req, res) {
    try {
        const statusFilter = normalizeStatus(req.query && req.query.status);
        const hasStatusFilter = statusFilter && ALLOWED_STATUS.has(statusFilter);

        const sql = `
      SELECT
        ssr.id,
        ssr.user_id,
        COALESCE(m.member_code, '-') AS member_code,
        COALESCE(NULLIF(m.name, ''), u.full_name) AS member_name,
        u.email,
        ssr.seminar_date,
        ssr.start_time,
        ssr.end_time,
        ssr.status,
        ssr.remarks,
        ssr.created_at,
        ssr.reviewed_at
      FROM seminar_schedule_requests ssr
      JOIN users u ON u.id = ssr.user_id
      LEFT JOIN members m ON m.user_id = ssr.user_id
      ${hasStatusFilter ? "WHERE ssr.status = ?" : ""}
      ORDER BY
        CASE ssr.status
          WHEN 'pending' THEN 0
          WHEN 'approved' THEN 1
          ELSE 2
        END,
        ssr.seminar_date ASC,
        ssr.start_time ASC,
        ssr.created_at DESC
    `;

        const [rows] = hasStatusFilter ? await db.query(sql, [statusFilter]) : await db.query(sql);

        return res.json(rows);
    } catch (err) {
        console.error("getAllScheduleRequests error:", err);
        return res.status(500).json({ message: "Server error" });
    }
}

async function updateScheduleRequestStatus(req, res) {
    try {
        const id = Number((req.params && req.params.id) || 0);
        const status = normalizeStatus(req.body && req.body.status);
        const remarksRaw = req.body && req.body.remarks;
        const remarks = typeof remarksRaw === "string" ? remarksRaw.trim() : null;

        if (!id) {
            return res.status(400).json({ message: "Invalid request id" });
        }

        if (!ALLOWED_STATUS.has(status)) {
            return res.status(400).json({ message: "Invalid status" });
        }

        const [existing] = await db.query("SELECT id FROM seminar_schedule_requests WHERE id = ? LIMIT 1", [id]);
        if (!existing.length) {
            return res.status(404).json({ message: "Schedule request not found" });
        }

        await db.query(
            `UPDATE seminar_schedule_requests
       SET status = ?, remarks = ?, reviewed_at = NOW()
       WHERE id = ?`, [status, remarks || null, id]
        );

        return res.json({ message: "Schedule request updated" });
    } catch (err) {
        console.error("updateScheduleRequestStatus error:", err);
        return res.status(500).json({ message: "Server error" });
    }
}

module.exports = {
    getAllScheduleRequests,
    updateScheduleRequestStatus,
};