/* =========================================================
 * file: controllers/mobile.signup.controller.js
 * Add: request_id + DB fingerprint + verify insert
 * ========================================================= */
const pool = require("../db.cjs");
const {
    getSecurityPolicies,
    validatePasswordAgainstPolicy,
} = require("../services/security-policy.service");
const { logAuditEvent } = require("../services/audit-log.service");

async function signup(req, res) {
    const requestId = `${Date.now()}-${Math.random().toString(16).slice(2)}`;

    console.log(`[signup] ${requestId} ip=${req.ip} url=${req.originalUrl}`);
    console.log(`[signup] ${requestId} content-type=${req.headers["content-type"]}`);
    console.log(`[signup] ${requestId} body=`, req.body);

    const body = req.body || {};
    const accountNumber = typeof body.account_number === "string" ? body.account_number.trim() : "";
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const membershipNo = typeof body.membership_no === "string" ? body.membership_no.trim() : "";
    const address = typeof body.address === "string" ? body.address.trim() : "";
    const contactNumber = typeof body.contact_number === "string" ? body.contact_number.trim() : "";
    const password = typeof body.password === "string" ? body.password : "";

    if (!accountNumber || !name || !membershipNo || !address || !contactNumber || !password) {
        await logAuditEvent({
            req,
            actionType: "login",
            action: "member_signup_failed_validation",
            entityType: "auth",
            details: { account_number: accountNumber || null, membership_no: membershipNo || null },
        });
        return res.json({
            status: "fail",
            message: "All fields are required",
            request_id: requestId,
            received_keys: Object.keys(req.body || {}),
        });
    }

    const policies = await getSecurityPolicies();
    const passwordErrors = validatePasswordAgainstPolicy(password, policies);
    if (passwordErrors.length) {
        await logAuditEvent({
            req,
            actionType: "login",
            action: "member_signup_failed_password_policy",
            entityType: "auth",
            details: { account_number: accountNumber || null, errors: passwordErrors },
        });
        return res.json({
            status: "fail",
            message: "Password does not meet security policy",
            policy_errors: passwordErrors,
            request_id: requestId,
        });
    }

    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();

        const [
            [fp]
        ] = await conn.query(`
      SELECT DATABASE() AS db_name, @@hostname AS mysql_host, @@port AS mysql_port
    `);

        const [
            [userDup]
        ] = await conn.query("SELECT id FROM users WHERE email = ? LIMIT 1", [accountNumber]);
        if (userDup) {
            await conn.rollback();
            return res.json({ status: "fail", message: "Account number already registered", request_id: requestId, db: fp });
        }

        const [
            [memberDup]
        ] = await conn.query("SELECT user_id FROM members WHERE member_code = ? LIMIT 1", [membershipNo]);
        if (memberDup) {
            await conn.rollback();
            return res.json({ status: "fail", message: "Membership number already registered", request_id: requestId, db: fp });
        }

        const [
            [acDup]
        ] = await conn.query(
            "SELECT id FROM account_creation WHERE account_number = ? OR membership_no = ? LIMIT 1", [accountNumber, membershipNo]
        );
        if (acDup) {
            await conn.rollback();
            return res.json({ status: "fail", message: "Account already submitted", request_id: requestId, db: fp });
        }

        const [userInsert] = await conn.execute(
            `INSERT INTO users (email, password_hash, full_name, phone, is_active)
       VALUES (?, SHA2(?, 256), ?, ?, 0)`, [accountNumber, password, name, contactNumber]
        );
        const userId = Number(userInsert.insertId);

        await conn.execute(
            `INSERT INTO members (user_id, member_code, name, address, contact_number)
       VALUES (?, ?, ?, ?, ?)`, [userId, membershipNo, name, address, contactNumber]
        );

        const [acInsert] = await conn.execute(
            `INSERT INTO account_creation (account_number, name, membership_no, status)
       VALUES (?, ?, ?, 'pending')`, [accountNumber, name, membershipNo]
        );

        const [
            [roleRow]
        ] = await conn.query("SELECT id FROM roles WHERE name = 'member' LIMIT 1");
        if (!roleRow) {
            await conn.rollback();
            return res.json({ status: "fail", message: "Role not configured: member", request_id: requestId, db: fp });
        }
        await conn.execute("INSERT INTO user_roles (user_id, role_id) VALUES (?, ?)", [userId, Number(roleRow.id)]);

        const [
            [verifyUser]
        ] = await conn.query("SELECT id, email FROM users WHERE id = ? LIMIT 1", [userId]);

        await conn.commit();

        await logAuditEvent({
            req,
            userId,
            targetUserId: userId,
            actionType: "login",
            action: "member_signup_success",
            entityType: "auth",
            entityId: userId,
            details: { account_number: accountNumber, membership_no: membershipNo },
        });

        return res.json({
            status: "success",
            message: `Account123 created successfully for ${name}.`,
            request_id: requestId,
            inserted: {
                user_id: userId,
                account_creation_id: Number(acInsert.insertId),
                verified_user: verifyUser || null,
            },
            db: fp,
        });
    } catch (err) {
        try { await conn.rollback(); } catch (_) {}
        return res.json({ status: "fail", message: `Server error: ${err?.message || String(err)}`, request_id: requestId });
    } finally {
        conn.release();
    }
}

async function health(req, res) {
    const conn = await pool.getConnection();
    try {
        const [
            [fp]
        ] = await conn.query(`SELECT DATABASE() AS db_name, @@hostname AS mysql_host, @@port AS mysql_port`);
        return res.json({ status: "ok", db: fp });
    } finally {
        conn.release();
    }
}

module.exports = { signup, health };