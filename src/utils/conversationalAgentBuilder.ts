import { RetrievalQAChain } from 'langchain/chains';
import { ChatOpenAI } from "langchain/chat_models/openai";
import { AgentActionOutputParser, AgentExecutor, ChatConversationalAgent, ChatConversationalCreatePromptArgs, ChatCreatePromptArgs, ZeroShotAgent, initializeAgentExecutorWithOptions } from "langchain/agents";
import { Calculator } from "langchain/tools/calculator";
import { SerpAPI, ChainTool } from "langchain/tools";
import { BufferWindowMemory, ChatMessageHistory } from 'langchain/memory';
import { AgentAction, AgentFinish, BaseChatMessage, ChainValues, LLMResult } from 'langchain/schema';
import { renderTemplate } from 'langchain/prompts';
import { OutputParserException } from 'langchain/schema/output_parser';
import { AIAgent } from '../types/chat';
import { VectorStore } from 'langchain/vectorstores/base';

export const makeRetrievalQAChain = (vectorstore: VectorStore, model: any) => {
  const chain = RetrievalQAChain.fromLLM(
    model,
    vectorstore.asRetriever(),
    {
      verbose: true
    },
  );
  return chain;
};

export function makeRetrivalQATool(vectorstore: VectorStore, model: any) {
  return new ChainTool({
    name: "nbc-qa",
    description:
      "Use this tool to retrieve any information construction materials, building codes and regulations, construction techniques and best practices, construction equipment, construction management, health and safety guidelines, and environmental considerations. DO NOT use this tool of the question is not related to construction.",
    chain: makeRetrievalQAChain(vectorstore, model),
    returnDirect: true
  });
}

export const FORMAT_INSTRUCTIONS = `RESPONSE FORMAT INSTRUCTIONS
----------------------------

Output a JSON markdown code snippet containing a valid JSON object in one of two formats:

**Option 1:**
Use this if you want to use a tool.
Markdown code snippet formatted in the following schema:

\`\`\`json
{{{{
    "action": string // The action to take. Must be one of [{tool_names}]
    "action_input": string // The input to the action. May be a stringified object.
}}}}
\`\`\`

**Option #2:**
Use this if you want to respond directly and conversationally to the human. Markdown code snippet formatted in the following schema:

\`\`\`json
{{{{
    "action": "Final Answer",
    "action_input": string // You should put what you want to return to use here and make sure to use valid json newline characters.
}}}}
\`\`\`

For both options, remember to always include the surrounding markdown code snippet delimiters (begin with "\`\`\`json" and end with "\`\`\`")!
`;

export const DEFAULT_SUFFIX = `TOOLS
------
You can use tools to look up information that may be helpful in answering the users original question. The tools the assistant can use are:

{tools}

MOST IMPORTANT INSTRUCTIONS
--------------------

Evaluate carefully whether or not you should use a tool based on the input and the tools decription. 
Feel free to use multiple tools if you are not satisfied with the results of the first tool you use.
If you do not use a tool, you will be expected to respond directly to the user's input. If you do use a tool, you will be expected to respond with the details of the tool you want to use.

{format_instructions}

USER'S INPUT
--------------------
Here is the user's input (remember to respond with a markdown code snippet of a json blob with a single action, and NOTHING else):

{{input}}`;

export const DEFAULT_PREFIX = `Ustaad AI is an AI-powered assistant developed by ProjectHero for the construction industry.
It provides quick and accurate answers to construction-related questions using a large language model and a verified knowledge base.
Its purpose is to enhance the efficiency of users by delivering reliable information and empowering them with immediate access to knowledge.
Ustaad AI ensures accuracy by cross-checking data with the knowledge base and continually improves through user feedback.
Its goal is to empower construction workers and contractors, improving job satisfaction and productivity.`

export async function makeAgent(vectorstore: VectorStore, pastMessages: BaseChatMessage[]): Promise<AIAgent> {

  return async function (params: {input: string, userId: string, requestId: string, userType: string}) {
    const {
      input,
      userId,
      userType,
      requestId
    } = params;

    const model = new ChatOpenAI({ temperature: 0 }, {
      basePath: "https://oai.hconeai.com/v1",
      baseOptions: {
        headers: {
          "Helicone-Auth": `Bearer sk-kx3zgly-czzenvq-xwzvrii-b75y72i`,
          "Helicone-Property-RequestId": requestId,
          "Helicone-Property-userType": userType,
          "Helicone-User-Id": userId,
          
        }
      }
    });

    const tools = [
      new SerpAPI(process.env.SERPAPI_API_KEY, {
        hl: "en",
        gl: "in",
      }),
      new Calculator(),
      makeRetrivalQATool(vectorstore, model)
    ];
  
    const memory = new BufferWindowMemory({
      chatHistory: new ChatMessageHistory(pastMessages),
      k: 5,
      memoryKey: "chat_history",
      returnMessages: true,
    });
  
    const opts = {
      memoryKey: "chat_history",
      verbose: true,
    }
  
    const promptArgs: ChatConversationalCreatePromptArgs = {
      humanMessage: DEFAULT_SUFFIX,
      systemMessage: DEFAULT_PREFIX,
      outputParser: new IndependentChatConversationalAgentOutputParser(
        tools.map((tool) => tool.name),
      )
    }
  
    const executor = AgentExecutor.fromAgentAndTools({
      agent: ChatConversationalAgent.fromLLMAndTools(
        model, 
        tools,
        {
          ...promptArgs,
        }),
      tools,
      memory,
      ...opts,
    });
  
    const response = await executor.call({
      input,
    });

    return response.output;
  }
}

export class IndependentChatConversationalAgentOutputParser extends AgentActionOutputParser {
  constructor(private toolNames: string[]) {
    super();
  }

  async parse(text: string): Promise<AgentAction | AgentFinish> {
    let jsonOutput = text.trim();
    if (jsonOutput.includes("```json")) {
      jsonOutput = jsonOutput.split("```json")[1].trimStart();
    } else if (jsonOutput.includes("```")) {
      const firstIndex = jsonOutput.indexOf("```");
      jsonOutput = jsonOutput.slice(firstIndex + 3).trimStart();
    }
    const lastIndex = jsonOutput.lastIndexOf("```");
    if (lastIndex !== -1) {
      jsonOutput = jsonOutput.slice(0, lastIndex).trimEnd();
    }

    try {
      const response = JSON.parse(jsonOutput);

      const { action, action_input } = response;

      if (action === "Final Answer") {
        return { returnValues: { output: action_input }, log: text };
      }
      return { tool: action, toolInput: action_input, log: text };
    } catch (e) {
      throw new OutputParserException(
        `Failed to parse. Text: "${text}". Error: ${e}`
      );
    }
  }

  getFormatInstructions(): string {
    return renderTemplate(FORMAT_INSTRUCTIONS, "f-string", {
      tool_names: this.toolNames.join(", "),
    });
  }
}