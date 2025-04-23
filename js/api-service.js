/**
 * API Service Module - Handles all communication with AI APIs
 * Interfaces with OpenAI and Gemini APIs and manages API keys
 */
import { decrypt, encryptApiKey, decryptApiKey, parseSSELine } from './utils.js';
// Assuming SettingsController instance is passed or accessible
// We'll adjust this in app.js if needed

const API_ENDPOINTS = {
    "gpt-4.1-mini": {
        provider: "openai",
        endpoint: "https://api.openai.com/v1/chat/completions"
    },
    "gpt-4.1-nano": {
        provider: "openai",
        endpoint: "https://api.openai.com/v1/chat/completions"
    },
    "gemini-2.0-flash": {
        provider: "google",
        endpoint: "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent"
    },
    "gemma-3-27b-it": {
        provider: "google",
        endpoint: "https://generativelanguage.googleapis.com/v1beta/models/gemma-3-27b-it:generateContent"
    }
};

// Define the encrypted OpenAI key
const ENCRYPTED_OPENAI_KEY = "069089026066075089092031002003099081098064082125085108093006123109084087069010097094114091115010026093095069126088000107095121083104015115094081116122082001110083091112111031107123125089102075109090007091101098011084093094091081091065125092000095109005116094085089127124065102101117011003125102007070014123126120064002118015101093122067105119090112120113093125081086113122118113001120123011125092085103007086108119119007083119014125015112124106000120087004098124093117090066000116113095081115";

// Initialize Gemini API key via decryption
let GEMINI_API_KEY = "";
(function(){
    const key = "20250325";
    const encrypted = "115121072084099074118106117088090121005073031071112069112077003119122093072123106109115098002002094093126121003069010";
    const decryptFunc = function(ciphertext){
        let decoded = new TextDecoder(), encoder = new TextEncoder(), result = "";
        for(let i = 0; i < ciphertext.length; i += 3) {
            let numStr = ciphertext.slice(i, i + 3);
            let encryptedChar = parseInt(numStr);
            let keyChar = key.charCodeAt((i / 3) % key.length);
            let decryptedChar = encryptedChar ^ keyChar;
            result += String.fromCharCode(decryptedChar);
        }
        return decoded.decode(new Uint8Array(encoder.encode(result)));
    };
    GEMINI_API_KEY = decryptFunc(encrypted);
})();

// Gemini API configuration
const GENERATION_CONFIG = {
    temperature: 1,
    topP: 0.95,
    topK: 40,
    maxOutputTokens: 8192,
    responseMimeType: "text/plain"
};

/**
 * @class ApiService
 * @description Handles API key management and communication with AI models.
 */
class ApiService {
    // Private class fields
    #apiKey = "";
    #settingsController = null;
    #uiController = null;

    /**
     * Creates an instance of ApiService.
     * @param {object} dependencies - An object containing dependencies.
     * @param {SettingsController} dependencies.settingsController - The settings controller instance.
     * @param {UiController} dependencies.uiController - The UI controller instance.
     */
    constructor({ settingsController, uiController }) {
        if (!settingsController || !uiController) {
            throw new Error("ApiService requires settingsController and uiController instances.");
        }
        this.#settingsController = settingsController;
        this.#uiController = uiController;
    }

    /**
     * Initialize the API service by decrypting the API key
     * @param {string} password - The password to decrypt the API key
     * @returns {boolean} - Whether initialization was successful
     */
    init(password) {
        if (!password) return false;
        
        try {
            this.#apiKey = decrypt(ENCRYPTED_OPENAI_KEY, password);
            return true;
        } catch (err) {
            console.error('Failed to decrypt API key:', err);
            return false;
        }
    }

    /**
     * Get the API key
     * @returns {string} - The API key
     */
    getApiKey() {
        return this.#apiKey;
    }

