/**
 * Chat Controller Module - Manages chat history and message handling
 * Coordinates between UI and API service for sending/receiving messages
 */
import { updateTokenDisplay } from './utils.js';

/**
 * @class ChatController
 * @description Manages chat interactions between the UI and API service
 */
class ChatController {
    constructor(apiService, uiController, settingsController) {
        // Store dependencies
        this.apiService = apiService;
        this.uiController = uiController;
        this.settingsController = settingsController;

        // Private state
        this.chatHistory = [];
        this.totalTokens = 0;
        this.settings = { streaming: false, enableCoT: false, showThinking: true };
        this.isThinking = false;
        this.lastThinkingContent = '';
        this.lastAnswerContent = '';
        this.currentAbortController = null;
    }

    /**
     * Chain of Thought preamble for enhancing prompts
     */
    get cotPreamble() {
        return `**Chain of Thought Instructions:**
1.  **Understand:** Briefly rephrase the core problem or question.
2.  **Deconstruct:** Break the problem down into smaller, logical steps needed to reach the solution.
3.  **Execute & Explain:** Work through each step sequentially. Show your reasoning, calculations, or data analysis for each step clearly.
4.  **Synthesize:** Combine the findings from the previous steps to formulate the final conclusion.
5.  **Final Answer:** State the final answer clearly and concisely, prefixed exactly with "\\nFinal Answer:".

Begin Reasoning Now:
`;
    }

    /**
     * Initializes the chat controller
     * @param {Object} initialSettings - Initial settings for the chat
     */
    init(initialSettings) {
        if (initialSettings) {
            this.settings = { ...this.settings, ...initialSettings };
        }
        
        // Set up event handlers through UI controller
        this.uiController.setupEventHandlers(
            this.sendMessage.bind(this), 
            this.clearChat.bind(this)
        );
    }

    /**
     * Updates the settings
     * @param {Object} newSettings - The new settings
     */
    updateSettings(newSettings) {
        this.settings = { ...this.settings, ...newSettings };
        console.log('Chat settings updated:', this.settings);
    }

    /**
     * Clears the chat history and resets token count
     */
    clearChat() {
        this.chatHistory = [];
        this.totalTokens = 0;
        updateTokenDisplay(0);
        this.uiController.clearChatWindow();
    }

    /**
     * Gets the current settings
     * @returns {Object} - The current settings
     */
    getSettings() {
        return { ...this.settings };
    }

    /**
     * Generates Chain of Thought prompting instructions
     * @param {string} message - The user message
     * @returns {string} - The CoT enhanced message
     */
    enhanceWithCoT(message) {
        return `${message}\n\nI'd like you to use Chain of Thought reasoning. Please think step-by-step before providing your final answer. Format your response like this:
Thinking: [detailed reasoning process, exploring different angles and considerations]
Answer: [your final, concise answer based on the reasoning above]`;
    }

    /**
     * Processes the AI response to extract thinking and answer parts
     * @param {string} response - The raw AI response
     * @returns {Object} - Object with thinking and answer components
     */
    processCoTResponse(response) {
        console.log("processCoTResponse received:", response);
        // Check if response follows the Thinking/Answer format
        const thinkingMatch = response.match(/Thinking:(.*?)(?=Answer:|$)/s);
        const answerMatch = response.match(/Answer:(.*?)$/s);
        console.log("processCoTResponse: thinkingMatch", thinkingMatch, "answerMatch", answerMatch);
        
        if (thinkingMatch && answerMatch) {
            const thinking = thinkingMatch[1].trim();
            const answer = answerMatch[1].trim();
            
            // Update the last known content
            this.lastThinkingContent = thinking;
            this.lastAnswerContent = answer;
            
            return {
                thinking: thinking,
                answer: answer,
                hasStructuredResponse: true
            };
        } else if (response.startsWith('Thinking:') && !response.includes('Answer:')) {
            // Partial thinking (no answer yet)
            const thinking = response.replace(/^Thinking:/, '').trim();
            this.lastThinkingContent = thinking;
            
            return {
                thinking: thinking,
                answer: this.lastAnswerContent,
                hasStructuredResponse: true,
                partial: true,
                stage: 'thinking'
            };
        } else if (response.includes('Thinking:') && !thinkingMatch) {
            // Malformed response (partial reasoning)
            const thinking = response.replace(/^.*?Thinking:/s, 'Thinking:');
            
            return {
                thinking: thinking.replace(/^Thinking:/, '').trim(),
                answer: '',
                hasStructuredResponse: false,
                partial: true
            };
        }
        
        // If not properly formatted, return the whole response as the answer
        return {
            thinking: '',
            answer: response,
            hasStructuredResponse: false
        };
    }
    
