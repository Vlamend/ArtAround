import express from "express";
import { register, login, logout, protectedRoute, updateMe, getLicenses, createAuthorUser, listUsers } from "../controllers/usersController.js";
import { authenticateToken, requireAdmin } from "../middleware/authenticator.js";

const router = express.Router();

router.post("/register", register);
router.post("/login", login);
router.post("/logout", authenticateToken, logout);
router.get("/protected-route", authenticateToken, protectedRoute);
router.put("/protected-route", authenticateToken, updateMe);
router.get("/licenses", authenticateToken, getLicenses);
router.get("/", authenticateToken, requireAdmin, listUsers);
router.post("/", authenticateToken, requireAdmin, createAuthorUser);

export default router;
