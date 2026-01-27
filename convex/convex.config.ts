import { defineApp } from "convex/server";
import r2 from "@convex-dev/r2/convex.config.js";
import workflow from "@convex-dev/workflow/convex.config.js";
import workpool from "@convex-dev/workpool/convex.config.js";

const app = defineApp();
app.use(r2);
app.use(workflow);
app.use(workpool, { name: "imageGeneration" });

export default app;
