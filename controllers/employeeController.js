const Employee = require("../models/Employees");
const User = require("../models/Users");

exports.createEmployee = async (req, res) => {
  try {
    const { name, designation, email,managerId } = req.body;

    const employee = await Employee.create({
      name,
      designation,managerId,
      email
    });

    res.status(201).json({
      message: "Employee created successfully",
      employee
    });

  } catch (err) {
    res.status(500).json({
      message: "Error creating employee",
      error: err.message
    });
  }
};

exports.getAllEmployees = async (req, res) => {
  try {
    const { includeDeleted } = req.query;

    const filter = {};

    
    if (includeDeleted !== "true") {
      filter.isDeleted = false;
    }

    const employees = await Employee.find(filter)
      .populate("userId", "name email role")
      .populate("managerId", "username email");

    res.status(200).json({
      status: "success",
      results: employees.length,
      data: employees
    });
  } catch (err) {
    res.status(500).json({
      status: "error",
      message: "Failed to fetch employees",
      error: err.message
    });
  }
};


exports.getAvailableManagers = async (req, res) => {
  try {
    const managers = await User.find({ role: "manager" })
      .select("_id username email");

    res.status(200).json({
      status: "success",
      results: managers.length,
      data: managers
    });
  } catch (err) {
    res.status(500).json({
      status: "error",
      message: "Failed to fetch managers",
      error: err.message
    });
  }
};

exports.updateEmployee = async (req, res) => {
  try {
    const employeeId = req.params.id;

    const allowedFields = [
      "name",
      "designation",
      "managerId",
      "active"
    ];

    const updates = {};
    Object.keys(req.body).forEach((key) => {
      if (allowedFields.includes(key)) {
        updates[key] = req.body[key];
      }
    });

    
    if (updates.managerId) {
      const manager = await User.findById(updates.managerId);
      if (!manager || manager.role !== "manager") {
        return res.status(400).json({
          message: "Assigned manager must be a valid manager user"
        });
      }
    }

    const employee = await Employee.findByIdAndUpdate(
      employeeId,
      updates,
      { new: true, runValidators: true }
    );

    if (!employee || employee.isDeleted) {
      return res.status(404).json({
        message: "Employee not found"
      });
    }

    res.status(200).json({
      status: "success",
      data: employee
    });
  } catch (err) {
    res.status(500).json({
      message: "Failed to update employee",
      error: err.message
    });
  }
};

exports.deleteEmployee = async (req, res) => {
  try {
    const employeeId = req.params.id;

    const employee = await Employee.findById(employeeId);

    if (!employee || employee.isDeleted) {
      return res.status(404).json({
        message: "Employee not found"
      });
    }

    employee.isDeleted = true;
    employee.active = false;
    await employee.save();

    res.status(200).json({
      status: "success",
      message: "Employee deleted successfully"
    });
  } catch (err) {
    res.status(500).json({
      message: "Failed to delete employee",
      error: err.message
    });
  }
};

exports.getLinkedEmployees = async (req, res) => {
  try {
    const managerId = req.user.id;

    const employees = await Employee.find({
      managerId,
      isDeleted: false
    })
      .populate("userId", "email role")
      .populate("managerId", "email");

    res.status(200).json({
      status: "success",
      results: employees.length,
      data: employees
    });
  } catch (err) {
    res.status(500).json({
      status: "fail",
      message: "Failed to fetch linked employees",
      error: err.message
    });
  }
};
