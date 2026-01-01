const express = require("express");
const employeeController = require("../controllers/employeeController");
const { protect, restrictTo } = require("../middlewares/authMiddleware");

const router = express.Router();

router.post(
  "/",
  protect,
  restrictTo("admin"),
  employeeController.createEmployee
);

router.get(
  "/",
 protect,restrictTo("admin"),
  employeeController.getAllEmployees
);

router.get(
  "/managers",
  protect,restrictTo("admin"),
  employeeController.getAvailableManagers
);

router.patch("/:id", protect,restrictTo("admin"), employeeController.updateEmployee);
router.delete("/:id", protect,restrictTo("admin"), employeeController.deleteEmployee);
router.get(
  "/linked",
  protect,
  restrictTo("manager"),
  employeeController.getLinkedEmployees
);

module.exports = router;
