const User = require("../models/Users");
const Employee = require("../models/Employees");

exports.getAllUsers = async(req,res)=>{
    try {
        const users = await User.find()
        .select("-password")
        .lean();
         const usersWithEmployee = await Promise.all(
      users.map(async (user) => {
        const employee = await Employee.findOne({ userId: user._id })
          .select("name designation isDeleted")
          .lean();

        return {
          ...user,
          employee
        };
      })
    );
    res.status(200).json({
      status: "success",
      results: usersWithEmployee.length,
      data: usersWithEmployee
    });
    } catch (error) {
         res.status(500).json({
      message: "Failed to fetch users",
      error: err.message
    });
  }
    }
exports.deleteUser = async (req, res) => {
  try {
    const userId = req.params.id;
    const employee = await Employee.findOne({ userId });

    
    if (employee) {
      employee.userId = null;
      await employee.save();
    }

    
    const user = await User.findByIdAndDelete(userId);

    if (!user) {
      return res.status(404).json({
        message: "User not found"
      });
    }

    res.status(200).json({
      status: "success",
      message: "User deleted and employee unlinked"
    });
  } catch (err) {
    res.status(500).json({
      message: "Failed to delete user",
      error: err.message
    });
  }
};