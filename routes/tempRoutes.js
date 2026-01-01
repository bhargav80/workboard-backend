const express = require("express");
const tempController = require('../controllers/tempController')

const router = express.Router();

router.post("/create-employee", tempController.tempCreateEmployee);
router.post("/create-admin",tempController.tempCreateAdmin);
module.exports = router;
