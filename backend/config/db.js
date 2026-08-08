import mongoose from "mongoose";

mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB connected"))
  .catch(err => {
    console.error("Mongo connection error:", err);
    process.exit(1);
  });