    /**
     * Extract and update partial CoT response during streaming
     * @param {string} fullText - The current streamed text
     * @returns {Object} - The processed response object
     */
    processPartialCoTResponse(fullText) {
        console.log("processPartialCoTResponse received:", fullText);
        if (fullText.includes('Thinking:') && !fullText.includes('Answer:')) {
            // Only thinking so far
            const thinking = fullText.replace(/^.*?Thinking:/s, '').trim();
            
            return {
                thinking: thinking,
                answer: '',
                hasStructuredResponse: true,
                partial: true,
                stage: 'thinking'
            };
        } else if (fullText.includes('Thinking:') && fullText.includes('Answer:')) {
            // Both thinking and answer are present
            const thinkingMatch = fullText.match(/Thinking:(.*?)(?=Answer:|$)/s);
            const answerMatch = fullText.match(/Answer:(.*?)$/s);
            
            if (thinkingMatch && answerMatch) {
                return {
                    thinking: thinkingMatch[1].trim(),
                    answer: answerMatch[1].trim(),
                    hasStructuredResponse: true,
                    partial: false
                };
            }
        }
        
        // Default case - treat as normal text
        return {
            thinking: '',
            answer: fullText,
            hasStructuredResponse: false
        };
    }

    /**
     * Formats the response for display based on settings
     * @param {Object} processed - The processed response with thinking and answer
     * @returns {string} - The formatted response for display
     */
    formatResponseForDisplay(processed) {
        if (!this.settings.enableCoT || !processed.hasStructuredResponse) {
            return processed.answer;
        }

        // If showThinking is enabled, show both thinking and answer
        if (this.settings.showThinking) {
            if (processed.partial && processed.stage === 'thinking') {
                return `Thinking: ${processed.thinking}`;
            } else if (processed.partial) {
                return processed.thinking; // Just the partial thinking
            } else {
                return `Thinking: ${processed.thinking}\n\nAnswer: ${processed.answer}`;
            }
        } else {
            // Otherwise just show the answer (or thinking indicator if answer isn't ready)
            return processed.answer || '🤔 Thinking...';
        }
    }

    /**
     * Sends a message to the AI and handles the response
     */
    async sendMessage() {
        // Get message from UI
        const userMessage = this.uiController.getUserInput();
        if (!userMessage.trim()) return;
        
        // Clear input
        this.uiController.clearUserInput();
        
        // Add to chat window
        this.uiController.addMessage('user', userMessage);
        
        // Add to chat history
        this.chatHistory.push({ role: 'user', content: userMessage });
        
        // Get model from settings
        const model = this.settingsController.getSettings().selectedModel;
        
        // Handle streaming vs non-streaming based on settings
        this.isThinking = true;
        
        // Create AI message placeholder based on streaming setting
        const aiMessage = this.settings.streaming ? 
                         this.uiController.createEmptyAIMessage() : 
                         this.uiController.addMessage('ai', '🤔 Thinking...');
        
        // Disable input while processing
        this.uiController.setLoading(true);
        
        try {
            if (model.startsWith('gpt')) {
                await this.handleOpenAIMessage(model, aiMessage);
            } else if (model.startsWith('gemini') || model.startsWith('gemma')) {
                await this.handleGeminiMessage(model, aiMessage);
            } else {
                this.uiController.updateMessageContent(aiMessage, "Unsupported model selected.");
            }
        } catch (error) {
            console.error('Error sending message:', error);
            this.uiController.updateMessageContent(aiMessage, `Error: ${error.message}`);
        } finally {
            this.isThinking = false;
            this.uiController.setLoading(false);
            
            // Update token display
            this.uiController.updateTokenCount(this.totalTokens);
        }
    }

    /**
     * Handles sending messages to OpenAI models
     * @param {string} model - The OpenAI model to use
     * @param {Element} aiMessage - The AI message element to update
     */
    async handleOpenAIMessage(model, aiMessage) {
        // Setup abort controller
        this.currentAbortController = new AbortController();
        
        if (this.settings.streaming) {
            // Handle streaming response
            const reader = await this.apiService.sendRequest(
                this.chatHistory, 
                model, 
                true, 
                this.currentAbortController,
                this.settings.enableCoT,
                this.settings.showThinking
            );
            
            const decoder = new TextDecoder();
            let responseText = '';
            
            let done = false;
            while (!done) {
                try {
                    const { value, done: doneReading } = await reader.read();
                    done = doneReading;
                    
                    if (done) break;
                    
                    const chunk = decoder.decode(value, { stream: true });
                    responseText += chunk;
                    
                    // If using Chain of Thought, process for structured output
                    if (this.settings.enableCoT) {
                        const processed = this.processPartialCoTResponse(responseText);
                        const formattedResponse = this.formatResponseForDisplay(processed);
                        this.uiController.updateMessageContent(aiMessage, formattedResponse);
                    } else {
                        this.uiController.updateMessageContent(aiMessage, responseText);
                    }
                } catch (error) {
                    if (error.name === 'AbortError') {
                        console.log('Stream aborted');
                        done = true;
                    } else {
                        throw error;
                    }
                }
            }
            
            // Process the complete response for chat history
            const finalProcessed = this.settings.enableCoT ? 
                                  this.processCoTResponse(responseText) : 
                                  { answer: responseText };
            
            this.chatHistory.push({ role: 'ai', content: finalProcessed.answer });
            
        } else {
            // Handle non-streaming response
            const response = await this.apiService.sendRequest(
                this.chatHistory, 
                model, 
                false, 
                this.currentAbortController,
                this.settings.enableCoT,
                this.settings.showThinking
            );
            
            // Process for Chain of Thought structured output if enabled
            if (this.settings.enableCoT) {
                const processed = this.processCoTResponse(response);
                const formattedResponse = this.formatResponseForDisplay(processed);
                this.uiController.updateMessageContent(aiMessage, formattedResponse);
                this.chatHistory.push({ role: 'ai', content: processed.answer });
            } else {
                this.uiController.updateMessageContent(aiMessage, response);
                this.chatHistory.push({ role: 'ai', content: response });
            }
        }
        
        // Get token usage
        try {
            const tokensUsed = await this.apiService.getTokenUsage(model, this.chatHistory);
            this.totalTokens += tokensUsed;
        } catch (error) {
            console.warn('Unable to get token usage:', error);
        }
    }

