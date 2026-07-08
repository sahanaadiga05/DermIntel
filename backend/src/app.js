import cors from "cors";
import express from "express";
import { errorHandler } from "./middleware/error-handler.js";
import analysisRoutes from "./routes/analysis.routes.js";
import authRoutes from "./routes/auth.routes.js";
import productRoutes from "./routes/products.routes.js";
import profileRoutes from "./routes/profile.routes.js";

export function createApp() {
  const app = express();

  app.use(
    cors({
      origin: true,
      credentials: true
    })
  );
  app.use(express.json());

  app.get("/api/health", (_request, response) => {
    response.json({
      status: "ok",
      service: "dermintel-api"
    });
  });

  app.use("/api/auth", authRoutes);
  app.use("/api/profile", profileRoutes);
  app.use("/api/products", productRoutes);
  app.use("/api/analysis", analysisRoutes);
  app.use(errorHandler);

  return app;
}

