import express from "express";
import taskRoutes from "./routes/tasks.js";
import errorHandler from "./middleware/errorHandler.js";

const app = express();

app.use(express.json());
app.use("/api/tasks", taskRoutes);
app.use(errorHandler);

export default app;
