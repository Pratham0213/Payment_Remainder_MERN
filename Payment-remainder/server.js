const express = require("express");
const app = express();
const bodyParser = require("body-parser");
const methodOverride = require("method-override");
const PDFDocument = require("pdfkit");
const nodemailer = require("nodemailer");
var cron = require("node-cron");
// Middleware to parse JSON-encoded bodies
app.use(bodyParser.json());
// Middleware to parse URL-encoded bodies
require("dotenv").config();
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("./views"));
app.use(express.static("./payment-reminders"));
app.set("view engine", "ejs");
app.use(bodyParser.urlencoded({ extended: true }));
app.use(methodOverride("_method"));
const mongoose = require("mongoose");
const session = require("express-session");
let uri = process.env.URI;
mongoose
  .connect("mongodb+srv://hustlerpratham:12345@cluster0.sp4bjfr.mongodb.net/", {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log("Connected to MongoDB"))
  .catch((err) => console.error("Error connecting to MongoDB:", err));
const reminderSchema = new mongoose.Schema({
  id: Number,
  name: String,
  dueDate: Date,
  cost: Number,
  category: String, // New field for category
  recurring: Boolean, // New field for recurring reminders
  customNotification: String, // New field for custom notification preferences
});

const Reminder = mongoose.model("Reminder", reminderSchema);
let reminders = [
  { id: 1, name: "Rent", dueDate: "2024-05-01", cost: 100, category: "Rent" },
  {
    id: 2,
    name: "Electricity bill",
    dueDate: "2024-05-05",
    cost: 50,
    category: "Utilities",
  },
];

app.get("/", (req, res) => {
  res.render("index", { reminders: reminders });
});
app.get("/login", (req, res) => {
  res.render("login");
});
app.get("/new", (req, res) => {
  res.render("new");
});
app.get("/signup", (req, res) => {
  res.render("signup");
});
app.post("/new", async (req, res) => {
  try {
    // Create a new reminder
    const newReminder = {
      id: reminders.length + 1,
      name: req.body.name,
      dueDate: req.body.dueDate,
      cost: parseFloat(req.body.cost),
      category: req.body.category,
      recurring: req.body.recurring === "on",
    };
    // Save the reminder to the database
    reminders.push(newReminder);
    // Redirect to the main page
    res.redirect("/");
  } catch (err) {
    console.error("Error adding reminder:", err);
    res.status(500).send("Internal Server Error");
  }
});
app.delete("/delete/:id", (req, res) => {
  const idToDelete = parseInt(req.params.id);
  reminders = reminders.filter((reminder) => reminder.id !== idToDelete);
  res.redirect("/");
});

app.get("/print", (req, res) => {
  const doc = new PDFDocument();
  const buffers = [];

  doc.on("data", buffers.push.bind(buffers));
  doc.on("end", () => {
    const pdfData = Buffer.concat(buffers);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", "attachment; filename=bills.pdf");
    res.send(pdfData);
  });
  doc.fontSize(20).text("Payment Reminders", { align: "center" });
  doc.moveDown();
  reminders.forEach((reminder, index) => {
    doc.fontSize(14).text(`Name: ${reminder.name}`);
    doc.fontSize(12).text(`Due Date: ${reminder.dueDate}`);
    doc.fontSize(12).text(`Cost: Rs.${reminder.cost.toFixed(2)}`);
    doc.fontSize(12).text(`Category: ${reminder.category}`);
    doc.moveDown();
    if (index !== reminders.length - 1) {
      doc.addPage();
    }
  });

  doc.end();
});
app.get("/reminders", (req, res) => {
  const { sortBy, filterBy } = req.query;
  // Sort reminders by specified criteria
  let sortedReminders = reminders;
  if (sortBy === "name") {
    sortedReminders = sortedReminders.sort((a, b) =>
      a.name.localeCompare(b.name)
    );
  } else if (sortBy === "dueDate") {
    sortedReminders = sortedReminders.sort(
      (a, b) => new Date(a.dueDate) - new Date(b.dueDate)
    );
  } else if (sortBy === "category") {
    sortedReminders = sortedReminders.sort((a, b) =>
      a.category.localeCompare(b.category)
    );
  }
  // Filter reminders by specified category
  let filteredReminders = sortedReminders;
  if (filterBy) {
    filteredReminders = sortedReminders.filter(
      (reminder) => reminder.category === filterBy
    );
  }
  res.render("index", { reminders: filteredReminders });
});

app.put("/complete/:id", async (req, res) => {
  try {
    const reminder = await Reminder.findById(req.params.id);
    if (reminder) {
      reminder.completed = !reminder.completed; // Toggle completion status
      await reminder.save();
      res.redirect("/");
    } else {
      res.status(404).send("Reminder not found");
    }
  } catch (err) {
    console.error("Error completing reminder:", err);
    res.status(500).send("Internal Server Error");
  }
});
app.get("/reminder/:id", (req, res) => {
  const reminderId = parseInt(req.params.id);
  const reminder = reminders.find((reminder) => reminder.id === reminderId);
  if (reminder) {
    res.render("reminder_details", { reminder });
  } else {
    res.status(404).send("Reminder not found");
  }
});
app.post("/reminder/recurring", (req, res) => {
  let newReminder = {
    id: reminders.length + 1,
    name: req.body.name,
    dueDate: req.body.dueDate,
    cost: parseFloat(req.body.cost),
    category: req.body.category,
    recurring: req.body.recurring === "on",
  };
  reminders.push(newReminder);
  res.redirect("/reminders");
  let emailSent = false;

  const transporter = nodemailer.createTransport({
    host: "smtp.ethereal.email",
    port: 587,
    auth: {
      user: "shania.crona38@ethereal.email",
      pass: "FDrKmaN75nwmQmv3Hc",
    },
  });

  const mailOptions = {
    from: "ritikumar2k18@gmail.com",
    to: "mishra2k21@gmail.com",
    subject: "Payment Reminder",
    text: `Dear user,\n This is a reminder that your payment is due  Details are \n
        \n Name:${newReminder.name}\n Due Date:${newReminder.dueDate}\nCost:${newReminder.cost}\nCategory:${newReminder.category}\nRecurring:${newReminder.recurring}\n\n\n Kindly Open your app and check it .\n\nThank you.`,
  };

  const sendMail = async (transporter, mailOptions) => {
    try {
      await transporter.sendMail(mailOptions);
    } catch (error) {
      console.log(error);
    }
  };

  const sendEmailOnce = () => {
    if (!emailSent) {
      sendMail(transporter, mailOptions);
      emailSent = true;
    }
  };
  const [year, month, day] = newReminder.dueDate.split("-").map(Number);
  cron.schedule(`* * * ${day} ${month} * `, () => {
    sendEmailOnce();
  });
  emailSent = false;

  Reminder.insertMany([newReminder]);
});

app.post("/signup", async (req, res) => {
  try {
    const { username, email, password, name } = req.body;
    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);
    // Create new user
    const newUser = new User({
      username,
      email,
      password: hashedPassword,
      name,
    });
    await newUser.save();
    res.status(201).send("User created successfully");
  } catch (error) {
    console.error("Error creating user:", error);
    res.status(500).send("Internal Server Error");
  }
});

