const db = require("../config/db");
const { logAuditEvent } = require("../services/audit-log.service");

const ExcelJS = require("exceljs");

function normalizeCellValue(v) {
    if (v == null) return "";
    if (typeof v === "object" && v.text) return String(v.text).trim();
    return String(v).trim();
}

function parseDateCell(v) {
    if (!v) return null;
    if (v instanceof Date) return v;
    const s = normalizeCellValue(v);
    if (!s) return null;
    const d = new Date(s);
    return Number.isNaN(d.getTime()) ? null : d;
}

function buildHeaderIndex(headerValues) {
    const idx = {};
    headerValues.forEach((h, i) => {
        const key = normalizeCellValue(h).toLowerCase();
        if (key) idx[key] = i + 1; // exceljs rows are 1-based
    });
    return idx;
}

function findHeaderIndex(headerIndex, aliases = []) {
    for (const alias of aliases) {
        const key = String(alias || "").toLowerCase();
        if (key && headerIndex[key]) return headerIndex[key];
    }
    return null;
}

function normalizeImportStatus(value) {
    const raw = String(value || "").trim().toLowerCase();
    if (raw === "inactive" || raw === "disconnected" || raw === "active") return raw;
    return "active";
}

function normalizeMeterPayload(body = {}) {
    const meterNumber = String(body.meter_number || "").trim();
    const userRef = String(body.user_id || "").trim();
    const installationAddress = String(body.installation_address || "").trim();
    const installedAt = body.installed_at ? String(body.installed_at).trim() : null;
    const allowedStatus = new Set(["active", "inactive", "disconnected"]);
    const status = allowedStatus.has(String(body.status || "").toLowerCase()) ?
        String(body.status).toLowerCase() :
        "active";

    return {
        meter_number: meterNumber,
        user_id: userRef,
        installation_address: installationAddress,
        installed_at: installedAt || null,
        status,
    };
}

async function resolveUserId(userInput) {
    const ref = String(userInput || "").trim();
    if (!ref) return null;

    const numeric = Number(ref);
    if (Number.isInteger(numeric) && numeric > 0) {
        const [
            [userById]
        ] = await db.query("SELECT id FROM users WHERE id = ? LIMIT 1", [numeric]);
        if (userById) return Number(userById.id);

        const [
            [memberByUserId]
        ] = await db.query("SELECT user_id FROM members WHERE user_id = ? LIMIT 1", [numeric]);
        if (memberByUserId) return Number(memberByUserId.user_id);
    }

    const [
        [memberRow]
    ] = await db.query(
        `SELECT user_id
         FROM members
         WHERE member_code = ?
            OR REPLACE(member_code, '-', '') = REPLACE(?, '-', '')
            OR (member_code REGEXP '^[0-9]+$' AND CAST(member_code AS UNSIGNED) = ?)
         LIMIT 1`, [ref, ref, Number.isFinite(numeric) ? numeric : -1]
    );
    if (memberRow && Number.isInteger(Number(memberRow.user_id))) {
        return Number(memberRow.user_id);
    }

    const [
        [userByNameOrEmail]
    ] = await db.query(
        "SELECT id FROM users WHERE LOWER(email) = LOWER(?) OR LOWER(full_name) = LOWER(?) LIMIT 1", [ref, ref]
    );
    if (userByNameOrEmail) return Number(userByNameOrEmail.id);

    return null;
}

// GET all meters
async function getAllMeters(req, res) {
    try {
        const [rows] = await db.query(
            `SELECT m.*, u.full_name 
       FROM meters m
       JOIN users u ON m.user_id = u.id`
        );
        res.json(rows);
    } catch (err) {
        console.error("getAllMeters error:", err);
        res.status(500).json({ message: "Server error" });
    }
}

async function exportMetersXlsx(req, res) {
    try {
        const [rows] = await db.query(
            `SELECT 
         m.id,
         m.meter_number,
         m.user_id,
         u.full_name,
         m.installation_address,
         m.installed_at,
         m.status
       FROM meters m
       JOIN users u ON m.user_id = u.id
       ORDER BY m.id DESC`
        );

        const wb = new ExcelJS.Workbook();
        const ws = wb.addWorksheet("Meters");

        ws.columns = [
            { header: "id", key: "id", width: 10 },
            { header: "meter_number", key: "meter_number", width: 18 },
            { header: "user_id", key: "user_id", width: 10 },
            { header: "full_name", key: "full_name", width: 24 },
            { header: "installation_address", key: "installation_address", width: 40 },
            { header: "installed_at", key: "installed_at", width: 16 },
            { header: "status", key: "status", width: 14 },
        ];

        ws.addRows(rows);
        ws.getRow(1).font = { bold: true };
        ws.views = [{ state: "frozen", ySplit: 1 }];

        await logAuditEvent({
            req,
            actionType: "system_event",
            action: "meters_export_xlsx_generated",
            entityType: "meters",
            details: { row_count: Array.isArray(rows) ? rows.length : 0 },
        });

        res.setHeader(
            "Content-Type",
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        );
        res.setHeader("Content-Disposition", 'attachment; filename="meters.xlsx"');

        await wb.xlsx.write(res);
        res.end();
    } catch (err) {
        console.error("exportMetersXlsx error:", err);
        res.status(500).json({ message: "Server error" });
    }
}

