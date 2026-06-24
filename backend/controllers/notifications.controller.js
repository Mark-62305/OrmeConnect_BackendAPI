const db = require("../config/db");

const DEFAULT_THRESHOLDS = {
    incidentsPerDayAlert: 5,
    benefitsPerDayAlert: 10,
    highBillAmount: 5000,
    seminarWindowDays: 7,
};

async function getWorkflowThresholds() {
    try {
        const [rows] = await db.query(
            `SELECT setting_value FROM system_settings WHERE setting_key = 'thresholds' LIMIT 1`
        );

        if (!rows.length) return {...DEFAULT_THRESHOLDS };

        const raw = rows[0].setting_value;
        const parsed = typeof raw === "object" ? raw : JSON.parse(String(raw || "{}"));

        return {
            incidentsPerDayAlert: Math.max(1, Number(parsed.incidentsPerDayAlert || DEFAULT_THRESHOLDS.incidentsPerDayAlert)),
            benefitsPerDayAlert: Math.max(1, Number(parsed.benefitsPerDayAlert || DEFAULT_THRESHOLDS.benefitsPerDayAlert)),
            highBillAmount: Math.max(1, Number(parsed.highBillAmount || DEFAULT_THRESHOLDS.highBillAmount)),
            seminarWindowDays: Math.max(1, Number(parsed.seminarWindowDays || DEFAULT_THRESHOLDS.seminarWindowDays)),
        };
    } catch (_) {
        return {...DEFAULT_THRESHOLDS };
    }
}

function classifyNotification(title = "", body = "") {
    const text = `${title} ${body}`.toLowerCase();
    if (text.includes("benefit")) return "benefits";
    if (text.includes("incident")) return "incidents";
    if (text.includes("seminar") || text.includes("schedule")) return "seminars";
    if (text.includes("system alert") || text.includes("utility") || text.includes("unusual")) return "system";
    return "general";
}

async function ensureAlert(userId, title, body) {
    const [exists] = await db.query(
        `
      SELECT id
      FROM notifications
      WHERE user_id = ?
        AND title = ?
        AND body = ?
        AND created_at >= DATE_SUB(NOW(), INTERVAL 12 HOUR)
      LIMIT 1
    `, [userId, title, body]
    );

    if (!exists.length) {
        await db.query(
            `INSERT INTO notifications (user_id, title, body, is_read) VALUES (?, ?, ?, 0)`, [userId, title, body]
        );
    }
}

async function syncWorkflowAlerts(userId) {
    const thresholds = await getWorkflowThresholds();

    const [
        [pendingBenefits]
    ] = await db.query(
        `SELECT COUNT(*) AS total FROM benefit_applications WHERE status = 'pending'`
    );
    if (Number(pendingBenefits.total || 0) > 0) {
        await ensureAlert(
            userId,
            "Pending Benefit Approvals",
            `${pendingBenefits.total} benefit application(s) are waiting for review.`
        );
    }

    const [
        [newIncidents]
    ] = await db.query(
        `
      SELECT COUNT(*) AS total
      FROM incident_reports
      WHERE status = 'open'
        AND reported_at >= DATE_SUB(NOW(), INTERVAL 1 DAY)
    `
    );
    if (Number(newIncidents.total || 0) > 0) {
        await ensureAlert(
            userId,
            "New Incidents Reported",
            `${newIncidents.total} new open incident(s) were reported in the last 24 hours.`
        );
    }

    const [
        [upcomingSeminars]
    ] = await db.query(
        `
      SELECT COUNT(*) AS total, MIN(seminar_date) AS nearest_date
      FROM seminar_schedule_requests
            WHERE seminar_date BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL ? DAY)
        AND status IN ('approved', 'pending')
        `, [thresholds.seminarWindowDays]
    );
    if (Number(upcomingSeminars.total || 0) > 0) {
        const nearest = upcomingSeminars.nearest_date ?
            new Date(upcomingSeminars.nearest_date).toISOString().slice(0, 10) :
            "soon";

        await ensureAlert(
            userId,
            "Upcoming Seminar Dates",
            `${upcomingSeminars.total} seminar request(s) are scheduled within 7 days. Nearest date: ${nearest}.`
        );
    }

    const [
        [highBills]
    ] = await db.query(
        `
      SELECT COUNT(*) AS total, MAX(estimated_amount) AS max_amount
      FROM billing_estimations
      WHERE created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
                AND estimated_amount >= ?
        `, [thresholds.highBillAmount]
    );
    if (Number(highBills.total || 0) > 0) {
        await ensureAlert(
            userId,
            "System Alert: High Utility Bills",
            `${highBills.total} high bill estimation(s) detected this month. Peak estimate: ${Number(highBills.max_amount || 0).toFixed(2)}.`
        );
    }

    const [
        [activitySpike]
    ] = await db.query(
        `
      SELECT
        (SELECT COUNT(*) FROM incident_reports WHERE reported_at >= DATE_SUB(NOW(), INTERVAL 1 DAY)) AS incidents_24h,
        (SELECT COUNT(*) FROM benefit_applications WHERE applied_at >= DATE_SUB(NOW(), INTERVAL 1 DAY)) AS benefits_24h
    `
    );

    const incidents24h = Number(activitySpike.incidents_24h || 0);
    const benefits24h = Number(activitySpike.benefits_24h || 0);
    if (incidents24h >= thresholds.incidentsPerDayAlert || benefits24h >= thresholds.benefitsPerDayAlert) {
        await ensureAlert(
            userId,
            "System Alert: Unusual Activity",
            `Activity spike detected in 24h. Incidents: ${incidents24h}, Benefit applications: ${benefits24h}.`
        );
    }
}

