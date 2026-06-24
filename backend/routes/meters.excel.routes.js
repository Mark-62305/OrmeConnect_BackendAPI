/**
 * File: routes/meters.excel.routes.js
 *
 * Endpoints:
 *  GET  /api/meters/export
 *  POST /api/meters/import
 *
 * Requires:
 *  - mysql2 pool (db)
 *  - table unique key (optional for upsert)
 */

import express from "express";
import ExcelJS from "exceljs";
import multer from "multer";

const router = express.Router();

// Use memory storage for simplicity; switch to diskStorage for huge files
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
});

function requireColumns(headerRow, expected) {
  const got = headerRow.map((v) => String(v || "").trim());
  const missing = expected.filter((c) => !got.includes(c));
  if (missing.length) {
    throw new Error(`Missing columns: ${missing.join(", ")}`);
  }
  return got;
}

function chunkArray(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

/**
 * Factory to attach Excel import/export using a mysql2 pool.
 * @param {import("mysql2/promise").Pool} db
 */
export function metersExcelRoutes(db) {
  // EXPORT: MySQL -> XLSX
  router.get("/export", async (req, res) => {
    // Example: add filters via querystring: ?status=active
    const { status } = req.query;

    const where = [];
    const params = [];
    if (status) {
      where.push("status = ?");
      params.push(status);
    }

    const sql = `
      SELECT id, serial_no, location, status, created_at
      FROM meters
      ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
      ORDER BY id DESC
      LIMIT 50000
    `;

    const [rows] = await db.query(sql, params);

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Meters");

    ws.columns = [
      { header: "id", key: "id", width: 10 },
      { header: "serial_no", key: "serial_no", width: 20 },
      { header: "location", key: "location", width: 30 },
      { header: "status", key: "status", width: 15 },
      { header: "created_at", key: "created_at", width: 22 },
    ];

    ws.addRows(rows);

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader("Content-Disposition", 'attachment; filename="meters.xlsx"');

    await wb.xlsx.write(res);
    res.end();
  });

  // IMPORT: XLSX -> MySQL (insert / upsert)
  router.post("/import", upload.single("file"), async (req, res) => {
    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded. Use field name: file" });
    }

    const expectedCols = ["serial_no", "location", "status"]; // match your template headers

    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(req.file.buffer);

    const ws = wb.worksheets[0];
    if (!ws) return res.status(400).json({ message: "XLSX has no worksheets" });

    const headerRow = ws.getRow(1).values.slice(1);
    const gotCols = requireColumns(headerRow, expectedCols);

    const idx = Object.fromEntries(gotCols.map((c, i) => [c, i + 1]));

    const parsed = [];
    const errors = [];

    ws.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return; // header

      const serialNo = String(row.getCell(idx.serial_no).value || "").trim();
      const location = String(row.getCell(idx.location).value || "").trim();
      const status = String(row.getCell(idx.status).value || "").trim();

      const isEmpty = !serialNo && !location && !status;
      if (isEmpty) return;

      if (!serialNo) {
        errors.push({ row: rowNumber, error: "serial_no is required" });
        return;
      }

      parsed.push({ serial_no: serialNo, location, status });
    });

    if (errors.length) {
      return res.status(422).json({ message: "Validation failed", errors });
    }

    const conn = await db.getConnection();
    try {
      await conn.beginTransaction();

      // Choose ONE:
      // A) Insert only:
      // const sql = `INSERT INTO meters (serial_no, location, status) VALUES ?`;
      // B) Upsert by unique key (serial_no must be UNIQUE):
      const sql = `
        INSERT INTO meters (serial_no, location, status)
        VALUES ?
        ON DUPLICATE KEY UPDATE
          location = VALUES(location),
          status = VALUES(status)
      `;

      const values = parsed.map((r) => [r.serial_no, r.location, r.status]);

      // Batch insert for safety with large files
      const batches = chunkArray(values, 1000);
      for (const batch of batches) {
        await conn.query(sql, [batch]);
      }

      await conn.commit();

      return res.json({
        message: "Import successful",
        rows_received: parsed.length,
        batches: batches.length,
      });
    } catch (e) {
      await conn.rollback();
      return res.status(500).json({ message: "Import failed", error: e.message });
    } finally {
      conn.release();
    }
  });

  return router;
}
