import { Request, Response } from 'express';
import { OpenAIEmbeddings } from 'langchain/embeddings/openai';
import { PineconeStore } from 'langchain/vectorstores/pinecone';
import { makeAgent } from '../utils/conversationalAgentBuilder';
import { initPinecone } from '../utils/pinecone-client';
import { PINECONE_INDEX_NAME, PINECONE_NAME_SPACE } from '../config/pinecone';
import { AgentBuilder, Message } from '../types/chat';
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

const getUpdatedQuestionAndHistory = (question: string, history: Message[] ) => {
    let updatedQuestion = question;
    let updatedHistory = history;
    
    let lastValidIndex = -1
    for (let i = history.length -1; i>=0; i--){
        if(history[i].type === 'apiMessage'){
            lastValidIndex = i;
            break;
        }
        updatedQuestion = updatedQuestion + ", " + history[i].message;
    }
    
    updatedHistory = history.slice(0, lastValidIndex +1);
    
    return {
        updatedQuestion, updatedHistory
    }
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
    const { question, version, history, requestId, userId, userType, environment } = req.body;

    if (req.method !== 'POST') {
        res.status(405).json({ error: 'Method not allowed' });
        return;
    }

    if (!question) {
        return res.status(400).json({ message: 'No question in the request' });
    }
    
    const { updatedQuestion, updatedHistory } = getUpdatedQuestionAndHistory(question, history);

    try {
        console.log('Calling agent version ', version);

        const agent = await agentBuilders[version](vectorStore, getFormattedChatHistory(updatedHistory));

        const response = await agent({input: sanitizeQuestion(updatedQuestion), requestId, userId, userType, environment});
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