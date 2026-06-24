const db = require("../config/db");
const fs = require("fs");
const path = require("path");
const { logAuditEvent } = require("../services/audit-log.service");
const ALLOWED_APPLICATION_STATUS = new Set(["pending", "approved", "rejected"]);
const BENEFIT_DOCS_DIR = path.join(__dirname, "..", "uploads", "benefit_documents");

async function getAllBenefits(req, res) {
    try {
        const [rows] = await db.query("SELECT * FROM benefits");
        res.json(rows);
    } catch (err) {
        console.error("getAllBenefits error:", err);
        res.status(500).json({ message: "Server error" });
    }
}

async function createBenefit(req, res) {
    try {
        const { name, description, is_active } = req.body;

        const [r] = await db.query(
            `INSERT INTO benefits (name, description, is_active)
       VALUES (?, ?, ?)`, [name, description, is_active ? 1 : 0]
        );

        res.json({ id: r.insertId });
    } catch (err) {
        console.error("createBenefit error:", err);
        res.status(500).json({ message: "Server error" });
    }
}

async function updateBenefit(req, res) {
    try {
        const { id } = req.params;
        const { name, description, is_active } = req.body;

        await db.query(
            `UPDATE benefits 
       SET name=?, description=?, is_active=? 
       WHERE id=?`, [name, description, is_active ? 1 : 0, id]
        );

        res.json({ message: "Updated" });
    } catch (err) {
        console.error("updateBenefit error:", err);
        res.status(500).json({ message: "Server error" });
    }
}

async function deleteBenefit(req, res) {
    try {
        const { id } = req.params;
        await db.query("DELETE FROM benefits WHERE id=?", [id]);
        res.json({ message: "Deleted" });
    } catch (err) {
        console.error("deleteBenefit error:", err);
        res.status(500).json({ message: "Server error" });
    }
}

async function getApplications(req, res) {
    try {
        const status = String((req.query && req.query.status) || "").trim().toLowerCase();
        const hasStatusFilter = status && ALLOWED_APPLICATION_STATUS.has(status);

        const sql = `
      SELECT
        ba.*,
        u.full_name AS applicant_name,
        b.name AS benefit_name,
        reviewer.full_name AS reviewed_by_name
      FROM benefit_applications ba
      JOIN users u ON u.id = ba.user_id
      JOIN benefits b ON b.id = ba.benefit_id
      LEFT JOIN users reviewer ON reviewer.id = ba.reviewed_by
      ${hasStatusFilter ? "WHERE ba.status = ?" : ""}
      ORDER BY
        CASE ba.status
          WHEN 'pending' THEN 0
          WHEN 'approved' THEN 1
          ELSE 2
        END,
        ba.applied_at DESC,
        ba.id DESC
    `;

        const [rows] = hasStatusFilter ? await db.query(sql, [status]) : await db.query(sql);
        res.json(rows);
    } catch (err) {
        console.error("getApplications error:", err);
        res.status(500).json({ message: "Server error" });
    }
}

async function updateApplicationStatus(req, res) {
    try {
        const { id } = req.params;
        const rawStatus = String((req.body && req.body.status) || "").trim().toLowerCase();
        const remarks = typeof(req.body && req.body.remarks) === "string" ? req.body.remarks.trim() : null;
        const reviewedByFromBody = Number((req.body && req.body.reviewed_by) || 0);
        const reviewedBy = reviewedByFromBody || Number((req.user && req.user.id) || 0);

        if (!Number(id)) {
            return res.status(400).json({ message: "Invalid application id" });
        }

        if (!ALLOWED_APPLICATION_STATUS.has(rawStatus)) {
            return res.status(400).json({ message: "Invalid status" });
        }

        if (!reviewedBy) {
            return res.status(400).json({ message: "Missing reviewer context" });
        }

        const [existing] = await db.query(
            "SELECT id FROM benefit_applications WHERE id = ? LIMIT 1", [id]
        );

        if (!existing.length) {
            return res.status(404).json({ message: "Application not found" });
        }

        await db.query(
            `UPDATE benefit_applications
       SET status=?, remarks=?, reviewed_by=?, reviewed_at=NOW()
       WHERE id=?`, [rawStatus, remarks || null, reviewedBy, id]
        );

        await logAuditEvent({
            req,
            userId: reviewedBy,
            actionType: "approval",
            action: `benefit_application_${rawStatus}`,
            entityType: "benefit_application",
            entityId: id,
            details: {
                status: rawStatus,
                remarks: remarks || null,
            },
        });

        res.json({ message: "Application updated" });
    } catch (err) {
        console.error("updateApplicationStatus error:", err);
        res.status(500).json({ message: "Server error" });
    }
}

async function getApplicationDocuments(req, res) {
    try {
        const applicationId = Number((req.params && req.params.id) || 0);
        if (!applicationId) {
            return res.status(400).json({ message: "Invalid application id" });
        }

        const [apps] = await db.query(
            "SELECT id, user_id FROM benefit_applications WHERE id = ? LIMIT 1", [applicationId]
        );

        if (!apps.length) {
            return res.status(404).json({ message: "Application not found" });
        }

        const userId = Number(apps[0].user_id || 0);
        if (!userId) {
            return res.json({ documents: [] });
        }

        if (!fs.existsSync(BENEFIT_DOCS_DIR)) {
            return res.json({ documents: [] });
        }

        const files = fs.readdirSync(BENEFIT_DOCS_DIR, { withFileTypes: true })
            .filter((entry) => entry.isFile())
            .map((entry) => entry.name)
            .filter((name) => {
                const marker = `_${userId}_`;
                return name.includes(marker);
            });

        const documents = files
            .map((fileName) => {
                const absolutePath = path.join(BENEFIT_DOCS_DIR, fileName);
                const stat = fs.statSync(absolutePath);
                const parts = fileName.split("_");
                const originalName = parts.length >= 3 ? parts.slice(2).join("_") : fileName;
                const timestamp = Number(parts[0]);
                const uploadedAt = Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : stat.mtime.toISOString();

                return {
                    fileName,
                    originalName,
                    uploadedAt,
                    sizeBytes: stat.size,
                    extension: path.extname(originalName || fileName).replace(".", "").toLowerCase(),
                };
            })
            .sort((a, b) => String(b.uploadedAt).localeCompare(String(a.uploadedAt)));

        return res.json({ documents });
    } catch (err) {
        console.error("getApplicationDocuments error:", err);
        return res.status(500).json({ message: "Server error" });
    }
}

async function getDocumentFile(req, res) {
    try {
        const requested = String((req.params && req.params.fileName) || "");
        const safeName = path.basename(requested);

        if (!safeName) {
            return res.status(400).json({ message: "Invalid file name" });
        }

        const absolutePath = path.join(BENEFIT_DOCS_DIR, safeName);
        if (!fs.existsSync(absolutePath)) {
            return res.status(404).json({ message: "Document not found" });
        }

        res.setHeader("Content-Disposition", `inline; filename=\"${safeName}\"`);
        return res.sendFile(absolutePath);
    } catch (err) {
        console.error("getDocumentFile error:", err);
        return res.status(500).json({ message: "Server error" });
    }
}

module.exports = {
    getAllBenefits,
    createBenefit,
    updateBenefit,
    deleteBenefit,
    getApplications,
    updateApplicationStatus,
    getApplicationDocuments,
    getDocumentFile,
};