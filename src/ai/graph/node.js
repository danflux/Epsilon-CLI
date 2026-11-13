import { ChatGroq } from "@langchain/groq";
import { getApiKey } from "../../utils/file.utils.js";
import { AIMessage,HumanMessage,SystemMessage } from "langchain"; 
import rl from "../../utils/readline.js";


export const LLMNode=async(state,config)=>{
    
    const model=new ChatGroq({
        model: "openai/gpt-oss-120b",
        apiKey:(await getApiKey()).apiKey,
    })

    const stream=await model.stream(state.messages)

    let aiMesaage=""

    for await (const chunk of stream){
        process.stdout.write(chunk.text)
        if(!aiMesaage){
            aiMesaage=chunk;
        }else{
            aiMesaage=aiMesaage.concat(chunk)
        }
    }
    process.stdout.write("\n");
    return{
        messages:[
            ...state.messages,aiMesaage
        ]
    }

}