// Login route
app.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body;
    // Find user by username
    const user = await User.findOne({ username });
    if (user) {
      // Compare passwords
      const passwordMatch = await bcrypt.compare(password, user.password);
      if (passwordMatch) {
        req.session.user = user;
        res.send("Login successful");
      } else {
        res.status(401).send("Invalid credentials");
      }
    } else {
      res.status(404).send("User not found");
    }
  } catch (error) {
    console.error("Error logging in:", error);
    res.status(500).send("Internal Server Error");
  }
});

// Logout route
app.get("/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error("Error destroying session:", err);
      res.status(500).send("Internal Server Error");
    } else {
      res.send("Logout successful");
    }
  });
});

// User profile route
app.get("/profile", (req, res) => {
  const user = req.session.user;
  if (user) {
    res.json(user);
  } else {
    res.status(401).send("Unauthorized");
  }
});

// Update user profile route
app.put("/profile", async (req, res) => {
  try {
    const user = req.session.user;
    if (user) {
      const { name, email, notificationPreferences } = req.body;
      user.name = name;
      user.email = email;
      user.notificationPreferences = notificationPreferences;
      await user.save();
      res.send("Profile updated successfully");
    } else {
      res.status(401).send("Unauthorized");
    }
  } catch (error) {
    console.error("Error updating profile:", error);
    res.status(500).send("Internal Server Error");
  }
});

const PORT = process.env.PORT || 2200;
app.listen(PORT, () => {
  console.log(`Payment Reminder App is running on port ${PORT}`);
});
