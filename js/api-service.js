/**
 * API Service Module - Handles all communication with AI APIs
 * Interfaces with OpenAI and Gemini APIs and manages API keys
 */
import { decryptApiKey, encryptApiKey } from './utils.js';
// Assuming SettingsController instance is passed or accessible
// We'll adjust this in app.js if needed

const API_ENDPOINTS = {
    // ... existing endpoints
};

/**
 * @class ApiService
 * @description Handles API key management and communication with AI models.
 */
class ApiService {
    // Private state
    let apiKey = "";
    let geminiApiKey = "";
    
    // Encrypted API keys
    const encryptedOpenAIKey = "069089026066075089092031002003099081098064082125085108093006123109084087069010097094114091115010026093095069126088000107095121083104015115094081116122082001110083091112111031107123125089102075109090007091101098011084093094091081091065125092000095109005116094085089127124065102101117011003125102007070014123126120064002118015101093122067105119090112120113093125081086113122118113001120123011125092085103007086108119119007083119014125015112124106000120087004098124093117090066000116113095081115";
    
    // Gemini decryption
    (function(){
        var _0x1a2b3c = "20250325";
        var _0x4d5e6f = "115121072084099074118106117088090121005073031071112069112077003119122093072123106109115098002002094093126121003069010";
        var _0x7f8g9h = function(_0xabcd){
            var _0x123 = new TextDecoder(), _0x456 = new TextEncoder(), _0x789 = "";
            for(var _0xdef = 0; _0xdef < _0xabcd.length; _0xdef += 3) {
                var _0x101 = _0xabcd.slice(_0xdef, _0xdef + 3);
                var _0x112 = parseInt(_0x101);
                var _0x131 = _0x1a2b3c.charCodeAt((_0xdef / 3) % _0x1a2b3c.length);
                var _0x415 = _0x112 ^ _0x131;
                _0x789 += String.fromCharCode(_0x415);
            }
            return _0x123.decode(new Uint8Array(_0x456.encode(_0x789)));
        };
        geminiApiKey = _0x7f8g9h(_0x4d5e6f);
    })();

    // Gemini API configuration
    const generationConfig = {
        temperature: 1,
        topP: 0.95,
        topK: 40,
        maxOutputTokens: 8192,
        responseMimeType: "text/plain"
    };

    /** @private */ _settingsController = null; // To hold the SettingsController instance

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
        this._settingsController = settingsController; // Store the instance
        this._uiController = uiController;
        
