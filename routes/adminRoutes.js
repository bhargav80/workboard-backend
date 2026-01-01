const express = require("express");
const adminController = require("../controllers/adminController");
const { protect, restrictTo } = require("../middlewares/authMiddleware");
const router = express.Router();


router.patch(
  "/users/:id/role",
  protect,
  restrictTo("admin"),
  adminController.updateUserRole
);
router.patch(
  "/assign-manager",
  protect,
  restrictTo("admin"),
  adminController.assignManagerToEmployee
);
module.exports = router;
