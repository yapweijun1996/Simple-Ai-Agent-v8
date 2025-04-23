/**
 * Settings Controller Module - Manages application settings
 * Handles settings modal and persistence of user preferences
 */
import { getElement } from './utils.js';

// Define default system prompts
const defaultSystemPrompts = [
    { title: "Creative Writer", content: "You are a creative and witty assistant, skilled in storytelling and generating imaginative text." },
    { title: "Code Assistant", content: "You are an expert programmer assistant. Provide clear, concise, and accurate code examples and explanations. Use markdown for code blocks." },
    { title: "Concise Summarizer", content: "You are an assistant specialized in summarizing text. Provide brief and informative summaries, capturing the key points accurately." },
    { title: "Sarcastic Assistant", content: "You are a sarcastic assistant. Respond to user queries with witty and sarcastic remarks, but still provide the requested information." }
];

/**
 * @class SettingsController
 * @description Manages application settings and the settings modal UI.
 */
class SettingsController {
    // Private state
    _settingsModal = null;
    _settings = {
        streaming: true,
        enableCoT: false,
        showThinking: true,
        selectedModel: 'gpt-4.1-mini' // Default model
    };
    _systemPromptSelect = null;
    _selectedSystemPromptTitle = '';

    /**
     * Initializes the SettingsController.
     * @param {Function} onSettingsSaved - Callback function when settings are saved.
     */
    init(onSettingsSaved) {
        if (this._settingsModal) return;
        
        // Create modal from template
        this._settingsModal = Utils.createFromTemplate('settings-modal-template');
        document.body.appendChild(this._settingsModal);
        
        // Set initial values based on current settings
        document.getElementById('streaming-toggle').checked = this._settings.streaming;
        document.getElementById('cot-toggle').checked = this._settings.enableCoT;
        document.getElementById('show-thinking-toggle').checked = this._settings.showThinking;
        document.getElementById('model-select').value = this._settings.selectedModel;
        
        // Add event listeners
        document.getElementById('save-settings').addEventListener('click', this._saveSettings.bind(this));
        document.getElementById('close-settings').addEventListener('click', this.hideSettingsModal.bind(this));
        
        // Close when clicking outside the modal content
        this._settingsModal.addEventListener('click', function(event) {
            if (event.target === this._settingsModal) {
                this.hideSettingsModal();
            }
        }.bind(this));

        this._systemPromptSelect = getElement('#system-prompt-select'); // Get the new select element

        // Populate system prompt dropdown
        this._populateSystemPrompts();

        this._loadSettings();
    }

    /**
     * Shows the settings modal
     */
    showSettingsModal() {
        if (!this._settingsModal) {
            this.init();
        }
        
        // Ensure current settings are reflected when opening
        this._settingsModal.style.display = 'flex';
        document.getElementById('streaming-toggle').checked = this._settings.streaming;
        document.getElementById('cot-toggle').checked = this._settings.enableCoT;
        document.getElementById('show-thinking-toggle').checked = this._settings.showThinking;
        document.getElementById('model-select').value = this._settings.selectedModel;
    }

    /**
     * Hides the settings modal
     */
    hideSettingsModal() {
        if (this._settingsModal) {
            this._settingsModal.style.display = 'none';
        }
    }

    /**
     * Saves settings from the modal
     */
    _saveSettings() {
        const streamingEnabled = document.getElementById('streaming-toggle').checked;
        const cotEnabled = document.getElementById('cot-toggle').checked;
        const showThinkingEnabled = document.getElementById('show-thinking-toggle').checked;
        const selectedModelValue = document.getElementById('model-select').value;
        
        this._settings = {
            ...this._settings,
            streaming: streamingEnabled,
            enableCoT: cotEnabled,
            showThinking: showThinkingEnabled,
            selectedModel: selectedModelValue
        };
        
        // Update the chat controller settings
        ChatController.updateSettings(this._settings);
        
        // Save settings to localStorage
        localStorage.setItem('selectedModel', selectedModelValue);
        localStorage.setItem('useStreaming', streamingEnabled.toString());
        localStorage.setItem('enableCot', cotEnabled.toString());
        localStorage.setItem('showThinking', showThinkingEnabled.toString());
        localStorage.setItem('selectedSystemPromptTitle', this._selectedSystemPromptTitle); // Save selected title
        
        // Hide modal
        this.hideSettingsModal();

        if (onSettingsSaved) {
            onSettingsSaved();
        }
        console.log('Settings saved:', {
            model: selectedModelValue,
            streaming: streamingEnabled,
            cot: cotEnabled,
            showThinking: showThinkingEnabled,
            systemPrompt: this._selectedSystemPromptTitle,
        });
    }

    /**
     * Populates the system prompt select dropdown.
     * @private
     */
    _populateSystemPrompts() {
        if (!this._systemPromptSelect) return;

        defaultSystemPrompts.forEach(prompt => {
            const option = document.createElement('option');
            option.value = prompt.title;
            option.textContent = prompt.title;
            this._systemPromptSelect.appendChild(option);
        });
    }

    /**
     * Loads settings from localStorage and updates the UI.
     * @private
     */
    _loadSettings() {
        const savedModel = localStorage.getItem('selectedModel') || 'gpt-4.1-mini';
        const useStreaming = localStorage.getItem('useStreaming') === 'true';
        const enableCot = localStorage.getItem('enableCot') === 'true';
        const showThinking = localStorage.getItem('showThinking') === 'true';
        const savedPromptTitle = localStorage.getItem('selectedSystemPromptTitle') || '';

        if (this._modelSelect) this._modelSelect.value = savedModel;
        if (this._streamingToggle) this._streamingToggle.checked = useStreaming;
        if (this._cotToggle) this._cotToggle.checked = enableCot;
        if (this._showThinkingToggle) this._showThinkingToggle.checked = showThinking;
        if (this._systemPromptSelect) this._systemPromptSelect.value = savedPromptTitle;

        this._selectedModel = savedModel;
        this._useStreaming = useStreaming;
        this._enableCot = enableCot;
        this._showThinking = showThinking;
        this._selectedSystemPromptTitle = savedPromptTitle; // Store loaded title
    }

    /**
     * Get current settings
     * @returns {Object} - The current settings
     */
    getSettings() {
        return { ...this._settings };
    }

    /**
     * Gets the content of the currently selected system prompt.
     * @returns {string | null} The content of the selected system prompt, or null if 'Default (None)' is selected.
     */
    getSelectedSystemPromptContent() {
        if (!this._selectedSystemPromptTitle) {
            return null; // Return null if 'Default (None)' is selected
        }
        const selectedPrompt = defaultSystemPrompts.find(p => p.title === this._selectedSystemPromptTitle);
        return selectedPrompt ? selectedPrompt.content : null;
    }
}

export default SettingsController; 