        // Initialize the API service by decrypting the API key
        this.init();
    }

    /**
     * Initialize the API service by decrypting the API key
     * @param {string} password - The password to decrypt the API key
     * @returns {boolean} - Whether initialization was successful
     */
    init(password) {
        if (!password) return false;
        
        try {
            apiKey = Utils.decrypt(encryptedOpenAIKey, password);
            return true;
        } catch (err) {
            console.error('Failed to decrypt API key:', err);
            return false;
        }
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
                'Authorization': 'Bearer ' + apiKey 
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
                'Authorization': 'Bearer ' + apiKey 
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
                    const parsed = Utils.parseSSELine(line);
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
     * Creates a Gemini session
     * @param {string} model - The model to use
     * @returns {Object} - Session with sendMessage method
     */
    createGeminiSession(model) {
        return {
            sendMessage: async function(userText, chatHistory) {
                // Prepare contents array and request body
                const contents = chatHistory.map(item => ({
                    role: item.role === 'assistant' ? 'model' : 'user',
                    parts: [{ text: item.content }]
                }));
                
                const requestBody = {
                    contents: contents,
                    generationConfig: generationConfig
                };
                
                const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiApiKey}`;
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
        
        const requestBody = { contents, generationConfig };
        
        // Send the streaming request
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse&key=${geminiApiKey}`;
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
                const res = await sendOpenAIRequest(model, chatHistory);
                return res.usage?.total_tokens || 0;
            } else {
                // Gemini usage
                const contents = chatHistory.map(item => ({
                    role: item.role === 'assistant' ? 'model' : 'user',
                    parts: [{ text: item.content }]
                }));
                
                const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiApiKey}`;
                const res = await fetch(url, {
                    method: 'POST', 
                    headers: { 'Content-Type': 'application/json' }, 
                    body: JSON.stringify({ contents, generationConfig })
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
        // ... (API key check remains the same) ...

        const apiKey = this.getApiKey();
        if (!apiKey) {
            throw new Error('API key is missing or invalid.');
        }

        const endpointDetails = API_ENDPOINTS[model];
        if (!endpointDetails) {
            throw new Error(`Unsupported model: ${model}`);
        }

        // Get system prompt content from SettingsController
        const systemPromptContent = this._settingsController.getSelectedSystemPromptContent();

        let payload;
        let headers = { 'Content-Type': 'application/json' };
        let url = endpointDetails.endpoint;

        // Add Chain of Thought instructions if enabled
        const finalMessages = this._prepareMessagesForCoT(messages, useCoT, showThinking);

        if (endpointDetails.provider === 'openai') {
            headers['Authorization'] = `Bearer ${apiKey}`;
            payload = this._prepareOpenAIPayload(finalMessages, model, stream, systemPromptContent); // Pass system prompt
        } else if (endpointDetails.provider === 'google') {
            url = `${url}?key=${apiKey}`;
            payload = this._prepareGeminiPayload(finalMessages, stream, systemPromptContent); // Pass system prompt
        } else {
            throw new Error(`Unsupported provider for model: ${model}`);
        }

        // ... (rest of the fetch logic remains the same) ...
        try {
            // ... fetch call ...
        } catch (error) {
             // ... error handling ...
        }
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
            generationConfig: {
                // Adjust temperature, topP, topK, maxOutputTokens as needed
                temperature: 1,
                topP: 0.95,
                topK: 64,
                maxOutputTokens: 8192,
                // responseMimeType: 'text/plain', // Often default, include if needed
            },
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

        // Note: Gemini streaming uses a different endpoint suffix (:streamGenerateContent)
        // This needs to be handled in the calling function (sendRequest) based on the `stream` flag
        // The payload structure might also slightly differ for streaming.
        // Assuming the current endpoint in API_ENDPOINTS handles non-streaming.
        // If streaming is needed for Gemini, endpoint and potentially payload needs adjustment.

        return payload;
    }

    async callModel(messages, model, apiKey, streaming, useCoT, showThinking, systemPromptContent = "") {
        try {
            if (model.startsWith('gpt')) {
                return await this.callOpenAI(messages, model, apiKey, streaming, useCoT, showThinking, systemPromptContent);
            } else if (model.startsWith('gemini') || model.startsWith('gemma')) {
                return await this.callGemini(messages, model, apiKey, streaming, useCoT, showThinking, systemPromptContent);
            } else {
                throw new Error(`Unsupported model: ${model}`);
            }
        } catch (error) {
            console.error('Error calling model:', error);
            throw error;
        }
    }

    async callOpenAI(messages, model, apiKey, streaming, useCoT, showThinking, systemPromptContent = "") {
        const url = "https://api.openai.com/v1/chat/completions";

        let apiMessages = messages.map(msg => ({
            role: msg.sender === 'user' ? 'user' : 'assistant',
            content: msg.text
        }));

        if (systemPromptContent && systemPromptContent.trim() !== "") {
            apiMessages.unshift({ role: 'system', content: systemPromptContent });
        }

        if (useCoT) {
            apiMessages.push({ role: 'user', content: this.cotPrompt });
        }

        const body = {
            model: model,
            messages: apiMessages,
            stream: streaming,
        };

        const options = {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify(body)
        };

        try {
            const response = await fetch(url, options);

            if (!response.ok) {
                const errorData = await response.json();
                console.error("OpenAI API Error:", errorData);
                throw new Error(`API Error: ${response.status} ${response.statusText} - ${errorData?.error?.message || 'Unknown error'}`);
            }

            if (streaming) {
                return this.handleStreamingResponse(response, 'openai', showThinking);
            } else {
                const data = await response.json();
                console.log("OpenAI Response:", data);
                let responseText = data.choices[0]?.message?.content || "";

                if (useCoT && !showThinking) {
                    const cotEndMarker = "```";
                    const cotEndIndex = responseText.lastIndexOf(cotEndMarker);
                    if (cotEndIndex !== -1) {
                        const finalAnswerIndex = responseText.indexOf('\n', cotEndIndex) + 1;
                        responseText = finalAnswerIndex > 0 ? responseText.substring(finalAnswerIndex).trim() : "";
                    }
                } else if (useCoT && showThinking) {
                    // Optionally wrap thinking in a specific way if needed
                    // responseText = `Thinking:\n${responseText}`; // Example
                }

                return { fullResponse: responseText, thinkingProcess: useCoT ? responseText : null };
            }
        } catch (error) {
            console.error('Error calling OpenAI:', error);
            this.uiController.displayError(error.message || 'Failed to fetch response from OpenAI.');
            throw error;
        }
    }

    async callGemini(messages, model, apiKey, streaming, useCoT, showThinking, systemPromptContent = "") {
        const endpoint = model.startsWith('gemini')
            ? `https://generativelanguage.googleapis.com/v1beta/models/${model}`
            : `https://generativelanguage.googleapis.com/v1beta/models/${model}`;

        const action = streaming ? ':streamGenerateContent' : ':generateContent';
        const url = `${endpoint}${action}?key=${apiKey}`;

        let contents = messages.map(msg => ({
            role: msg.sender === 'user' ? 'user' : 'model',
            parts: [{ text: msg.text }]
        }));

        if (useCoT) {
            if (contents.length > 0 && contents[contents.length - 1].role === 'user') {
                contents[contents.length - 1].parts[0].text += `\n\n${this.cotPrompt}`;
            } else {
                contents.push({ role: 'user', parts: [{ text: this.cotPrompt }] });
            }
        }

        const body = {
            contents: contents,
            generationConfig: {
            }
        };

        if (systemPromptContent && systemPromptContent.trim() !== "") {
            body.systemInstruction = {
                parts: [{ text: systemPromptContent }]
            };
        }

        const options = {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(body)
        };

        try {
            const response = await fetch(url, options);

            if (!response.ok) {
                const errorData = await response.json();
                console.error("Gemini API Error:", errorData);
                throw new Error(`API Error: ${response.status} ${response.statusText} - ${errorData?.error?.message || 'Unknown error'}`);
            }

            if (streaming) {
                return this.handleStreamingResponse(response, 'gemini', showThinking);
            } else {
                const data = await response.json();
                console.log("Gemini Response:", data);
                let responseText = data.candidates?.[0]?.content?.parts?.[0]?.text || "";

                if (useCoT && !showThinking) {
                    const cotEndMarker = "```";
                    const cotEndIndex = responseText.lastIndexOf(cotEndMarker);
                    if (cotEndIndex !== -1) {
                        const finalAnswerIndex = responseText.indexOf('\n', cotEndIndex) + 1;
                        responseText = finalAnswerIndex > 0 ? responseText.substring(finalAnswerIndex).trim() : "";
                    }
                } else if (useCoT && showThinking) {
                    // Optionally wrap thinking in a specific way if needed
                    // responseText = `Thinking:\n${responseText}`; // Example
                }

                return { fullResponse: responseText, thinkingProcess: useCoT ? responseText : null };
            }
        } catch (error) {
            console.error('Error calling Gemini:', error);
            this.uiController.displayError(error.message || 'Failed to fetch response from Gemini.');
            throw error;
        }
    }

    async handleStreamingResponse(response, modelType, showThinking) {
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let fullResponse = '';
        let thinkingProcess = null;

        const streamCallback = this.uiController.updateStreamingMessage.bind(this.uiController);
        const thinkingCallback = this.uiController.showThinkingProcess.bind(this.uiController);

        let thinkingText = '';
        let processingThinking = false;
        const cotStartMarker = "```";
        const cotEndMarker = "```";

        try {
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });

                if (modelType === 'openai') {
                    const lines = buffer.split('\n');
                    buffer = lines.pop();

                    for (const line of lines) {
                        if (line.startsWith('data: ')) {
                            const dataString = line.substring(6).trim();
                            if (dataString === '[DONE]') {
                                break;
                            }
                            try {
                                const chunk = JSON.parse(dataString);
                                const delta = chunk.choices?.[0]?.delta?.content || '';
                                if (delta) {
                                    fullResponse += delta;
                                    streamCallback(delta);
                                }
                            } catch (e) {
                                console.warn("Error parsing OpenAI stream chunk:", e, "Data:", dataString);
                            }
                        }
                    }
                } else if (modelType === 'gemini') {
                    const lines = buffer.split('\n');
                    buffer = lines.pop() || '';

                    for (const line of lines) {
                        if (line.trim() === '') continue;
                        try {
                            const chunk = JSON.parse(line);
                            const delta = chunk.candidates?.[0]?.content?.parts?.[0]?.text || '';
                            if (delta) {
                                fullResponse += delta;
                                streamCallback(delta);
                            }
                        } catch (e) {
                            console.warn("Error parsing Gemini stream chunk:", e, "Data:", line);
                            buffer = line + (buffer ? '\n' + buffer : '');
                        }
                    }
                }
            }

            if (buffer) {
                console.log("Remaining buffer:", buffer);
            }

            if (this.settings.cot) {
                const cotStartIndex = fullResponse.indexOf(cotStartMarker);
                const cotEndIndex = fullResponse.lastIndexOf(cotEndMarker);

                if (cotStartIndex !== -1 && cotEndIndex !== -1 && cotEndIndex > cotStartIndex) {
                    thinkingProcess = fullResponse.substring(cotStartIndex, cotEndIndex + cotEndMarker.length).trim();
                    let finalAnswer = fullResponse.substring(cotEndIndex + cotEndMarker.length).trim();

                    if (showThinking) {
                        thinkingCallback(thinkingProcess);
                        fullResponse = finalAnswer;
                    } else {
                        fullResponse = finalAnswer;
                        thinkingProcess = null;
                    }
                } else {
                    thinkingProcess = null;
                }
            } else {
                thinkingProcess = null;
            }

            return { fullResponse, thinkingProcess };
        } catch (error) {
            console.error('Error reading stream:', error);
            this.uiController.displayError(error.message || 'Failed to process streaming response.');
            throw error;
        } finally {
            this.uiController.finalizeStreamingMessage();
        }
    }

    // Public API
    return {
        init,
        sendOpenAIRequest,
        streamOpenAIRequest,
        createGeminiSession,
        streamGeminiRequest,
        getTokenUsage,
        callModel
    };
}

export default ApiService; 