
import { loadSummarizationChain } from "langchain/chains";
import { Document } from "langchain/document";
import { OpenAI } from "langchain/llms/openai";
import { PromptTemplate} from "langchain/prompts";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";

console.log(process.env);

// prompt documentation: https://js.langchain.com/docs/modules/prompts/prompt_templates/
const _prompt = `
    Write a concise summary that explains the association between the target HPSE2 and the disease ochoa syndrome.
    If any, please include references to the direction of effect or the mechanism of action of HPSE2:

    ${text}

    CONCISE SUMMARY:
    `
const prompt = new PromptTemplate({ _prompt, inputVariables: ["text"] });

export const run = async (prompt) => {
    // text processing TODO: query strategy based on text length
    const text = "Full text article coming from Carlos"
    const wordCount = text.split(" ").length;
    // generate docs from textSplitter only if wordCount is bigger than 40000 words, otherwise use the text as is
    const textSplitter = new RecursiveCharacterTextSplitter({ chunkSize: 10000, chunkOverlap: 200,  separators: ["\n\n"]});
    const docs = wordCount > 40000 ? await textSplitter.createDocuments([text]) : [Document({ pageContent: text })];
    console.log({ length: docs.length })

    // query setup
    // summarization docs https://js.langchain.com/docs/api/chains/functions/loadSummarizationChain
    const model = new OpenAI({ modelName: "gpt-3.5-turbo" ,temperature: 0.5, openAIApiKey: process.env.OPENAI_API_KEY});
    const chain = loadSummarizationChain(model, { type: "map_reduce" }, prompt);
    const res = await chain.call({
      input_documents: docs,
    });
    console.log({ res });
  };

run(prompt);
