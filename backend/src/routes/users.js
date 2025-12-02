import express from "express";
import { register, login, logout, refreshToken } from "../controllers/authController.js";
import { authenticateToken } from "../middleware/authenticator.js";

const router = express.Router();

router.post("/register", register);
router.post("/login", login);
router.post("/logout", authenticateToken, logout);
router.post("/refresh", authenticateToken, refreshToken);

export default router;
