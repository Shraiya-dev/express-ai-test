import { Message } from "../types/chat"
import { AIChatMessage, HumanChatMessage } from "langchain/schema"

export function getFormattedChatHistory(history: Message[]) {
    return history?.map((message: Message) => {
          if (message.type == 'apiMessage') return new AIChatMessage(message.message)
          else return new HumanChatMessage(message.message)
        }) || []
}

export function sanitizeQuestion(question: string) {
    return question.trim().replace('/\n/g', ' ')
}

