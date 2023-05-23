import { loadSummarizationChain } from "langchain/chains";
import { OpenAI } from "langchain/llms/openai";
import { PromptTemplate } from "langchain/prompts";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";

import * as dotenv from "dotenv";
dotenv.config();

export const run = async ({ text, targetSymbol, diseaseName }) => {
  const _prompt = `
    Write a concise summary that explains the association between the target ${targetSymbol} and the disease ${diseaseName} based on the following publication:
    {text}
    `;

  const prompt = new PromptTemplate({
    template: _prompt,
    inputVariables: ["text"],
  });

  // text processing TODO: query strategy based on text length
  const wordCount = text.split(" ").length;
  // generate docs from textSplitter only if wordCount is bigger than 4000 words, otherwise use the text as is
  const textSplitter = new RecursiveCharacterTextSplitter({
    chunkSize: 4000,
    chunkOverlap: 200,
    separators: ["\n\n", "\n", " "],
  });

  const docs = await textSplitter.createDocuments([text]);

  console.log({ wordCount });
  console.log({ length: docs.length });

  // query setup
  // summarization docs https://js.langchain.com/docs/api/chains/functions/loadSummarizationChain
  const model = new OpenAI({
    modelName: "gpt-3.5-turbo",
    temperature: 0.5,
    openAIApiKey: process.env.OPENAI_TOKEN,
  });
  const chain = loadSummarizationChain(model, { type: "map_reduce" }, prompt);
  const apiResponse = await chain.call({
    input_documents: docs,
  });

  return apiResponse;
};
