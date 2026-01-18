const express = require("express");
const authController = require("../controllers/authController");
console.log("ResetPassword Function:", authController.resetPassword);
const { protect, restrictTo } = require("../middlewares/authMiddleware");
const router = express.Router();
router.post("/login", authController.login);
router.post("/register", authController.registerEmployee);
router.post("/forgot-password", authController.forgotPassword);
//router.post("/reset-password/:token",authController.resetPassword);
router.post("/reset-password/:token", (req, res, next) => {
    return authController.resetPassword(req, res, next);
});
router.patch(
  "/users/:id/role",
  protect,
  restrictTo("admin"),
  authController.updateUserRole
);

module.exports = router;
