import path from "path";
import fs from "fs/promises";
import { HOME_DIR, CONFIG_DIR } from "./constant.js";
import axios from "axios";

/**
 * Return the content of settings.json file (create if it doesnt exist)
 */

export const getSettingsFile = async () => {
  //Ensures config dir exists
  try {
    await fs.access(CONFIG_DIR);
  } catch (error) {
    await fs.mkdir(CONFIG_DIR, { recursive: true });
  }

  const settingsFilePath = path.join(CONFIG_DIR, "settings.json");

  try {
    await fs.access(settingsFilePath);
    const content = await fs.readFile(settingsFilePath, "utf-8");
    return JSON.parse(content);
  } catch (error) {
    await fs.writeFile(settingsFilePath, JSON.stringify({}));
    return {};
  }
};

/**
 * save api key to setting file
 */
export const saveApiKey=async(apiKey)=>{
    const settingsFilePath=path.join(CONFIG_DIR,"settings.json")
    const settingsContent=await getSettingsFile();

    await fs.writeFile(settingsFilePath,JSON.stringify({...settingsContent,apiKey}))

}


/**
 * 
 * @returns get API from the settings file
 */
export const getApiKey=async()=>{
    const settings=await getSettingsFile()
    const apiKey= settings.apiKey || null
    if(!apiKey){
        return {
            error:"API key not found in settings file"
        }
    }

    try {
        
        const respone =await axios.get("https://api.groq.com/openai/v1/models",{
            headers:{
                "Authorization": `Bearer ${apiKey}`
            }
        })
        return {
            apiKey
        }
    } catch (error) {
        return {
            error:"Invalid or expired API key"
        }
    }
}