exports.getNotifications = async(req, res) => {
    try {
        const userId = req.user && req.user.id;
        const typeFilter = String(req.query.type || "all").toLowerCase();
        const statusFilter = String(req.query.status || "all").toLowerCase();
        const search = String(req.query.q || "").trim().toLowerCase();
        const limit = Math.min(Math.max(Number(req.query.limit || 200), 1), 500);

        await syncWorkflowAlerts(userId);

        const where = ["user_id = ?"];
        const params = [userId];

        if (statusFilter === "read") where.push("is_read = 1");
        if (statusFilter === "unread") where.push("is_read = 0");

        if (search) {
            where.push("(LOWER(title) LIKE ? OR LOWER(body) LIKE ?)");
            const like = `%${search}%`;
            params.push(like, like);
        }

        const [rows] = await db.query(
            `
        SELECT id, title, body, is_read, created_at, read_at
        FROM notifications
        WHERE ${where.join(" AND ")}
        ORDER BY created_at DESC, id DESC
        LIMIT ${limit}
      `,
            params
        );

        const items = rows
            .map((row) => ({
                ...row,
                type: classifyNotification(row.title, row.body),
            }))
            .filter((row) => (typeFilter === "all" ? true : row.type === typeFilter));

        const summary = {
            total: items.length,
            unread: items.filter((n) => !n.is_read).length,
            read: items.filter((n) => !!n.is_read).length,
            byType: {
                benefits: items.filter((n) => n.type === "benefits").length,
                incidents: items.filter((n) => n.type === "incidents").length,
                seminars: items.filter((n) => n.type === "seminars").length,
                system: items.filter((n) => n.type === "system").length,
                general: items.filter((n) => n.type === "general").length,
            },
        };

        res.json({ items, summary });
    } catch (err) {
        res.status(500).json({
            message: "Failed to load notifications",
            details: err.message,
        });
    }
};

exports.updateReadStatus = async(req, res) => {
    try {
        const userId = req.user && req.user.id;
        const id = Number(req.params.id);
        const isRead = !!req.body.is_read;

        const [result] = await db.query(
            `
        UPDATE notifications
        SET is_read = ?, read_at = CASE WHEN ? = 1 THEN NOW() ELSE NULL END
        WHERE id = ? AND user_id = ?
      `, [isRead ? 1 : 0, isRead ? 1 : 0, id, userId]
        );

        if (!result.affectedRows) {
            return res.status(404).json({ message: "Notification not found" });
        }

        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ message: "Failed to update notification", details: err.message });
    }
};

exports.markAll = async(req, res) => {
    try {
        const userId = req.user && req.user.id;
        const isRead = !!req.body.is_read;

        const [result] = await db.query(
            `
        UPDATE notifications
        SET is_read = ?, read_at = CASE WHEN ? = 1 THEN NOW() ELSE NULL END
        WHERE user_id = ?
      `, [isRead ? 1 : 0, isRead ? 1 : 0, userId]
        );

        res.json({ success: true, affectedRows: result.affectedRows || 0 });
    } catch (err) {
        res.status(500).json({ message: "Failed to update notifications", details: err.message });
    }
};

exports.deleteNotification = async(req, res) => {
    try {
        const userId = req.user && req.user.id;
        const id = Number(req.params.id);

        const [result] = await db.query(
            `DELETE FROM notifications WHERE id = ? AND user_id = ?`, [id, userId]
        );

        if (!result.affectedRows) {
            return res.status(404).json({ message: "Notification not found" });
        }

        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ message: "Failed to delete notification", details: err.message });
    }
};