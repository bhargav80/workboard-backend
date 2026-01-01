const mongoose = require("mongoose");

const validator = require('validator');
const bcrypt = require("bcrypt");
const userSchema = new mongoose.Schema(
  {
    username: String,

    email: {
      type: String,
      required: true,
      unique: true
    },

    password: {
      type: String,
      required: true,
      select: false
    },

    role: {
      type: String,
      enum: ["admin", "employee","manager"],
      default: "employee"
    },

    employeeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employee"
    },

    isVerified: {
      type: Boolean,
      default: true // option 3 → no verification required
    },

    isActive: {
      type: Boolean,
      default: true
    },passwordConfirm: {
    type: String,
    required: [true, 'Please confirm your password'],
    validate: {
      // This only works on CREATE and SAVE!!!
      validator: function(el) {
        return el === this.password;
      },
      message: 'Passwords are not the same!'
    }
  },
    passwordChangedAt: Date,
passwordResetToken: String,
  passwordResetExpires: Date
  },
  { timestamps: true }
);

userSchema.pre("save",async function(next){
    if (!this.isModified("password")) return;
  this.password = await bcrypt.hash(this.password, 10);
  this.passwordConfirm = undefined;
  
  
});
userSchema.pre('save', function(next) {
  if (!this.isModified('password') || this.isNew) return;

  this.passwordChangedAt = Date.now() - 1000;
 
  
});

userSchema.methods.correctPassword = async function
(candidatePassword,
  userPassword)
{
  return await bcrypt.compare(candidatePassword,userPassword);
};

module.exports = mongoose.model("User", userSchema);
