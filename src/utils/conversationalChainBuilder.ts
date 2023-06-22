import { OpenAI } from 'langchain/llms/openai';
import { ConversationalRetrievalQAChain } from 'langchain/chains';
import { AIAgent } from '../types/chat';
import { BaseChatMessage } from 'langchain/schema';
import { VectorStore } from 'langchain/vectorstores/base';
import { WarfrontEnv } from './warfront';

const CONDENSE_PROMPT = `Given the following conversation and a follow up question, rephrase the follow up question to be a standalone question.

Chat History:
{chat_history}
Follow Up Input: {question}
Standalone question:`;

const QA_PROMPT = `You are a helpful AI assistant. Use the following pieces of context to answer the question at the end. 

1. Feel free to breakdown a question into multiple sub questions if needed, and answer each of them.
2. If you don't know the answer, just say you don't know. DO NOT try to make up an answer.

{context}

Question: {question}
Helpful answer in markdown:`;

export const makeChain = (vectorstore: VectorStore, pastMessages: BaseChatMessage[] ) : Promise<AIAgent> => {
  const model = new OpenAI({
    temperature: 0.3, // increase temepreature to get more creative answers
    modelName: 'gpt-3.5-turbo', //change this to gpt-4 if you have access
  });

  const chain = ConversationalRetrievalQAChain.fromLLM(
    model,
    vectorstore.asRetriever(),
    {
      qaTemplate: QA_PROMPT,
      questionGeneratorTemplate: CONDENSE_PROMPT,
      returnSourceDocuments: true, //The number of source documents returned is 4 by default
      verbose: true
    },
  );

  return Promise.resolve(async function (params: { input: string; userId: string; requestId: string, userType: string; environment: WarfrontEnv }) {
    const response = await chain.call({
      question: params.input,
      chat_history: pastMessages || [],
    });

    return response.text;
  })
};
