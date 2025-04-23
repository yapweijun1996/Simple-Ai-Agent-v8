/**
 * Settings Controller Module - Manages application settings
 * Handles settings modal and persistence of user preferences
 */
import { getElement, createFromTemplate } from './utils.js';

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
    _onSettingsSaved = null;
    _modelSelect = null;
    _streamingToggle = null;
    _cotToggle = null;
    _showThinkingToggle = null;

    /**
     * Initializes the SettingsController.
     * @param {Function} onSettingsSaved - Callback function when settings are saved.
     */
    init(onSettingsSaved) {
        this._onSettingsSaved = onSettingsSaved;
        
        if (this._settingsModal) return;
        
        // Create modal from template
        this._settingsModal = createFromTemplate('settings-modal-template');
        document.body.appendChild(this._settingsModal);
        
        // Get UI elements
        this._modelSelect = getElement('#model-select');
        this._streamingToggle = getElement('#streaming-toggle');
        this._cotToggle = getElement('#cot-toggle');
        this._showThinkingToggle = getElement('#show-thinking-toggle');
        this._systemPromptSelect = getElement('#system-prompt-select');
        
        // Set initial values based on current settings
        if (this._streamingToggle) this._streamingToggle.checked = this._settings.streaming;
        if (this._cotToggle) this._cotToggle.checked = this._settings.enableCoT;
        if (this._showThinkingToggle) this._showThinkingToggle.checked = this._settings.showThinking;
        if (this._modelSelect) this._modelSelect.value = this._settings.selectedModel;
        
        // Add event listeners
        getElement('#save-settings').addEventListener('click', this._saveSettings.bind(this));
        getElement('#close-settings').addEventListener('click', this.hideSettingsModal.bind(this));
        
        // Close when clicking outside the modal content
        this._settingsModal.addEventListener('click', (event) => {
            if (event.target === this._settingsModal) {
                this.hideSettingsModal();
            }
        });

        // Populate system prompt dropdown
        this._populateSystemPrompts();

        // Load saved settings
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
        if (this._streamingToggle) this._streamingToggle.checked = this._settings.streaming;
        if (this._cotToggle) this._cotToggle.checked = this._settings.enableCoT;
        if (this._showThinkingToggle) this._showThinkingToggle.checked = this._settings.showThinking;
        if (this._modelSelect) this._modelSelect.value = this._settings.selectedModel;
        if (this._systemPromptSelect) this._systemPromptSelect.value = this._selectedSystemPromptTitle;
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
        if (!this._modelSelect || !this._streamingToggle || !this._cotToggle || !this._showThinkingToggle || !this._systemPromptSelect) return;

        const streamingEnabled = this._streamingToggle.checked;
        const cotEnabled = this._cotToggle.checked;
        const showThinkingEnabled = this._showThinkingToggle.checked;
        const selectedModelValue = this._modelSelect.value;
        this._selectedSystemPromptTitle = this._systemPromptSelect.value;
        
        this._settings = {
            ...this._settings,
            streaming: streamingEnabled,
            enableCoT: cotEnabled,
            showThinking: showThinkingEnabled,
            selectedModel: selectedModelValue
        };
        
        // Save settings to localStorage
        localStorage.setItem('selectedModel', selectedModelValue);
        localStorage.setItem('useStreaming', streamingEnabled.toString());
        localStorage.setItem('enableCot', cotEnabled.toString());
        localStorage.setItem('showThinking', showThinkingEnabled.toString());
        localStorage.setItem('selectedSystemPromptTitle', this._selectedSystemPromptTitle);
        
        // Hide modal
        this.hideSettingsModal();

        // Call the callback if it exists
        if (this._onSettingsSaved) {
            this._onSettingsSaved();
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

        this._settings.selectedModel = savedModel;
        this._settings.streaming = useStreaming;
        this._settings.enableCoT = enableCot;
        this._settings.showThinking = showThinking;
        this._selectedSystemPromptTitle = savedPromptTitle;
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