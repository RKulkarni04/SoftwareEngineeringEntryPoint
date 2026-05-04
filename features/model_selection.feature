# features/model_selection.feature
# Integration tests: UC-1 Select background models, UC-2 Local models, UC-3 Online web models
#
# Run: npx cucumber-js features/model_selection.feature

Feature: Model Selection
  As a student using EntryPoint
  I want to choose which AI model responds to my questions
  So that I can compare answers or pick the best tool for each discipline

  Background:
    Given I am logged in as a valid user
    And I have an active chat session

  # ── UC-1: Select background (Ollama local) models ────────────────────────────

  Scenario: Sidebar lists available models after page load
    When I navigate to the chat page
    Then the model list in the sidebar should be visible
    And the model list should contain at least one model entry

  Scenario: Single model mode is the default
    When I navigate to the chat page
    Then the "Single" mode button should be active
    And the "Compare" mode button should not be active

  @named-ollama-models
  Scenario: User selects a different local model
    When I navigate to the chat page
    And I click on a local model named "mistral" in the sidebar
    Then "mistral" should appear as the active model

  Scenario: User switches to Compare mode
    When I navigate to the chat page
    And I click the "Compare" mode button
    Then the "Compare" mode button should be active
    And a multi-model information banner should appear

  @named-ollama-models
  Scenario: User selects multiple models in Compare mode
    When I navigate to the chat page
    And I click the "Compare" mode button
    And I check the checkbox for model "llama3"
    And I check the checkbox for model "mistral"
    Then both "llama3" and "mistral" should be checked in the model list

  # ── UC-2: Local model (Ollama) ────────────────────────────────────────────────

  Scenario: Local models are shown under the "Local (Ollama)" provider section
    When I navigate to the chat page
    Then the model section should contain a "Local (Ollama)" provider heading

  Scenario: Sending a message via a local model returns a reply
    When I navigate to the chat page
    And I select the local model "llama3"
    And I type "What is 2 + 2?" in the chat input
    And I click the send button
    Then I should see an AI reply bubble appear

  Scenario: Switching from single to multi mode in the sidebar preserves subject selection
    When I navigate to the chat page
    And I select subject "Mathematics"
    And I click the "Compare" mode button
    Then the "Mathematics" subject button should still be active

  # ── UC-3: Online web models (cloud provider display) ─────────────────────────

  Scenario: Cloud model entries are listed even without API keys configured
    When I navigate to the chat page
    Then the model list should contain an entry for provider "claude"
    And the model list should contain an entry for provider "gemini"
    And the model list should contain an entry for provider "openai"

  Scenario: Cloud models without API keys show a "key needed" badge
    When I navigate to the chat page
    And no API keys are configured in the environment
    Then cloud model entries should display a "key needed" badge

  Scenario: Attempting to send via a cloud model without a key shows an error
    When I navigate to the chat page
    And I select a cloud model without an API key
    And I type "Hello" in the chat input
    And I click the send button
    Then I should see an error message mentioning an API key
