const db = require("../config/db");
const fs = require("fs");
const path = require("path");

const ANNOUNCEMENT_IMAGE_DIR = path.join(__dirname, "..", "uploads", "announcement_images");

async function ensureAnnouncementAttachmentsTable() {
    await db.query(`
        CREATE TABLE IF NOT EXISTS announcement_attachments (
            id INT AUTO_INCREMENT PRIMARY KEY,
            announcement_id INT NOT NULL,
            file_name VARCHAR(255) NOT NULL,
            original_name VARCHAR(255) NULL,
            mime_type VARCHAR(120) NULL,
            file_size INT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            INDEX idx_announcement_attachments_announcement_id (announcement_id)
        )
    `);
}

function normalizeFileName(input) {
    const fileName = String(input || "").trim();
    if (!fileName) return "";
    if (fileName.includes("/") || fileName.includes("\\") || fileName.includes("..")) return "";
    return fileName;
}

function mapAttachmentRow(row) {
    return {
        id: Number(row.id),
        file_name: row.file_name,
        original_name: row.original_name || row.file_name,
        mime_type: row.mime_type || "application/octet-stream",
        file_size: Number(row.file_size || 0),
        url: `/api/announcements/attachments/${encodeURIComponent(row.file_name)}`,
    };
}

function normalizeTargetRole(value) {
    if (value == null) return null;
    const v = String(value).trim();
    if (!v || v === "all") return null;
    return v;
}

async function resolveTargetRoleId(value) {
    const normalized = normalizeTargetRole(value);
    if (normalized == null) return null;

    const asNumber = Number(normalized);
    if (Number.isInteger(asNumber) && asNumber > 0) {
        const [
            [roleById]
        ] = await db.query("SELECT id FROM roles WHERE id = ? LIMIT 1", [asNumber]);
        if (!roleById) {
            const err = new Error("Invalid target role");
            err.statusCode = 400;
            throw err;
        }
        return Number(roleById.id);
    }

    const [
        [roleByName]
    ] = await db.query("SELECT id FROM roles WHERE LOWER(name) = LOWER(?) LIMIT 1", [normalized]);
    if (!roleByName) {
        const err = new Error("Invalid target role");
        err.statusCode = 400;
        throw err;
    }

    return Number(roleByName.id);
}

async function getAll(req, res) {
    try {
        await ensureAnnouncementAttachmentsTable();

        const [rows] = await db.query(
            `SELECT a.*, COALESCE(r.name, 'all') AS target_role_name
             FROM announcements a
             LEFT JOIN roles r ON r.id = a.target_role
             ORDER BY a.created_at DESC`
        );

        if (!rows.length) {
            return res.json([]);
        }

        const ids = rows.map((row) => Number(row.id)).filter((id) => Number.isInteger(id) && id > 0);
        const placeholders = ids.map(() => "?").join(",");

        const [attachments] = await db.query(
            `SELECT id, announcement_id, file_name, original_name, mime_type, file_size
             FROM announcement_attachments
             WHERE announcement_id IN (${placeholders})
             ORDER BY id ASC`,
            ids
        );

        const attachmentMap = new Map();
        for (const item of attachments) {
            const announcementId = Number(item.announcement_id);
            const list = attachmentMap.get(announcementId) || [];
            list.push(mapAttachmentRow(item));
            attachmentMap.set(announcementId, list);
        }

        const payload = rows.map((row) => {
            const files = attachmentMap.get(Number(row.id)) || [];
            return {
                ...row,
                attachments: files,
                attachments_count: files.length,
            };
        });

        res.json(payload);
    } catch (err) {
        console.error("getAll error:", err);
        res.status(500).json({ message: "Server error" });
    }
}

