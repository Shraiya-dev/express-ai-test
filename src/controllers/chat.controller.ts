import { Request, Response } from 'express';
import { OpenAIEmbeddings } from 'langchain/embeddings/openai';
import { PineconeStore } from 'langchain/vectorstores/pinecone';
import { makeAgent } from '../utils/conversationalAgentBuilder';
import { initPinecone } from '../utils/pinecone-client';
import { PINECONE_INDEX_NAME, PINECONE_NAME_SPACE } from '../config/pinecone';
import { AgentBuilder } from '../types/chat';
import { makeChain } from '../utils/conversationalChainBuilder';
import { getFormattedChatHistory, sanitizeQuestion } from '../utils/formatter';
import { VectorStore } from 'langchain/vectorstores/base';
import util from 'util';

let vectorStore: VectorStore;

const initIndex = async () => {
    const pinecone = await initPinecone();
    const index = pinecone.Index(PINECONE_INDEX_NAME);
    /* create vectorstore*/
    vectorStore = await PineconeStore.fromExistingIndex(
      new OpenAIEmbeddings({}),
      {
        pineconeIndex: index,
        textKey: 'text',
        namespace: PINECONE_NAME_SPACE, //namespace comes from your config folder
      },
    );
}


const agentBuilders: Record<string, AgentBuilder> = { 
    v1: makeChain,
    v2: makeAgent,
}

const getResponse = async (
    req: Request,
    res: Response,
) => {

    console.log("chat API: ",util.inspect(req.body, { showHidden: false, depth: null }));
    const { question, version, history, requestId, userId, userType } = req.body;

    if (req.method !== 'POST') {
        res.status(405).json({ error: 'Method not allowed' });
        return;
    }

    if (!question) {
        return res.status(400).json({ message: 'No question in the request' });
    }

    try {
        console.log('Calling agent version ', version);

        const agent = await agentBuilders[version](vectorStore, getFormattedChatHistory(history));

        const response = await agent({input: sanitizeQuestion(question), requestId, userId, userType});
        console.log('response', response);
        res.status(200).json({ text: response });
    } catch (error: any) {
        console.log('error', error);
        res.status(500).json({ error: error.message || 'Something went wrong' });
    }
};


export {
    initIndex,
    getResponse
}