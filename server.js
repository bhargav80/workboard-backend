const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const dotenv = require('dotenv');
const tempRoutes = require("./routes/tempRoutes.js");
const authRoutes = require("./routes/authRoutes.js");
const employeeRoutes = require("./routes/employeeRoutes");
const userRoutes = require("./routes/userRoutes.js");
const adminRoutes =  require("./routes/adminRoutes.js");
const projectRoutes =require("./routes/projectRoute.js");
const taskRoutes =require("./routes/taskRoutes.js");
const sprintRoutes = require("./routes/sprintRoutes.js")
const dashboardRoutes = require("./routes/dashboardRoutes.js");

const app = express();
app.use(cors({
  origin: [
    "http://localhost:50342",
    process.env.FRONTEND_URL
  ],
  credentials: true
}));

dotenv.config({ path: './config.env' });
app.use(express.json());
app.use(express.urlencoded({ extended: true }));


app.set('query parser', 'extended');

const DB = process.env.DATABASE;
//console.log("DB:", process.env.DATABASE);
mongoose.connect(DB,{
  family: 4, // Force IPv4
})
  .then(() => console.log("DB Connection Successful"))
  .catch((err) => console.log("DB Connection Error:", err));

app.use("/api/temp", tempRoutes);
app.use("/api/auth",authRoutes);
app.use("/api/employees", employeeRoutes);
app.use("/api/admin",adminRoutes);
app.use("/api/users", userRoutes);
app.use("/api/projects",projectRoutes);
app.use("/api/tasks",taskRoutes);
app.use("/api/sprints",sprintRoutes);
app.use("/api/dashboard",dashboardRoutes);
const port = process.env.PORT ||3000;
app.listen(port, () => {
  console.log(`App running on port ${port}...`);
});



