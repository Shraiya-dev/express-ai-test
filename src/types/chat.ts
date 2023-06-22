import { VectorStore } from 'langchain/vectorstores/base';
import { Document } from 'langchain/document';
import { BaseChatMessage } from 'langchain/schema';

export type Message = {
  type: 'apiMessage' | 'userMessage';
  message: string;
  isStreaming?: boolean;
  sourceDocs?: Document[];
};

export type AgentBuilder = (vectorstore: VectorStore, pastMessages: BaseChatMessage[] ) => Promise<AIAgent>;

export type AIAgent = (params: {input: string; userId: string; requestId: string, userType: string}) => Promise<string>;