    /**
     * Handles sending messages to Gemini/Gemma models
     * @param {string} model - The Gemini model to use
     * @param {Element} aiMessage - The AI message element to update
     */
    async handleGeminiMessage(model, aiMessage) {
        // Setup abort controller
        this.currentAbortController = new AbortController();
        
        if (this.settings.streaming) {
            try {
                const reader = await this.apiService.sendRequest(
                    this.chatHistory, 
                    model, 
                    true, 
                    this.currentAbortController,
                    this.settings.enableCoT,
                    this.settings.showThinking
                );
                
                const decoder = new TextDecoder();
                let responseText = '';
                
                let done = false;
                while (!done) {
                    try {
                        const { value, done: doneReading } = await reader.read();
                        done = doneReading;
                        
                        if (done) break;
                        
                        const chunk = decoder.decode(value, { stream: true });
                        responseText += chunk;
                        
                        // Process response based on settings
                        if (this.settings.enableCoT) {
                            const processed = this.processPartialCoTResponse(responseText);
                            const formattedResponse = this.formatResponseForDisplay(processed);
                            this.uiController.updateMessageContent(aiMessage, formattedResponse);
                        } else {
                            this.uiController.updateMessageContent(aiMessage, responseText);
                        }
                    } catch (error) {
                        if (error.name === 'AbortError') {
                            console.log('Stream aborted');
                            done = true;
                        } else {
                            throw error;
                        }
                    }
                }
                
                // Process the complete response for chat history
                const finalProcessed = this.settings.enableCoT ? 
                                      this.processCoTResponse(responseText) : 
                                      { answer: responseText };
                
                this.chatHistory.push({ role: 'ai', content: finalProcessed.answer });
                
            } catch (error) {
                console.error('Error streaming from Gemini:', error);
                this.uiController.updateMessageContent(aiMessage, `Error: ${error.message}`);
            }
        } else {
            try {
                const response = await this.apiService.sendRequest(
                    this.chatHistory, 
                    model, 
                    false, 
                    this.currentAbortController,
                    this.settings.enableCoT,
                    this.settings.showThinking
                );
                
                // Process response based on settings
                if (this.settings.enableCoT) {
                    const processed = this.processCoTResponse(response);
                    const formattedResponse = this.formatResponseForDisplay(processed);
                    this.uiController.updateMessageContent(aiMessage, formattedResponse);
                    this.chatHistory.push({ role: 'ai', content: processed.answer });
                } else {
                    this.uiController.updateMessageContent(aiMessage, response);
                    this.chatHistory.push({ role: 'ai', content: response });
                }
                
            } catch (error) {
                console.error('Error getting response from Gemini:', error);
                this.uiController.updateMessageContent(aiMessage, `Error: ${error.message}`);
            }
        }
        
        // Get token usage for Gemini
        try {
            const tokensUsed = await this.apiService.getTokenUsage(model, this.chatHistory);
            this.totalTokens += tokensUsed;
        } catch (error) {
            console.warn('Unable to get Gemini token usage:', error);
        }
    }

    /**
     * Handles settings changes that require immediate action
     */
    handleSettingsChange() {
        // Update UI based on new settings if needed
        const currentSettings = this.settingsController.getSettings();
        this.updateSettings(currentSettings);
    }

    /**
     * Gets the current chat history
     * @returns {Array} - The chat history
     */
    getChatHistory() {
        return [...this.chatHistory];
    }

    /**
     * Gets the total tokens used
     * @returns {number} - The total tokens used
     */
    getTotalTokens() {
        return this.totalTokens;
    }
}

export default ChatController; 