async function create(req, res) {
    try {
        const { title, body, target_role } = req.body;
        const userId = req.user.id;
        const files = Array.isArray(req.files) ? req.files : [];

        if (!title || !body) {
            return res.status(400).json({ message: "Title and body are required" });
        }

        await ensureAnnouncementAttachmentsTable();

        const resolvedRoleId = await resolveTargetRoleId(target_role);

        const [r] = await db.query(
            "INSERT INTO announcements (title, body, created_by, target_role) VALUES (?, ?, ?, ?)", [title, body, userId, resolvedRoleId]
        );

        const announcementId = Number(r.insertId);
        for (const file of files) {
            await db.query(
                `INSERT INTO announcement_attachments
                 (announcement_id, file_name, original_name, mime_type, file_size)
                 VALUES (?, ?, ?, ?, ?)`, [
                    announcementId,
                    file.filename,
                    file.originalname || file.filename,
                    file.mimetype || null,
                    Number(file.size || 0),
                ]
            );
        }

        res.json({ id: announcementId, attachments_added: files.length });
    } catch (err) {
        console.error("create error:", err);
        res.status(err.statusCode || 500).json({ message: err.sqlMessage || err.message || "Server error" });
    }
}

async function update(req, res) {
    try {
        const { id } = req.params;
        const { title, body, target_role } = req.body;
        const files = Array.isArray(req.files) ? req.files : [];

        if (!title || !body) {
            return res.status(400).json({ message: "Title and body are required" });
        }

        await ensureAnnouncementAttachmentsTable();

        const resolvedRoleId = await resolveTargetRoleId(target_role);

        await db.query(
            "UPDATE announcements SET title=?, body=?, target_role=? WHERE id=?", [title, body, resolvedRoleId, id]
        );

        for (const file of files) {
            await db.query(
                `INSERT INTO announcement_attachments
                 (announcement_id, file_name, original_name, mime_type, file_size)
                 VALUES (?, ?, ?, ?, ?)`, [
                    Number(id),
                    file.filename,
                    file.originalname || file.filename,
                    file.mimetype || null,
                    Number(file.size || 0),
                ]
            );
        }

        res.json({ message: "Updated", attachments_added: files.length });
    } catch (err) {
        console.error("update error:", err);
        res.status(err.statusCode || 500).json({ message: err.sqlMessage || err.message || "Server error" });
    }
}

async function remove(req, res) {
    try {
        const { id } = req.params;

        await ensureAnnouncementAttachmentsTable();

        const [files] = await db.query(
            "SELECT file_name FROM announcement_attachments WHERE announcement_id = ?", [id]
        );

        await db.query("DELETE FROM announcement_attachments WHERE announcement_id=?", [id]);

        await db.query("DELETE FROM announcements WHERE id=?", [id]);

        for (const file of files) {
            const safeFileName = normalizeFileName(file.file_name);
            if (!safeFileName) continue;
            const abs = path.join(ANNOUNCEMENT_IMAGE_DIR, safeFileName);
            try {
                if (fs.existsSync(abs)) fs.unlinkSync(abs);
            } catch (unlinkErr) {
                console.warn("Failed to remove announcement image:", unlinkErr.message);
            }
        }

        res.json({ message: "Deleted" });
    } catch (err) {
        console.error("remove error:", err);
        res.status(500).json({ message: "Server error" });
    }
}

async function getAttachmentFile(req, res) {
    try {
        const safeFileName = normalizeFileName(req.params && req.params.fileName);
        if (!safeFileName) {
            return res.status(400).json({ message: "Invalid file name" });
        }

        const absolutePath = path.join(ANNOUNCEMENT_IMAGE_DIR, safeFileName);
        if (!fs.existsSync(absolutePath)) {
            return res.status(404).json({ message: "File not found" });
        }

        res.setHeader("Content-Disposition", `inline; filename=\"${safeFileName}\"`);
        return res.sendFile(absolutePath);
    } catch (err) {
        console.error("getAttachmentFile error:", err);
        return res.status(500).json({ message: "Server error" });
    }
}

module.exports = {
    getAll,
    create,
    update,
    remove,
    getAttachmentFile,
};