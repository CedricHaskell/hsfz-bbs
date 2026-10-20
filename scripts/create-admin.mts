import bcrypt from "bcryptjs";
import { db } from "../lib/db";

const username = process.env.HSFZ_ADMIN_USERNAME?.trim().toLowerCase() ?? "";
const password = process.env.HSFZ_ADMIN_PASSWORD ?? "";
if (!/^[a-z0-9_]{3,20}$/.test(username) || password.length < 12 || Buffer.byteLength(password) > 72) {
  throw new Error("设置 HSFZ_ADMIN_USERNAME（3–20 位小写用户名）及 HSFZ_ADMIN_PASSWORD（至少 12 位、最多 72 字节），然后重试。不会覆盖现有账号。");
}
const hash = await bcrypt.hash(password, 12);
db.prepare(`INSERT INTO users (username, password_hash, nickname, role, status, created_at)
  VALUES (?, ?, ?, 'admin', 'approved', datetime('now','localtime'))`).run(username, hash, username);
db.close();
console.log("管理员已创建。请从环境中移除临时管理员密码。");