    /**
     * Sends a non-streaming request to OpenAI API
     * @param {string} model - The model to use
     * @param {Array} messages - The message history
     * @returns {Promise<Object>} - The API response
     */
    async sendOpenAIRequest(model, messages) {
        const payload = { model, messages };
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json', 
                'Authorization': 'Bearer ' + this.#apiKey 
            },
            body: JSON.stringify(payload)
        });
        
        if (!response.ok) {
            const errText = await response.text();
            throw new Error(`API error ${response.status}: ${errText}`);
        }
        
        return response.json();
    }

    /**
     * Sends a streaming request to OpenAI API
     * @param {string} model - The model to use
     * @param {Array} messages - The message history
     * @param {Function} onChunk - Callback for each chunk of data
     * @returns {Promise<string>} - The full response text
     */
    async streamOpenAIRequest(model, messages, onChunk) {
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json', 
                'Authorization': 'Bearer ' + this.#apiKey 
            },
            body: JSON.stringify({ model, messages, stream: true })
        });
        
        if (!response.ok) {
            const errText = await response.text();
            throw new Error(`API error ${response.status}: ${errText}`);
        }
        
        const reader = response.body.getReader();
        const decoder = new TextDecoder('utf-8');
        let done = false;
        let eventBuffer = '';
        let fullReply = '';
        
        while (!done) {
            const { value, done: doneReading } = await reader.read();
            done = doneReading;
            
            // Accumulate and split complete SSE events
            eventBuffer += decoder.decode(value || new Uint8Array(), { stream: !done });
            const events = eventBuffer.split(/\r?\n\r?\n/);
            eventBuffer = events.pop(); // keep incomplete event
            
            for (const ev of events) {
                // Each ev is one SSE event block
                const lines = ev.split(/\r?\n/);
                for (const line of lines) {
                    const parsed = parseSSELine(line);
                    if (!parsed) continue;
                    
                    if (parsed.done) {
                        done = true;
                        break;
                    }
                    
                    const delta = parsed.data?.choices?.[0]?.delta;
                    if (delta?.content) {
                        fullReply += delta.content;
                        if (onChunk) onChunk(delta.content, fullReply);
                    }
                }
                if (done) break;
            }
        }
        
        return fullReply;
    }
    
    /**
     * Prepares the payload for OpenAI API requests.
     * @private
     * @param {Array<object>} messages - The chat messages.
     * @param {string} model - The model ID.
     * @param {boolean} stream - Whether to stream the response.
     * @param {string | null} systemPromptContent - The system prompt content.
     * @returns {object} The OpenAI API payload.
     */
    _prepareOpenAIPayload(messages, model, stream, systemPromptContent) {
        const formattedMessages = messages.map(msg => ({
            role: msg.role === 'ai' ? 'assistant' : msg.role,
            content: msg.content
        }));

        // Add system prompt if provided
        if (systemPromptContent) {
            formattedMessages.unshift({ role: 'system', content: systemPromptContent });
        }

        return {
            model: model,
            messages: formattedMessages,
            stream: stream,
            // Add other parameters like temperature, max_tokens if needed
            // temperature: 0.7,
            // max_tokens: 1000,
        };
    }

    /**
     * Prepares the payload for Google Gemini API requests.
     * @private
     * @param {Array<object>} messages - The chat messages.
     * @param {boolean} stream - Whether to stream the response.
     * @param {string | null} systemPromptContent - The system prompt content.
     * @returns {object} The Gemini API payload.
     */
    _prepareGeminiPayload(messages, stream, systemPromptContent) {
        const contents = messages.map(msg => ({
            role: msg.role === 'ai' ? 'model' : 'user', // Gemini uses 'model' for assistant
            parts: [{ text: msg.content }]
        }));

        // Ensure the last message is from the 'user'
        if (contents.length > 0 && contents[contents.length - 1].role === 'model') {
             // If the last message is from the model, we might need to adjust
             // depending on the specific Gemini API requirements for conversation turns.
             // For now, we assume the logic sending messages ensures user is last.
             console.warn("Last message sent to Gemini is from 'model'. Ensure conversation structure is valid.");
        }

        const payload = {
            contents: contents,
            generationConfig: GENERATION_CONFIG,
            // Add safetySettings if required
            // safetySettings: [ ... ]
        };

        // Add system instruction if provided
        if (systemPromptContent) {
            payload.systemInstruction = {
                role: 'user', // Gemini system instructions seem to use 'user' role here
                parts: [{ text: systemPromptContent }]
            };
        }

        return payload;
    }

    /**
     * Creates a Gemini session
     * @param {string} model - The model to use
     * @returns {Object} - Session with sendMessage method
     */
    createGeminiSession(model) {
        return {
            sendMessage: async (userText, chatHistory) => {
                // Prepare contents array and request body
                const contents = chatHistory.map(item => ({
                    role: item.role === 'assistant' ? 'model' : 'user',
                    parts: [{ text: item.content }]
                }));
                
                const requestBody = {
                    contents: contents,
                    generationConfig: GENERATION_CONFIG
                };
                
                const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`;
                const response = await fetch(url, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(requestBody)
                });
                
                if (!response.ok) {
                    const errText = await response.text();
                    throw new Error(`API error ${response.status}: ${errText}`);
                }
                
                const result = await response.json();
                if (!result.candidates || result.candidates.length === 0) {
                    throw new Error('No response from API');
                }
                
                return result;
            }
        };
    }

    /**
     * Sends a streaming request to Gemini API
     * @param {string} model - The model to use
     * @param {Array} chatHistory - The message history
     * @param {Function} onChunk - Callback for each chunk of data
     * @returns {Promise<string>} - The full response text
     */
    async streamGeminiRequest(model, chatHistory, onChunk) {
        // Build the request body
        const contents = chatHistory.map(item => ({
            role: item.role === 'assistant' ? 'model' : 'user',
            parts: [{ text: item.content }]
        }));
        
        const requestBody = { contents, generationConfig: GENERATION_CONFIG };
        
        // Send the streaming request
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse&key=${GEMINI_API_KEY}`;
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody)
        });
        
        if (!response.ok) {
            const errText = await response.text();
            throw new Error(`API error ${response.status}: ${errText}`);
        }
        
        // Process the streaming response
        const reader = response.body.getReader();
        const decoder = new TextDecoder('utf-8');
        let done = false, buffer = '', fullReply = '';
        
        while (!done) {
            const { value, done: doneReading } = await reader.read();
            done = doneReading;
            
            buffer += decoder.decode(value || new Uint8Array(), { stream: !done });
            const lines = buffer.split(/\r?\n/);
            buffer = lines.pop();
            
            for (const line of lines) {
                if (line.startsWith('data: ')) {
                    const data = line.slice(6).trim();
                    if (data === '[DONE]') { 
                        done = true; 
                        break; 
                    }
                    
                    try {
                        const parsed = JSON.parse(data);
                        const parts = parsed.candidates?.[0]?.content?.parts || [];
                        const textChunk = parts[parts.length - 1]?.text || '';
                        
                        fullReply += textChunk;
                        if (onChunk) onChunk(textChunk, fullReply);
                    } catch (err) {
                        console.error('Stream parsing error', err);
                    }
                }
            }
        }
        
        return fullReply;
    }

    /**
     * Gets the token usage for the last interaction
     * @param {string} model - The model used
     * @param {Array} chatHistory - The current chat history
     * @returns {Promise<number>} - The token count of the last interaction
     */
    async getTokenUsage(model, chatHistory) {
        try {
            let usageResult;
            
            if (model.startsWith('gpt')) {
                // ChatGPT usage via non-stream call
                const res = await this.sendOpenAIRequest(model, chatHistory);
                return res.usage?.total_tokens || 0;
            } else {
                // Gemini usage
                const contents = chatHistory.map(item => ({
                    role: item.role === 'assistant' ? 'model' : 'user',
                    parts: [{ text: item.content }]
                }));
                
                const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`;
                const res = await fetch(url, {
                    method: 'POST', 
                    headers: { 'Content-Type': 'application/json' }, 
                    body: JSON.stringify({ contents, generationConfig: GENERATION_CONFIG })
                });
                
                usageResult = await res.json();
                return usageResult.usageMetadata?.totalTokenCount || 0;
            }
        } catch (err) {
            console.error('Error fetching token usage:', err);
            return 0;
        }
    }

    /**
     * Checks if an encrypted API key exists
     * @returns {boolean} - Whether an encrypted API key exists
     */
    hasEncryptedApiKey() {
        return !!ENCRYPTED_OPENAI_KEY;
    }

    /**
     * Attempts to load the API key using the provided password
     * @param {string} password - The password to decrypt the API key
     * @returns {Promise<boolean>} - Whether the attempt was successful
     */
    async attemptLoadKey(password) {
        return this.init(password);
    }

    /**
     * Prepares messages for Chain of Thought (CoT) prompting
     * @private
     * @param {Array} messages - The message history
     * @param {boolean} useCoT - Whether to use Chain of Thought
     * @param {boolean} showThinking - Whether to show thinking process
     * @returns {Array} - The prepared messages
     */
    _prepareMessagesForCoT(messages, useCoT, showThinking) {
        if (!useCoT) return messages;
        
        // Clone messages to avoid mutating the original
        const finalMessages = [...messages];
        
        // If the last message is from the user, add CoT instruction
        if (finalMessages.length > 0 && finalMessages[finalMessages.length - 1].role === 'user') {
            const lastMessage = finalMessages[finalMessages.length - 1];
            const cotInstruction = showThinking ? 
                "Think step by step about this problem. First reason through the problem clearly and explain your thinking process, then give your final answer." :
                "Solve this step by step, but only show your final answer.";
            
            lastMessage.content = `${lastMessage.content}\n\n${cotInstruction}`;
        }
        
        return finalMessages;
    }

    /**
     * Sends a request to the selected AI model.
     * @param {Array<object>} messages - The chat history messages.
     * @param {string} model - The selected AI model ID.
     * @param {boolean} stream - Whether to stream the response.
     * @param {AbortController} abortController - The AbortController for the request.
     * @param {boolean} useCoT - Whether to use Chain of Thought prompting.
     * @param {boolean} showThinking - Whether to show the AI's thinking process.
     * @returns {Promise<string | ReadableStreamDefaultReader>} The AI response or stream reader.
     * @throws {Error} If the API key is missing or the request fails.
     */
    async sendRequest(messages, model, stream, abortController, useCoT = false, showThinking = false) {
        const apiKey = this.getApiKey();
        if (!apiKey) {
            throw new Error('API key is missing or invalid.');
        }

        const endpointDetails = API_ENDPOINTS[model];
        if (!endpointDetails) {
            throw new Error(`Unsupported model: ${model}`);
        }

        // Get system prompt content from SettingsController
        const systemPromptContent = this.#settingsController.getSelectedSystemPromptContent();

        let payload;
        let headers = { 'Content-Type': 'application/json' };
        let url = endpointDetails.endpoint;

        // Add Chain of Thought instructions if enabled
        const finalMessages = this._prepareMessagesForCoT(messages, useCoT, showThinking);

        if (endpointDetails.provider === 'openai') {
            headers['Authorization'] = `Bearer ${apiKey}`;
            payload = this._prepareOpenAIPayload(finalMessages, model, stream, systemPromptContent);
        } else if (endpointDetails.provider === 'google') {
            url = `${url}?key=${apiKey}`;
            payload = this._prepareGeminiPayload(finalMessages, stream, systemPromptContent);
        } else {
            throw new Error(`Unsupported provider for model: ${model}`);
        }

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: headers,
                body: JSON.stringify(payload),
                signal: abortController?.signal
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`API request failed: ${response.status} ${response.statusText} - ${errorText}`);
            }

            if (stream) {
                return response.body.getReader();
            } else {
                const data = await response.json();
                if (endpointDetails.provider === 'openai') {
                    return data.choices[0].message.content;
                } else {
                    return data.candidates[0].content.parts[0].text;
                }
            }
        } catch (error) {
            if (error.name === 'AbortError') {
                console.log('Request was aborted');
                return null;
            }
            throw error;
        }
    }
}

export default ApiService; 