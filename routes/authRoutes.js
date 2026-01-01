const express = require("express");
const authController = require("../controllers/authController");
const { protect, restrictTo } = require("../middlewares/authMiddleware");
const router = express.Router();

router.post("/login", authController.login);
router.post("/register", authController.registerEmployee);
router.patch(
  "/users/:id/role",
  protect,
  restrictTo("admin"),
  authController.updateUserRole
);

module.exports = router;
