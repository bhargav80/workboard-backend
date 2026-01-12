const express = require("express");
const authController = require("../controllers/authController");
const { protect, restrictTo } = require("../middlewares/authMiddleware");
const router = express.Router();

router.post("/login", authController.login);
router.post("/register", authController.registerEmployee);
router.post("/forgot-password", authController.forgotPassword);
router.patch(
  "/users/:id/role",
  protect,
  restrictTo("admin"),
  authController.updateUserRole
);

module.exports = router;
