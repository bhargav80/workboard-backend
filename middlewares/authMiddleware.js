const jwt = require("jsonwebtoken");
const User = require("../models/Users");

exports.protect = async (req, res, next) => {
  try {
    let token;

    
    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith("Bearer")
    ) {
      token = req.headers.authorization.split(" ")[1];
    }

    if (!token) {
      return res.status(401).json({
        message: "You are not logged in"
      });
    }

    
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    
    const currentUser = await User.findById(decoded.id);
    if (!currentUser) {
      return res.status(401).json({
        message: "User no longer exists"
      });
    }

   
    if (
      currentUser.passwordChangedAt &&
      decoded.iat * 1000 < currentUser.passwordChangedAt.getTime()
    ) {
      return res.status(401).json({
        message: "Password recently changed. Please log in again."
      });
    }

    req.user = currentUser;
    next();

  } catch (err) {
    res.status(401).json({
      message: "Invalid or expired token"
    });
  }
};

exports.restrictTo = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        message: "You do not have permission to perform this action"
      });
    }
    next();
  };
};
