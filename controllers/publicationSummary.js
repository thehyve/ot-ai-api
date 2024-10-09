import { loadQAMapReduceChain } from "langchain/chains";
import { AzureChatOpenAI } from "@langchain/openai";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import wandb from "@wandb/sdk";

import * as dotenv from "dotenv";
import logger from "../utils/logger.js";

dotenv.config();

// query setup
// summarization docs https://js.langchain.com/docs/api/chains/functions/loadQAMapReduceChain
const model = new AzureChatOpenAI({
  azureOpenAIEndpoint: process.env.AZURE_OPENAI_ENDPOINT,
  azureOpenAIApiKey: process.env.AZURE_OPENAI_API_KEY,
  azureOpenAIApiDeploymentName: process.env.AZURE_OPENAI_API_DEPLOYMENT_NAME,
  azureOpenAIApiVersion: process.env.AZURE_OPENAI_API_VERSION,
  azureOpenAIApiInstanceName: process.env.AZURE_OPENAI_API_INSTANCE_NAME,
});

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

export const getMulitpleAbstractSummary = async ({
  name,
  entity,
  abstracts,
}) => {  
  var prompt = 
  `You are given abstracts related to ${name} ${entity}. Use information found in the abstracts to inform me about this ${entity}.
  Combine the information found in the following abstracts into a single story.\n
  Format the output as plaintext.\n
  If abstract 1 is used as information source, add a citation [1] to the text if an abstact is used.\n
  `

  for(let i = 0; i < abstracts.length; i++) {
    prompt = prompt.concat("Abstract ", i+1, " Title:\n", abstracts[i].publication.title, "\nAbstract:\n", abstracts[i].publication.abstract)
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
