/**
 * UI Controller Module - Manages UI elements and interactions
 * Handles chat display, inputs, and visual elements
 */
import { createFromTemplate, getElement } from './utils.js';

/**
 * @class UiController
 * @description Manages UI elements and interactions
 */
class UiController {
    constructor() {
        // Private state
        this.sendMessageCallback = null;
        this.clearChatCallback = null;
    }
    
    /**
     * Initializes the UI controller
     */
    init() {
        // Show the chat container
        const chatContainer = getElement('#chat-container');
        if (chatContainer) chatContainer.style.display = 'flex';
        
        // Add enter key handler for message input
        const messageInput = getElement('#message-input');
        if (messageInput) {
            messageInput.addEventListener('keydown', (event) => {
                if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault();
                    if (this.sendMessageCallback) this.sendMessageCallback();
                }
            });
            
            // Auto-resize textarea as user types
            messageInput.addEventListener('input', function() {
                this.style.height = 'auto';
                this.style.height = Math.min(this.scrollHeight, 200) + 'px';
            });
        }
        
        // Add global event delegation for thinking toggle buttons
        document.addEventListener('click', (event) => {
            if (event.target.classList.contains('toggle-thinking') || 
                event.target.parentElement.classList.contains('toggle-thinking')) {
                const button = event.target.classList.contains('toggle-thinking') ? 
                               event.target : event.target.parentElement;
                const messageElement = button.closest('.chat-app__message');
                
                // Toggle the expanded state
                const isExpanded = button.getAttribute('data-expanded') === 'true';
                button.setAttribute('data-expanded', !isExpanded);
                
                // Toggle visibility of thinking section
                if (messageElement) {
                    messageElement.classList.toggle('thinking-collapsed');
                    button.textContent = isExpanded ? 'Show thinking' : 'Hide thinking';
                }
            }
        });
    }

    /**
     * Sets up event handlers for UI elements
     * @param {Function} onSendMessage - Callback for send button
     * @param {Function} onClearChat - Callback for clear chat button
     */
    setupEventHandlers(onSendMessage, onClearChat) {
        this.sendMessageCallback = onSendMessage;
        this.clearChatCallback = onClearChat;
        
        // Send button click handler
        const sendButton = getElement('#send-button');
        if (sendButton) {
            sendButton.addEventListener('click', onSendMessage);
        }
        
        // Clear chat button click handler
        const clearChatButton = getElement('#clear-chat-button');
        if (clearChatButton) {
            clearChatButton.addEventListener('click', () => {
                if (confirm('Are you sure you want to clear the chat history?')) {
                    this.clearChatWindow();
                    if (this.clearChatCallback) this.clearChatCallback();
                }
            });
        }
    }

    /**
     * Adds a message to the chat window
     * @param {string} sender - The sender ('user' or 'ai')
     * @param {string} text - The message text
     * @returns {Element} - The created message element
     */
    addMessage(sender, text) {
        const chatWindow = getElement('#chat-window');
        if (!chatWindow) return null;
        
        const messageElement = createFromTemplate('message-template');
        if (!messageElement) return null;
        
        // Set appropriate class based on sender
        messageElement.classList.add(`${sender}-message`);
        
        // Format the message text
        this.updateMessageContent(messageElement, text);
        
        // Add to chat window and scroll into view
        chatWindow.appendChild(messageElement);
        messageElement.scrollIntoView({ behavior: 'smooth', block: 'end' });
        
        return messageElement;
    }

    /**
     * Clears all messages from the chat window
     */
    clearChatWindow() {
        const chatWindow = getElement('#chat-window');
        if (chatWindow) chatWindow.innerHTML = '';
    }

    /**
     * Updates the content of a message element
     * @param {Element} messageElement - The message element to update
     * @param {string} text - The new text content
     */
    updateMessageContent(messageElement, text) {
        if (!messageElement) return;
        
        const contentElement = messageElement.querySelector('.chat-app__message-content');
        if (!contentElement) return;
        
        // Remove existing toggle button if present
        const existingToggle = messageElement.querySelector('.toggle-thinking');
        if (existingToggle) {
            existingToggle.remove();
        }
        
        // Add thinking indicator if it's a thinking message
        if (text === '🤔 Thinking...') {
            contentElement.className = 'chat-app__message-content thinking-indicator';
            contentElement.textContent = 'Thinking...';
            return;
        }
        
        // Reset content element class
        contentElement.className = 'chat-app__message-content';
        
        // Format code blocks and check for structured reasoning
        if (text.includes('```')) {
            // Render code blocks
            contentElement.innerHTML = this.formatCodeBlocks(text);
        } else {
            // Apply regular text formatting
            contentElement.innerHTML = this.formatTextWithReasoningHighlights(text);
        }
        
        // Add toggle button for CoT responses if they have thinking
        if (text.includes('Thinking:') && text.includes('Answer:') && messageElement.classList.contains('ai-message')) {
            const toggleButton = document.createElement('button');
            toggleButton.className = 'toggle-thinking';
            toggleButton.textContent = 'Hide thinking';
            toggleButton.setAttribute('data-expanded', 'true');
            
            // Add button after the content
            contentElement.parentNode.insertBefore(toggleButton, contentElement.nextSibling);
        }
    }
    
    /**
     * Formats text with highlighting for reasoning sections
     * @param {string} text - The text to format
     * @returns {string} - HTML formatted text
     */
    formatTextWithReasoningHighlights(text) {
        // Escape any HTML first
        let escapedText = this.escapeHtml(text);
        
        // Replace newlines with <br> tags
        let formattedText = escapedText.replace(/\n/g, '<br>');
        
        // Check for and highlight reasoning patterns
        if (text.includes('Thinking:') && text.includes('Answer:')) {
            // Split into thinking and answer sections
            const thinkingMatch = text.match(/Thinking:(.*?)(?=Answer:|$)/s);
            const answerMatch = text.match(/Answer:(.*?)$/s);
            
            if (thinkingMatch && answerMatch) {
                const thinkingContent = this.escapeHtml(thinkingMatch[1].trim());
                const answerContent = this.escapeHtml(answerMatch[1].trim());
                
                formattedText = `<div class="thinking-section"><strong>Thinking:</strong><br>${thinkingContent.replace(/\n/g, '<br>')}</div>
                                <div class="answer-section"><strong>Answer:</strong><br>${answerContent.replace(/\n/g, '<br>')}</div>`;
            }
        }
        
        return formattedText;
    }
    
    /**
     * Safely escapes HTML
     * @param {string} html - The string to escape
     * @returns {string} - Escaped HTML string
     */
    escapeHtml(html) {
        const div = document.createElement('div');
        div.textContent = html;
        return div.innerHTML;
    }
    
    /**
     * Formats code blocks in message text
     * @param {string} text - The text containing code blocks
     * @returns {string} - HTML formatted text with syntax highlighting
     */
    formatCodeBlocks(text) {
        // Escape HTML first to prevent injection
        let escapedText = this.escapeHtml(text);
        
        // Format code blocks
        let formattedText = escapedText.replace(/```(\w*)([\s\S]*?)```/g, (match, language, code) => {
            const trimmedCode = code.trim();
            const langClass = language ? ` class="language-${language}"` : '';
            
            return `<pre class="code-block"><code${langClass}>${trimmedCode}</code></pre>`;
        });
        
        // Convert newlines outside code blocks to <br>
        formattedText = formattedText.replace(/^(.+)$/gm, (match, line) => {
            if (!line.includes('<pre class="code-block">') && 
                !line.includes('</pre>') && 
                !line.includes('<code')) {
                return line + '<br>';
            }
            return line;
        });
        
        return formattedText;
    }
    
    /**
     * Gets the current user input
     * @returns {string} - The user input text
     */
    getUserInput() {
        const messageInput = getElement('#message-input');
        return messageInput ? messageInput.value.trim() : '';
    }
    
    /**
     * Clears the user input field
     */
    clearUserInput() {
        const messageInput = getElement('#message-input');
        if (messageInput) {
            messageInput.value = '';
            messageInput.style.height = 'auto';
        }
    }
    
    /**
     * Creates an empty AI message for streaming
     * @returns {Element} - The created message element
     */
    createEmptyAIMessage() {
        return this.addMessage('ai', '');
    }
    
    /**
     * Updates the displayed token count
     * @param {number} count - The token count to display
     */
    updateTokenCount(count) {
        const tokenDisplay = getElement('#token-usage');
        if (tokenDisplay) {
            tokenDisplay.textContent = `Total tokens used: ${count}`;
        }
    }
    
    /**
     * Disables or enables the send button
     * @param {boolean} disabled - Whether to disable the button
     */
    setInputDisabled(disabled) {
        const messageInput = getElement('#message-input');
        const sendButton = getElement('#send-button');
        
        if (messageInput) messageInput.disabled = disabled;
        if (sendButton) sendButton.disabled = disabled;
    }
    
    /**
     * Shows a loading indicator in the input area
     * @param {boolean} isLoading - Whether AI is generating a response
     */
    setLoading(isLoading) {
        this.setInputDisabled(isLoading);
        
        // Add visual indicator for loading state
        const sendButton = getElement('#send-button');
        if (sendButton) {
            sendButton.textContent = isLoading ? '⏳' : 'Send';
            sendButton.classList.toggle('loading', isLoading);
        }
    }
}

export default UiController; 