const express = require("express");
const userController = require("../controllers/userController")
const { protect, restrictTo } = require("../middlewares/authMiddleware");
const router = express.Router();
router.get(
  "/",
  protect,
  restrictTo("admin"),
  userController.getAllUsers
);
router.delete(
  "/:id",
  protect,
  restrictTo("admin"),
  userController.deleteUser
);
module.exports = router;
