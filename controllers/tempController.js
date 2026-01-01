const  Employee= require("../models/Employees");
const User= require("../models/Users");

exports.tempCreateEmployee = async (req, res) => {
  try {
    const { name, designation, email } = req.body;

    const employee = await Employee.create({
      name,
      designation,
      email
    });

    res.status(201).json({
      message: "Temporary employee created",
      employee
    });

  } catch (err) {
    res.status(500).json({ message: "Error creating employee", error: err });
  }
};


exports.tempCreateAdmin = async (req, res) => {
  try {
    const { email, password, passwordConfirm, username } = req.body;

    // Check if an admin already exists (optional safety)
    const existingAdmin = await User.findOne({ role: "admin" });
    // REMOVE this check if you want multiple admins
    if (existingAdmin) {
      return res
        .status(400)
        .json({ message: "Admin already exists. Remove this check if needed." });
    }

   

    const adminUser = await User.create({
      username,
      email,
      password,passwordConfirm,
      role: "admin",
      isVerified: true,
      isActive: true,
      employeeId: null,
    });

    res.status(201).json({
      message: "Temporary admin created",
      admin: adminUser,
    });
  } catch (err) {
    res.status(500).json({ message: "Error creating admin", error: err });
  }
};