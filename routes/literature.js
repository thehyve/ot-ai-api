import express from "express";
import { handleLiterartureRequest } from "../controllers/literature.js";
import { run } from "../controllers/explain.js";

const router = express.Router();

router.post("/", async (req, res) => {
  const pmcId = req.body.payload.pmcId;
  const targetSymbol = req.body.payload.targetSymbol;
  const diseaseName = req.body.payload.diseaseName;
  console.log({ pmcId, targetSymbol, diseaseName });
  const plainText = await handleLiterartureRequest({ id: pmcId });
  const json = await run({
    text: plainText,
    targetSymbol,
    diseaseName,
    response: res,
  });
  res.send(json);
});

export default router;
