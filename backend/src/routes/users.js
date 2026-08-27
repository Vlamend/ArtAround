import express from "express";
import { register, login, logout, protectedRoute, updateMe } from "../controllers/usersController.js";
import { authenticateToken } from "../middleware/authenticator.js";

const router = express.Router();

router.post("/register", register);
router.post("/login", login);
router.post("/logout", authenticateToken, logout);
router.get("/protected-route", authenticateToken, protectedRoute);
router.put("/protected-route", authenticateToken, updateMe);


export default router;