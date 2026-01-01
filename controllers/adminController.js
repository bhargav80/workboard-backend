const User = require("../models/Users");
const Employee = require("../models/Employees")
const mongoose = require("mongoose")

exports.updateUserRole = async (req, res) => {
  try {
    const { role } = req.body;

    if (!["employee", "manager", "admin"].includes(role)) {
      return res.status(400).json({
        message: "Invalid role"
      });
    }

    const user = await User.findByIdAndUpdate(
      req.params.id,
      { role },
      { new: true, runValidators: true }
    );

    if (!user) {
      return res.status(404).json({
        message: "User not found"
      });
    }

    res.status(200).json({
      message: "Role updated successfully",
      user: {
        id: user._id,
        email: user.email,
        role: user.role
      }
    });

  } catch (err) {
    res.status(500).json({
      message: "Role update failed",
      error: err.message
    });
  }
};

exports.assignManagerToEmployee = async(req,res)=>{
    try {
        const{employeeId,managerId} = req.body;
        const employee = await Employee.findById(employeeId);
         if (!employee) {
      return res.status(404).json({
        message: "Employee not found"
      });
    }
  const manager = await User.findById(managerId);
    if (!manager || manager.role !== "manager") {
      return res.status(400).json({
        message: "Selected user is not a manager"
      });
    }

    employee.managerId = managerId;
    await employee.save();
    res.status(200).json({
      status: "success",
      message: "Manager assigned successfully",
      data: employee
    });
    } catch (err) {
        res.status(500).json({
      message: "Failed to assign manager",
      error: err.message
    });
    }
}