// IMPORT meters from XLSX
async function importMetersXlsx(req, res) {
    try {
        if (!req.file) {
            return res.status(400).json({ message: "No file uploaded (field name must be 'file')" });
        }

        const wb = new ExcelJS.Workbook();
        await wb.xlsx.load(req.file.buffer);
        const ws = wb.worksheets[0];
        if (!ws) return res.status(400).json({ message: "XLSX file has no worksheets" });

        const headerRow = ws.getRow(1);
        const headerValues = headerRow.values.slice(1);
        const headerIndex = buildHeaderIndex(headerValues);

        const idCol = findHeaderIndex(headerIndex, ["id", "meter_id"]);
        const meterNumberCol = findHeaderIndex(headerIndex, ["meter_number", "meter no.", "meter no", "meter", "meter no"]);
        const userRefCol = findHeaderIndex(headerIndex, ["user_id", "user id", "member_code", "member code", "full_name", "name", "email"]);
        const addressCol = findHeaderIndex(headerIndex, ["installation_address", "address", "location"]);
        const installedAtCol = findHeaderIndex(headerIndex, ["installed_at", "installed at", "installation_date", "installation date", "created_at"]);
        const statusCol = findHeaderIndex(headerIndex, ["status"]);

        const missing = [];
        if (!meterNumberCol) missing.push("meter_number");
        if (!userRefCol) missing.push("user_id/member_code");
        if (missing.length) {
            return res.status(422).json({
                message: `Missing required columns: ${missing.join(", ")}`,
                accepted_headers: {
                    meter_number: ["meter_number", "meter no.", "meter"],
                    user_ref: ["user_id", "user id", "member_code", "member code", "full_name", "email"],
                    optional: ["id", "installation_address", "address", "installed_at", "status"],
                },
            });
        }

        const upserts = [];
        const updates = [];
        const errors = [];

        ws.eachRow((row, rowNumber) => {
            if (rowNumber === 1) return;

            const id = idCol ? normalizeCellValue(row.getCell(idCol).value) : "";
            const meterNumber = normalizeCellValue(row.getCell(meterNumberCol).value);
            const userRef = normalizeCellValue(row.getCell(userRefCol).value);
            const installationAddress = addressCol ? normalizeCellValue(row.getCell(addressCol).value) : "";
            const installedAt = installedAtCol ? parseDateCell(row.getCell(installedAtCol).value) : null;
            const status = statusCol ? normalizeImportStatus(normalizeCellValue(row.getCell(statusCol).value)) : "active";

            const isBlank = !id && !meterNumber && !userRef && !installationAddress && !installedAt;
            if (isBlank) return;

            if (!meterNumber || !userRef) {
                errors.push({ row: rowNumber, error: "meter_number and user reference are required" });
                return;
            }

            const payload = {
                rowNumber,
                meter_number: meterNumber,
                user_ref: userRef,
                installation_address: installationAddress,
                installed_at: installedAt ? installedAt.toISOString().slice(0, 10) : null,
                status,
            };

            const idNum = Number(id);
            if (id && Number.isFinite(idNum) && idNum > 0) {
                updates.push({ id: idNum, ...payload });
            } else {
                upserts.push(payload);
            }
        });

        if (errors.length) {
            return res.status(422).json({ message: "Validation failed", errors });
        }

        for (const record of[...updates, ...upserts]) {
            const resolvedUserId = await resolveUserId(record.user_ref);
            if (!resolvedUserId) {
                errors.push({
                    row: record.rowNumber,
                    error: `User reference not found: ${record.user_ref}`,
                });
            } else {
                record.user_id = resolvedUserId;
            }
        }

        if (errors.length) {
            return res.status(422).json({ message: "Validation failed", errors });
        }

        const conn = await db.getConnection();
        try {
            await conn.beginTransaction();

            // upsert by meter_number for rows without explicit id
            if (upserts.length) {
                const values = upserts.map((r) => [
                    r.meter_number,
                    r.user_id,
                    r.installation_address,
                    r.installed_at,
                    r.status,
                ]);

                const batchSize = 500;
                for (let i = 0; i < values.length; i += batchSize) {
                    const batch = values.slice(i, i + batchSize);
                    await conn.query(
                        `INSERT INTO meters (meter_number, user_id, installation_address, installed_at, status)
             VALUES ?
             ON DUPLICATE KEY UPDATE
               user_id = VALUES(user_id),
               installation_address = VALUES(installation_address),
               installed_at = VALUES(installed_at),
               status = VALUES(status)`, [batch]
                    );
                }
            }

            // updates (by id)
            for (const r of updates) {
                await conn.query(
                    `UPDATE meters
           SET meter_number=?, user_id=?, installation_address=?, installed_at=?, status=?
           WHERE id=?`, [
                        r.meter_number,
                        r.user_id,
                        r.installation_address,
                        r.installed_at,
                        r.status,
                        r.id,
                    ]
                );
            }

            await conn.commit();

            await logAuditEvent({
                req,
                actionType: "system_event",
                action: "meters_import_xlsx_processed",
                entityType: "meters",
                details: {
                    inserted_or_upserted: upserts.length,
                    updated: updates.length,
                },
            });

            return res.json({
                message: "Import successful",
                inserted_or_upserted: upserts.length,
                updated: updates.length,
            });

        } catch (err) {
            await conn.rollback();
            console.error("importMetersXlsx error:", err);
            return res.status(500).json({ message: "Import failed", error: err.message });
        } finally {
            conn.release();
        }
    } catch (err) {
        console.error("importMetersXlsx error:", err);
        res.status(500).json({ message: "Server error", error: err.message });
    }
}


