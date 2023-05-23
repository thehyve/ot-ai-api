import express from "express";
import { run } from "../controllers/explain.js";

const router = express.Router();

router.post("/", async (req, res) => {
  // console.log("SearchID:", req.body.payload.id);
  // const id = req.body.payload.id;
  const json = await run();
  res.send(json);
});

export default router;
