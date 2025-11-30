import User from '../models/User.js';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

export async function login(req, res) {
  const user = await User.findOne({ username: req.body.username });
  if (!user) return res.status(401).json({ error: "User not found" });

  const valid = await bcrypt.compare(req.body.password, user.passwordHash);
  if (!valid) return res.status(401).json({ error: "Invalid password" });

  const token = jwt.sign({ id: user._id }, "secretkey");
  res.json({ token });
}
