const db = require("../config/db");

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

   // required for insert/update payload
    const required = ["meter_number", "user_id"];
    const missing = required.filter((k) => !headerIndex[k]);
    if (missing.length) {
      return res.status(422).json({ message: `Missing required columns: ${missing.join(", ")}` });
    }

    const inserts = [];
    const updates = [];
    const errors = [];

    ws.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;

      const id = headerIndex.id ? normalizeCellValue(row.getCell(headerIndex.id).value) : "";
      const meterNumber = normalizeCellValue(row.getCell(headerIndex.meter_number).value);
      const userIdRaw = normalizeCellValue(row.getCell(headerIndex.user_id).value);
      const installationAddress = headerIndex.installation_address
        ? normalizeCellValue(row.getCell(headerIndex.installation_address).value)
        : "";
      const installedAt = headerIndex.installed_at
        ? parseDateCell(row.getCell(headerIndex.installed_at).value)
        : null;
      const status = headerIndex.status
        ? normalizeCellValue(row.getCell(headerIndex.status).value) || "active"
        : "active";

      const isBlank = !id && !meterNumber && !userIdRaw && !installationAddress && !status && !installedAt;
      if (isBlank) return;

      if (!meterNumber || !userIdRaw) {
        errors.push({ row: rowNumber, error: "meter_number and user_id are required" });
        return;
      }

      const userId = Number(userIdRaw);
      if (!Number.isFinite(userId) || userId <= 0) {
        errors.push({ row: rowNumber, error: "user_id must be a positive number" });
        return;
      }

      const payload = {
        meter_number: meterNumber,
        user_id: userId,
        installation_address: installationAddress,
        installed_at: installedAt ? installedAt.toISOString().slice(0, 10) : null,
        status,
      };

      const idNum = Number(id);
      if (id && Number.isFinite(idNum) && idNum > 0) {
        updates.push({ id: idNum, ...payload });
      } else {
        inserts.push(payload);
      }
    });

    if (errors.length) {
      return res.status(422).json({ message: "Validation failed", errors });
    }

    const conn = await db.getConnection();
    try {
      await conn.beginTransaction();

      // batch insert
      if (inserts.length) {
        const values = inserts.map((r) => [
          r.meter_number,
          r.user_id,
          r.installation_address,
          r.installed_at,
          r.status,
        ]);

        // keep query size reasonable
        const batchSize = 500;
       for (let i = 0; i < values.length; i += batchSize) {
          const batch = values.slice(i, i + batchSize);
          await conn.query(
            `INSERT INTO meters (meter_number, user_id, installation_address, installed_at, status)
             VALUES ?`,
            [batch]
          );
        }
      }

      // updates (by id)
      for (const r of updates) {
        await conn.query(
          `UPDATE meters
           SET meter_number=?, user_id=?, installation_address=?, installed_at=?, status=?
           WHERE id=?`,
          [
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

      return res.json({
        message: "Import successful",
        inserted: inserts.length,
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
      "SELECT * FROM meters WHERE id = ?", 
      [id]
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
    const { meter_number, user_id, installation_address, installed_at, status } = req.body;

    const [result] = await db.query(
      `INSERT INTO meters (meter_number, user_id, installation_address, installed_at, status)
       VALUES (?, ?, ?, ?, ?)`,
      [meter_number, user_id, installation_address, installed_at, status]
    );

    res.json({ id: result.insertId });
  } catch (err) {
    console.error("createMeter error:", err);
    res.status(500).json({ message: "Server error" });
  }
}

// UPDATE meter
async function updateMeter(req, res) {
  try {
    const { id } = req.params;
    const { meter_number, user_id, installation_address, installed_at, status } = req.body;

    await db.query(
      `UPDATE meters 
       SET meter_number=?, user_id=?, installation_address=?, installed_at=?, status=?
       WHERE id=?`,
      [meter_number, user_id, installation_address, installed_at, status, id]
    );

    res.json({ message: "Meter updated" });
  } catch (err) {
    console.error("updateMeter error:", err);
    res.status(500).json({ message: "Server error" });
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
