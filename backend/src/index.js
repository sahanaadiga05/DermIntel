import dotenv from "dotenv";
import { createApp } from "./app.js";

dotenv.config();

const app = createApp();
const port = Number(process.env.PORT || 4000);

app.listen(port, () => {
  console.log(`DermIntel API listening on port ${port}`);
});

