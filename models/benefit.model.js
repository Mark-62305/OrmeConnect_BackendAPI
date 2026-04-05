const db = require("../config/db");

const Benefit = {
  getAll() {
    return db.query("SELECT * FROM benefits ORDER BY id DESC");
  },
  create({ name, description, is_active }) {
    return db.query(
      "INSERT INTO benefits (name, description, is_active) VALUES (?,?,?)",
      [name, description || null, is_active ? 1 : 0]
    );
  },
  update(id, { name, description, is_active }) {
    return db.query(
      "UPDATE benefits SET name=?, description=?, is_active=? WHERE id=?",
      [name, description || null, is_active ? 1 : 0, id]
    );
  },
  delete(id) {
    return db.query("DELETE FROM benefits WHERE id=?", [id]);
  }
};

module.exports = Benefit;
