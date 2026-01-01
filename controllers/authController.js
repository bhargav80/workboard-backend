const User = require("../models/Users");
const Employee = require("../models/Employees")
const { signToken } = require("../utils/jwt");

exports.login = async (req, res) => {
    try {
        const { email, password } = req.body;


        if (!email || !password) {
            return res.status(400).json({
                message: "Please provide email and password"
            });
        }


        const user = await User.findOne({ email }).select("+password");

        if (!user || !(await user.correctPassword(password, user.password))) {
            return res.status(401).json({
                message: "Incorrect email or password"
            });
        }

        if (!user.isActive) {
            return res.status(403).json({
                message: "Account deactivated"
            });
        }

        if (!user.isVerified) {
            return res.status(403).json({
                message: "Account not verified"
            });
        }

        const token = signToken(user._id);

        // 5. Send response
        res.status(200).json({
            status: "success",
            token,
            user: {
                id: user._id,
                email: user.email,
                role: user.role,
                username:user.username
            }
        });

    } catch (err) {
        res.status(500).json({
            message: "Login failed",
            error: err.message
        });
    }
};


exports.registerEmployee = async (req, res) => {
    try {
        const { email, password, passwordConfirm, username } = req.body;
        if (!email || !password || !passwordConfirm) {
            return res.status(400).json({
                message: "Email, password and passwordConfirm are required"
            });
        }
const employee = await Employee.findOne({ email, isDeleted: false });
    if (!employee) {
      return res.status(400).json({
        message: "This email is not registered with the company"
      });
    }
  const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        message: "User already registered. Please login."
      });
    }
     const user = await User.create({
      email,
      username,
      password,
      passwordConfirm,
      role: "employee",
      employeeId: employee._id
    });
  employee.userId = user._id;
    await employee.save();
 const token = signToken(user._id);

    res.status(201).json({
      status: "success",
      message: "Registration successful",
      token,
      user: {
        id: user._id,
        email: user.email,
        role: user.role
      }
    });

    } catch (error) {
 res.status(500).json({
      message: "Registration failed",
      error: error.message
    });
    }
}

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