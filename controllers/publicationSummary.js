import wandb from "@wandb/sdk";
import { loadQAMapReduceChain } from "langchain/chains";
import { AzureChatOpenAI } from "@langchain/openai";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";

import * as dotenv from "dotenv";
import fs from "fs";
import logger from "../utils/logger.js";

dotenv.config();

// query setup
// summarization docs https://js.langchain.com/docs/api/chains/functions/loadQAMapReduceChain
const model = new AzureChatOpenAI({
  temperature: .9,
  azureOpenAIEndpoint: process.env.AZURE_OPENAI_ENDPOINT,
  azureOpenAIApiKey: process.env.AZURE_OPENAI_API_KEY,
  azureOpenAIApiDeploymentName: process.env.AZURE_OPENAI_API_DEPLOYMENT_NAME,
  azureOpenAIApiVersion: process.env.AZURE_OPENAI_API_VERSION,
  azureOpenAIApiInstanceName: process.env.AZURE_OPENAI_API_INSTANCE_NAME,

});

const getOpenAIToken = () => {
  if (process.env.OPENAI_TOKEN_FILE) {
    try {
      return fs.readFileSync(process.env.OPENAI_TOKEN_FILE, 'utf8').trim();
    } catch (error) {
      logger.error(`Error reading OPENAI_TOKEN_FILE: ${error.message}`);
      throw new Error('Failed to read OpenAI token file');
    }
  }
  else if (process.env.OPENAI_TOKEN) {
    return process.env.OPENAI_TOKEN;
  }

  throw new Error('OPENAI_TOKEN or OPENAI_TOKEN_FILE must be provided');
};

const createPrompt = ({ targetSymbol, diseaseName }) => {
  return `
  Can you provide a concise summary about the relationship between ${targetSymbol} and ${diseaseName} according to this study?`;
};

export const streamTest = ({ res }) => {
  var sendAndSleep = function (response, counter) {
    if (counter > 10) {
      response.end();
    } else {
      response.write(" ;i=" + counter);
      counter++;
      setTimeout(function () {
        sendAndSleep(response, counter);
      }, 1000);
    }
  };

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Transfer-Encoding", "chunked");

  res.write("Thinking...");
  sendAndSleep(res, 1);
};

export const getMultipleAbstractSummary = async ({
  name,
  entity,
  abstracts,
}) => {  
  var prompt = `
    You are given several abstracts related to ${name} (${entity}). Your task is to write a clear, informative summary combining information from all provided abstracts. 
    The audience are scientists expert on ${name}. They are looking for a quick overview of the main findings, and to get recommended on which paper would be interesting.

    Instructions:
    - Start with a concise textual summary that synthesizes the main points, agreements, and contradictions.
    - List the key findings from all the abstracts as bullet points, each with a citation [n].
    - Compare the findings: do the abstracts agree or contradict? Clearly state any agreements or contradictions.
    - Use plain text format. Do not invent citations or reference abstracts not provided. Do not add a list of citations at the end.
    - Highlight key words in **bold**.
    - don't ask follow up questions. your sole purpose is to provide a summary.

    Below are the abstracts:
    `
  console.log(abstracts)
  for(let i = 0; i < abstracts.length; i++) {
    // if the abstracts are sent from the bibliography section
    if(abstracts[i].hasOwnProperty("europePmcId") && abstracts[i].hasOwnProperty("abstract") && abstracts[i].hasOwnProperty("title")){
      prompt = prompt.concat("\nAbstract [", i + 1, "]\n Title:\n", abstracts[i].title, "\nAbstract:\n", abstracts[i].abstract.replace(/<[^>]*>?/gm, ''))
    // if the abstracts are sent from the EuropePMC section
    } else if(abstracts[i].hasOwnProperty("abstract")) {
      prompt = prompt.concat("\nAbstract [", abstracts[i].number, "]\n Title:\n", abstracts[i].title, "\nAbstract:\n", abstracts[i].abstract.replace(/<[^>]*>?/gm, ''))
    }
  }
  const apiResponse = await model.invoke(prompt);

  return apiResponse
};



export const getPublicationSummary = async ({
  text,
  targetSymbol,
  diseaseName,
  pmcId,
  wbTracer = null,
}) => {
  const prompt = createPrompt({ targetSymbol, diseaseName });

  const wordCount = text.split(" ").length;
  const chunkSize = 14000; // max character count per chunk
  const textSplitter = new RecursiveCharacterTextSplitter({
    chunkSize,
    separators: ["\n\n", "\n", " "],
  });

  const docs = await textSplitter.createDocuments([text]);
  logger.info(JSON.stringify({ wordCount, docsLength: docs.length }));
  const chain = loadQAMapReduceChain(model);
  logger.info("request to openai");
  if (wbTracer !== null) {
    wandb.log({
      targetSymbol: targetSymbol,
      diseaseName: diseaseName,
      pmcId: pmcId,
      chunkSize: chunkSize,
      wordCount: wordCount,
      docsLength: docs.length,
    });
    const apiResponse = await chain.call(
      {
        input_documents: docs,
        question: prompt,
      },
      wbTracer
    );
    if (apiResponse.text.includes("no concise summary")) {
      wandb.log({ successFlag: 0 });
    } else {
      wandb.log({ successFlag: 1 });
    }
    return apiResponse;
  } else {
    const apiResponse = await chain.call({
      input_documents: docs,
      question: prompt,
    });
    return apiResponse;
  }
};
