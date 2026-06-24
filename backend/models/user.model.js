const db = require("../config/db");

const User = {
  findByEmail(email) {
    return db.query("SELECT * FROM users WHERE email = ?", [email]);
  },

  getAll() {
    return db.query("SELECT id, email, full_name, phone, is_active, created_at FROM users");
  },

  create({ email, password, full_name, phone }) {
    // password stored as SHA2(...,256) to match your existing PHP logic
    return db.query(
      "INSERT INTO users (email, password_hash, full_name, phone) VALUES (?, SHA2(?,256), ?, ?)",
      [email, password, full_name, phone || null]
    );
  },

  update(id, { email, full_name, phone, is_active }) {
    return db.query(
      "UPDATE users SET email = ?, full_name = ?, phone = ?, is_active = ? WHERE id = ?",
      [email, full_name, phone || null, is_active ? 1 : 0, id]
    );
  },

  delete(id) {
    return db.query("DELETE FROM users WHERE id = ?", [id]);
  }
};

module.exports = User;
