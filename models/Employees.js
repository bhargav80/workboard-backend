const mongoose = require("mongoose");

const employeeSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true
    },
    designation: String,

    email: {
      type: String,
      required: true,
      unique: true
    },

    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null 
    },
    managerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    default: null
  },

    active: {
      type: Boolean,
      default: true
    },

    isDeleted: {
      type: Boolean,
      default: false
    },

    deletedAt: Date
  },
  { timestamps: true }
);

module.exports = mongoose.model("Employee", employeeSchema);