// GET meter by ID
async function getMeterById(req, res) {
    try {
        const { id } = req.params;
        const [rows] = await db.query(
            "SELECT * FROM meters WHERE id = ?", [id]
        );
        if (!rows.length) return res.status(404).json({ message: "Meter not found" });
        res.json(rows[0]);
    } catch (err) {
        console.error("getMeterById error:", err);
        res.status(500).json({ message: "Server error" });
    }
}

// CREATE meter
async function createMeter(req, res) {
    try {
        const payload = normalizeMeterPayload(req.body);

        if (!payload.meter_number) {
            return res.status(400).json({ message: "Meter number is required" });
        }

        const resolvedUserId = await resolveUserId(payload.user_id);
        if (!resolvedUserId) {
            return res.status(400).json({ message: "User reference not found. Use a valid User ID or Member Code." });
        }

        const [result] = await db.query(
            `INSERT INTO meters (meter_number, user_id, installation_address, installed_at, status)
       VALUES (?, ?, ?, ?, ?)`, [
                payload.meter_number,
                resolvedUserId,
                payload.installation_address,
                payload.installed_at,
                payload.status,
            ]
        );

        res.json({ id: result.insertId });
    } catch (err) {
        console.error("createMeter error:", err);
        if (err.code === "ER_DUP_ENTRY") {
            return res.status(409).json({ message: "Meter number already exists" });
        }
        res.status(500).json({ message: err.sqlMessage || err.message || "Server error" });
    }
}

// UPDATE meter
async function updateMeter(req, res) {
    try {
        const { id } = req.params;
        const payload = normalizeMeterPayload(req.body);

        if (!payload.meter_number) {
            return res.status(400).json({ message: "Meter number is required" });
        }

        const resolvedUserId = await resolveUserId(payload.user_id);
        if (!resolvedUserId) {
            return res.status(400).json({ message: "User reference not found. Use a valid User ID or Member Code." });
        }

        await db.query(
            `UPDATE meters 
       SET meter_number=?, user_id=?, installation_address=?, installed_at=?, status=?
       WHERE id=?`, [
                payload.meter_number,
                resolvedUserId,
                payload.installation_address,
                payload.installed_at,
                payload.status,
                id,
            ]
        );

        res.json({ message: "Meter updated" });
    } catch (err) {
        console.error("updateMeter error:", err);
        if (err.code === "ER_DUP_ENTRY") {
            return res.status(409).json({ message: "Meter number already exists" });
        }
        res.status(500).json({ message: err.sqlMessage || err.message || "Server error" });
    }
}

// DELETE meter
async function deleteMeter(req, res) {
    try {
        const { id } = req.params;
        await db.query("DELETE FROM meters WHERE id = ?", [id]);
        res.json({ message: "Meter deleted" });
    } catch (err) {
        console.error("deleteMeter error:", err);
        res.status(500).json({ message: "Server error" });
    }
}

module.exports = {
    getAllMeters,
    exportMetersXlsx,
    importMetersXlsx,
    getMeterById,
    createMeter,
    updateMeter,
    deleteMeter,
};