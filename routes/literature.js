import express, { response } from "express";
import { WandbTracer } from "@wandb/sdk/integrations/langchain";
import * as dotenv from "dotenv";

import { getPublicationPlainText } from "../controllers/publication.js";
import {
  getPublicationSummary,
  streamTest,
  getMulitpleAbstractSummary,
} from "../controllers/publicationSummary.js";
import { isDevelopment } from "../utils/index.js";
import logger from "../utils/logger.js";

dotenv.config();
const router = express.Router();

var LLM_counter = 0;
var LLM_counter_date = new Date();
const MAX_LLM_REQUESTS = process.env.MAX_LLM_REQUESTS;

async function payloadValidator({ req }) {
  let error = false;
  if (!req.body.payload) {
    error = "Missing payload";
  }
  if (!req.body.payload.pmcId) {
    error = "Missing pmcId in payload";
  }
  if (!req.body.payload.targetSymbol) {
    error = "Missing targetSymbol in payload";
  }
  if (!req.body.payload.diseaseName) {
    error = "Missing diseaseName in payload";
  }
  return { error };
}

async function abstactSummaryPayloadValidator({ req }) {
  let error = false;
  if (!req.body.payload) {
    error = "Missing payload";
  }
  if (!req.body.payload.name) {
    error = "Missing name in payload";
  }
  if (!req.body.payload.entity) {
    error = "Missing entity in payload";
  }
  if (!req.body.payload.abstracts) {
    error = "Missing abstracts in payload";
  }
  return { error };
}

router.post("/publication/abstract-summary", async (req, res) => {

  const payloadError = await abstactSummaryPayloadValidator({ req });
  if (payloadError.error) {
    return res.status(400).json(payloadError);
  }
  const name = req.body.payload.name;

  var entity = req.body.payload.entity;
  if(req.body.payload.entity == "target") {
    entity = req.body.payload.entity.concat(" gene");
  }
  
  const abstracts = req.body.payload.abstracts;
  
  const currentDate = new Date();

  if(LLM_counter_date.getDay() == currentDate.getDay()) {
    if(LLM_counter < MAX_LLM_REQUESTS) {
      const llm_response = await getMulitpleAbstractSummary({name, entity, abstracts})
      LLM_counter++;
      return res.send(llm_response)
    } else {
      return res.status(400).json({error: "LLM message limit reached, please try again tomorrow."});
    }
  } else {
      const llm_response = await getMulitpleAbstractSummary({name, entity, abstracts})
      LLM_counter_date = currentDate;
      LLM_counter = 1;
      return res.send(llm_response)
  }
});


router.post("/publication/summary/stream", async (req, res) => {
  res.setHeader("Content-Type", "application/ndjson");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  streamTest({ res });
});

router.post("/publication/summary/", async (req, res) => {
  const payloadError = await payloadValidator({ req });
  if (payloadError.error) {
    return res.status(400).json(payloadError);
  }

  const { pmcId, targetSymbol, diseaseName } = req.body.payload;

  const prettyDiseaseName = diseaseName.replace(/\s/g, "_");
  const queryId = `${pmcId}_${targetSymbol}_${prettyDiseaseName}`;
  const wbIdWithRandom = `${queryId}_${Math.floor(Math.random() * 1000)}`;
  let wbTracer = null;
  if (isDevelopment) {
    wbTracer = await WandbTracer.init(
      { project: "ot-explain", id: wbIdWithRandom },
      false
    );
  }

  logger.info(`Request on pub summary`);

  let plainText;
  let publicationSummary;
  try {
    plainText = await getPublicationPlainText({ id: pmcId });
  } catch {
    logger.error("Error getting publication text");
    return res.status(503).json({ error: "Error getting publication text" });
  }
  try {
    publicationSummary = await getPublicationSummary({
      text: plainText,
      targetSymbol,
      diseaseName,
      pmcId,
      wbTracer,
      response: res,
    });
  } catch {
    return res.status(503).json({ error: "Error getting publication summary" });
  }
  res.json(publicationSummary);
  if (wbTracer) {
    await WandbTracer.finish();
  }
});

export default router;
