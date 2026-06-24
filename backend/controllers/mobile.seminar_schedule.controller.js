const pool = require("../db.cjs");

function isDateYYYYMMDD(s) {
  return typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);
}
function isTimeHHMMSS(s) {
  return typeof s === "string" && /^\d{2}:\d{2}:\d{2}$/.test(s);
}

exports.createScheduleRequest = async (req, res) => {

  try {
    const user_id = Number(req.body?.user_id || 0);
    const seminar_date = (req.body?.seminar_date || "").trim();
    const start_time = (req.body?.start_time || "").trim();
    const end_time = (req.body?.end_time || "").trim();
    console.log("headers:", req.headers["content-type"]);
    console.log("body:", req.body);
    if (!user_id || !isDateYYYYMMDD(seminar_date) || !isTimeHHMMSS(start_time) || !isTimeHHMMSS(end_time)) {
      return res.status(400).json({ status: "fail", message: "Missing required fields" });
    }

    // One-time submit: block if pending exists
    const [pending] = await pool.execute(
      `SELECT id FROM seminar_schedule_requests
       WHERE user_id=? AND status='pending'
       ORDER BY created_at DESC
       LIMIT 1`,
      [user_id]
    );

    if (pending.length > 0) {
      return res.status(409).json({
        status: "fail",
        message: "You already have a pending request.",
        request_id: pending[0].id,
        approval_status: "pending",
      });
    }

    const [result] = await pool.execute(
      `INSERT INTO seminar_schedule_requests (user_id, seminar_date, start_time, end_time, status)
       VALUES (?, ?, ?, ?, 'pending')`,
      [user_id, seminar_date, start_time, end_time]
    );

    return res.status(201).json({
      status: "success",
      message: "Submitted. Waiting for admin approval.",
      request_id: result.insertId,
      approval_status: "pending",
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ status: "fail", message: "Server error" });
  }
};

exports.getLatestScheduleRequest = async (req, res) => {
  try {
    const user_id = Number(req.query?.user_id || 0);
    if (!user_id) {
      return res.status(400).json({ status: "fail", message: "Missing user_id" });
    }

    const [rows] = await pool.execute(
      `SELECT id, status, seminar_date, start_time, end_time, created_at, reviewed_at, remarks
       FROM seminar_schedule_requests
       WHERE user_id=?
       ORDER BY created_at DESC
       LIMIT 1`,
      [user_id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ status: "fail", message: "No requests found" });
    }

    return res.json({
      status: "success",
      request: {
        id: rows[0].id,
        approval_status: rows[0].status,
        seminar_date: rows[0].seminar_date,
        start_time: rows[0].start_time,
        end_time: rows[0].end_time,
        created_at: rows[0].created_at,
        reviewed_at: rows[0].reviewed_at,
        remarks: rows[0].remarks,
      },
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ status: "fail", message: "Server error" });
  }
};