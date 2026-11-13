import { initGraph } from "./ai/graph/graph.js";
import { getSettingsFile ,saveApiKey, getApiKey} from "./utils/file.utils.js";
import rl from "./utils/readline.js";

async function main(){

    const settings= await getSettingsFile();
    // console.log(settings)
    if(!settings.apiKey){
        const apiKey=await rl.question("Please enter your API key: ")
        await saveApiKey(apiKey);
    }

    const response=await getApiKey();
    if(response.error){
        console.error(response.error);
        const apiKey=await rl.question("Please enter your API key: ")
        await saveApiKey(apiKey);
        return main()
    }

    const apiKey=await response.apiKey
    console.log("API key set successfully")

    await initGraph()
    rl.close()
}

export default main